// Les doublures async imitent des interfaces qui renvoient des promesses.
// deno-lint-ignore-file require-await
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildGeminiBody, callGemini, callGeminiResilient, GEMINI_API_BASE, type GeminiConfig, type GeminiRequest } from './gemini.ts';

const config: GeminiConfig = {
  apiKey: 'cle-de-test',
  apiBase: GEMINI_API_BASE,
  model: 'gemini-3.8-flash',
  temperature: 0.3,
  thinkingLevel: 'low',
  maxOutputTokens: 4096,
  timeoutMs: 1000,
};
const request: GeminiRequest = { systemPrompt: 'système', userText: 'analyse', imageBase64: '/9j/AAAA', responseSchema: { type: 'OBJECT' } };

const reply = (status: number, body: unknown): typeof fetch =>
  (async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;

test('corps de requête : image, schéma, réflexion basse, température', () => {
  const body = buildGeminiBody(config, request);
  assert.deepEqual(body.contents[0]!.parts[0], { inlineData: { mimeType: 'image/jpeg', data: '/9j/AAAA' } });
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  assert.deepEqual(body.generationConfig.responseSchema, { type: 'OBJECT' });
  assert.deepEqual(body.generationConfig.thinkingConfig, { thinkingLevel: 'low' });
  assert.equal(body.generationConfig.temperature, 0.3);
  assert.equal('temperature' in buildGeminiBody({ ...config, temperature: null }, request).generationConfig, false);
  assert.equal('thinkingConfig' in buildGeminiBody({ ...config, thinkingLevel: null }, request).generationConfig, false);
});

test('appel : clé en en-tête (jamais dans l’URL), modèle dans le chemin', async () => {
  let seenUrl = '';
  let seenKey: string | null = null;
  const fake = (async (url: string, init: RequestInit) => {
    seenUrl = url;
    seenKey = new Headers(init.headers).get('x-goog-api-key');
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{}' }] } }] }), { status: 200 });
  }) as unknown as typeof fetch;
  await callGemini(config, request, fake);
  assert.equal(seenUrl, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent');
  assert.equal(seenKey, 'cle-de-test');
});

test('succès : texte sans les parties de réflexion + tokens', async () => {
  const r = await callGemini(
    config,
    request,
    reply(200, {
      candidates: [{ content: { parts: [{ text: 'résumé', thought: true }, { text: '{"ok":' }, { text: 'true}' }] } }],
      usageMetadata: { promptTokenCount: 1500, candidatesTokenCount: 200, thoughtsTokenCount: 300, totalTokenCount: 2000 },
    }),
  );
  assert.ok(r.ok);
  assert.equal(r.text, '{"ok":true}');
  assert.deepEqual(r.usage, { promptTokens: 1500, outputTokens: 200, thoughtsTokens: 300, totalTokens: 2000 });
});

test('erreurs : 429/500 relançables, 400 non', async () => {
  const r429 = await callGemini(config, request, reply(429, { error: { message: 'quota' } }));
  assert.ok(!r429.ok && r429.retryable);
  const r500 = await callGemini(config, request, reply(503, { error: { message: 'indisponible' } }));
  assert.ok(!r500.ok && r500.retryable);
  const r400 = await callGemini(config, request, reply(400, { error: { message: 'modèle inconnu' } }));
  assert.ok(!r400.ok && !r400.retryable);
  assert.match(r400.error, /HTTP 400 : modèle inconnu/);
});

test('réponse vide ou bloquée', async () => {
  const r = await callGemini(config, request, reply(200, { candidates: [{ finishReason: 'SAFETY', content: { parts: [] } }] }));
  assert.ok(!r.ok);
  assert.match(r.error, /SAFETY/);
});

test('coupure réseau et délai dépassé', async () => {
  const down = (async () => {
    throw new TypeError('fetch failed');
  }) as typeof fetch;
  const r = await callGemini(config, request, down);
  assert.ok(!r.ok && r.retryable);

  const slow = ((_url: string, init: RequestInit) =>
    new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
    })) as unknown as typeof fetch;
  // AbortSignal.timeout ne retient pas la boucle d'événements de Node : on la garde active.
  const keepAlive = setTimeout(() => undefined, 1000);
  const t = await callGemini({ ...config, timeoutMs: 20 }, request, slow);
  clearTimeout(keepAlive);
  assert.ok(!t.ok);
  assert.equal(t.error, 'timeout');
});

/** Répond selon le modèle demandé : une file de statuts par modèle, et la liste des modèles appelés. */
function byModel(statuses: Record<string, number[]>) {
  const seen: string[] = [];
  const fetchImpl = (async (url: string) => {
    const model = /models\/([^:]+):/.exec(url)![1]!;
    seen.push(model);
    const status = statuses[model]!.shift() ?? 503;
    const body = status === 200 ? { candidates: [{ content: { parts: [{ text: '{}' }] } }] } : { error: { message: 'high demand' } };
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { seen, fetchImpl };
}
const secours: GeminiConfig = { ...config, model: 'secours', thinkingLevel: null };
const noWait = { retryDelaysMs: [1000, 3000], budgetMs: 50_000, sleep: async () => undefined };

test('saturation : même modèle réessayé, succès au 2e essai', async () => {
  const { seen, fetchImpl } = byModel({ 'gemini-3.8-flash': [503, 200] });
  const r = await callGeminiResilient([config, secours], request, { ...noWait, fetchImpl });
  assert.ok(r.ok);
  assert.equal(r.model, 'gemini-3.8-flash');
  assert.deepEqual(seen, ['gemini-3.8-flash', 'gemini-3.8-flash']);
});

test('saturation persistante : 3 essais puis modèle de secours', async () => {
  const { seen, fetchImpl } = byModel({ 'gemini-3.8-flash': [503, 503, 503], secours: [200] });
  const failures: string[] = [];
  const r = await callGeminiResilient([config, secours], request, { ...noWait, fetchImpl, onFailure: (f) => failures.push(f.model!) });
  assert.ok(r.ok);
  assert.equal(r.model, 'secours');
  assert.deepEqual(seen, ['gemini-3.8-flash', 'gemini-3.8-flash', 'gemini-3.8-flash', 'secours']);
  assert.equal(failures.length, 3);
});

test('tout est saturé : dernier échec renvoyé, marqué « overloaded »', async () => {
  const { seen, fetchImpl } = byModel({ 'gemini-3.8-flash': [], secours: [] });
  const r = await callGeminiResilient([config, secours], request, { ...noWait, fetchImpl });
  assert.ok(!r.ok && r.overloaded);
  assert.equal(seen.length, 6);
});

test('erreur définitive (400) : pas de nouvel essai, passage direct au secours', async () => {
  const { seen, fetchImpl } = byModel({ 'gemini-3.8-flash': [400], secours: [200] });
  const r = await callGeminiResilient([config, secours], request, { ...noWait, fetchImpl });
  assert.ok(r.ok);
  assert.deepEqual(seen, ['gemini-3.8-flash', 'secours']);
});

test('budget épuisé : pas d’attente qui dépasserait le délai de l’app', async () => {
  const { seen, fetchImpl } = byModel({ 'gemini-3.8-flash': [], secours: [] });
  const r = await callGeminiResilient([config, secours], request, { ...noWait, budgetMs: 4_000, fetchImpl });
  assert.ok(!r.ok);
  assert.deepEqual(seen, ['gemini-3.8-flash']);
});
