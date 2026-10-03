import { useEffect, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { subscribeToast, TOAST_MS, type Toast } from '@/lib/toast';
import { colors, radius, spacing } from '@/theme';

/**
 * Affiche les messages de showToast. Monté une fois à la racine, au-dessus de tout le reste.
 *
 * Un nouveau message remplace celui qui s'affiche au lieu de faire la queue : ces messages
 * confirment une action qui vient d'avoir lieu, et un confirmation en retard désigne la
 * mauvaise action.
 */
export function Toaster() {
  const [toast, setToast] = useState<Toast | null>(null);
  // useState plutôt que useRef : la valeur est créée une seule fois sans être lue au rendu.
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => subscribeToast(setToast), []);

  useEffect(() => {
    if (!toast) return;
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(({ finished }) => {
        // Un message arrivé pendant la disparition a déjà remplacé celui-ci : ne pas l'effacer.
        if (finished) setToast((current) => (current?.id === toast.id ? null : current));
      });
    }, TOAST_MS[toast.duration]);
    return () => clearTimeout(timer);
  }, [toast, opacity]);

  if (!toast) return null;

  return (
    <Animated.View style={[styles.wrap, { opacity }]} pointerEvents="none">
      <AppText style={styles.text}>{toast.message}</AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: 96,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  text: { color: colors.onPrimary, fontWeight: '600', textAlign: 'center' },
});
