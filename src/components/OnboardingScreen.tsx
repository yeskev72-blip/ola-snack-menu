import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { RoundButton, Screen } from '@/components/Screen';
import { t } from '@/i18n';
import { colors } from '@/theme';

export const ONBOARDING_STEPS = 5;

type Props = {
  step: number;
  children: ReactNode;
  /** Bouton principal en bas. */
  cta: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean };
  extra?: ReactNode;
};

/** Écran d'onboarding : retour, barre de progression fine, une question, bouton en bas. */
export function OnboardingScreen({ step, children, cta, extra }: Props) {
  return (
    <Screen
      header={
        <View style={styles.header}>
          {step > 1 ? <RoundButton icon="back" label={t('common.back')} onPress={() => router.back()} /> : null}
          <View
            style={styles.track}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={t('onboarding.step', { current: step, total: ONBOARDING_STEPS })}
            accessibilityValue={{ min: 0, max: ONBOARDING_STEPS, now: step }}>
            <View style={[styles.fill, { width: `${(step / ONBOARDING_STEPS) * 100}%` }]} />
          </View>
        </View>
      }
      footer={
        <>
          <Button label={cta.label} disabled={cta.disabled} loading={cta.loading} onPress={cta.onPress} />
          {extra}
        </>
      }>
      {children}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 48 },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: colors.primary },
});
