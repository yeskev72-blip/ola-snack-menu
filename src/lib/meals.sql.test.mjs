// Rejoue le SQL local de src/lib/meals.ts (migrations, fusion de la récupération) avec le SQLite de Node.
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

test('SQL local : migration phase 4 → v2 et fusion de la récupération', () => {
  // Extrait les migrations et requêtes directement du code source.
  const src = readFileSync('src/lib/meals.ts', 'utf8');
  const migrations = [...src.matchAll(/^  `([\s\S]*?)`,$/gm)].map((m) => m[1]);
  assert.equal(migrations.length, 2, 'deux migrations trouvées');

  const db = new DatabaseSync(':memory:');
  // État d'une installation « phase 4 » : table sans colonne deleted, user_version 0.
  db.exec(`CREATE TABLE meals (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, eaten_at TEXT NOT NULL, type_repas TEXT NOT NULL,
    items_json TEXT NOT NULL, total_json TEXT NOT NULL, confidence REAL, photo_path TEXT, correction_json TEXT, synced INTEGER NOT NULL DEFAULT 0);`);
  db.prepare(`INSERT INTO meals VALUES ('ancien','u','2026-09-20T12:00:00.000Z','dejeuner','[]','{"kcal":500}',NULL,NULL,NULL,0)`).run();

  const version = db.prepare('PRAGMA user_version').get().user_version;
  for (let v = version; v < migrations.length; v++) {
    db.exec('BEGIN'); db.exec(migrations[v]); db.exec(`PRAGMA user_version = ${v + 1}`); db.exec('COMMIT');
  }
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 2);
  assert.equal(db.prepare("SELECT deleted FROM meals WHERE id='ancien'").get().deleted, 0, 'repas phase 4 conservé');

  // Installation neuve.
  const fresh = new DatabaseSync(':memory:');
  for (const m of migrations) fresh.exec(m);

  // Fusion de la récupération : même SQL que pullRecent.
  const insert = src.match(/`(INSERT OR IGNORE INTO meals[\s\S]*?)`/)[1];
  const update = src.match(/`(UPDATE meals SET eaten_at = \?[\s\S]*?)`/)[1];
  db.prepare(`INSERT INTO meals VALUES ('local-attente','u','2026-09-21T12:00:00.000Z','diner','[]','{"kcal":1}',NULL,NULL,NULL,0,0)`).run();
  db.prepare(`INSERT INTO meals VALUES ('supprime-ailleurs','u','2026-09-22T12:00:00.000Z','diner','[]','{"kcal":2}',NULL,NULL,NULL,1,0)`).run();
  for (const m of [{ id: 'serveur', kcal: 700 }, { id: 'local-attente', kcal: 999 }]) {
    db.prepare(insert).run(m.id, 'u', '2026-09-23T10:00:00+00:00', 'dejeuner');
    db.prepare(update).run('2026-09-23T10:00:00.000Z', 'dejeuner', '[]', JSON.stringify({ kcal: m.kcal }), null, null, m.id);
  }
  const ids = ['serveur', 'local-attente'];
  const del = src.match(/`(DELETE FROM meals WHERE user_id = \? AND synced = 1 AND eaten_at >= \?)\$\{/)[1] + ` AND id NOT IN (${ids.map(() => '?').join(',')})`;
  db.prepare(del).run('u', '2026-08-20T00:00:00.000Z', ...ids);

  const rows = Object.fromEntries(db.prepare('SELECT id, total_json, synced FROM meals').all().map((r) => [r.id, r]));
  assert.equal(JSON.parse(rows.serveur.total_json).kcal, 700, 'repas du serveur rapatrié');
  assert.equal(rows.serveur.synced, 1);
  assert.equal(JSON.parse(rows['local-attente'].total_json).kcal, 1, 'repas local en attente jamais écrasé');
  assert.equal(rows['supprime-ailleurs'], undefined, 'repas supprimé sur un autre appareil retiré');
  assert.ok(rows.ancien, 'repas en attente hors serveur conservé');
});
