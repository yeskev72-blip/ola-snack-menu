import Storage from 'expo-sqlite/kv-store';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { t } from '@/i18n';
import { promptInstall, useInstallOffer } from '@/lib/install';
import { colors, radius, spacing } from '@/theme';

/**
 * Proposition d'installer Calbasse sur l'écran d'accueil.
 *
 * Le navigateur ne la propose que dans son propre menu, où personne ne va la chercher. Posée
 * dans le journal, après la première photo, elle arrive au moment où l'app a déjà servi à
 * quelque chose — pas à la seconde où l'on arrive.
 *
 * Écartée une fois, elle ne revient pas : l'installation reste accessible depuis le menu du
 * navigateur, et insister est le meilleur moyen de faire fermer l'onglet.
 */
const DISMISSED = 'install:dismissed:v1';

export function InstallBanner() {
  const offer = useInstallOffer();
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    void Storage.getItem(DISMISSED)
      .then((value) => setHidden(value === '1'))
      // Stockage indisponible : on propose quand même, c'est sans conséquence.
      .catch(() => setHidden(false));
  }, []);

  if (!offer || hidden) return null;

  const dismiss = () => {
    setHidden(true);
    void Storage.setItem(DISMISSED, '1').catch(() => undefined);
  };

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Icon name="phone" size={20} color={colors.accent} />
        <AppText style={styles.title}>{t('install.title')}</AppText>
      </View>
      <AppText variant="small">{t(offer === 'ios' ? 'install.bodyIOS' : 'install.body')}</AppText>
      <View style={styles.actions}>
        {offer === 'prompt' ? (
          <Button
            label={t('install.action')}
            variant="accent"
            onPress={() => {
              dismiss();
              void promptInstall();
            }}
          />
        ) : null}
        <Button label={t('install.later')} variant="ghost" onPress={dismiss} />
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
