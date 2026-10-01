import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { t } from '@/i18n';
import { hasAskedReminders, markRemindersAsked, setRemindersEnabled } from '@/lib/remindersStore';
import { colors, radius, spacing } from '@/theme';

/**
 * Proposition des rappels, à la première ouverture du journal.
 *
 * Android ne permet de demander l'autorisation qu'une seule fois, et un refus est définitif.
 * On explique donc d'abord à quoi servent les rappels, et la demande système n'est déclenchée
 * que sur un « oui » — la fenêtre d'Android n'est pas dépensée sur quelqu'un qui n'en veut pas.
 *
 * Posée une seule fois, quelle que soit la réponse : une app qui redemande à chaque ouverture
 * se fait désinstaller. Le réglage reste accessible dans le profil.
 */
export function RemindersPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    void hasAskedReminders().then((asked) => setShow(!asked));
  }, []);

  if (!show) return null;

  const answer = (yes: boolean) => {
    setShow(false);
    void markRemindersAsked();
    if (yes) void setRemindersEnabled(true);
  };

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Icon name="clock" size={20} color={colors.accent} />
        <AppText style={styles.title}>{t('reminders.askTitle')}</AppText>
      </View>
      <AppText variant="small">{t('reminders.askBody')}</AppText>
      <View style={styles.actions}>
        <Button label={t('reminders.askYes')} variant="accent" onPress={() => answer(true)} />
        <Button label={t('reminders.askNo')} variant="ghost" onPress={() => answer(false)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.card, backgroundColor: colors.accentSoft },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontWeight: '700', flex: 1 },
  actions: { gap: spacing.xs },
});
