import { Redirect } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { MACROS } from '@/components/Macros';
import { Notice } from '@/components/Notice';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { Stepper } from '@/components/Stepper';
import { t } from '@/i18n';
import { ACTIVITY_LEVELS, clampTarget, dailyTarget, MACRO_SPLIT, macroTargets, TARGET_BOUNDS } from '@/lib/calories';
import { formatNumber } from '@/lib/format';
import { useAction } from '@/lib/useAction';
import { useOnboardingDraft } from '@/state/onboardingDraft';
import { useSession } from '@/state/session';
import { colors, radius, spacing } from '@/theme';

const SIZE = 200;
const STROKE = 16;

/** Anneau tricolore : part des calories apportée par chaque macro. */
function MacroRing({ kcal }: { kcal: number }) {
  const r = (SIZE - STROKE) / 2;
  const c = 2 * Math.PI * r;
  const gap = 6;
  // Début de chaque arc : somme des parts précédentes.
  const starts = MACROS.map((_, i) => MACROS.slice(0, i).reduce((sum, m) => sum + c * MACRO_SPLIT[m.key], 0));
  return (
    <View style={styles.ring}>
      <Svg width={SIZE} height={SIZE}>
        {MACROS.map((m, i) => {
          const len = c * MACRO_SPLIT[m.key] - gap;
          return (
            <Circle
              key={m.key}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={r}
              stroke={m.color}
              strokeWidth={STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-starts[i]!}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            />
          );
        })}
      </Svg>
      <View style={styles.ringCenter}>
        <AppText style={styles.kcal}>{formatNumber(kcal)}</AppText>
        <AppText style={styles.kcalUnit}>{t('common.kcalPerDayUnit')}</AppText>
      </View>
    </View>
  );
}

const MACRO_TINTS = { proteines: '#FBE3E3', glucides: '#FCEFCF', lipides: '#E1EAFB' } as const;

export default function TargetScreen() {
  const { draft } = useOnboardingDraft();
  const { updateProfile } = useSession();
  const { objectif, sexe, age, taille_cm, poids_kg, activite, prenom } = draft;
  const [editing, setEditing] = useState(false);

  const computed = useMemo(
    () =>
      objectif && sexe && age && taille_cm && poids_kg
        ? dailyTarget({ sexe, age, taille_cm, poids_kg }, ACTIVITY_LEVELS[activite], objectif)
        : null,
    [objectif, sexe, age, taille_cm, poids_kg, activite],
  );
  const [custom, setCustom] = useState<number | null>(null);
  const target = clampTarget(custom ?? computed ?? 0);

  // La sauvegarde bascule hasProfile : la navigation passe seule au journal.
  const save = useAction(async () => {
    if (computed === null) return;
    await updateProfile({
      prenom: prenom.trim() || null,
      sexe,
      age,
      taille_cm,
      poids_kg,
      niveau_activite: ACTIVITY_LEVELS[activite],
      objectif,
      calories_cible: target,
    });
  });

  // Arrivée directe sur cet écran (ex. rechargement) : on reprend au début.
  if (computed === null) return <Redirect href="/goal" />;
  const grams = macroTargets(target);

  return (
    <OnboardingScreen
      step={5}
      cta={{ label: t('onboarding.start'), loading: save.loading, onPress: () => void save.run() }}
      extra={editing ? null : <Button label={t('onboarding.editTarget')} variant="ghost" onPress={() => setEditing(true)} />}>
      <View style={styles.head}>
        <AppText style={styles.ready}>{prenom.trim() ? t('onboarding.readyName', { name: prenom.trim() }) : t('onboarding.ready')}</AppText>
        <AppText style={styles.title} accessibilityRole="header">
          {t('onboarding.targetTitle')}
        </AppText>
      </View>

      <MacroRing kcal={target} />
      <AppText variant="muted" style={styles.center}>
        {t(objectif === 'perte' ? 'onboarding.targetLose' : objectif === 'prise' ? 'onboarding.targetGain' : 'onboarding.targetMaintain')}
      </AppText>

      {editing ? (
        <Card style={styles.editCard}>
          <Stepper
            label={t('onboarding.targetTitle')}
            value={target}
            onChange={setCustom}
            step={50}
            min={TARGET_BOUNDS.min}
            max={TARGET_BOUNDS.max}
            unit={t('common.kcal')}
            size="medium"
          />
        </Card>
      ) : null}

      <View style={styles.list}>
        {MACROS.map((m, i) => (
          <View key={m.key} style={[styles.row, i > 0 && styles.border]}>
            <View style={[styles.macroIcon, { backgroundColor: MACRO_TINTS[m.key] }]}>
              <Icon name={m.icon} size={16} color={m.ink} strokeWidth={2.2} />
            </View>
            <AppText style={styles.flex}>{t(m.label)}</AppText>
            <AppText style={styles.bold}>
              {formatNumber(grams[m.key])} {t('common.grams')}
            </AppText>
            <AppText variant="small" style={styles.pct}>
              {Math.round(MACRO_SPLIT[m.key] * 100)} %
            </AppText>
          </View>
        ))}
      </View>

      <AppText variant="small" style={styles.center}>
        {t('onboarding.targetNote')}
      </AppText>
      <Notice message={save.error} />
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  center: { textAlign: 'center' },
  head: { alignItems: 'center', gap: 6 },
  ready: { fontSize: 15, fontWeight: '700', color: colors.accent },
  title: { fontSize: 18, fontWeight: '600', color: colors.textMuted },
  ring: { width: SIZE, height: SIZE, alignSelf: 'center' },
  ringCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  kcal: { fontSize: 48, lineHeight: 54, fontWeight: '800', letterSpacing: -1.5 },
  kcalUnit: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
  editCard: { borderRadius: radius.lg },
  list: { borderRadius: radius.lg, backgroundColor: colors.surface, shadowColor: '#3C230F', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.md },
  border: { borderTopWidth: 1, borderTopColor: colors.surfaceAlt },
  macroIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  pct: { width: 40, textAlign: 'right' },
});
