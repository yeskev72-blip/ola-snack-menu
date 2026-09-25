/**
 * Logique pure de l'analyse d'un repas : validation de la requête, prompt, schéma
 * de sortie Gemini et validation stricte de la réponse.
 * Aucun import Deno ni réseau : testé avec `node --test` (voir analysis.test.ts).
 */

export const OTHER_FOOD_KEY = 'autre';

export const LIMITS = {
  /** ~1,5 Mo de JPEG une fois décodé (la photo est compressée à 1024 px côté app). */
  maxImageBase64Length: 2_000_000,
  maxHintLength: 300,
  maxAnswers: 2,
  maxAnswerLength: 200,
  maxItems: 12,
  maxQuestions: 2,
  minGrams: 1,
  maxGrams: 2000,
} as const;

export type FoodRef = {
  food_key: string;
  label_fr: string;
  aliases: string[];
  portion_reperes: Record<string, number>;
};

export type Answer = { question: string; answer: string };

export type AnalyzeRequest = {
  imageBase64: string;
  hint: string | null;
  /** Présents uniquement pour la relance après questions de clarification. */
  scanId: string | null;
  answers: Answer[];
};

export type Estimate100g = { kcal: number; proteines: number; glucides: number; lipides: number };

export type AnalyzedItem = {
  food_key: string;
  label: string;
  grams: number;
  confidence: number;
  /** Uniquement pour food_key = « autre » : valeurs estimées par l'IA, affichées comme telles. */
  estimate_100g: Estimate100g | null;
};

export type Question = { id: string; text: string; options: string[] };

export type Analysis = {
  not_food: boolean;
  items: AnalyzedItem[];
  questions: Question[];
  confidence_globale: number;
};

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

// ---------------------------------------------------------------------------
// Requête de l'app
// ---------------------------------------------------------------------------

export function parseRequest(body: unknown): Result<AnalyzeRequest> {
  if (!isRecord(body)) return { ok: false, error: 'Corps JSON attendu.' };

  const image = body.image_base64;
  if (typeof image !== 'string' || image.length === 0) return { ok: false, error: 'image_base64 manquant.' };
  if (image.length > LIMITS.maxImageBase64Length) return { ok: false, error: 'Image trop lourde.' };
  // Signature JPEG (FF D8 FF) encodée en base64.
  if (!image.startsWith('/9j/')) return { ok: false, error: 'Image JPEG attendue (base64 sans préfixe data:).' };

  let hint: string | null = null;
  if (body.hint !== undefined && body.hint !== null) {
    if (typeof body.hint !== 'string') return { ok: false, error: 'hint doit être un texte.' };
    hint = body.hint.trim().slice(0, LIMITS.maxHintLength) || null;
  }

  let scanId: string | null = null;
  const answers: Answer[] = [];
  if (body.scan_id !== undefined && body.scan_id !== null) {
    if (typeof body.scan_id !== 'string' || !UUID_RE.test(body.scan_id)) return { ok: false, error: 'scan_id invalide.' };
    scanId = body.scan_id;
    if (!Array.isArray(body.answers) || body.answers.length === 0 || body.answers.length > LIMITS.maxAnswers) {
      return { ok: false, error: `La relance demande 1 à ${LIMITS.maxAnswers} réponses.` };
    }
    for (const a of body.answers) {
      if (!isRecord(a) || typeof a.question !== 'string' || typeof a.answer !== 'string' || !a.answer.trim()) {
        return { ok: false, error: 'Réponse invalide.' };
      }
      answers.push({
        question: a.question.trim().slice(0, LIMITS.maxAnswerLength),
        answer: a.answer.trim().slice(0, LIMITS.maxAnswerLength),
      });
    }
  } else if (body.answers !== undefined) {
    return { ok: false, error: 'answers exige scan_id.' };
  }

  return { ok: true, value: { imageBase64: image, hint, scanId, answers } };
}

/** Empreinte SHA-256 (hex) de la photo telle qu'envoyée, pour lier la relance au même scan. */
export async function imageFingerprint(imageBase64: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(imageBase64));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function foodLine(f: FoodRef): string {
  const aliases = f.aliases.length ? ` (aussi : ${f.aliases.join(', ')})` : '';
  const reperes = Object.entries(f.portion_reperes)
    .map(([name, grams]) => `${name} ≈ ${grams} g`)
    .join(', ');
  return `- ${f.food_key} : ${f.label_fr}${aliases}${reperes ? ` [${reperes}]` : ''}`;
}

export function buildSystemPrompt(foods: FoodRef[]): string {
  return `Tu es un assistant nutritionniste spécialisé dans la cuisine d'Afrique de l'Ouest (Bénin, Togo, Côte d'Ivoire, Sénégal, Nigeria, Ghana). Tu analyses la photo d'un repas pour identifier chaque élément et estimer sa quantité en grammes. Tu ne calcules pas les calories des aliments de la liste : l'application les calcule avec sa propre table.

RÈGLES

1. Liste de référence. Pour chaque élément, choisis en priorité un food_key de la liste ci-dessous (clé : libellé, autres noms, [repères de portion]). Utilise « ${OTHER_FOOD_KEY} » seulement si aucun élément de la liste ne correspond raisonnablement ; donne alors un libellé précis et une estimation pour 100 g dans estimate_100g. Pour un élément de la liste, estimate_100g vaut null.

2. Indice de l'utilisateur. S'il décrit le plat, considère-le comme fiable en cas de doute visuel (par exemple une sauce brune qu'il appelle « sauce arachide »). S'il contredit clairement la photo, suis la photo et baisse la confiance.

3. Sauces et huile, souvent invisibles. Compte chaque sauce comme un élément séparé du féculent qu'elle accompagne, même si elle est en partie cachée dessous. Compte l'huile de cuisson (huile_palme ou huile_vegetale) comme un élément séparé quand elle se voit en excès : flaque, couche d'huile en surface, aliments luisants. Les plats frits et les sauces de la liste incluent déjà leur huile de cuisson normale : n'ajoute de l'huile que pour l'excès visible, pour ne pas la compter deux fois.

4. Portions. Estime les grammes à partir de repères visibles : taille de l'assiette (assiette plate courante ≈ 24 à 26 cm, bol ≈ 15 cm), couverts, main, emballage. Appuie-toi sur les repères de portion de la liste. Une portion est rarement au-dessus de ${LIMITS.maxGrams} g.

5. N'invente pas. Si un élément important est incertain (aliment caché, sauce ambiguë, quantité impossible à juger), baisse sa confidence et pose au plus ${LIMITS.maxQuestions} questions courtes, chacune avec 2 à 4 réponses possibles, uniquement si la réponse change nettement les calories. Exemple : « Sauce à l'huile de palme ou à la tomate ? ». Si tout est clair, ne pose aucune question.

6. Confiance. confidence (0 à 1) par élément ; confidence_globale (0 à 1) reflète l'incertitude sur le total de calories du repas.

7. Si la photo ne montre pas de nourriture, renvoie not_food = true, sans éléments ni questions.

8. Réponds uniquement avec un objet JSON de cette forme exacte, sans texte autour. Libellés et questions en français simple.
{"not_food": false, "items": [{"food_key": "<clé de la liste ou ${OTHER_FOOD_KEY}>", "label": "<libellé>", "grams": <nombre>, "confidence": <0 à 1>, "estimate_100g": null ou {"kcal": <nombre>, "proteines": <nombre>, "glucides": <nombre>, "lipides": <nombre>}}], "questions": [{"id": "<identifiant court>", "text": "<question>", "options": ["<réponse>", "<réponse>"]}], "confidence_globale": <0 à 1>}
Au plus ${LIMITS.maxItems} éléments.

LISTE DE RÉFÉRENCE
${foods.map(foodLine).join('\n')}`;
}

export function buildUserText(req: Pick<AnalyzeRequest, 'hint' | 'answers'>): string {
  const lines = ['Analyse ce repas.'];
  lines.push(req.hint ? `Indice de l'utilisateur : « ${req.hint} »` : "L'utilisateur n'a pas donné d'indice.");
  if (req.answers.length) {
    lines.push("Réponses de l'utilisateur à tes questions précédentes :");
    for (const a of req.answers) lines.push(`- ${a.question} → ${a.answer}`);
    lines.push('Refais l’analyse complète en tenant compte de ces réponses. Ne pose plus de question.');
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Schéma de sortie (format responseSchema de l'API Gemini, sous-ensemble OpenAPI)
// ---------------------------------------------------------------------------

export function buildResponseSchema(foodKeys: string[]) {
  const estimate = {
    type: 'OBJECT',
    nullable: true,
    properties: {
      kcal: { type: 'NUMBER' },
      proteines: { type: 'NUMBER' },
      glucides: { type: 'NUMBER' },
      lipides: { type: 'NUMBER' },
    },
    required: ['kcal', 'proteines', 'glucides', 'lipides'],
  };
  return {
    type: 'OBJECT',
    properties: {
      not_food: { type: 'BOOLEAN' },
      items: {
        type: 'ARRAY',
        maxItems: LIMITS.maxItems,
        items: {
          type: 'OBJECT',
          properties: {
            food_key: { type: 'STRING', enum: [...foodKeys, OTHER_FOOD_KEY] },
            label: { type: 'STRING' },
            grams: { type: 'NUMBER' },
            confidence: { type: 'NUMBER' },
            estimate_100g: estimate,
          },
          required: ['food_key', 'label', 'grams', 'confidence', 'estimate_100g'],
          propertyOrdering: ['food_key', 'label', 'grams', 'confidence', 'estimate_100g'],
        },
      },
      questions: {
        type: 'ARRAY',
        maxItems: LIMITS.maxQuestions,
        items: {
          type: 'OBJECT',
          properties: {
            id: { type: 'STRING' },
            text: { type: 'STRING' },
            options: { type: 'ARRAY', minItems: 2, maxItems: 4, items: { type: 'STRING' } },
          },
          required: ['id', 'text', 'options'],
        },
      },
      confidence_globale: { type: 'NUMBER' },
    },
    required: ['not_food', 'items', 'questions', 'confidence_globale'],
    propertyOrdering: ['not_food', 'items', 'questions', 'confidence_globale'],
  };
}

// ---------------------------------------------------------------------------
// Validation stricte de la réponse du modèle
// ---------------------------------------------------------------------------

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const round1 = (v: number) => Math.round(v * 10) / 10;
const round2 = (v: number) => Math.round(v * 100) / 100;

function parseEstimate(v: unknown): Estimate100g | null {
  if (!isRecord(v)) return null;
  const { kcal, proteines, glucides, lipides } = v;
  if (![kcal, proteines, glucides, lipides].every((n) => isFiniteNumber(n) && n >= 0)) return null;
  const e = { kcal: kcal as number, proteines: proteines as number, glucides: glucides as number, lipides: lipides as number };
  // Valeurs pour 100 g plausibles : pas plus de 900 kcal ni plus de 100 g de macros.
  if (e.kcal > 900 || e.proteines + e.glucides + e.lipides > 100.5) return null;
  return { kcal: round1(e.kcal), proteines: round1(e.proteines), glucides: round1(e.glucides), lipides: round1(e.lipides) };
}

/**
 * Valide le texte JSON renvoyé par Gemini. Les écarts bénins sont corrigés (bornes,
 * arrondis) ; les écarts de structure rendent la réponse invalide (→ une relance).
 */
export function validateModelOutput(text: string, knownKeys: ReadonlySet<string>, opts: { allowQuestions: boolean }): Result<Analysis> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'JSON illisible' };
  }
  if (!isRecord(raw)) return { ok: false, error: 'objet attendu' };
  if (typeof raw.not_food !== 'boolean') return { ok: false, error: 'not_food manquant' };
  if (!Array.isArray(raw.items)) return { ok: false, error: 'items manquant' };
  if (!Array.isArray(raw.questions)) return { ok: false, error: 'questions manquant' };
  if (!isFiniteNumber(raw.confidence_globale)) return { ok: false, error: 'confidence_globale manquant' };

  if (raw.not_food) {
    return { ok: true, value: { not_food: true, items: [], questions: [], confidence_globale: 0 } };
  }
  if (raw.items.length === 0) return { ok: false, error: 'aucun élément pour un repas' };
  if (raw.items.length > LIMITS.maxItems) return { ok: false, error: 'trop d’éléments' };

  const items: AnalyzedItem[] = [];
  for (const [i, it] of raw.items.entries()) {
    if (!isRecord(it)) return { ok: false, error: `élément ${i} invalide` };
    const { food_key, label, grams, confidence } = it;
    if (typeof food_key !== 'string' || (food_key !== OTHER_FOOD_KEY && !knownKeys.has(food_key))) {
      return { ok: false, error: `élément ${i} : food_key inconnu` };
    }
    if (typeof label !== 'string' || !label.trim()) return { ok: false, error: `élément ${i} : label vide` };
    if (!isFiniteNumber(grams) || grams <= 0) return { ok: false, error: `élément ${i} : grams invalide` };
    if (!isFiniteNumber(confidence)) return { ok: false, error: `élément ${i} : confidence invalide` };

    let estimate: Estimate100g | null = null;
    if (food_key === OTHER_FOOD_KEY) {
      estimate = parseEstimate(it.estimate_100g);
      if (!estimate) return { ok: false, error: `élément ${i} : estimate_100g requis pour « autre »` };
    }
    items.push({
      food_key,
      label: label.trim().slice(0, 120),
      grams: round1(clamp(grams, LIMITS.minGrams, LIMITS.maxGrams)),
      confidence: round2(clamp(confidence, 0, 1)),
      estimate_100g: estimate,
    });
  }

  const questions: Question[] = [];
  if (opts.allowQuestions) {
    for (const [i, q] of raw.questions.slice(0, LIMITS.maxQuestions).entries()) {
      if (!isRecord(q) || typeof q.text !== 'string' || !q.text.trim() || !Array.isArray(q.options)) {
        return { ok: false, error: `question ${i} invalide` };
      }
      const options = q.options.filter((o): o is string => typeof o === 'string' && o.trim() !== '').map((o) => o.trim());
      if (options.length < 2) return { ok: false, error: `question ${i} : au moins 2 options` };
      questions.push({
        id: typeof q.id === 'string' && q.id.trim() ? q.id.trim().slice(0, 40) : `q${i + 1}`,
        text: q.text.trim().slice(0, 200),
        options: options.slice(0, 4).map((o) => o.slice(0, 80)),
      });
    }
  }

  return {
    ok: true,
    value: { not_food: false, items, questions, confidence_globale: round2(clamp(raw.confidence_globale, 0, 1)) },
  };
}
