import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Icon, type IconName } from '@/components/Icon';
import { AnalyzingView, StatusView } from '@/components/ScanStates';
import { t } from '@/i18n';
import { analyzeMeal, type AnalyzeError, fetchScanStatus, preparePhoto, type QuotaInfo } from '@/lib/analyze';
import { loadFoods } from '@/lib/foods';
import { useScanDraft } from '@/state/scanDraft';
import { colors, fontFamily, radius, spacing } from '@/theme';

/** Quota Premium (scan_quota côté serveur) : au-dessous, on propose de passer Premium. */
const PREMIUM_DAILY_SCANS = 30;

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = { mediaTypes: 'images', quality: 0.9, exif: false };

/** Palette du viseur (fond sombre, comme un appareil photo). */
const DARK = { bg: '#0E0B09', sheet: '#0E0B09', field: '#1D1814', fieldBorder: '#3A3028', button: '#29221C', text: '#FFFFFF', muted: '#B9AB9C', soft: '#E6DACB', shutter: '#E09A5F' };

export default function Scan() {
  const draft = useScanDraft();
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [busy, setBusy] = useState<'photo' | 'analyze' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<AnalyzeError | null>(null);
  const [quotaExhausted, setQuotaExhausted] = useState(false);
  /** Numéro de l'analyse en cours : « Annuler » ignore simplement la réponse qui arrivera. */
  const attempt = useRef(0);

  // Quota restant et table des plats (pour le calcul) rafraîchis à chaque ouverture de l'onglet ;
  // barre d'état claire sur le viseur sombre.
  useFocusEffect(
    useCallback(() => {
      void fetchScanStatus().then((status) => {
        setQuota(status);
        setQuotaExhausted(status?.remaining === 0);
      });
      void loadFoods();
      setStatusBarStyle('light');
      return () => setStatusBarStyle('dark');
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
    const id = ++attempt.current;
    setBusy('analyze');
    setError(null);
    setFailure(null);
    const result = await analyzeMeal({ photo: draft.photo, hint: draft.hint });
    if (id !== attempt.current) return;
    setBusy(null);
    if (!result.ok) {
      if (result.error.code === 'quota_exceeded') {
        setQuotaExhausted(true);
        if (result.error.quota) setQuota(result.error.quota);
      }
      return setFailure(result.error);
    }
    if (result.data.quota) setQuota(result.data.quota);
    if (result.data.not_food) return setError(t('scan.notFood'));
    draft.applyAnalysis(result.data);
    router.push('/result');
  };

  const cancelAnalysis = () => {
    attempt.current++;
    setBusy(null);
  };

  const manual = () => {
    setFailure(null);
    draft.reset();
    router.push('/result');
  };

  // Analyse en cours.
  if (busy === 'analyze' && draft.photo) return <AnalyzingView photoUri={draft.photo.uri} onCancel={cancelAnalysis} />;

  // Échec de l'analyse : écran dédié selon la cause (aucun de ces cas ne décompte le scan).
  if (failure || (quotaExhausted && !draft.photo)) {
    const close = () => setFailure(null);
    if (!failure || failure.code === 'quota_exceeded') {
      const daily = quota?.quota ?? 0;
      return (
        <StatusView
          icon="camera"
          badge="lock"
          title={daily === 1 ? t('scan.quotaTitleOne') : t('scan.quotaTitle', { count: daily })}
          body={t('scan.quotaBody')}
          secondary={{ label: t('scan.manualShort'), onPress: manual }}
          onClose={failure ? close : () => router.navigate('/')}>
          {daily < PREMIUM_DAILY_SCANS ? (
            <View style={styles.premium}>
              <AppText style={styles.premiumLabel}>Premium</AppText>
              <View style={styles.premiumRow}>
                <AppText style={styles.premiumBig}>{PREMIUM_DAILY_SCANS}</AppText>
                <AppText style={styles.premiumText}>{t('scan.premiumScans', { count: daily })}</AppText>
              </View>
              <Button label={t('scan.discoverPremium')} variant="secondary" onPress={() => router.push('/premium')} />
            </View>
          ) : null}
        </StatusView>
      );
    }
    const network = failure.code === 'offline' || failure.code === 'timeout';
    return (
      <StatusView
        icon={network ? 'offline' : 'clock'}
        badge={network ? 'offline' : 'bolt'}
        title={network ? t('scan.offlineTitle') : t('scan.busyTitle')}
        body={network ? t('scan.offlineBody') : failure.message}
        notCounted
        primary={{ label: t('common.retry'), icon: 'refresh', onPress: () => void analyze() }}
        secondary={{ label: t('scan.manualShort'), onPress: manual }}
        onClose={close}
      />
    );
  }

  const quotaText = quota ? t('scan.quota', { count: quota.remaining }) : t('scan.quotaUnknown');

  return (
    <SafeAreaView style={styles.dark} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior="height">
        <View style={styles.top}>
          <View style={styles.pill}>
            <AppText style={styles.pillText}>{quotaText}</AppText>
          </View>
        </View>

        <View style={styles.viewfinder}>
          {draft.photo ? (
            <Image source={{ uri: draft.photo.uri }} style={styles.photo} resizeMode="cover" accessibilityIgnoresInvertColors />
          ) : (
            <Pressable accessibilityRole="button" accessibilityLabel={t('scan.takePhoto')} onPress={() => void takePhoto()} style={styles.frame}>
              <View style={[styles.corner, styles.tl]} />
              <View style={[styles.corner, styles.tr]} />
              <View style={[styles.corner, styles.bl]} />
              <View style={[styles.corner, styles.br]} />
              {busy === 'photo' ? <ActivityIndicator color={DARK.text} size="large" /> : <Icon name="camera" size={44} color={DARK.muted} strokeWidth={1.6} />}
              <AppText style={styles.frameText}>{t('scan.frameHint')}</AppText>
            </Pressable>
          )}
        </View>

        <ScrollView style={styles.sheet} contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
          {error ? (
            <View style={styles.error} accessibilityRole="alert">
              <Icon name="alert" size={18} color="#F59C8F" />
              <AppText style={styles.errorText}>{error}</AppText>
            </View>
          ) : null}
          <View style={styles.field}>
            <AppText style={styles.fieldLabel}>
              {t('scan.hintShort')} <AppText style={styles.optional}>{t('common.optional')}</AppText>
            </AppText>
            <TextInput
              accessibilityLabel={t('scan.hintLabel')}
              placeholder={t('scan.hintPlaceholder')}
              placeholderTextColor="#8C7E70"
              value={draft.hint}
              onChangeText={draft.setHint}
              maxLength={300}
              editable={busy === null}
              style={styles.input}
            />
          </View>

          {draft.photo ? (
            <View style={styles.photoActions}>
              <Button label={t('scan.analyze')} variant="accent" icon="bolt" disabled={quotaExhausted} onPress={() => void analyze()} />
              <View style={styles.rowButtons}>
                <DarkButton icon="camera" label={t('scan.retakeShort')} onPress={() => void takePhoto()} disabled={busy !== null} />
                <DarkButton icon="image" label={t('scan.galleryShort')} onPress={() => void pickFromGallery()} disabled={busy !== null} />
                <DarkButton icon="pencil" label={t('scan.manualShort')} onPress={manual} />
              </View>
            </View>
          ) : (
            <View style={styles.controls}>
              <View style={styles.control}>
                <SquareButton icon="image" label={t('scan.pickGallery')} onPress={() => void pickFromGallery()} disabled={busy !== null} />
                <AppText style={styles.controlLabel}>{t('scan.galleryShort')}</AppText>
              </View>
              <View style={styles.control}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('scan.takePhoto')}
                  disabled={busy !== null}
                  onPress={() => void takePhoto()}
                  style={({ pressed }) => [styles.shutter, pressed && styles.shutterPressed]}>
                  <View style={styles.shutterInner} />
                </Pressable>
                <AppText style={[styles.controlLabel, styles.controlLabelActive]}>{t('scan.photoShort')}</AppText>
              </View>
              <View style={styles.control}>
                <SquareButton icon="pencil" label={t('scan.manual')} onPress={manual} />
                <AppText style={styles.controlLabel}>{t('scan.manualShort')}</AppText>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SquareButton({ icon, label, onPress, disabled }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.square, pressed && styles.squarePressed, disabled && styles.disabled]}>
      <Icon name={icon} size={24} color={DARK.text} />
    </Pressable>
  );
}

function DarkButton({ icon, label, onPress, disabled }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.darkButton, pressed && styles.squarePressed, disabled && styles.disabled]}>
      <Icon name={icon} size={20} color={DARK.text} />
      <AppText style={styles.darkButtonText} numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

const CORNER = 44;
const styles = StyleSheet.create({
  dark: { flex: 1, backgroundColor: DARK.bg },
  flex: { flex: 1 },
  top: { flexDirection: 'row', justifyContent: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.md },
  pill: { height: 40, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center' },
  pillText: { color: DARK.text, fontSize: 14, lineHeight: 18, fontWeight: '700' },
  viewfinder: { flex: 1, minHeight: 220, paddingHorizontal: 30, paddingVertical: spacing.lg },
  photo: { flex: 1, borderRadius: radius.lg },
  frame: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  frameText: { color: DARK.text, fontSize: 15, lineHeight: 20, fontWeight: '700', textAlign: 'center' },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: DARK.text },
  tl: { left: 0, top: 0, borderLeftWidth: 4, borderTopWidth: 4, borderTopLeftRadius: 22 },
  tr: { right: 0, top: 0, borderRightWidth: 4, borderTopWidth: 4, borderTopRightRadius: 22 },
  bl: { left: 0, bottom: 0, borderLeftWidth: 4, borderBottomWidth: 4, borderBottomLeftRadius: 22 },
  br: { right: 0, bottom: 0, borderRightWidth: 4, borderBottomWidth: 4, borderBottomRightRadius: 22 },
  sheet: { flexGrow: 0, backgroundColor: DARK.sheet, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  sheetContent: { padding: spacing.md, paddingBottom: spacing.lg, gap: spacing.md },
  error: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', padding: 12, borderRadius: radius.md, backgroundColor: '#3A1D17' },
  errorText: { flex: 1, color: '#FBD5CF', fontSize: 14, lineHeight: 20, fontWeight: '600' },
  field: { gap: 6 },
  fieldLabel: { color: DARK.soft, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  optional: { color: DARK.muted, fontSize: 14, fontWeight: '500' },
  input: {
    height: 52,
    borderWidth: 1.5,
    borderColor: DARK.fieldBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: DARK.text,
    backgroundColor: DARK.field,
    fontFamily: fontFamily('400'),
  },
  controls: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 12 },
  control: { alignItems: 'center', gap: spacing.sm, minWidth: 80 },
  controlLabel: { color: DARK.muted, fontSize: 12, lineHeight: 16, fontWeight: '600' },
  controlLabelActive: { color: DARK.text },
  square: { width: 56, height: 56, marginTop: 12, borderRadius: radius.md, backgroundColor: DARK.button, alignItems: 'center', justifyContent: 'center' },
  squarePressed: { backgroundColor: '#3A3028' },
  disabled: { opacity: 0.5 },
  shutter: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: DARK.text, alignItems: 'center', justifyContent: 'center' },
  shutterPressed: { opacity: 0.8 },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: DARK.shutter },
  photoActions: { gap: 12 },
  rowButtons: { flexDirection: 'row', gap: spacing.sm },
  darkButton: { flex: 1, minHeight: 56, borderRadius: radius.md, backgroundColor: DARK.button, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 4 },
  darkButtonText: { color: DARK.text, fontSize: 12, lineHeight: 16, fontWeight: '600' },
  premium: { alignSelf: 'stretch', backgroundColor: colors.primary, borderRadius: radius.lg, padding: 20, gap: 14 },
  premiumLabel: { fontSize: 13, lineHeight: 18, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', color: '#E7B24A' },
  premiumRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  premiumBig: { fontSize: 44, lineHeight: 48, fontWeight: '800', letterSpacing: -1, color: '#F7F0E6' },
  premiumText: { flex: 1, fontSize: 17, lineHeight: 24, fontWeight: '600', color: '#F7F0E6' },
});
