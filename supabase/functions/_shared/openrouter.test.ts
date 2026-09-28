// Les doublures async imitent des interfaces qui renvoient des promesses.
// deno-lint-ignore-file require-await
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildOpenRouterBody, callOpenRouter, callOpenRouterResilient, OPENROUTER_API_BASE, type OpenRouterConfig } from './openrouter.ts';
import type { GeminiRequest } from './gemini.ts';

const config: OpenRouterConfig = {
  apiKey: 'cle-de-test',
  apiBase: OPENROUTER_API_BASE,
  model: 'google/gemini-2.5-flash-lite',
  maxOutputTokens: 4096,
  timeoutMs: 1000,
};
const request: GeminiRequest = { systemPrompt: 'système', userText: 'analyse', imageBase64: '/9j/AAAA', responseSchema: { type: 'OBJECT' } };

const reply = (status: number, body: unknown): typeof fetch =>
  (async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;

test('corps de requête : image en data URL, JSON forcé', () => {
  const body = buildOpenRouterBody(config, request);
  assert.equal(body.model, 'google/gemini-2.5-flash-lite');
  assert.equal(body.messages[0]!.role, 'system');
  assert.equal(body.messages[0]!.content, 'système');
  const userContent = body.messages[1]!.content as { type: string; text?: string; image_url?: { url: string } }[];
  assert.equal(userContent[0]!.text, 'analyse');
  assert.equal(userContent[1]!.image_url!.url, 'data:image/jpeg;base64,/9j/AAAA');
  assert.deepEqual(body.response_format, { type: 'json_object' });
});

test('appel : clé en en-tête Authorization Bearer', async () => {
  let seenUrl = '';
  let seenAuth: string | null = null;
  const fake = (async (url: string, init: RequestInit) => {
    seenUrl = url;
    seenAuth = new Headers(init.headers).get('Authorization');
    return new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }] }), { status: 200 });
  }) as unknown as typeof fetch;
  await callOpenRouter(config, request, fake);
  assert.equal(seenUrl, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(seenAuth, 'Bearer cle-de-test');
});

test('succès : texte + tokens', async () => {
  const r = await callOpenRouter(
    config,
    request,
    reply(200, { choices: [{ message: { content: '{"ok":true}' } }], usage: { prompt_tokens: 1500, completion_tokens: 200, total_tokens: 1700 } }),
  );
  assert.ok(r.ok);
  assert.equal(r.text, '{"ok":true}');
  assert.deepEqual(r.usage, { promptTokens: 1500, outputTokens: 200, thoughtsTokens: null, totalTokens: 1700 });
});

test('erreurs : 429/500 relançables, 400 non', async () => {
  const r429 = await callOpenRouter(config, request, reply(429, { error: { message: 'rate limited' } }));
  assert.ok(!r429.ok && r429.retryable);
  const r500 = await callOpenRouter(config, request, reply(503, { error: { message: 'indisponible' } }));
  assert.ok(!r500.ok && r500.retryable);
  const r400 = await callOpenRouter(config, request, reply(400, { error: { message: 'modèle inconnu' } }));
  assert.ok(!r400.ok && !r400.retryable);
  assert.match(r400.error, /HTTP 400 : modèle inconnu/);
});

test('réponse vide ou tronquée', async () => {
  const r = await callOpenRouter(config, request, reply(200, { choices: [{ message: {}, finish_reason: 'length' }] }));
  assert.ok(!r.ok);
  assert.match(r.error, /length/);
});

test('coupure réseau et délai dépassé', async () => {
  const down = (async () => {
    throw new TypeError('fetch failed');
  }) as typeof fetch;
  const r = await callOpenRouter(config, request, down);
  assert.ok(!r.ok && r.retryable);

  const slow = ((_url: string, init: RequestInit) =>
    new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
    })) as unknown as typeof fetch;
  const keepAlive = setTimeout(() => undefined, 1000);
  const t = await callOpenRouter({ ...config, timeoutMs: 20 }, request, slow);
  clearTimeout(keepAlive);
  assert.ok(!t.ok);
  assert.equal(t.error, 'timeout');
});

/** Répond selon le modèle demandé : une file de statuts par modèle, et la liste des modèles appelés. */
function byModel(statuses: Record<string, number[]>) {
  const seen: string[] = [];
  const fetchImpl = (async (_url: string, init: RequestInit) => {
    const model = (JSON.parse(String(init.body)) as { model: string }).model;
    seen.push(model);
    const status = statuses[model]!.shift() ?? 503;
    const body = status === 200 ? { choices: [{ message: { content: '{}' } }] } : { error: { message: 'high demand' } };
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { seen, fetchImpl };
}
const secours: OpenRouterConfig = { ...config, model: 'google/gemini-flash-latest' };
const noWait = { retryDelaysMs: [1000, 3000], budgetMs: 50_000, sleep: async () => undefined };

test('saturation : même modèle réessayé, succès au 2e essai', async () => {
  const { seen, fetchImpl } = byModel({ 'google/gemini-2.5-flash-lite': [503, 200] });
  const r = await callOpenRouterResilient([config, secours], request, { ...noWait, fetchImpl });
  assert.ok(r.ok);
  assert.equal(r.model, 'google/gemini-2.5-flash-lite');
  assert.deepEqual(seen, ['google/gemini-2.5-flash-lite', 'google/gemini-2.5-flash-lite']);
});

test('quota dépassé (429) : passage direct au secours', async () => {
  const { seen, fetchImpl } = byModel({ 'google/gemini-2.5-flash-lite': [429], 'google/gemini-flash-latest': [200] });
  const r = await callOpenRouterResilient([config, secours], request, { ...noWait, fetchImpl });
  assert.ok(r.ok);
  assert.deepEqual(seen, ['google/gemini-2.5-flash-lite', 'google/gemini-flash-latest']);
});

test('tout est saturé : dernier échec renvoyé, marqué « overloaded »', async () => {
  const { seen, fetchImpl } = byModel({ 'google/gemini-2.5-flash-lite': [], 'google/gemini-flash-latest': [] });
  const r = await callOpenRouterResilient([config, secours], request, { ...noWait, fetchImpl });
  assert.ok(!r.ok && r.overloaded);
  assert.equal(seen.length, 6);
});
