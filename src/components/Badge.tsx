import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Icon, type IconName } from '@/components/Icon';
import { colors, radius, spacing } from '@/theme';

/**
 * Pastille accolée à un aliment, qui dit d'où vient son chiffre.
 *
 * Deux tons seulement, repris des fondations : feuille pour une valeur vérifiée, terre douce
 * pour une estimation. Un symbole accompagne la couleur, sinon l'information disparaît pour qui
 * distingue mal le vert du brun.
 */
type Tone = 'verified' | 'estimated';

const TONES: Record<Tone, { bg: string; fg: string; icon: IconName }> = {
  verified: { bg: colors.successSoft, fg: colors.success, icon: 'check' },
  estimated: { bg: colors.accentSoft, fg: colors.accentStrong, icon: 'alert' },
};

export function Badge({ label, tone = 'estimated' }: { label: string; tone?: Tone }) {
  const { bg, fg, icon } = TONES[tone];
  return (
    <View style={[styles.box, { backgroundColor: bg }]}>
      <Icon name={icon} size={12} color={fg} strokeWidth={2.6} />
      <AppText style={[styles.text, { color: fg }]}>{label}</AppText>
    </View>
  );
}
const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  text: { fontSize: 11, lineHeight: 14, fontWeight: '700' },
});
