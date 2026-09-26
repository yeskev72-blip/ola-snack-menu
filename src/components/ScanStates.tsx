import { type ReactNode, useEffect, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Icon, type IconName } from '@/components/Icon';
import { RoundButton } from '@/components/Screen';
import { t, type MessageKey } from '@/i18n';
import { colors, radius, shadow, spacing } from '@/theme';

const STEPS: MessageKey[] = ['scan.stepPhoto', 'scan.stepFoods', 'scan.stepPortions', 'scan.stepCalories'];
/** Moments (ms) où chaque étape se termine : indicatif, l'écran se ferme dès que la réponse arrive. */
const STEP_DONE_AT = [600, 5000, 11000];

/** Analyse en cours : photo balayée par une ligne lumineuse et étapes cochées au fil de l'attente. */
export function AnalyzingView({ photoUri, onCancel }: { photoUri: string; onCancel: () => void }) {
  const [step, setStep] = useState(0);
  const [sweep] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const timers = STEP_DONE_AT.map((ms, i) => setTimeout(() => setStep(i + 1), ms));
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(sweep, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      timers.forEach(clearTimeout);
      loop.stop();
    };
  }, [sweep]);

  return (
    <SafeAreaView style={styles.light} edges={['top']}>
      <View style={styles.photoWrap}>
        <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" accessibilityIgnoresInvertColors />
        <Animated.View
          style={[styles.sweep, { transform: [{ translateY: sweep.interpolate({ inputRange: [0, 1], outputRange: [0, 280] }) }] }]}
        />
      </View>
      <View style={styles.titles} accessibilityLiveRegion="polite">
        <AppText style={styles.title}>{t('scan.analyzingTitle')}</AppText>
        <AppText variant="muted">{t('scan.analyzingBody')}</AppText>
      </View>
      <View style={styles.steps}>
        {STEPS.map((key, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <View key={key} style={styles.step}>
              {done ? (
                <View style={[styles.stepIcon, styles.stepDone]}>
                  <Icon name="check" size={16} color={colors.onPrimary} strokeWidth={3} />
                </View>
              ) : current ? (
                <View style={[styles.stepIcon, styles.stepCurrent]}>
                  <View style={styles.dot} />
                  <View style={styles.dot} />
                  <View style={styles.dot} />
                </View>
              ) : (
                <View style={[styles.stepIcon, styles.stepTodo]} />
              )}
              <AppText style={[styles.stepText, current && styles.stepTextCurrent, !done && !current && styles.stepTextTodo]}>{t(key)}</AppText>
            </View>
          );
        })}
      </View>
      <View style={styles.flex} />
      <Button label={t('common.cancel')} variant="ghost" onPress={onCancel} />
    </SafeAreaView>
  );
}

type Action = { label: string; onPress: () => void; icon?: IconName };

/** Écran d'état (pas de réseau, service saturé, quota atteint) : illustration, message, actions. */
export function StatusView({
  icon,
  badge,
  title,
  body,
  notCounted,
  primary,
  secondary,
  onClose,
  children,
}: {
  icon: IconName;
  badge?: IconName;
  title: string;
  body: string;
  notCounted?: boolean;
  primary?: Action;
  secondary?: Action;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <SafeAreaView style={styles.light} edges={['top']}>
      <RoundButton icon="close" label={t('common.close')} onPress={onClose} />
      <View style={styles.statusBody}>
        <View style={styles.illustration}>
          <Icon name={icon} size={56} color={colors.accent} strokeWidth={1.8} />
          {badge ? (
            <View style={styles.badge}>
              <Icon name={badge} size={22} color={colors.onPrimary} />
            </View>
          ) : null}
        </View>
        <AppText style={styles.statusTitle} accessibilityRole="header">
          {title}
        </AppText>
        <AppText variant="muted" style={styles.statusText}>
          {body}
        </AppText>
        {notCounted ? (
          <View style={styles.notCounted}>
            <Icon name="check" size={16} color={colors.success} strokeWidth={2.6} />
            <AppText style={styles.notCountedText}>{t('scan.notCounted')}</AppText>
          </View>
        ) : null}
        {children}
      </View>
      <View style={styles.actions}>
        {primary ? <Button label={primary.label} icon={primary.icon} onPress={primary.onPress} /> : null}
        {secondary ? <Button label={secondary.label} variant="secondary" onPress={secondary.onPress} /> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  light: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: spacing.lg },
  flex: { flex: 1 },
  photoWrap: { height: 280, borderRadius: 28, overflow: 'hidden', backgroundColor: colors.surfaceAlt, ...shadow.card },
  photo: { width: '100%', height: '100%' },
  sweep: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 3,
    backgroundColor: colors.surface,
    shadowColor: '#E9A05A',
    shadowOpacity: 0.9,
    shadowRadius: 12,
    elevation: 6,
  },
  titles: { gap: 6 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '800', letterSpacing: -0.5 },
  steps: { gap: 4, backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, ...shadow.card },
  step: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 3 },
  stepDone: { backgroundColor: colors.success },
  stepCurrent: { backgroundColor: colors.accentSoft },
  stepTodo: { borderWidth: 2, borderColor: colors.border },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent },
  stepText: { fontWeight: '600' },
  stepTextCurrent: { fontWeight: '700' },
  stepTextTodo: { fontWeight: '500', color: colors.textMuted },
  statusBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  illustration: { width: 132, height: 132, borderRadius: 66, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    right: -6,
    bottom: 0,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    borderWidth: 4,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitle: { marginTop: spacing.sm, fontSize: 26, lineHeight: 32, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
  statusText: { fontSize: 17, lineHeight: 25, textAlign: 'center' },
  notCounted: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  notCountedText: { fontSize: 14, lineHeight: 18, fontWeight: '600', color: colors.primaryPressed },
  actions: { gap: 12 },
});
