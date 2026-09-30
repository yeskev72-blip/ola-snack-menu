import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildResponseSchema, buildSystemPrompt, buildUserText, LIMITS, OTHER_FOOD_KEY, parseRequest, validateModelOutput } from './analysis.ts';
import { FOODS, JPEG_B64, KEYS, VALID_OUTPUT } from './fixtures.ts';

test('parseRequest : scan simple avec indice', () => {
  const r = parseRequest({ image_base64: JPEG_B64, hint: '  riz, sauce arachide  ' });
  assert.ok(r.ok);
  assert.equal(r.value.hint, 'riz, sauce arachide');
  assert.equal(r.value.scanId, null);
  assert.deepEqual(r.value.answers, []);
});

test('parseRequest : refus des entrées invalides', () => {
  assert.equal(parseRequest(null).ok, false);
  assert.equal(parseRequest({}).ok, false);
  assert.equal(parseRequest({ image_base64: 'data:image/jpeg;base64,/9j/' }).ok, false, 'préfixe data: refusé');
  assert.equal(parseRequest({ image_base64: 'iVBORw0KGgo' }).ok, false, 'PNG refusé');
  assert.equal(parseRequest({ image_base64: '/9j/' + 'A'.repeat(LIMITS.maxImageBase64Length) }).ok, false, 'trop lourd');
  assert.equal(parseRequest({ image_base64: JPEG_B64, hint: 42 }).ok, false);
  assert.equal(parseRequest({ image_base64: JPEG_B64, answers: [] }).ok, false, 'answers sans scan_id');
  assert.equal(parseRequest({ image_base64: JPEG_B64, scan_id: 'pas-un-uuid', answers: [] }).ok, false);
});

test('parseRequest : relance avec réponses', () => {
  const scan_id = '6f1c2f4e-8b1a-4c43-9a51-3d2f0e6b7a10';
  assert.equal(parseRequest({ image_base64: JPEG_B64, scan_id }).ok, false, 'réponses obligatoires');
  const r = parseRequest({ image_base64: JPEG_B64, scan_id, answers: [{ question: 'Sauce ?', answer: 'Graine' }] });
  assert.ok(r.ok);
  assert.equal(r.value.scanId, scan_id);
  assert.equal(r.value.answers.length, 1);
  const tooMany = Array.from({ length: 3 }, () => ({ question: 'q', answer: 'a' }));
  assert.equal(parseRequest({ image_base64: JPEG_B64, scan_id, answers: tooMany }).ok, false);
});

test('prompt système : liste des plats et règles clés', () => {
  const prompt = buildSystemPrompt(FOODS);
  for (const f of FOODS) assert.ok(prompt.includes(`- ${f.food_key} : ${f.label_fr}`));
  assert.ok(prompt.includes('mafé'), 'alias inclus');
  assert.ok(prompt.includes('louche ≈ 120 g'), 'repères inclus');
  assert.ok(prompt.includes("l'huile de cuisson"));
  assert.ok(prompt.includes('Afrique de l'));
});

// Un aliment hors liste doit être rendu tel quel via « autre », jamais remplacé par le plat
// le plus ressemblant de la liste : une pomme avait été identifiée comme un ananas.
test('prompt système : la liste ne doit pas brider les aliments reconnus', () => {
  const prompt = buildSystemPrompt(FOODS);
  assert.ok(prompt.includes('monde entier'), 'le rôle ne se limite pas à une cuisine régionale');
  assert.ok(prompt.includes('INTERDIT'), 'la substitution est explicitement interdite');
  assert.ok(prompt.includes(OTHER_FOOD_KEY), 'le repli hors liste est décrit');
  assert.equal(/choisis en priorité un food_key/.test(prompt), false, 'plus de biais vers la liste');
  // La consigne doit venir APRÈS la liste : c'est la fin du prompt qui pèse le plus.
  assert.ok(prompt.indexOf('RAPPEL FINAL') > prompt.indexOf('LISTE DE RÉFÉRENCE'), 'rappel placé après la liste');
  assert.ok(prompt.trimEnd().endsWith("qu'un food_key de la liste posé sur le mauvais aliment."), 'le prompt finit par la consigne');
});

// L'estimation du poids est la principale source d'erreur sur les calories : le prompt doit donner
// une méthode (échelle → volume → densité), et des poids courants pour les aliments hors liste.
test('prompt système : méthode d’estimation des portions', () => {
  const prompt = buildSystemPrompt(FOODS);
  assert.ok(prompt.includes("Trouve l'échelle"), 'étape de mise à l’échelle');
  assert.ok(prompt.includes('Juge le volume'), 'volume plutôt que surface');
  assert.ok(prompt.includes('g/ml'), 'densités fournies');
  assert.ok(/petite 100 g, moyenne 150 g, grosse 220 g/.test(prompt), 'poids courants hors liste, du petit au gros');
  // Une pomme de 100 g avait été annoncée à 180 g : l'ancienne consigne « ≈ 150 à 200 g » rendait
  // la bonne réponse impossible. Le poids doit se mesurer, pas se recopier.
  assert.ok(prompt.includes('6 cm ≈ 100 g'), 'échelle diamètre → poids');
  assert.ok(prompt.includes('cube du diamètre'), 'le poids varie au cube, pas linéairement');
  assert.equal(/\(pomme, orange, mangue\) ≈ 150 à 200 g/.test(prompt), false, 'plus de fourchette qui exclut les petits fruits');
});

// Le modèle juge mal les tailles : il fournit des portions nommées pour que l'utilisateur
// corrige d'un appui, comme le font Cal AI ou MyFitnessPal, sans table d'aliments occidentaux.
test('prompt système : portions nommées pour les aliments hors table', () => {
  const prompt = buildSystemPrompt(FOODS);
  assert.ok(prompt.includes('portions'), 'le champ est demandé');
  assert.ok(/petite pomme/.test(prompt), 'exemple de fruit entier');
  assert.ok(/1 louche/.test(prompt), 'exemple de plat en sauce');
  assert.ok(/renvoie une liste vide/.test(prompt), 'rien à proposer pour un plat de la table');
});

test('schéma : portions déclarées et bornées', () => {
  const item = buildResponseSchema([...KEYS]).properties.items.items;
  assert.equal(item.properties.portions.maxItems, LIMITS.maxPortions);
  assert.deepEqual(item.properties.portions.items.required, ['label', 'grams']);
  assert.ok(item.required.includes('portions'));
});

test('validation : portions nettoyées, triées et bornées', () => {
  const withPortions = (portions: unknown) =>
    JSON.stringify({
      ...VALID_OUTPUT,
      items: [
        {
          food_key: 'autre',
          label: 'Pomme',
          grams: 150,
          confidence: 0.5,
          estimate_100g: { kcal: 52, proteines: 0.3, glucides: 14, lipides: 0.2 },
          portions,
        },
      ],
    });
  const parse = (portions: unknown) => {
    const r = validateModelOutput(withPortions(portions), KEYS, { allowQuestions: true });
    assert.ok(r.ok);
    return r.value.items[0]!.portions;
  };

  assert.deepEqual(
    parse([
      { label: 'grosse pomme', grams: 220 },
      { label: 'petite pomme', grams: 100 },
      { label: 'pomme moyenne', grams: 150 },
    ]),
    [
      { label: 'petite pomme', grams: 100 },
      { label: 'pomme moyenne', grams: 150 },
      { label: 'grosse pomme', grams: 220 },
    ],
    'triées du plus léger au plus lourd',
  );

  // Une portion mal formée est ignorée : elle n'aide qu'à corriger, elle ne doit pas faire
  // échouer un scan par ailleurs valide.
  assert.deepEqual(parse([{ label: '', grams: 100 }, { label: 'ok', grams: 0 }, { label: 'ok', grams: 'x' }]), []);
  assert.deepEqual(parse('pas un tableau'), []);
  assert.deepEqual(parse(undefined), [], 'champ absent : ancienne réponse acceptée');
  assert.deepEqual(parse([{ label: 'une', grams: 100 }, { label: 'autre', grams: 100 }]).length, 1, 'même poids : une seule');
  assert.equal(parse(Array.from({ length: 9 }, (_, i) => ({ label: `p${i}`, grams: (i + 1) * 10 }))).length, LIMITS.maxPortions);
  assert.equal(parse([{ label: 'x'.repeat(99), grams: 100 }])[0]!.label.length, LIMITS.maxPortionLabelLength);
  assert.equal(parse([{ label: 'énorme', grams: 99999 }])[0]!.grams, LIMITS.maxGrams, 'poids plafonné');
});

// Les plats de la table ont leurs propres repères : ceux du modèle ne doivent pas les remplacer.
test('validation : portions ignorées pour un plat de la table', () => {
  const base = structuredClone(VALID_OUTPUT);
  const out = { ...base, items: base.items.map((it) => ({ ...it, portions: [{ label: 'inventée', grams: 111 }] })) };
  const r = validateModelOutput(JSON.stringify(out), KEYS, { allowQuestions: true });
  assert.ok(r.ok);
  assert.deepEqual(r.value.items[0]!.portions, []);
});

test('texte utilisateur : indice et réponses', () => {
  assert.match(buildUserText({ hint: null, answers: [] }), /pas donné d'indice/);
  const text = buildUserText({ hint: 'riz', answers: [{ question: 'Sauce ?', answer: 'Graine' }] });
  assert.match(text, /« riz »/);
  assert.match(text, /Sauce \? → Graine/);
  assert.match(text, /Ne pose plus de question/);
});

test('schéma : food_key limité à la table + « autre »', () => {
  const schema = buildResponseSchema([...KEYS]);
  const enumKeys = schema.properties.items.items.properties.food_key.enum;
  assert.deepEqual(enumKeys, [...KEYS, OTHER_FOOD_KEY]);
  assert.deepEqual(schema.required, ['not_food', 'items', 'questions', 'confidence_globale']);
});

test('validation : réponse correcte', () => {
  const r = validateModelOutput(JSON.stringify(VALID_OUTPUT), KEYS, { allowQuestions: true });
  assert.ok(r.ok);
  assert.equal(r.value.items.length, 2);
  assert.equal(r.value.questions.length, 1);
});

test('validation : bornes et arrondis corrigés', () => {
  const out = structuredClone(VALID_OUTPUT);
  out.items[0]!.grams = 99999;
  out.items[0]!.confidence = 1.7;
  out.confidence_globale = -1;
  const r = validateModelOutput(JSON.stringify(out), KEYS, { allowQuestions: true });
  assert.ok(r.ok);
  assert.equal(r.value.items[0]!.grams, LIMITS.maxGrams);
  assert.equal(r.value.items[0]!.confidence, 1);
  assert.equal(r.value.confidence_globale, 0);
});

test('validation : questions retirées pendant une relance', () => {
  const r = validateModelOutput(JSON.stringify(VALID_OUTPUT), KEYS, { allowQuestions: false });
  assert.ok(r.ok);
  assert.deepEqual(r.value.questions, []);
});

test('validation : « autre » exige une estimation plausible', () => {
  const other = (estimate_100g: unknown) =>
    JSON.stringify({ ...VALID_OUTPUT, items: [{ food_key: 'autre', label: 'Kom', grams: 100, confidence: 0.4, estimate_100g }] });
  assert.equal(validateModelOutput(other(null), KEYS, { allowQuestions: true }).ok, false);
  assert.equal(validateModelOutput(other({ kcal: 2000, proteines: 1, glucides: 1, lipides: 1 }), KEYS, { allowQuestions: true }).ok, false);
  const r = validateModelOutput(other({ kcal: 150.44, proteines: 3, glucides: 20, lipides: 6 }), KEYS, { allowQuestions: true });
  assert.ok(r.ok);
  assert.deepEqual(r.value.items[0]!.estimate_100g, { kcal: 150.4, proteines: 3, glucides: 20, lipides: 6 });
});

test('validation : estimation ignorée pour un plat de la table', () => {
  const out = structuredClone(VALID_OUTPUT) as { items: { estimate_100g: unknown }[] };
  out.items[0]!.estimate_100g = { kcal: 999, proteines: 0, glucides: 0, lipides: 0 };
  const r = validateModelOutput(JSON.stringify(out), KEYS, { allowQuestions: true });
  assert.ok(r.ok);
  assert.equal(r.value.items[0]!.estimate_100g, null, 'les calories viennent de la table, pas du modèle');
});

test('validation : erreurs de structure', () => {
  const v = (o: unknown) => validateModelOutput(typeof o === 'string' ? o : JSON.stringify(o), KEYS, { allowQuestions: true }).ok;
  assert.equal(v('pas du json'), false);
  assert.equal(v({ ...VALID_OUTPUT, items: [] }), false, 'repas sans élément');
  assert.equal(v({ ...VALID_OUTPUT, items: [{ ...VALID_OUTPUT.items[0], food_key: 'pizza' }] }), false, 'clé inventée');
  assert.equal(v({ ...VALID_OUTPUT, items: [{ ...VALID_OUTPUT.items[0], grams: 0 }] }), false);
  assert.equal(v({ ...VALID_OUTPUT, questions: [{ id: 'q', text: 'Sauce ?', options: ['une seule'] }] }), false);
  const { not_food: _omitted, ...withoutNotFood } = VALID_OUTPUT;
  assert.equal(v(withoutNotFood), false);
});

test('validation : photo sans nourriture', () => {
  const r = validateModelOutput(JSON.stringify({ not_food: true, items: [], questions: [], confidence_globale: 0.9 }), KEYS, {
    allowQuestions: true,
  });
  assert.ok(r.ok);
  assert.equal(r.value.not_food, true);
  assert.deepEqual(r.value.items, []);
});
