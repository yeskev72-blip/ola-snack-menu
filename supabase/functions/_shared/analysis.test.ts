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
