import { useCallback, useEffect, useState } from 'react';

/** Compte à rebours (en secondes) pour limiter les renvois de code. Démarre actif. */
export function useCooldown(seconds: number) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  const start = useCallback(() => setRemaining(seconds), [seconds]);
  return { remaining, start };
}
