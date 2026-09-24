import { randomUUID } from 'expo-crypto';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { AnalysisResponse, AnalyzedItem, PreparedPhoto, Question } from '@/lib/analyze';
import type { TypeRepas } from '@/lib/database.types';
import type { Per100g } from '@/lib/nutrition';

/** Élément du repas en cours d'édition. */
export type DraftItem = {
  key: string;
  /** null = hors table (valeurs estimées par l'IA dans estimate_100g). */
  food_key: string | null;
  label: string;
  grams: number;
  /** Confiance de l'IA ; null dès que l'utilisateur a modifié l'élément. */
  confidence: number | null;
  estimate_100g: Per100g | null;
};

export type ScanInfo = {
  scanId: string;
  questions: Question[];
  followUpAllowed: boolean;
  /** Dernière prédiction de l'IA : référence pour enregistrer les corrections. */
  predicted: AnalyzedItem[];
  photoPath: string | null;
};

type Draft = {
  photo: PreparedPhoto | null;
  hint: string;
  scan: ScanInfo | null;
  items: DraftItem[];
  typeRepas: TypeRepas;
};

type Ctx = Draft & {
  setPhoto: (photo: PreparedPhoto | null) => void;
  setHint: (hint: string) => void;
  setTypeRepas: (type: TypeRepas) => void;
  applyAnalysis: (response: AnalysisResponse) => void;
  updateItem: (key: string, patch: Partial<Omit<DraftItem, 'key'>>) => void;
  removeItem: (key: string) => void;
  addItem: (item: Omit<DraftItem, 'key'>) => string;
  /** Nouveau repas : saisie manuelle (sans photo) ou nouveau scan. */
  reset: () => void;
};

/** Type de repas proposé selon l'heure. */
export function defaultTypeRepas(date = new Date()): TypeRepas {
  const minutes = date.getHours() * 60 + date.getMinutes();
  if (minutes < 10 * 60 + 30) return 'petit_dejeuner';
  if (minutes < 15 * 60) return 'dejeuner';
  if (minutes < 18 * 60) return 'en_cas';
  return 'diner';
}

const emptyDraft = (): Draft => ({ photo: null, hint: '', scan: null, items: [], typeRepas: defaultTypeRepas() });

function toDraftItem(item: AnalyzedItem): DraftItem {
  const other = item.food_key === 'autre';
  return {
    key: randomUUID(),
    food_key: other ? null : item.food_key,
    label: item.label,
    grams: item.grams,
    confidence: item.confidence,
    estimate_100g: other ? item.estimate_100g : null,
  };
}

const ScanDraftContext = createContext<Ctx | null>(null);

export function ScanDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const value = useMemo<Ctx>(
    () => ({
      ...draft,
      setPhoto: (photo) => setDraft((d) => ({ ...d, photo })),
      setHint: (hint) => setDraft((d) => ({ ...d, hint })),
      setTypeRepas: (typeRepas) => setDraft((d) => ({ ...d, typeRepas })),
      applyAnalysis: (response) =>
        setDraft((d) => ({
          ...d,
          items: response.items.map(toDraftItem),
          scan: {
            scanId: response.scan_id,
            questions: response.questions,
            followUpAllowed: response.follow_up_allowed,
            predicted: response.items,
            photoPath: response.photo_path ?? d.scan?.photoPath ?? null,
          },
        })),
      updateItem: (key, patch) =>
        setDraft((d) => ({
          ...d,
          items: d.items.map((it) => (it.key === key ? { ...it, ...patch, confidence: null } : it)),
        })),
      removeItem: (key) => setDraft((d) => ({ ...d, items: d.items.filter((it) => it.key !== key) })),
      addItem: (item) => {
        const key = randomUUID();
        setDraft((d) => ({ ...d, items: [...d.items, { ...item, key }] }));
        return key;
      },
      reset: () => setDraft(emptyDraft()),
    }),
    [draft],
  );

  return <ScanDraftContext.Provider value={value}>{children}</ScanDraftContext.Provider>;
}

export function useScanDraft(): Ctx {
  const ctx = useContext(ScanDraftContext);
  if (!ctx) throw new Error('useScanDraft doit être utilisé dans <ScanDraftProvider>');
  return ctx;
}
