/**
 * Edge Function analyze-meal (Deno). Branche les vraies dépendances sur handler.ts.
 *
 * Secrets (supabase secrets set …) :
 *   GEMINI_API_KEY          obligatoire, ne quitte jamais le serveur
 *   GEMINI_MODEL            défaut « gemini-flash-lite-latest » (modèle léger, offre gratuite)
 *   GEMINI_FALLBACK_MODELS  modèles de secours si le principal est saturé, séparés par des virgules ;
 *                           défaut « gemini-flash-lite-latest,gemini-flash-latest » ; « none » pour désactiver
 *   GEMINI_STRUCTURED       « true » pour imposer le schéma JSON, la température et le niveau de réflexion
 *                           (refusés en 400 par les modèles actuels) ; défaut : requête simplifiée
 *   GEMINI_TEMPERATURE      avec GEMINI_STRUCTURED seulement ; défaut 0.3 ; « default » = valeur du modèle
 *   GEMINI_THINKING_LEVEL   avec GEMINI_STRUCTURED seulement ; défaut « low »
 *   STORE_PHOTOS            « true » pour conserver les photos (si l'utilisateur a consenti)
 *   GEMINI_API_BASE         facultatif (tests, proxy) ; défaut : API publique de Google
 * Fournis automatiquement par Supabase : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

import type { FoodRef } from '../_shared/analysis.ts';
import { callGeminiResilient, GEMINI_API_BASE, type GeminiConfig } from '../_shared/gemini.ts';
import { createHandler } from './handler.ts';

function env(name: string, fallback?: string): string {
  const value = Deno.env.get(name) ?? fallback;
  if (value === undefined || value === '') throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

function parseTemperature(raw: string): number | null {
  if (raw === 'default') return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 2) throw new Error('GEMINI_TEMPERATURE invalide');
  return value;
}

const THINKING_LEVELS = ['minimal', 'low', 'medium', 'high'] as const;
const thinkingLevel = env('GEMINI_THINKING_LEVEL', 'low') as (typeof THINKING_LEVELS)[number];
if (!THINKING_LEVELS.includes(thinkingLevel)) throw new Error('GEMINI_THINKING_LEVEL invalide');

const geminiConfig: GeminiConfig = {
  apiKey: env('GEMINI_API_KEY'),
  apiBase: env('GEMINI_API_BASE', GEMINI_API_BASE),
  model: env('GEMINI_MODEL', 'gemini-flash-lite-latest'),
  temperature: parseTemperature(env('GEMINI_TEMPERATURE', '0.3')),
  thinkingLevel,
  maxOutputTokens: 4096,
  timeoutMs: 45_000,
  // Schéma, température et réflexion : refusés (HTTP 400) par les modèles actuels, d'où la requête
  // simplifiée par défaut. La forme JSON est décrite dans le prompt ; la validation reste stricte.
  simple: env('GEMINI_STRUCTURED', 'false') !== 'true',
};
// Secours : sans réglage de réflexion, que certains modèles refusent (chacun garde sa valeur par défaut).
const fallbackConfigs: GeminiConfig[] = env('GEMINI_FALLBACK_MODELS', 'gemini-flash-lite-latest,gemini-flash-latest')
  .split(',')
  .map((m) => m.trim())
  .filter((m) => m !== '' && m !== 'none' && m !== geminiConfig.model)
  .map((model) => ({ ...geminiConfig, model, thinkingLevel: null }));
const modelChain = [geminiConfig, ...fallbackConfigs];

const storePhotos = env('STORE_PHOTOS', 'false') === 'true';

// Client service role : contourne la RLS, n'est utilisé que côté serveur.
const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

function decodeBase64(data: string): Uint8Array {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const handler = createHandler({
  model: geminiConfig.model,
  maxAttempts: 2,

  async getUser(token) {
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) return null;
    return { id: data.user.id, isAnonymous: data.user.is_anonymous ?? false };
  },

  async consumeScan(userId) {
    const { data, error } = await admin.rpc('consume_scan', { p_user_id: userId }).single();
    if (error) throw error;
    return data as { allowed: boolean; used: number; quota: number };
  },

  async releaseScan(userId) {
    const { error } = await admin.rpc('release_scan', { p_user_id: userId });
    if (error) throw error;
  },

  async createScan(userId, imageSha256) {
    const { data, error } = await admin.from('scans').insert({ user_id: userId, image_sha256: imageSha256 }).select('id').single();
    if (error) throw error;
    return data.id as string;
  },

  async claimFollowUp(scanId, userId, imageSha256) {
    const { data, error } = await admin.rpc('claim_follow_up', { p_scan_id: scanId, p_user_id: userId, p_image_sha256: imageSha256 });
    if (error) throw error;
    return data === true;
  },

  async releaseFollowUp(scanId) {
    const { error } = await admin.rpc('release_follow_up', { p_scan_id: scanId });
    if (error) throw error;
  },

  async loadFoods() {
    const { data, error } = await admin.from('foods').select('food_key, label_fr, aliases, portion_reperes').order('food_key');
    if (error) throw error;
    return data as FoodRef[];
  },

  // Modèle saturé (503) : un second essai 2 s plus tard, puis les modèles de secours ; réponse en moins de 50 s
  // pour rester sous le délai de l'app (60 s).
  gemini: (req) =>
    callGeminiResilient(modelChain, req, {
      retryDelaysMs: [2_000],
      budgetMs: 50_000,
      onFailure: (r) => !r.ok && console.error(JSON.stringify({ message: 'essai Gemini en échec', model: r.model, error: r.error })),
    }),

  async logCall({ scanId, userId, kind, attempt, model, result, error }) {
    const { error: dbError } = await admin.from('scan_calls').insert({
      scan_id: scanId,
      user_id: userId,
      kind,
      attempt,
      model,
      ok: error === null,
      error,
      prompt_tokens: result.usage.promptTokens,
      output_tokens: result.usage.outputTokens,
      thoughts_tokens: result.usage.thoughtsTokens,
      total_tokens: result.usage.totalTokens,
      latency_ms: result.latencyMs,
    });
    if (dbError) throw dbError;
    console.log(
      JSON.stringify({ event: 'gemini_call', scanId, userId, kind, attempt, ok: error === null, ...result.usage, latencyMs: result.latencyMs }),
    );
  },

  async storePhoto(user, scanId, imageBase64) {
    // Désactivé par défaut ; et seulement si l'utilisateur a accepté le partage des photos.
    if (!storePhotos || user.isAnonymous) return null;
    const { data: profile } = await admin.from('profiles').select('partage_photos').eq('id', user.id).single();
    if (!profile?.partage_photos) return null;

    const path = `${user.id}/${scanId}.jpg`;
    const { error } = await admin.storage.from('meal-photos').upload(path, decodeBase64(imageBase64), {
      contentType: 'image/jpeg',
      upsert: true,
    });
    if (error) throw error;
    await admin.from('scans').update({ photo_path: path }).eq('id', scanId);
    return path;
  },

  log: (message, extra) => console.error(JSON.stringify({ message, ...extra })),
});

Deno.serve(handler);
