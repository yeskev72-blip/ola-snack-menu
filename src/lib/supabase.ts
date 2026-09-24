import { createClient } from '@supabase/supabase-js';
import Storage from 'expo-sqlite/kv-store';
import { AppState } from 'react-native';

import type { Database } from '@/lib/database.types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** false si le fichier .env n'est pas rempli : l'app affiche alors un écran d'aide. */
export const isSupabaseConfigured = Boolean(url && anonKey);

// Seules l'URL et la clé publique (anon) sont embarquées dans l'app. Aucune autre clé.
export const supabase = createClient<Database>(url ?? 'http://localhost', anonKey ?? 'missing', {
  auth: {
    storage: Storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Le rafraîchissement du jeton ne tourne qu'au premier plan (économie de batterie et de données).
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
