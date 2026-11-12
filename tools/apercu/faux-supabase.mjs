/**
 * Supabase de substitution, pour voir l'app dans un navigateur sans toucher au vrai projet.
 *
 * Il répond juste assez pour que le mode invité s'ouvre sur un profil complet : l'app atteint
 * alors le journal, et on peut regarder les écrans. Aucune donnée réelle, aucune clé.
 */
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const UID = '11111111-2222-3333-4444-555555555555';

/** La vraie table du dépôt : les écrans montrent ainsi les plats et leurs pastilles. */
const plats = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../supabase/seed/foods.json', import.meta.url)), 'utf8'),
).map((f, i) => ({ ...f, id: `food-${i}`, updated_at: new Date().toISOString() }));
const PORT = Number(process.env.PORT ?? 8300);

const session = {
  access_token: 'faux', token_type: 'bearer', expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'faux-refresh',
  user: { id: UID, aud: 'authenticated', role: 'authenticated', email: null, phone: '',
    is_anonymous: true, app_metadata: {}, user_metadata: {}, identities: [],
    created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
};
/** OBJECTIF=prise|perte|maintien : l'écran du jour ne met pas le même chiffre en grand. */
const OBJECTIF = process.env.OBJECTIF ?? 'maintien';

const profil = { id: UID, prenom: 'Arnaud', sexe: 'homme', age: 30, taille_cm: 175, poids_kg: 70,
  niveau_activite: 1.375, objectif: OBJECTIF, calories_cible: 2200, plan: 'free',
  partage_photos: false, premium_until: null,
  created_at: new Date().toISOString(), updated_at: new Date().toISOString() };

/**
 * PROFIL=vide sert un compte sans profil : l'app part alors dans le parcours d'accueil, seul
 * moyen d'atteindre l'écran de la cible, qu'un profil complet saute.
 */
const VIDE = process.env.PROFIL === 'vide';

http.createServer((req, res) => {
  const entetes = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': '*', 'Access-Control-Expose-Headers': '*',
    'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') { res.writeHead(204, entetes); return res.end(); }
  const chemin = req.url.split('?')[0];
  let corps = [];
  if (chemin.startsWith('/auth/v1/signup') || chemin.startsWith('/auth/v1/token')) corps = session;
  else if (chemin.startsWith('/auth/v1/user')) corps = session.user;
  else if (chemin.startsWith('/rest/v1/profiles')) corps = req.method === 'PATCH' ? profil : VIDE ? [] : [profil];
  else if (chemin.startsWith('/rest/v1/foods')) corps = plats;
  res.writeHead(200, entetes);
  res.end(JSON.stringify(corps));
}).listen(PORT, '127.0.0.1', () => console.error(`faux Supabase sur ${PORT}`));
