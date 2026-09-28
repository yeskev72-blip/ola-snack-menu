/**
 * Appel à une passerelle IA compatible OpenAI (POST /chat/completions), quand la facturation
 * directe des fournisseurs n'est pas utilisable — leurs cartes prépayées sont refusées.
 *
 * Par défaut RodiumAi, qui se recharge par Mobile Money et facture un crédit prépayé : le solde se
 * consomme requête par requête, et plus de solde signifie plus d'appel, jamais de facture surprise.
 * Fonctionne avec toute autre passerelle du même format (OpenRouter…) en changeant GATEWAY_API_BASE.
 *
 * Renvoie le même type `GeminiResult` que gemini.ts pour rester interchangeable dans analyze-meal.
 */

import type { GeminiRequest, GeminiResult, GeminiUsage } from './gemini.ts';

export type GatewayConfig = {
  apiKey: string;
  /** Racine de l'API, sans barre finale ; modifiable pour changer de passerelle ou pour les tests. */
  apiBase: string;
  /** Identifiant préfixé par le fournisseur, ex. « google/gemini-2.5-flash-lite ». */
  model: string;
  maxOutputTokens: number;
  timeoutMs: number;
};

export const RODIUM_API_BASE = 'https://api.rodiumai.io/v1';

const emptyUsage: GeminiUsage = { promptTokens: null, outputTokens: null, thoughtsTokens: null, totalTokens: null };

function readUsage(body: unknown): GeminiUsage {
  const u = (body as { usage?: Record<string, unknown> } | null)?.usage;
  if (!u) return emptyUsage;
  const n = (v: unknown) => (typeof v === 'number' ? v : null);
  return { promptTokens: n(u.prompt_tokens), outputTokens: n(u.completion_tokens), thoughtsTokens: null, totalTokens: n(u.total_tokens) };
}

type ApiError = { error?: { message?: string; code?: number | string } };

/** Message d'erreur renvoyé par la passerelle (ou le modèle sous-jacent qu'elle relaie). */
export function errorMessage(body: unknown): string | null {
  return (body as ApiError | null)?.error?.message ?? null;
}

export function buildGatewayBody(config: GatewayConfig, req: GeminiRequest) {
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

export async function callGateway(config: GatewayConfig, req: GeminiRequest, fetchImpl: typeof fetch = fetch): Promise<GeminiResult> {
  const started = Date.now();
  const elapsed = () => Date.now() - started;

  let response: Response;
  try {
    response = await fetchImpl(`${config.apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
        // Identifie l'app dans le tableau de bord des passerelles qui le lisent ; ignoré par les autres.
        'HTTP-Referer': 'https://github.com/yeskev72-blip/ola-snack-menu',
        'X-Title': 'Calbasse',
      },
      body: JSON.stringify(buildGatewayBody(config, req)),
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

export type GatewayResilienceOptions = {
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
export async function callGatewayResilient(
  configs: GatewayConfig[],
  req: GeminiRequest,
  options: GatewayResilienceOptions,
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
      const result = await callGateway({ ...config, timeoutMs }, req, options.fetchImpl);
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
