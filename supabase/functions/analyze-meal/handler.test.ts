// Les doublures async imitent des interfaces qui renvoient des promesses.
// deno-lint-ignore-file require-await
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FOODS, JPEG_B64, VALID_OUTPUT } from '../_shared/fixtures.ts';
import type { GeminiResult } from '../_shared/gemini.ts';
import { type AuthUser, type CallLog, createHandler, type Deps } from './handler.ts';

const SCAN_ID = '6f1c2f4e-8b1a-4c43-9a51-3d2f0e6b7a10';
const usage = { promptTokens: 1000, outputTokens: 150, thoughtsTokens: 80, totalTokens: 1230 };
const okText = (body: unknown): GeminiResult => ({ ok: true, text: JSON.stringify(body), usage, latencyMs: 900 });

/** Doublures en mémoire : enregistrent les appels pour les vérifications. */
type SetupOptions = {
  user?: AuthUser | null;
  quota?: number;
  used?: number;
  gemini?: GeminiResult[];
  followUpAvailable?: boolean;
  /** Empreinte enregistrée lors du scan initial (la relance doit porter sur la même photo). */
  initialFingerprint?: string;
  failCreateScan?: boolean;
};

function setup(opts: SetupOptions = {}) {
  const calls = {
    consume: 0,
    release: 0,
    releaseFollowUp: 0,
    gemini: 0,
    logs: [] as CallLog[],
    prompts: [] as string[],
    fingerprints: [] as string[],
  };
  let used = opts.used ?? 0;
  const quota = opts.quota ?? 3;
  const replies = [...(opts.gemini ?? [okText(VALID_OUTPUT)])];
  let followUp = opts.followUpAvailable ?? true;

  const deps: Deps = {
    model: 'gemini-3.8-flash',
    maxAttempts: 2,
    getUser: async (token) => (token === 'jeton-valide' ? (opts.user === undefined ? { id: 'u1', isAnonymous: false } : opts.user) : null),
    consumeScan: async () => {
      calls.consume++;
      if (used >= quota) return { allowed: false, used, quota };
      used++;
      return { allowed: true, used, quota };
    },
    releaseScan: async () => {
      calls.release++;
      used--;
    },
    createScan: async (_userId, sha) => {
      calls.fingerprints.push(sha);
      if (opts.failCreateScan) throw new Error('base indisponible');
      return SCAN_ID;
    },
    claimFollowUp: async (scanId, _userId, sha) => {
      if (scanId !== SCAN_ID || !followUp || sha !== (opts.initialFingerprint ?? sha)) return false;
      followUp = false;
      return true;
    },
    releaseFollowUp: async () => {
      calls.releaseFollowUp++;
      followUp = true;
    },
    loadFoods: async () => FOODS,
    gemini: async (req) => {
      calls.gemini++;
      calls.prompts.push(req.userText);
      return replies.shift() ?? { ok: false, error: 'plus de réponse prévue', retryable: false, usage, latencyMs: 1 };
    },
    logCall: async (log) => {
      calls.logs.push(log);
    },
    storePhoto: async () => null,
    log: () => undefined,
  };
  const handle = createHandler(deps);
  const post = (body: unknown, token = 'jeton-valide') =>
    handle(
      new Request('http://localhost/analyze-meal', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
  return { post, handle, calls, used: () => used };
}

const scan = { image_base64: JPEG_B64, hint: 'riz sauce arachide' };
const followUp = { image_base64: JPEG_B64, scan_id: SCAN_ID, answers: [{ question: 'Sauce ?', answer: 'Graine' }] };

test('refuse sans jeton valide', async () => {
  const { post, calls } = setup();
  const res = await post(scan, 'faux');
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error, 'unauthorized');
  assert.equal(calls.consume, 0);
});

test('requête invalide : 400 sans consommer de scan', async () => {
  const { post, calls } = setup();
  const res = await post({ image_base64: 'pas une image' });
  assert.equal(res.status, 400);
  assert.equal(calls.consume, 0);
});

test('scan réussi : analyse, scan_id, quota restant, questions', async () => {
  const { post, calls } = setup();
  const res = await post(scan);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.scan_id, SCAN_ID);
  assert.equal(body.items.length, 2);
  assert.equal(body.follow_up_allowed, true);
  assert.deepEqual(body.quota, { used: 1, quota: 3, remaining: 2 });
  assert.equal(calls.gemini, 1);
  assert.equal(calls.logs.length, 1);
  assert.equal(calls.logs[0]!.result.usage.totalTokens, 1230, 'tokens journalisés');
  assert.match(calls.prompts[0]!, /riz sauce arachide/);
});

test('4e scan gratuit refusé côté serveur, sans appel Gemini', async () => {
  const { post, calls } = setup({ used: 3 });
  const res = await post(scan);
  assert.equal(res.status, 429);
  const body = await res.json();
  assert.equal(body.error, 'quota_exceeded');
  assert.match(body.message, /3 scans/);
  assert.equal(calls.gemini, 0);
});

test('invité : message qui invite à créer un compte', async () => {
  const { post } = setup({ user: { id: 'g1', isAnonymous: true }, quota: 1, used: 1 });
  const body = await (await post(scan)).json();
  assert.match(body.message, /Crée un compte/);
});

test('réponse invalide puis valide : une seule relance', async () => {
  const { post, calls } = setup({ gemini: [{ ok: true, text: '{"cassé"', usage, latencyMs: 1 }, okText(VALID_OUTPUT)] });
  const res = await post(scan);
  assert.equal(res.status, 200);
  assert.equal(calls.gemini, 2);
  assert.equal(calls.logs.length, 2);
  assert.match(calls.logs[0]!.error ?? '', /réponse invalide/);
  assert.equal(calls.logs[1]!.error, null);
});

test('deux réponses invalides : erreur propre et scan rendu', async () => {
  const bad: GeminiResult = { ok: true, text: JSON.stringify({ ...VALID_OUTPUT, items: [] }), usage, latencyMs: 1 };
  const { post, calls, used } = setup({ gemini: [bad, bad, okText(VALID_OUTPUT)] });
  const res = await post(scan);
  assert.equal(res.status, 502);
  assert.equal((await res.json()).error, 'analysis_failed');
  assert.equal(calls.gemini, 2, 'pas de troisième appel');
  assert.equal(calls.release, 1);
  assert.equal(used(), 0, 'le scan n’est pas décompté');
});

test('erreur Gemini non relançable (ex. clé invalide) : un seul appel', async () => {
  const { post, calls } = setup({ gemini: [{ ok: false, error: 'HTTP 400', retryable: false, usage, latencyMs: 1 }] });
  const res = await post(scan);
  assert.equal(res.status, 502);
  assert.equal(calls.gemini, 1);
  assert.equal(calls.release, 1);
});

test('modèles saturés : 503 « ai_busy », pas de relance, scan rendu, chaque essai journalisé', async () => {
  const earlier: GeminiResult = { ok: false, error: 'HTTP 503 : high demand', retryable: true, overloaded: true, usage, latencyMs: 1, model: 'principal' };
  const busy: GeminiResult = {
    ok: false,
    error: 'HTTP 400 : invalid argument',
    retryable: false,
    overloaded: true,
    usage,
    latencyMs: 1,
    model: 'secours',
    earlierFailures: [earlier, earlier],
  };
  const { post, calls, used } = setup({ gemini: [busy, okText(VALID_OUTPUT)] });
  const res = await post(scan);
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.error, 'ai_busy');
  assert.match(body.message, /saturé/);
  assert.equal(calls.gemini, 1, 'deps.gemini a déjà réessayé : pas de second passage');
  assert.deepEqual(calls.logs.map((l) => [l.model, l.error]), [
    ['principal', 'HTTP 503 : high demand'],
    ['principal', 'HTTP 503 : high demand'],
    ['secours', 'HTTP 400 : invalid argument'],
  ]);
  assert.equal(used(), 0);
});

test('relance après questions : gratuite, une seule fois, sans nouvelles questions', async () => {
  const { post, calls } = setup();
  const res = await post(followUp);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(calls.consume, 0, 'pas de quota consommé');
  assert.deepEqual(body.questions, []);
  assert.equal(body.follow_up_allowed, false);
  assert.equal(body.quota, null);
  assert.match(calls.prompts[0]!, /Sauce \? → Graine/);

  const again = await post(followUp);
  assert.equal(again.status, 409);
  assert.equal((await again.json()).error, 'follow_up_not_allowed');
});

test('relance refusée avec une autre photo que le scan initial', async () => {
  const { post, calls } = setup({ initialFingerprint: 'f'.repeat(64) });
  const res = await post(followUp);
  assert.equal(res.status, 409);
  assert.equal(calls.gemini, 0);
});

test('empreinte SHA-256 de la photo enregistrée avec le scan', async () => {
  const { post, calls } = setup();
  await post(scan);
  assert.match(calls.fingerprints[0]!, /^[0-9a-f]{64}$/);
});

test('panne de base après consommation du quota : erreur propre et scan rendu', async () => {
  const { post, calls, used } = setup({ failCreateScan: true });
  const res = await post(scan);
  assert.equal(res.status, 500);
  assert.equal((await res.json()).error, 'internal_error');
  assert.equal(calls.release, 1);
  assert.equal(used(), 0);
  assert.equal(calls.gemini, 0);
});

test('relance en échec : la relance est rendue', async () => {
  const { post, calls } = setup({ gemini: [{ ok: false, error: 'timeout', retryable: true, usage, latencyMs: 1 }] });
  const res = await post(followUp);
  assert.equal(res.status, 502);
  assert.equal(calls.releaseFollowUp, 1);
  assert.equal(calls.release, 0);
});

test('méthodes : OPTIONS (CORS) et GET refusé', async () => {
  const { handle } = setup();
  assert.equal((await handle(new Request('http://localhost', { method: 'OPTIONS' }))).status, 204);
  assert.equal((await handle(new Request('http://localhost', { method: 'GET' }))).status, 405);
});
