import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { t } from '@/i18n';
import { isSendableReport, REPORT_MAX } from '@/lib/foodReport';
import { sendReport } from '@/lib/sendReport';
import { showToast } from '@/lib/toast';
import { useAction } from '@/lib/useAction';
import { colors, radius, spacing } from '@/theme';

/**
 * Signaler une valeur qui paraît fausse.
 *
 * Le doute sur la fiabilité est la seule douleur bloquante citée par les quatre professionnels
 * interrogés en Phase 1. On ne le lève pas en affirmant plus fort : on le lève en offrant une
 * porte de sortie visible à qui n'est pas d'accord avec un chiffre.
 */
export default function Report() {
  const { food, label, meal } = useLocalSearchParams<{ food?: string; label?: string; meal?: string }>();
  const [message, setMessage] = useState('');

  const send = useAction(async () => {
    await sendReport({
      foodKey: food ?? null,
      label: label ?? t('report.unnamed'),
      mealId: meal ?? null,
      message,
    });
    showToast(t('report.sent'));
    router.back();
  });

  return (
    <Screen
      back="back"
      title={t('report.title')}
      footer={
        <Button
          label={t('report.send')}
          loading={send.loading}
          disabled={!isSendableReport(message)}
          onPress={() => send.run()}
        />
      }>
      <View style={styles.subject}>
        <AppText variant="small">{t('report.subject')}</AppText>
        <AppText style={styles.subjectLabel}>{label || t('report.unnamed')}</AppText>
      </View>

      <AppText>{t('report.intro')}</AppText>

      <TextField
        label={t('report.field')}
        hint={t('report.fieldHint')}
        placeholder={t('report.placeholder')}
        value={message}
        onChangeText={setMessage}
        multiline
        numberOfLines={5}
        maxLength={REPORT_MAX}
        autoFocus
        style={styles.input}
      />

      <Notice message={send.error} />
      <AppText variant="small">{t('report.privacy')}</AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subject: { gap: 2, padding: spacing.md, borderRadius: radius.card, backgroundColor: colors.surfaceAlt },
  subjectLabel: { fontSize: 17, lineHeight: 24, fontWeight: '800' },
  input: { minHeight: 120, textAlignVertical: 'top', paddingTop: 12 },
});
