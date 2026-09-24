import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';
import { colors, spacing } from '@/theme';

export default function Journal() {
  return (
    <Screen edges={['top']} footer={<Button label={t('journal.scanCta')} onPress={() => router.navigate('/scan')} />}>
      <AppText variant="title">{t('journal.title')}</AppText>
      <Card style={styles.summary}>
        <AppText variant="display">—</AppText>
        <AppText variant="muted">
          {t('common.kcal')} {t('journal.remaining')}
        </AppText>
        <View style={styles.macros}>
          <Macro label={t('journal.protein')} color={colors.protein} />
          <Macro label={t('journal.carbs')} color={colors.carbs} />
          <Macro label={t('journal.fat')} color={colors.fat} />
        </View>
      </Card>
      <AppText variant="muted">{t('journal.empty')}</AppText>
    </Screen>
  );
}

function Macro({ label, color }: { label: string; color: string }) {
  return (
    <View style={styles.macro}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <AppText variant="small">{label}</AppText>
      <AppText variant="large">— {t('common.grams')}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { alignItems: 'center', paddingVertical: spacing.lg },
  macros: { flexDirection: 'row', justifyContent: 'space-around', alignSelf: 'stretch', marginTop: spacing.md },
  macro: { alignItems: 'center', gap: spacing.xs },
  dot: { width: 12, height: 12, borderRadius: 6 },
});
