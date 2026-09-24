/**
 * Edge Function delete-account : supprime définitivement le compte de l'utilisateur connecté.
 * Les tables (profil, repas, éléments, corrections, quota, scans) partent en cascade avec
 * auth.users ; les photos éventuelles du bucket sont supprimées avant.
 */

export type Deps = {
  getUser: (token: string) => Promise<{ id: string } | null>;
  deletePhotos: (userId: string) => Promise<number>;
  deleteUser: (userId: string) => Promise<void>;
  log: (message: string, extra?: Record<string, unknown>) => void;
};

const HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: HEADERS });

export function createHandler(deps: Deps) {
  return async function handle(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS });
    if (req.method !== 'POST') return json(405, { error: 'method_not_allowed', message: 'Utilise POST.' });

    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim();
    const user = token ? await deps.getUser(token).catch(() => null) : null;
    if (!user) return json(401, { error: 'unauthorized', message: 'Connexion requise.' });

    try {
      const photos = await deps.deletePhotos(user.id);
      await deps.deleteUser(user.id);
      deps.log('compte supprimé', { userId: user.id, photos });
      return json(200, { ok: true });
    } catch (e) {
      deps.log('suppression du compte impossible', { userId: user.id, error: String(e) });
      return json(500, { error: 'internal_error', message: 'La suppression a échoué. Réessaie.' });
    }
  };
}
