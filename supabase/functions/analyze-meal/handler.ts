/**
 * Edge Function analyze-meal : logique HTTP, sans dépendance directe à Deno ni à Supabase.
 * index.ts fournit les vraies dépendances ; handler.test.ts des doublures.
 */

import {
  type Analysis,
  buildResponseSchema,
  buildSystemPrompt,
  buildUserText,
  type FoodRef,
  imageFingerprint,
  parseRequest,
  validateModelOutput,
} from '../_shared/analysis.ts';
import type { GeminiRequest, GeminiResult } from '../_shared/gemini.ts';

export type AuthUser = { id: string; isAnonymous: boolean };
export type QuotaState = { allowed: boolean; used: number; quota: number };
export type CallLog = {
  scanId: string;
  userId: string;
  kind: 'initial' | 'follow_up';
  attempt: number;
  model: string;
  result: GeminiResult;
  error: string | null;
};

export type Deps = {
  model: string;
  /** Nombre maximal d'appels Gemini par analyse (1 + une relance si réponse invalide). */
  maxAttempts: number;
  getUser: (token: string) => Promise<AuthUser | null>;
  consumeScan: (userId: string) => Promise<QuotaState>;
  releaseScan: (userId: string) => Promise<void>;
  createScan: (userId: string, imageSha256: string) => Promise<string>;
  /** Réserve la relance : même utilisateur, même photo, une seule fois. */
  claimFollowUp: (scanId: string, userId: string, imageSha256: string) => Promise<boolean>;
  releaseFollowUp: (scanId: string) => Promise<void>;
  loadFoods: () => Promise<FoodRef[]>;
  gemini: (req: GeminiRequest) => Promise<GeminiResult>;
  logCall: (log: CallLog) => Promise<void>;
  /** Stockage facultatif de la photo ; renvoie son chemin ou null. */
  storePhoto: (user: AuthUser, scanId: string, imageBase64: string) => Promise<string | null>;
  log: (message: string, extra?: Record<string, unknown>) => void;
};

export type SuccessBody = Analysis & {
  scan_id: string;
  /** true si l'app peut relancer une fois avec les réponses aux questions. */
  follow_up_allowed: boolean;
  quota: { used: number; quota: number; remaining: number } | null;
  photo_path: string | null;
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Quota Premium (scan_quota côté base) : en dessous, le message de refus propose Premium. */
const PREMIUM_DAILY_SCANS = 30;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  });
}

/** Erreur lisible par l'app (code stable) et par un humain (message en français). */
function fail(status: number, error: string, message: string, extra: Record<string, unknown> = {}): Response {
  return json(status, { error, message, ...extra });
}

export function createHandler(deps: Deps) {
  return async function handle(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
    if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Utilise POST.');

    // 1. Authentification (JWT Supabase de l'utilisateur, invité compris).
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim();
    const user = token ? await deps.getUser(token).catch(() => null) : null;
    if (!user) return fail(401, 'unauthorized', 'Connexion requise.');

    // 2. Validation de la requête.
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return fail(400, 'bad_request', 'Corps JSON invalide.');
    }
    const parsed = parseRequest(body);
    if (!parsed.ok) return fail(400, 'bad_request', parsed.error);
    const request = parsed.value;
    const isFollowUp = request.scanId !== null;

    // 3. Quota : un scan consomme 1 ; la relance après questions est gratuite, une seule fois,
    //    et seulement pour la même photo.
    // Relance : l'identifiant du scan initial ; nouveau scan : attribué après consommation du quota.
    let scanId = request.scanId ?? '';
    let quota: QuotaState | null = null;
    let charged = false;
    // Rend le scan (ou la relance) si l'analyse n'aboutit pas.
    const refund = async () => {
      if (!charged) return;
      try {
        if (isFollowUp) await deps.releaseFollowUp(scanId);
        else await deps.releaseScan(user.id);
      } catch (e) {
        deps.log('remboursement impossible', { scanId, error: String(e) });
      }
    };

    try {
      const fingerprint = await imageFingerprint(request.imageBase64);
      if (isFollowUp) {
        if (!(await deps.claimFollowUp(scanId, user.id, fingerprint))) {
          return fail(409, 'follow_up_not_allowed', 'Cette analyse a déjà été relancée ou a expiré. Refais un scan.');
        }
        charged = true;
      } else {
        quota = await deps.consumeScan(user.id);
        if (!quota.allowed) {
          const message = user.isAnonymous
            ? 'Tu as utilisé ton scan gratuit du jour. Crée un compte pour en avoir 2 par jour.'
            : quota.quota < PREMIUM_DAILY_SCANS
              ? `Tu as utilisé tes ${quota.quota} scans d'aujourd'hui. Passe Premium pour en avoir ${PREMIUM_DAILY_SCANS} par jour, ou reviens demain !`
              : `Tu as utilisé tes ${quota.quota} scans d'aujourd'hui. Reviens demain !`;
          return fail(429, 'quota_exceeded', message, { quota: { used: quota.used, quota: quota.quota, remaining: 0 } });
        }
        charged = true;
        scanId = await deps.createScan(user.id, fingerprint);
      }
    } catch (e) {
      deps.log('erreur quota', { error: String(e) });
      await refund();
      return fail(500, 'internal_error', "Erreur du serveur. Ton scan n'a pas été décompté, réessaie.");
    }

    try {
      // 4. Prompt construit à partir de la table foods, rechargée à chaque appel.
      const foods = await deps.loadFoods();
      const knownKeys = new Set(foods.map((f) => f.food_key));
      const geminiRequest: GeminiRequest = {
        systemPrompt: buildSystemPrompt(foods),
        userText: buildUserText(request),
        imageBase64: request.imageBase64,
        responseSchema: buildResponseSchema([...knownKeys]),
      };

      // 5. Appel Gemini + validation stricte, avec une seule relance si la réponse est invalide.
      let analysis: Analysis | null = null;
      let overloaded = false;
      for (let attempt = 1; attempt <= deps.maxAttempts && !analysis; attempt++) {
        const result = await deps.gemini(geminiRequest);
        overloaded = !result.ok && result.overloaded === true;
        let error: string | null = null;
        let retryable = false;
        if (result.ok) {
          const validated = validateModelOutput(result.text, knownKeys, { allowQuestions: !isFollowUp });
          if (validated.ok) analysis = validated.value;
          else {
            error = `réponse invalide : ${validated.error}`;
            retryable = true;
          }
        } else {
          error = result.error;
          retryable = result.retryable;
        }
        const kind = isFollowUp ? 'follow_up' : 'initial';
        const logs: CallLog[] = (result.earlierFailures ?? []).map((f) => ({
          scanId,
          userId: user.id,
          kind,
          attempt,
          model: f.model ?? deps.model,
          result: f,
          error: f.ok ? null : f.error,
        }));
        logs.push({ scanId, userId: user.id, kind, attempt, model: result.model ?? deps.model, result, error });
        for (const log of logs) {
          await deps.logCall(log).catch((e) => deps.log('journalisation des tokens impossible', { error: String(e) }));
        }
        if (error) deps.log('échec Gemini', { scanId, attempt, error });
        // Modèles saturés : deps.gemini a déjà réessayé, une relance ici dépasserait le délai de l'app.
        if (!analysis && (!retryable || overloaded)) break;
      }

      if (!analysis) {
        await refund();
        if (overloaded) {
          return fail(503, 'ai_busy', "Le service d'analyse est saturé en ce moment. Ton scan n'a pas été décompté : réessaie dans une minute.");
        }
        return fail(502, 'analysis_failed', "L'analyse n'a pas abouti. Ton scan n'a pas été décompté, réessaie.");
      }

      const photoPath = isFollowUp ? null : await deps.storePhoto(user, scanId, request.imageBase64).catch(() => null);

      const response: SuccessBody = {
        ...analysis,
        scan_id: scanId,
        follow_up_allowed: !isFollowUp && analysis.questions.length > 0,
        quota: quota ? { used: quota.used, quota: quota.quota, remaining: Math.max(quota.quota - quota.used, 0) } : null,
        photo_path: photoPath,
      };
      return json(200, response);
    } catch (e) {
      deps.log('erreur inattendue', { scanId, error: String(e) });
      await refund();
      return fail(500, 'internal_error', "Erreur du serveur. Ton scan n'a pas été décompté, réessaie.");
    }
  };
}
