import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { t } from '@/i18n';
import { colors, radius, spacing } from '@/theme';

/**
 * Demande de confirmation, posée par l'app elle-même.
 *
 * Alert.alert de React Native n'existe pas sur le web : l'appel n'y produit rien du tout. Les
 * actions placées derrière une confirmation — supprimer un repas, supprimer son compte — ne
 * partaient donc jamais, sans le moindre message. Cette boîte est construite avec Modal, que
 * react-native-web rend correctement, donc elle se comporte pareil sur les deux plateformes et
 * ressemble au reste de l'application.
 */

type Options = {
  title: string;
  body?: string;
  /** Libellé du bouton qui valide. Par défaut « Continuer ». */
  confirmLabel?: string;
  /** Action irréversible : le bouton de validation passe en rouge. */
  destructive?: boolean;
};

type Ask = (options: Options) => Promise<boolean>;

const ConfirmContext = createContext<Ask | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<Options | null>(null);
  // La promesse rendue à l'appelant attend que l'un des deux boutons soit touché.
  const answer = useRef<((ok: boolean) => void) | null>(null);

  const ask = useCallback<Ask>(
    (next) =>
      new Promise<boolean>((resolve) => {
        // Une demande déjà ouverte est refusée plutôt que remplacée : son appelant attend
        // toujours une réponse, et la laisser en suspens le figerait pour de bon.
        answer.current?.(false);
        answer.current = resolve;
        setOptions(next);
      }),
    [],
  );

  const close = (ok: boolean) => {
    setOptions(null);
    const resolve = answer.current;
    answer.current = null;
    resolve?.(ok);
  };

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      <Modal visible={options !== null} transparent animationType="fade" onRequestClose={() => close(false)}>
        {/* Toucher en dehors annule, comme le ferait le bouton retour d'Android. */}
        <Pressable style={styles.backdrop} onPress={() => close(false)}>
          {/* Le contenu absorbe le toucher pour ne pas se fermer quand on vise un bouton. */}
          <Pressable style={styles.card} onPress={() => undefined}>
            <AppText style={styles.title}>{options?.title}</AppText>
            {options?.body ? <AppText variant="muted">{options.body}</AppText> : null}
            <View style={styles.actions}>
              <Button
                label={options?.confirmLabel ?? t('common.continue')}
                variant={options?.destructive ? 'danger' : 'primary'}
                onPress={() => close(true)}
              />
              <Button label={t('common.cancel')} variant="ghost" onPress={() => close(false)} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): Ask {
  const ask = useContext(ConfirmContext);
  if (!ask) throw new Error('useConfirm doit être utilisé dans <ConfirmProvider>');
  return ask;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(27, 21, 17, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '800' },
  actions: { gap: spacing.xs, marginTop: spacing.sm },
});
