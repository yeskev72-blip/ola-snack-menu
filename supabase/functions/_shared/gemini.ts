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
  /** Niveau de réflexion des modèles Gemini 3 : « low » pour limiter coût et latence. */
  thinkingLevel: 'minimal' | 'low' | 'medium' | 'high';
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
  | { ok: true; text: string; usage: GeminiUsage; latencyMs: number }
  | { ok: false; error: string; retryable: boolean; usage: GeminiUsage; latencyMs: number };

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
      thinkingConfig: { thinkingLevel: config.thinkingLevel },
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
    return { ok: false, error: timeout ? 'timeout' : `réseau : ${String(e)}`, retryable: true, usage: emptyUsage, latencyMs: elapsed() };
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
      usage,
      latencyMs: elapsed(),
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
    return { ok: false, error: `réponse vide (${reason ?? 'inconnu'})`, retryable: true, usage, latencyMs: elapsed() };
  }
  return { ok: true, text, usage, latencyMs: elapsed() };
}
