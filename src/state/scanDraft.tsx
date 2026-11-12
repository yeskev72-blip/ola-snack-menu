import { randomUUID } from 'expo-crypto';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { AnalysisResponse, AnalyzedItem, NamedPortion, Question } from '@/lib/analyze';
import type { PreparedPhoto } from '@/lib/preparePhoto';
import { DEFAULT_OIL, removeOil, type OilLevel } from '@/lib/cookingOil';
import type { TypeRepas } from '@/lib/database.types';
import type { LocalMeal } from '@/lib/meals';
import { per100gFromPortion, type Per100g } from '@/lib/nutrition';
import type { ScanMarks } from '@/lib/scanTiming';

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
  /** Portions nommées de l'IA, hors table uniquement. Absent pour un plat ajouté à la main. */
  portions?: NamedPortion[];
  /**
   * Poids estimé par l'IA, figé. Les tailles proposées dans l'éditeur s'y ancrent : sans lui,
   * elles se recalculeraient sur la valeur corrigée et dériveraient à chaque réouverture.
   */
  aiGrams?: number;
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
  /** Huile de cuisson par rapport à l'habitude, pour tout le repas. */
  oil: OilLevel;
  /**
   * Instants du parcours, pour mesurer le temps de saisie. Null dès que le repas ne part pas
   * d'une photo fraîche (ajout à la main, repas refait, photo reprise de la file hors ligne).
   */
  marks: ScanMarks | null;
};

type Ctx = Draft & {
  /** `picked` : instants de la prise de vue ; l'omettre renonce à mesurer ce parcours. */
  setPhoto: (photo: PreparedPhoto | null, picked?: Pick<ScanMarks, 'pickedAt' | 'preparedAt'>) => void;
  setHint: (hint: string) => void;
  setOil: (oil: OilLevel) => void;
  setTypeRepas: (type: TypeRepas) => void;
  /** `span` : bornes de l'analyse initiale. Sans lui, c'est la relance après les questions. */
  applyAnalysis: (response: AnalysisResponse, span?: Pick<ScanMarks, 'analyzeAt' | 'analyzedAt' | 'attempts'>) => void;
  updateItem: (key: string, patch: Partial<Omit<DraftItem, 'key'>>) => void;
  removeItem: (key: string) => void;
  addItem: (item: Omit<DraftItem, 'key'>) => string;
  /** Recharge un repas déjà enregistré dans le brouillon, pour le refaire sans rescanner. */
  repeatMeal: (meal: Pick<LocalMeal, 'items' | 'type_repas' | 'huile'>) => void;
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

const emptyDraft = (): Draft => ({ photo: null, hint: '', scan: null, items: [], typeRepas: defaultTypeRepas(), oil: DEFAULT_OIL, marks: null });

function toDraftItem(item: AnalyzedItem): DraftItem {
  const other = item.food_key === 'autre';
  return {
    key: randomUUID(),
    food_key: other ? null : item.food_key,
    label: item.label,
    grams: item.grams,
    confidence: item.confidence,
    estimate_100g: other ? item.estimate_100g : null,
    portions: other ? item.portions : undefined,
    aiGrams: item.grams,
  };
}

const ScanDraftContext = createContext<Ctx | null>(null);

export function ScanDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const value = useMemo<Ctx>(
    () => ({
      ...draft,
      setPhoto: (photo, picked) => setDraft((d) => ({ ...d, photo, marks: photo && picked ? { ...picked, attempts: 0, followUp: false } : null })),
      setHint: (hint) => setDraft((d) => ({ ...d, hint })),
      setOil: (oil) => setDraft((d) => ({ ...d, oil })),
      setTypeRepas: (typeRepas) => setDraft((d) => ({ ...d, typeRepas })),
      applyAnalysis: (response, span) =>
        setDraft((d) => ({
          ...d,
          marks: d.marks ? (span ? { ...d.marks, ...span } : { ...d.marks, followUp: true }) : null,
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
      // Ni photo ni scan : l'enregistrement n'envoie donc ni correction, ni confiance, ni photo,
      // et l'écran de résultat n'affiche pas de questions de clarification. Aucun appel à l'IA.
      repeatMeal: (meal) =>
        setDraft({
          ...emptyDraft(),
          typeRepas: meal.type_repas,
          oil: meal.huile,
          items: meal.items.map((it) => ({
            key: randomUUID(),
            food_key: it.food_key,
            label: it.label,
            grams: it.grams,
            confidence: null,
            // Un aliment hors table garde les valeurs retenues ce jour-là : les recalculer
            // demanderait un nouvel appel à l'IA, et donnerait un autre résultat. Le repas
            // enregistre les valeurs de la PORTION : il faut les ramener à 100 g. L'huile y est
            // déjà comprise, et le calcul la réappliquera : on la retire d'abord.
            estimate_100g: it.food_key ? null : per100gFromPortion(removeOil(it, meal.huile)),
          })),
        }),
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
