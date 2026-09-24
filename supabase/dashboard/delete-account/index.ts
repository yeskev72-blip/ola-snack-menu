// Edge Function delete-account : version en un seul fichier pour l'éditeur du tableau de bord Supabase.
// GÉNÉRÉ par scripts/build-dashboard-files.sh depuis supabase/functions/delete-account. Ne pas modifier à la main.
// Réglage requis : « Verify JWT » désactivé (le jeton est vérifié dans le code).
// supabase/functions/delete-account/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";

// supabase/functions/delete-account/handler.ts
var HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
var json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: HEADERS
});
function createHandler(deps) {
  return async function handle(req) {
    if (req.method === "OPTIONS") return new Response(null, {
      status: 204,
      headers: HEADERS
    });
    if (req.method !== "POST") return json(405, {
      error: "method_not_allowed",
      message: "Utilise POST."
    });
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
    const user = token ? await deps.getUser(token).catch(() => null) : null;
    if (!user) return json(401, {
      error: "unauthorized",
      message: "Connexion requise."
    });
    try {
      const photos = await deps.deletePhotos(user.id);
      await deps.deleteUser(user.id);
      deps.log("compte supprim\xE9", {
        userId: user.id,
        photos
      });
      return json(200, {
        ok: true
      });
    } catch (e) {
      deps.log("suppression du compte impossible", {
        userId: user.id,
        error: String(e)
      });
      return json(500, {
        error: "internal_error",
        message: "La suppression a \xE9chou\xE9. R\xE9essaie."
      });
    }
  };
}

// supabase/functions/delete-account/index.ts
var url = Deno.env.get("SUPABASE_URL");
var serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !serviceKey) throw new Error("SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis");
var admin = createClient(url, serviceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
var BUCKET = "meal-photos";
Deno.serve(createHandler({
  async getUser(token) {
    const { data, error } = await admin.auth.getUser(token);
    return error || !data.user ? null : {
      id: data.user.id
    };
  },
  async deletePhotos(userId) {
    let removed = 0;
    for (; ; ) {
      const { data, error } = await admin.storage.from(BUCKET).list(userId, {
        limit: 100
      });
      if (error) throw error;
      if (!data || data.length === 0) return removed;
      const { error: removeError } = await admin.storage.from(BUCKET).remove(data.map((f) => `${userId}/${f.name}`));
      if (removeError) throw removeError;
      removed += data.length;
    }
  },
  async deleteUser(userId) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;
  },
  log: (message, extra) => console.log(JSON.stringify({
    message,
    ...extra
  }))
}));
