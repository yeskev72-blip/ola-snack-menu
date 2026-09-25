import NetInfo from '@react-native-community/netinfo';
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { PHOTO } from '@/config';
import { t } from '@/i18n';
import type { Per100g } from '@/lib/nutrition';
import { supabase } from '@/lib/supabase';

/** Réponse de l'Edge Function analyze-meal (voir supabase/functions/analyze-meal/handler.ts). */
export type AnalyzedItem = {
  food_key: string;
  label: string;
  grams: number;
  confidence: number;
  estimate_100g: Per100g | null;
};
export type Question = { id: string; text: string; options: string[] };
export type QuotaInfo = { used: number; quota: number; remaining: number };
export type AnalysisResponse = {
  not_food: boolean;
  items: AnalyzedItem[];
  questions: Question[];
  confidence_globale: number;
  scan_id: string;
  follow_up_allowed: boolean;
  quota: QuotaInfo | null;
  photo_path: string | null;
};

export type AnalyzeError = {
  code: 'offline' | 'quota_exceeded' | 'follow_up_not_allowed' | 'timeout' | 'server';
  message: string;
  quota?: QuotaInfo;
};

export type PreparedPhoto = { uri: string; base64: string };

/** Réduit la photo (côté long ~1024 px) et la compresse en JPEG avant envoi. */
export async function preparePhoto(uri: string, width: number, height: number): Promise<PreparedPhoto> {
  const context = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > PHOTO.maxSide) {
    context.resize(width >= height ? { width: PHOTO.maxSide } : { height: PHOTO.maxSide });
  }
  const image = await context.renderAsync();
  const result = await image.saveAsync({ base64: true, compress: PHOTO.jpegQuality, format: SaveFormat.JPEG });
  if (!result.base64) throw new Error('Compression de la photo impossible');
  return { uri: result.uri, base64: result.base64 };
}

export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected !== false && state.isInternetReachable !== false;
}

type AnalyzeInput = {
  photo: PreparedPhoto;
  hint: string;
  followUp?: { scanId: string; answers: { question: string; answer: string }[] };
};

/** Appelle l'analyse IA. La clé Gemini reste côté serveur : l'app n'envoie que la photo et l'indice. */
export async function analyzeMeal(input: AnalyzeInput): Promise<{ ok: true; data: AnalysisResponse } | { ok: false; error: AnalyzeError }> {
  if (!(await isOnline())) return { ok: false, error: { code: 'offline', message: t('scan.offline') } };

  const body = {
    image_base64: input.photo.base64,
    hint: input.hint.trim() || null,
    ...(input.followUp ? { scan_id: input.followUp.scanId, answers: input.followUp.answers } : {}),
  };

  const { data, error } = await supabase.functions.invoke<AnalysisResponse>('analyze-meal', { body, timeout: 60_000 });
  if (!error && data) return { ok: true, data };

  if (error instanceof FunctionsHttpError) {
    const response = error.context as Response;
    const payload = (await response.json().catch(() => null)) as { error?: string; message?: string; quota?: QuotaInfo } | null;
    if (payload?.error === 'quota_exceeded') {
      return { ok: false, error: { code: 'quota_exceeded', message: payload.message ?? t('scan.quotaExceeded'), quota: payload.quota } };
    }
    if (payload?.error === 'follow_up_not_allowed') {
      return { ok: false, error: { code: 'follow_up_not_allowed', message: t('result.followUpExpired') } };
    }
    return { ok: false, error: { code: 'server', message: payload?.message ?? t('scan.serverError') } };
  }
  if (error instanceof FunctionsFetchError || (error instanceof Error && /abort|timeout/i.test(error.message))) {
    return { ok: false, error: { code: 'timeout', message: t('scan.networkError') } };
  }
  return { ok: false, error: { code: 'server', message: t('scan.serverError') } };
}

/** Scans restants aujourd'hui (null si hors ligne ou indisponible). */
export async function fetchScanStatus(): Promise<QuotaInfo | null> {
  const { data, error } = await supabase.rpc('get_scan_status');
  if (error || !data || data.length === 0) return null;
  return data[0] ?? null;
}
