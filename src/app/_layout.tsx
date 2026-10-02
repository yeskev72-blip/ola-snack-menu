import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';
import { useAppFonts } from '@/lib/appFonts';
import { startAutoSync } from '@/lib/meals';
import { restoreReminders } from '@/lib/remindersStore';
import { isSupabaseConfigured } from '@/lib/supabase';
import { ScanDraftProvider } from '@/state/scanDraft';
import { SessionProvider, useSession } from '@/state/session';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { status, hasProfile, user } = useSession();
  const isSignedIn = status === 'signedIn';
  const userId = user?.id;

  // Envoie les repas en attente maintenant et à chaque retour du réseau.
  useEffect(() => (userId ? startAutoSync(userId) : undefined), [userId]);

  // Android efface les notifications programmées après une mise à jour de l'app ou un
  // redémarrage du téléphone : sans cela les rappels disparaîtraient sans prévenir.
  useEffect(() => {
    if (userId) void restoreReminders();
  }, [userId]);

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync();
  }, [status]);

  // L'écran de démarrage reste affiché pendant la lecture de la session locale.
  if (status === 'loading') return null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={isSignedIn && !hasProfile}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={isSignedIn && hasProfile}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="result" />
        <Stack.Screen name="item-editor" options={{ presentation: 'modal' }} />
        <Stack.Screen name="food-picker" options={{ presentation: 'modal' }} />
        <Stack.Screen name="link-account" />
        <Stack.Screen name="profile-edit" />
        <Stack.Screen name="premium" />
        <Stack.Screen name="meal/[id]" />
        <Stack.Screen name="day/[day]" />
      </Stack.Protected>
    </Stack>
  );
}

function MissingConfig() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);
  return (
    <Screen>
      <AppText variant="title">{t('setup.title')}</AppText>
      <AppText>{t('setup.body')}</AppText>
    </Screen>
  );
}

export default function RootLayout() {
  // Sur le web la police doit être chargée par le navigateur avant le premier rendu, sinon
  // l'app s'affiche brièvement dans la police système. Sur Android, elle est déjà dans l'APK
  // et ce crochet renvoie true tout de suite.
  const fontsReady = useAppFonts();
  if (!fontsReady) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {isSupabaseConfigured ? (
        <SessionProvider>
          <ScanDraftProvider>
            <RootNavigator />
          </ScanDraftProvider>
        </SessionProvider>
      ) : (
        <MissingConfig />
      )}
    </SafeAreaProvider>
  );
}
