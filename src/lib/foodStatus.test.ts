import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isUnverified } from './foodStatus.ts';

const food = (verified: boolean) => ({ verified });

test('isUnverified : seul un verified explicitement faux est signalé', () => {
  assert.equal(isUnverified(food(false)), true);
  assert.equal(isUnverified(food(true)), false);
  // Un aliment absent (élément hors table) n'est pas « à confirmer » : il est « estimé »,
  // ce que l'app signale séparément. Ne pas confondre les deux marqueurs.
  assert.equal(isUnverified(undefined), false);
  assert.equal(isUnverified(null), false);
});
