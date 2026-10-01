import assert from 'node:assert/strict';
import { test } from 'node:test';

import { type Reminder, REMINDERS, remindersAreValid } from './reminders.ts';

const at = (id: string, hour: number, minute: number): Reminder => ({ id, hour, minute, bodyKey: 'reminders.lunch' });

test('REMINDERS : la liste livrée est programmable', () => {
  assert.ok(remindersAreValid(REMINDERS));
  // Les rappels tombent après le repas : on note ce qu'on a mangé, pas ce qu'on va manger.
  assert.ok(REMINDERS.every((r) => r.hour >= 9), 'aucun rappel avant la fin du petit-déjeuner');
  assert.equal(new Set(REMINDERS.map((r) => r.id)).size, REMINDERS.length);
});

test('remindersAreValid : refuse ce qui ne se programme pas', () => {
  assert.equal(remindersAreValid([]), false);
  assert.equal(remindersAreValid([at('a', 24, 0)]), false, 'heure hors bornes');
  assert.equal(remindersAreValid([at('a', 9, 60)]), false, 'minute hors bornes');
  assert.equal(remindersAreValid([at('a', 9, -1)]), false);
  assert.equal(remindersAreValid([at('a', 9.5, 0)]), false, 'heure non entière');
  assert.equal(remindersAreValid([at('a', 14, 0), at('b', 9, 0)]), false, 'pas dans l’ordre');
  // Deux rappels à la même minute n'en feraient qu'un sur le téléphone.
  assert.equal(remindersAreValid([at('a', 9, 0), at('b', 9, 0)]), false, 'même horaire');
  assert.equal(remindersAreValid([at('a', 9, 0), at('a', 14, 0)]), false, 'même identifiant');
  assert.ok(remindersAreValid([at('a', 0, 0), at('b', 23, 59)]), 'bornes acceptées');
});
