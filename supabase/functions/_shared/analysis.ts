/**
 * Logique pure de l'analyse d'un repas : validation de la requête, prompt, schéma
 * de sortie Gemini et validation stricte de la réponse.
 * Aucun import Deno ni réseau : testé avec `node --test` (voir analysis.test.ts).
 */

import { FOOD_ASPECTS } from './aspects.ts';

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
  /** Portions nommées proposées par le modèle pour un aliment hors table. */
  maxPortions: 4,
  maxPortionLabelLength: 40,
} as const;

export type FoodRef = {
  food_key: string;
  label_fr: string;
  aliases: string[];
  portion_reperes: Record<string, number>;
};

/**
 * Langue de la réponse du modèle. L'app peut tourner en anglais : les libellés d'aliments, les
 * portions nommées et les questions doivent suivre, sinon l'utilisateur anglophone lit
 * « grosse pomme · 220 g » sous un titre « Size ».
 */
export const LANGS = ['fr', 'en'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = 'fr';

export type Answer = { question: string; answer: string };

export type AnalyzeRequest = {
  imageBase64: string;
  hint: string | null;
  /** Présents uniquement pour la relance après questions de clarification. */
  scanId: string | null;
  answers: Answer[];
  /** Langue attendue pour les libellés, les portions et les questions. */
  lang: Lang;
};

export type Estimate100g = { kcal: number; proteines: number; glucides: number; lipides: number };

/** « 1 pomme moyenne » = 150 g : façon naturelle de compter un aliment absent de la table. */
export type NamedPortion = { label: string; grams: number };

export type AnalyzedItem = {
  food_key: string;
  label: string;
  grams: number;
  confidence: number;
  /** Uniquement pour food_key = « autre » : valeurs estimées par l'IA, affichées comme telles. */
  estimate_100g: Estimate100g | null;
  /**
   * Portions nommées proposées par le modèle, uniquement pour « autre ». Vide pour un plat de
   * la table, qui a ses propres repères. Le modèle juge mal les tailles : ces portions donnent
   * à l'utilisateur de quoi le corriger d'un appui, sans taper de grammes.
   */
  portions: NamedPortion[];
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

  // Une langue absente ou inconnue retombe sur le français : un scan ne doit pas échouer parce
  // qu'une version de l'app envoie une étiquette que le serveur ne connaît pas encore.
  const lang = LANGS.find((l) => l === body.lang) ?? DEFAULT_LANG;

  return { ok: true, value: { imageBase64: image, hint, scanId, answers, lang } };
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
  const tete = `- ${f.food_key} : ${f.label_fr}${aliases}${reperes ? ` [${reperes}]` : ''}`;
  // Sans l'aspect, le modèle ne peut pas départager deux plats qui portent des noms différents
  // mais se ressemblent sur une photo. C'est le seul moyen qu'il a de regarder plutôt que deviner.
  const vu = FOOD_ASPECTS[f.food_key];
  if (!vu) return tete;
  const conf = vu.confusions.length ? `\n  À ne pas confondre : ${vu.confusions.join(' ; ')}` : '';
  return `${tete}\n  Aspect : ${vu.aspect}${conf}`;
}

/**
 * Consigne de langue pour la sortie. Le prompt reste rédigé en français — le modèle le comprend
 * aussi bien — mais ce que lit l'utilisateur doit suivre la langue de l'app.
 */
const OUTPUT_LANGUAGE: Record<Lang, string> = {
  fr: 'en français simple',
  en: "en anglais simple (l'utilisateur lit l'application en anglais)",
};

export function buildSystemPrompt(foods: FoodRef[], lang: Lang = DEFAULT_LANG): string {
  return `Tu es un assistant nutritionniste. Tu reconnais les aliments et les plats du monde entier — cuisine africaine, européenne, asiatique, américaine, produits industriels, fruits et légumes de toutes origines — et tu connais particulièrement bien la cuisine d'Afrique de l'Ouest (Bénin, Togo, Côte d'Ivoire, Sénégal, Nigeria, Ghana). Tu analyses la photo d'un repas pour identifier chaque élément et estimer sa quantité en grammes.

RÈGLES

1. Identifie d'abord, classe ensuite. Chaque plat de la liste est décrit par son aspect, et parfois par ce qui le distingue de ses sosies : compare ce que montre la photo à ces descriptions avant de choisir une clé. Couleur, texture et grain priment sur le nom : une pâte brun foncé n'est pas une pâte blanche, même si les deux s'appellent « pâte ». Nomme ce que tu vois réellement, quel que soit le pays d'origine de l'aliment. Ensuite seulement, regarde la liste ci-dessous : c'est la liste des aliments dont l'application connaît déjà les valeurs nutritionnelles (clé : libellé, autres noms, [repères de portion]).
   - Si l'aliment que tu as identifié EST un aliment de la liste, donne son food_key, et estimate_100g vaut null : l'application calcule les calories avec sa propre table.
   - Sinon, donne food_key = « ${OTHER_FOOD_KEY} », un libellé précis, et ta propre estimation pour 100 g dans estimate_100g.
   La liste n'est pas une contrainte : elle ne couvre qu'une petite partie des aliments existants. Tu dois pouvoir traiter n'importe quel aliment, même absent de la liste.

   INTERDIT : remplacer un aliment par un autre sous prétexte qu'il lui ressemble ou qu'il est dans la liste. Une pomme reste une pomme même si la liste ne contient que des mangues et des ananas : dans ce cas, c'est « ${OTHER_FOOD_KEY} » avec le libellé « pomme ». Un faux aliment est une erreur bien plus grave qu'un aliment hors liste.

2. Indice de l'utilisateur. S'il décrit le plat, considère-le comme fiable en cas de doute visuel (par exemple une sauce brune qu'il appelle « sauce arachide »). S'il contredit clairement la photo, suis la photo et baisse la confiance.

3. Sauces et huile, souvent invisibles. Compte chaque sauce comme un élément séparé du féculent qu'elle accompagne, même si elle est en partie cachée dessous. Compte l'huile de cuisson (huile_palme ou huile_vegetale) comme un élément séparé quand elle se voit en excès : flaque, couche d'huile en surface, aliments luisants. Les plats frits et les sauces de la liste incluent déjà leur huile de cuisson normale : n'ajoute de l'huile que pour l'excès visible, pour ne pas la compter deux fois.

4. Portions. Ne devine pas un poids d'un coup : procède en trois temps.

   a) Trouve l'échelle. Cherche dans l'image un objet dont la taille est connue : assiette plate ≈ 24 à 26 cm de diamètre, assiette creuse ≈ 22 cm, bol ≈ 15 cm, cuillère à soupe ≈ 8 cm de long, fourchette ≈ 19 cm, canette ≈ 12 cm de haut, main d'adulte ≈ 18 cm, pouce ≈ 6 cm. Si rien ne donne l'échelle, suppose une assiette plate courante et baisse nettement la confiance de l'élément : la photo seule ne dit pas si un aliment est petit et proche ou gros et loin.

   b) Juge le volume, pas la surface. Deux assiettes peuvent être couvertes pareil pour des poids très différents : ce qui compte est l'épaisseur du tas. Une couche fine et un monticule ne pèsent pas la même chose.

   c) Convertis le volume en grammes. Ordres de grandeur : sauces et liquides ≈ 1 g pour 1 ml ; féculents cuits tassés (riz, pâte, couscous) ≈ 0,8 g/ml ; viande et poisson ≈ 1 g/ml ; salade et feuilles crues ≈ 0,2 g/ml ; aliments frits et aérés ≈ 0,5 g/ml.

   d) Pour un aliment rond et entier (fruit, tubercule, boule de pâte), mesure son diamètre avec le repère d'échelle, puis lis ce tableau — il vaut pour une pomme, une orange, une tomate, tout ce qui est à peu près sphérique : 6 cm ≈ 100 g ; 7 cm ≈ 150 g ; 8 cm ≈ 220 g ; 9 cm ≈ 300 g ; 10 cm ≈ 400 g. Le poids suit le cube du diamètre : un fruit à peine plus large est beaucoup plus lourd, et un fruit à peine plus petit est beaucoup plus léger.

   Poids courants pour les aliments absents de la liste. Ce sont des repères pour un spécimen MOYEN, pas des réponses à recopier : un même fruit va du simple au triple selon sa taille, alors descends ou monte franchement dès que la photo montre un aliment petit ou gros. Pomme, orange : petite 100 g, moyenne 150 g, grosse 220 g. Mangue : petite 150 g, moyenne 250 g, grosse 400 g. Banane épluchée : petite 80 g, moyenne 120 g, grosse 170 g. Œuf ≈ 55 g ; tranche de pain ≈ 30 g ; part de pizza ≈ 125 g ; pot de yaourt ≈ 125 g ; verre ≈ 250 ml ; bouteille individuelle ≈ 500 ml.

   e) Propose des portions nommées. Pour tout aliment absent de la liste, remplis « portions » avec 2 à 4 façons naturelles de compter CET aliment, de la plus petite à la plus grosse, chacune avec son poids en grammes : un fruit entier donne « petite pomme » 100, « pomme moyenne » 150, « grosse pomme » 220 ; du pain donne « 1 tranche » 30, « 2 tranches » 60 ; une boisson donne « 1 verre » 250, « 1 bouteille » 500 ; un plat en sauce donne « 1 louche » 120, « 2 louches » 240. Ce sont les choix que l'utilisateur touchera pour corriger ton estimation, donc ils doivent être parlants et adaptés à cet aliment précis. Pour un aliment de la liste, renvoie une liste vide : l'application a déjà ses repères.

   Ne réponds jamais le poids moyen par réflexe. Le poids moyen est la réponse uniquement quand l'aliment paraît vraiment moyen à côté de ton repère d'échelle ; sinon c'est une erreur, et elle est systématique.

   Quand l'aliment figure dans la liste, ses repères de portion priment sur tout ce qui précède. Une portion dépasse rarement ${LIMITS.maxGrams} g.

5. N'invente pas. Si un élément important est incertain (aliment caché, sauce ambiguë, quantité impossible à juger), baisse sa confidence et pose au plus ${LIMITS.maxQuestions} questions courtes, chacune avec 2 à 4 réponses possibles, uniquement si la réponse change nettement les calories. Exemple : « Sauce à l'huile de palme ou à la tomate ? ». Si tout est clair, ne pose aucune question.

6. Confiance. confidence (0 à 1) par élément ; confidence_globale (0 à 1) reflète l'incertitude sur le total de calories du repas.

7. Si la photo ne montre pas de nourriture, renvoie not_food = true, sans éléments ni questions.

8. Réponds uniquement avec un objet JSON de cette forme exacte, sans texte autour. Les libellés, les portions nommées et les questions sont écrits ${OUTPUT_LANGUAGE[lang]} : c'est le seul texte que l'utilisateur lit. Les noms de plats locaux (attiéké, amiwo, gari, alloco) ne se traduisent pas, quelle que soit la langue.
{"not_food": false, "items": [{"food_key": "<clé de la liste ou ${OTHER_FOOD_KEY}>", "label": "<libellé>", "grams": <nombre>, "confidence": <0 à 1>, "estimate_100g": null ou {"kcal": <nombre>, "proteines": <nombre>, "glucides": <nombre>, "lipides": <nombre>}}], "questions": [{"id": "<identifiant court>", "text": "<question>", "options": ["<réponse>", "<réponse>"]}], "confidence_globale": <0 à 1>}
Au plus ${LIMITS.maxItems} éléments.

LISTE DE RÉFÉRENCE — aliments dont l'application connaît déjà les valeurs
${foods.map(foodLine).join('\n')}

RAPPEL FINAL, le plus important. Cette liste est courte et très incomplète : elle couvre surtout des plats d'Afrique de l'Ouest et presque aucun aliment courant d'ailleurs — ni pomme, ni poire, ni raisin, ni fraise, ni pizza, ni yaourt, ni fromage, ni pâtes, ni céréales, ni sandwich. C'est normal et attendu.
Avant de répondre, relis chacun de tes éléments : si le libellé que tu as écrit ne décrit pas exactement ce que montre la photo, alors le food_key est faux. Remplace-le par « ${OTHER_FOOD_KEY} » et renseigne estimate_100g.
Une pomme n'est pas un ananas. Un aliment hors liste correctement nommé avec « ${OTHER_FOOD_KEY} » vaut toujours mieux qu'un food_key de la liste posé sur le mauvais aliment.`;
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
            portions: {
              type: 'ARRAY',
              maxItems: LIMITS.maxPortions,
              items: {
                type: 'OBJECT',
                properties: { label: { type: 'STRING' }, grams: { type: 'NUMBER' } },
                required: ['label', 'grams'],
                propertyOrdering: ['label', 'grams'],
              },
            },
          },
          required: ['food_key', 'label', 'grams', 'confidence', 'estimate_100g', 'portions'],
          propertyOrdering: ['food_key', 'label', 'grams', 'confidence', 'estimate_100g', 'portions'],
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
/**
 * Portions nommées du modèle : au plus LIMITS.maxPortions, triées du plus léger au plus lourd,
 * sans doublon de libellé ni de poids. Une portion mal formée est ignorée plutôt que de faire
 * échouer tout le scan : elle n'est qu'une aide à la correction, pas une donnée nutritionnelle.
 */
function parsePortions(raw: unknown): NamedPortion[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const portions: NamedPortion[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const { label, grams } = entry;
    if (typeof label !== 'string' || !label.trim()) continue;
    if (!isFiniteNumber(grams) || grams <= 0) continue;
    const clean = label.trim().slice(0, LIMITS.maxPortionLabelLength);
    const weight = round1(clamp(grams, LIMITS.minGrams, LIMITS.maxGrams));
    const dedupe = `${clean.toLowerCase()}|${weight}`;
    if (seen.has(dedupe) || seen.has(String(weight))) continue;
    seen.add(dedupe);
    seen.add(String(weight));
    portions.push({ label: clean, grams: weight });
    if (portions.length === LIMITS.maxPortions) break;
  }
  return portions.sort((a, b) => a.grams - b.grams);
}

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
      // Les plats de la table ont leurs propres repères de portion : ceux du modèle sont ignorés.
      portions: food_key === OTHER_FOOD_KEY ? parsePortions(it.portions) : [],
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
