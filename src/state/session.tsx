import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * État de session minimal. En phase 1 il vit en mémoire pour faire tourner la
 * navigation ; la phase 2 le branche sur Supabase Auth et le profil distant.
 */
type Session = {
  isSignedIn: boolean;
  hasProfile: boolean;
  signInAsGuest: () => void;
  completeOnboarding: () => void;
  signOut: () => void;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [isSignedIn, setSignedIn] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);

  const value = useMemo<Session>(
    () => ({
      isSignedIn,
      hasProfile,
      signInAsGuest: () => setSignedIn(true),
      completeOnboarding: () => setHasProfile(true),
      signOut: () => {
        setSignedIn(false);
        setHasProfile(false);
      },
    }),
    [isSignedIn, hasProfile],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession doit être utilisé dans <SessionProvider>');
  return session;
}
