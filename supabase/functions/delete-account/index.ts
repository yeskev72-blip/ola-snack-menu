/**
 * Edge Function delete-account (Deno). Fournis automatiquement par Supabase :
 * SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

import { createHandler } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !serviceKey) throw new Error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis');

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const BUCKET = 'meal-photos';

Deno.serve(
  createHandler({
    async getUser(token) {
      const { data, error } = await admin.auth.getUser(token);
      return error || !data.user ? null : { id: data.user.id };
    },

    async deletePhotos(userId) {
      let removed = 0;
      // Par lots de 100 jusqu'à ce que le dossier de l'utilisateur soit vide.
      for (;;) {
        const { data, error } = await admin.storage.from(BUCKET).list(userId, { limit: 100 });
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

    log: (message, extra) => console.log(JSON.stringify({ message, ...extra })),
  }),
);
