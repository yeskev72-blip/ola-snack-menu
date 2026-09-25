/**
 * Appel REST à l'API Gemini (generateContent) avec sortie JSON structurée.
 * Sans dépendance : `fetch` est injectable pour les tests.
 */

export type GeminiConfig = {
  apiKey: string;
  /** Racine de l'API ; modifiable pour les tests ou un proxy. */
  apiBase: string;
  /** Ex. « gemini-3.8-flash » : lu depuis la variable GEMINI_MODEL. */
  model: string;
  /** null = valeur par défaut du modèle. */
  temperature: number | null;
  /** Niveau de réflexion des modèles Gemini 3 : « low » pour limiter coût et latence. null = non envoyé. */
  thinkingLevel: 'minimal' | 'low' | 'medium' | 'high' | null;
  /** Borne commune à la réflexion et à la réponse. */
  maxOutputTokens: number;
  timeoutMs: number;
};

export type GeminiUsage = {
  promptTokens: number | null;
  outputTokens: number | null;
  thoughtsTokens: number | null;
  totalTokens: number | null;
};

export type GeminiResult =
  | { ok: true; text: string; usage: GeminiUsage; latencyMs: number; model?: string }
  | {
    ok: false;
    error: string;
    retryable: boolean;
    /** Modèle saturé ou indisponible (429, 5xx, délai dépassé) : un autre modèle peut répondre. */
    overloaded?: boolean;
    usage: GeminiUsage;
    latencyMs: number;
    model?: string;
  };

export type GeminiRequest = {
  systemPrompt: string;
  userText: string;
  imageBase64: string;
  responseSchema: unknown;
};

export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const emptyUsage: GeminiUsage = { promptTokens: null, outputTokens: null, thoughtsTokens: null, totalTokens: null };

function readUsage(body: unknown): GeminiUsage {
  const u = (body as { usageMetadata?: Record<string, unknown> } | null)?.usageMetadata;
  if (!u) return emptyUsage;
  const n = (v: unknown) => (typeof v === 'number' ? v : null);
  return {
    promptTokens: n(u.promptTokenCount),
    outputTokens: n(u.candidatesTokenCount),
    thoughtsTokens: n(u.thoughtsTokenCount),
    totalTokens: n(u.totalTokenCount),
  };
}

export function buildGeminiBody(config: GeminiConfig, req: GeminiRequest) {
  return {
    systemInstruction: { parts: [{ text: req.systemPrompt }] },
    contents: [
      {
        role: 'user',
        parts: [{ inlineData: { mimeType: 'image/jpeg', data: req.imageBase64 } }, { text: req.userText }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: req.responseSchema,
      ...(config.temperature === null ? {} : { temperature: config.temperature }),
      maxOutputTokens: config.maxOutputTokens,
      ...(config.thinkingLevel === null ? {} : { thinkingConfig: { thinkingLevel: config.thinkingLevel } }),
    },
  };
}

export async function callGemini(config: GeminiConfig, req: GeminiRequest, fetchImpl: typeof fetch = fetch): Promise<GeminiResult> {
  const started = Date.now();
  const elapsed = () => Date.now() - started;

  let response: Response;
  try {
    response = await fetchImpl(`${config.apiBase}/${encodeURIComponent(config.model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey },
      body: JSON.stringify(buildGeminiBody(config, req)),
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
    const message = (body as { error?: { message?: string } } | null)?.error?.message ?? response.statusText;
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

  const candidate = (body as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[] } | null)
    ?.candidates?.[0];
  // Les parties marquées « thought » (résumé de réflexion) ne font pas partie de la réponse.
  const text = candidate?.content?.parts
    ?.filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text)
    .join('');

  if (!text) {
    const reason = candidate?.finishReason ?? (body as { promptFeedback?: { blockReason?: string } } | null)?.promptFeedback?.blockReason;
    return { ok: false, error: `réponse vide (${reason ?? 'inconnu'})`, retryable: true, usage, latencyMs: elapsed(), model: config.model };
  }
  return { ok: true, text, usage, latencyMs: elapsed(), model: config.model };
}

export type ResilienceOptions = {
  /** Attentes avant chaque nouvel essai du même modèle saturé (ex. [1000, 3000] = 3 essais). */
  retryDelaysMs: number[];
  /** Durée maximale de l'ensemble des essais, pour répondre avant que l'app abandonne. */
  budgetMs: number;
  sleep?: (ms: number) => Promise<void>;
  fetchImpl?: typeof fetch;
  onFailure?: (result: GeminiResult) => void;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Appelle les modèles dans l'ordre (principal puis secours). Un modèle saturé (429, 5xx) est
 * réessayé après une courte attente, puis on passe au suivant ; une erreur définitive (clé, requête)
 * ou un délai dépassé passe directement au suivant. Renvoie le premier succès, sinon le dernier échec.
 */
export async function callGeminiResilient(
  configs: GeminiConfig[],
  req: GeminiRequest,
  options: ResilienceOptions,
): Promise<GeminiResult> {
  const sleep = options.sleep ?? defaultSleep;
  const started = Date.now();
  const remaining = () => options.budgetMs - (Date.now() - started);
  const MIN_CALL_MS = 5_000;

  let last: GeminiResult | null = null;
  for (const config of configs) {
    for (let attempt = 0; attempt <= options.retryDelaysMs.length; attempt++) {
      if (attempt > 0) {
        const delay = options.retryDelaysMs[attempt - 1]!;
        if (remaining() - delay < MIN_CALL_MS) break;
        await sleep(delay);
      }
      if (last && remaining() < MIN_CALL_MS) return last;
      const result = await callGemini({ ...config, timeoutMs: Math.min(config.timeoutMs, Math.max(remaining(), MIN_CALL_MS)) }, req, options.fetchImpl);
      if (result.ok) return result;
      last = result;
      options.onFailure?.(result);
      // Seul un modèle saturé qui a répondu vite mérite un nouvel essai ; sinon on change de modèle.
      if (!result.overloaded || result.error === 'timeout') break;
    }
  }
  return last!;
}
