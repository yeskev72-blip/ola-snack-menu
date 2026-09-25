import type { Session as AuthSession, User } from '@supabase/supabase-js';
import Storage from 'expo-sqlite/kv-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { Profile, ProfileUpdate } from '@/lib/database.types';
import { clearLocalData } from '@/lib/meals';
import { supabase } from '@/lib/supabase';

type Status = 'loading' | 'signedOut' | 'signedIn';

export type SessionUser = {
  id: string;
  email: string | null;
  /** Compte invité : peut être converti en compte e-mail sans perdre ses données. */
  isAnonymous: boolean;
};

type Session = {
  status: Status;
  user: SessionUser | null;
  profile: Profile | null;
  /** Onboarding terminé = une cible calorique est enregistrée. */
  hasProfile: boolean;
  signInAsGuest: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  /** Crée le compte ; un code de confirmation est envoyé par e-mail. */
  signUp: (email: string, password: string) => Promise<void>;
  verifySignupCode: (email: string, code: string) => Promise<void>;
  resendSignupCode: (email: string) => Promise<void>;
  /** Invité → compte : envoie un code à la nouvelle adresse. */
  startLinkEmail: (email: string) => Promise<void>;
  /** Invité → compte : valide le code puis fixe le mot de passe. Même identifiant, données conservées. */
  finishLinkEmail: (email: string, code: string, password: string) => Promise<void>;
  updateProfile: (patch: ProfileUpdate) => Promise<void>;
  /** Déconnexion : efface aussi le journal et le profil gardés sur le téléphone. */
  signOut: () => Promise<void>;
  /** Supprime définitivement le compte et toutes ses données (serveur puis téléphone). */
  deleteAccount: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

const profileCacheKey = (userId: string) => `profile:${userId}`;

function toSessionUser(user: User): SessionUser {
  return { id: user.id, email: user.email || null, isAnonymous: user.is_anonymous ?? false };
}

/** Lève l'erreur Supabase pour que les écrans l'affichent via authErrorMessage(). */
function check<T extends { error: unknown }>(result: T): T {
  if (result.error) throw result.error;
  return result;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  // Profil : d'abord le cache local (l'app s'ouvre hors ligne), puis le serveur si joignable.
  const loadProfile = useCallback(async (userId: string) => {
    const cached = await Storage.getItem(profileCacheKey(userId));
    if (cached) setProfile(JSON.parse(cached) as Profile);

    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (!error && data) {
      setProfile(data);
      await Storage.setItem(profileCacheKey(userId), JSON.stringify(data));
    }
  }, []);

  const applySession = useCallback(
    async (session: AuthSession | null) => {
      if (!session) {
        setUser(null);
        setProfile(null);
        setStatus('signedOut');
        return;
      }
      setUser(toSessionUser(session.user));
      try {
        await loadProfile(session.user.id);
      } finally {
        // Même si le profil n'a pas pu être lu, on ne bloque pas l'app sur l'écran de démarrage.
        setStatus('signedIn');
      }
    },
    [loadProfile],
  );

  useEffect(() => {
    // Le callback reste synchrone : Supabase déconseille d'attendre d'autres appels auth dedans.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') return;
      if (event === 'USER_UPDATED' && session) {
        setUser(toSessionUser(session.user));
        return;
      }
      setTimeout(() => void applySession(session), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [applySession]);

  const value = useMemo<Session>(
    () => ({
      status,
      user,
      profile,
      hasProfile: profile?.calories_cible != null,

      signInAsGuest: async () => {
        check(await supabase.auth.signInAnonymously());
      },
      signIn: async (email, password) => {
        check(await supabase.auth.signInWithPassword({ email, password }));
      },
      signUp: async (email, password) => {
        check(await supabase.auth.signUp({ email, password }));
      },
      verifySignupCode: async (email, code) => {
        check(await supabase.auth.verifyOtp({ email, token: code, type: 'email' }));
      },
      resendSignupCode: async (email) => {
        check(await supabase.auth.resend({ type: 'signup', email }));
      },
      startLinkEmail: async (email) => {
        check(await supabase.auth.updateUser({ email }));
      },
      finishLinkEmail: async (email, code, password) => {
        check(await supabase.auth.verifyOtp({ email, token: code, type: 'email_change' }));
        check(await supabase.auth.updateUser({ password }));
        const { data } = await supabase.auth.getUser();
        if (data.user) setUser(toSessionUser(data.user));
      },
      updateProfile: async (patch) => {
        if (!user) throw new Error('Aucun utilisateur connecté');
        const { data } = check(await supabase.from('profiles').update(patch).eq('id', user.id).select('*').single());
        if (data) {
          setProfile(data);
          await Storage.setItem(profileCacheKey(user.id), JSON.stringify(data));
        }
      },
      signOut: async () => {
        if (user) {
          await clearLocalData(user.id);
          await Storage.removeItem(profileCacheKey(user.id));
        }
        // scope local : fonctionne même hors ligne.
        await supabase.auth.signOut({ scope: 'local' });
      },
      deleteAccount: async () => {
        if (!user) return;
        const { error } = await supabase.functions.invoke('delete-account', { body: {}, timeout: 30_000 });
        if (error) throw error;
        await clearLocalData(user.id);
        await Storage.removeItem(profileCacheKey(user.id));
        await supabase.auth.signOut({ scope: 'local' });
      },
    }),
    [status, user, profile],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession doit être utilisé dans <SessionProvider>');
  return session;
}
