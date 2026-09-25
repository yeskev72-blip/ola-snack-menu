import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { t } from '@/i18n';
import { analyzeMeal, fetchScanStatus, preparePhoto, type QuotaInfo, UNLIMITED_SCANS } from '@/lib/analyze';
import { loadFoods } from '@/lib/foods';
import { useScanDraft } from '@/state/scanDraft';
import { colors, radius, spacing } from '@/theme';

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = { mediaTypes: 'images', quality: 0.9, exif: false };

export default function Scan() {
  const draft = useScanDraft();
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [busy, setBusy] = useState<'photo' | 'analyze' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quotaExhausted, setQuotaExhausted] = useState(false);

  // Quota restant et table des plats (pour le calcul) rafraîchis à chaque ouverture de l'onglet.
  useFocusEffect(
    useCallback(() => {
      void fetchScanStatus().then((status) => {
        setQuota(status);
        setQuotaExhausted(status?.remaining === 0);
      });
      void loadFoods();
    }, []),
  );

  const handlePicked = useCallback(
    async (result: ImagePicker.ImagePickerResult) => {
      const asset = result.canceled ? null : result.assets[0];
      if (!asset) return;
      setBusy('photo');
      setError(null);
      try {
        const photo = await preparePhoto(asset.uri, asset.width, asset.height);
        draft.reset();
        draft.setPhoto(photo);
      } catch {
        setError(t('scan.photoError'));
      } finally {
        setBusy(null);
      }
    },
    [draft],
  );

  // Sur les téléphones à peu de mémoire, Android peut fermer l'app pendant la prise de vue :
  // on récupère alors la photo au redémarrage.
  useEffect(() => {
    void ImagePicker.getPendingResultAsync().then((pending) => {
      if (pending && 'assets' in pending) void handlePicked(pending);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule fois au montage
  }, []);

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return setError(t('scan.cameraDenied'));
    await handlePicked(await ImagePicker.launchCameraAsync(PICKER_OPTIONS));
  };

  const pickFromGallery = async () => {
    await handlePicked(await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS));
  };

  const analyze = async () => {
    if (!draft.photo) return;
    setBusy('analyze');
    setError(null);
    const result = await analyzeMeal({ photo: draft.photo, hint: draft.hint });
    setBusy(null);
    if (!result.ok) {
      setError(result.error.message);
      if (result.error.code === 'quota_exceeded') {
        setQuotaExhausted(true);
        if (result.error.quota) setQuota(result.error.quota);
      }
      return;
    }
    if (result.data.quota) setQuota(result.data.quota);
    if (result.data.not_food) return setError(t('scan.notFood'));
    draft.applyAnalysis(result.data);
    router.push('/result');
  };

  const manual = () => {
    draft.reset();
    router.push('/result');
  };

  const quotaText = !quota
    ? t('scan.quotaUnknown')
    : quota.quota >= UNLIMITED_SCANS
      ? t('scan.quotaUnlimited')
      : t('scan.quota', { count: quota.remaining });

  return (
    <Screen
      edges={['top']}
      footer={
        draft.photo ? (
          <>
            <Button
              label={busy === 'analyze' ? t('scan.analyzing') : t('scan.analyze')}
              loading={busy === 'analyze'}
              disabled={quotaExhausted}
              onPress={analyze}
            />
            <Button label={t('scan.retake')} variant="ghost" disabled={busy !== null} onPress={takePhoto} />
          </>
        ) : (
          <>
            <Button label={t('scan.takePhoto')} loading={busy === 'photo'} disabled={quotaExhausted} onPress={takePhoto} />
            <Button label={t('scan.pickGallery')} variant="secondary" disabled={busy !== null || quotaExhausted} onPress={pickFromGallery} />
            <Button label={t('scan.manual')} variant="ghost" onPress={manual} />
          </>
        )
      }>
      <AppText variant="title">{t('scan.title')}</AppText>
      <AppText variant="muted">{quotaText}</AppText>

      {draft.photo ? (
        <>
          <Image source={{ uri: draft.photo.uri }} style={styles.photo} resizeMode="cover" accessibilityIgnoresInvertColors />
          <TextField
            label={t('scan.hintLabel')}
            placeholder={t('scan.hintPlaceholder')}
            value={draft.hint}
            onChangeText={draft.setHint}
            maxLength={300}
            multiline
            editable={busy === null}
          />
        </>
      ) : (
        <View style={styles.placeholder}>
          <AppText style={styles.center}>{t('scan.intro')}</AppText>
        </View>
      )}

      <Notice message={error} />
      {draft.photo && (quotaExhausted || error) ? <Button label={t('scan.manual')} variant="secondary" onPress={manual} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  placeholder: {
    aspectRatio: 4 / 3,
    borderRadius: radius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  center: { textAlign: 'center' },
});
