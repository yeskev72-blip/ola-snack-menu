import { useCallback, useState } from 'react';

import { authErrorMessage } from '@/lib/authErrors';

/** Enveloppe une action asynchrone : état de chargement + message d'erreur en français. */
export function useAction<Args extends unknown[]>(action: (...args: Args) => Promise<void>) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (...args: Args): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        await action(...args);
        return true;
      } catch (e) {
        setError(authErrorMessage(e));
        return false;
      } finally {
        setLoading(false);
      }
    },
    [action],
  );

  return { run, loading, error, setError };
}
