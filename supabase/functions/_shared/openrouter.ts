/**
 * Appel à l'API OpenRouter (chat/completions, compatible OpenAI) pour les mêmes modèles Gemini,
 * quand la facturation Google directe n'est pas utilisable (ex. carte prépayée refusée). Le crédit
 * OpenRouter se dépose à l'avance (carte ou crypto) et se consomme requête par requête : plus de solde,
 * plus d'appel — jamais de facture surprise.
 *
 * Renvoie le même type `GeminiResult` que gemini.ts pour rester interchangeable dans analyze-meal.
 */

import type { GeminiRequest, GeminiResult, GeminiUsage } from './gemini.ts';

export type OpenRouterConfig = {
  apiKey: string;
  /** Racine de l'API ; modifiable pour les tests. */
  apiBase: string;
  /** Ex. « google/gemini-2.5-flash-lite » : lu depuis la variable OPENROUTER_MODEL. */
  model: string;
  maxOutputTokens: number;
  timeoutMs: number;
};

export const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';

const emptyUsage: GeminiUsage = { promptTokens: null, outputTokens: null, thoughtsTokens: null, totalTokens: null };

function readUsage(body: unknown): GeminiUsage {
  const u = (body as { usage?: Record<string, unknown> } | null)?.usage;
  if (!u) return emptyUsage;
  const n = (v: unknown) => (typeof v === 'number' ? v : null);
  return { promptTokens: n(u.prompt_tokens), outputTokens: n(u.completion_tokens), thoughtsTokens: null, totalTokens: n(u.total_tokens) };
}

type ApiError = { error?: { message?: string; code?: number | string } };

/** Message d'erreur renvoyé par OpenRouter (ou le modèle sous-jacent qu'il relaie). */
export function errorMessage(body: unknown): string | null {
  return (body as ApiError | null)?.error?.message ?? null;
}

export function buildOpenRouterBody(config: OpenRouterConfig, req: GeminiRequest) {
  return {
    model: config.model,
    messages: [
      { role: 'system', content: req.systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: req.userText },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${req.imageBase64}` } },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: config.maxOutputTokens,
  };
}

export async function callOpenRouter(config: OpenRouterConfig, req: GeminiRequest, fetchImpl: typeof fetch = fetch): Promise<GeminiResult> {
  const started = Date.now();
  const elapsed = () => Date.now() - started;

  let response: Response;
  try {
    response = await fetchImpl(`${config.apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
        // Recommandé par OpenRouter pour identifier l'app dans son tableau de bord ; sans effet sur la requête.
        'HTTP-Referer': 'https://github.com/yeskev72-blip/ola-snack-menu',
        'X-Title': 'Calbasse',
      },
      body: JSON.stringify(buildOpenRouterBody(config, req)),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (e) {
    const timeout = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
    return {
      ok: false,
      error: timeout ? 'timeout' : `réseau : ${String(e)}`,
      retryable: true,
      overloaded: true,
      usage: emptyUsage,
      latencyMs: elapsed(),
      model: config.model,
    };
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // corps non JSON : traité ci-dessous selon le statut
  }
  const usage = readUsage(body);

  if (!response.ok) {
    const message = errorMessage(body) ?? response.statusText;
    return {
      ok: false,
      error: `HTTP ${response.status} : ${message}`.slice(0, 500),
      retryable: response.status === 429 || response.status >= 500,
      overloaded: response.status === 429 || response.status >= 500,
      usage,
      latencyMs: elapsed(),
      model: config.model,
    };
  }

  const choice = (body as { choices?: { message?: { content?: string }; finish_reason?: string }[] } | null)?.choices?.[0];
  const text = choice?.message?.content;

  if (!text) {
    return { ok: false, error: `réponse vide (${choice?.finish_reason ?? 'inconnu'})`, retryable: true, usage, latencyMs: elapsed(), model: config.model };
  }
  return { ok: true, text, usage, latencyMs: elapsed(), model: config.model };
}

export type OpenRouterResilienceOptions = {
  /** Attentes avant chaque nouvel essai du même modèle saturé. */
  retryDelaysMs: number[];
  budgetMs: number;
  sleep?: (ms: number) => Promise<void>;
  fetchImpl?: typeof fetch;
  onFailure?: (result: GeminiResult) => void;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Même stratégie que callGeminiResilient (gemini.ts) : modèle saturé (429/5xx) réessayé sur place,
 * puis passage au modèle de secours suivant ; renvoie le premier succès, sinon le dernier échec.
 */
export async function callOpenRouterResilient(
  configs: OpenRouterConfig[],
  req: GeminiRequest,
  options: OpenRouterResilienceOptions,
): Promise<GeminiResult> {
  const sleep = options.sleep ?? defaultSleep;
  const started = Date.now();
  const remaining = () => options.budgetMs - (Date.now() - started);
  const MIN_CALL_MS = 5_000;

  let last: GeminiResult | null = null;
  let anyOverloaded = false;
  const failures: GeminiResult[] = [];
  const failure = (): GeminiResult => {
    const final = failures.pop()!;
    return { ...final, ...(anyOverloaded ? { overloaded: true } : {}), earlierFailures: failures };
  };
  for (const config of configs) {
    for (let attempt = 0; attempt <= options.retryDelaysMs.length; attempt++) {
      if (attempt > 0) {
        const delay = options.retryDelaysMs[attempt - 1]!;
        if (remaining() - delay < MIN_CALL_MS) break;
        await sleep(delay);
      }
      if (last && remaining() < MIN_CALL_MS) return failure();
      const timeoutMs = Math.min(config.timeoutMs, Math.max(remaining(), MIN_CALL_MS));
      const result = await callOpenRouter({ ...config, timeoutMs }, req, options.fetchImpl);
      if (result.ok) return { ...result, earlierFailures: failures };
      last = result;
      failures.push(result);
      if (result.overloaded) anyOverloaded = true;
      options.onFailure?.(result);
      if (!result.overloaded || result.error === 'timeout' || result.error.startsWith('HTTP 429')) break;
    }
  }
  return failure();
}
