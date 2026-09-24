import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';
import { isSupabaseConfigured } from '@/lib/supabase';
import { SessionProvider, useSession } from '@/state/session';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { status, hasProfile } = useSession();
  const isSignedIn = status === 'signedIn';

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync();
  }, [status]);

  // L'écran de démarrage reste affiché pendant la lecture de la session locale.
  if (status === 'loading') return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={isSignedIn && !hasProfile}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={isSignedIn && hasProfile}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="result" options={{ headerShown: true, title: t('result.title') }} />
        <Stack.Screen name="link-account" options={{ headerShown: true, title: t('auth.linkTitle') }} />
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
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {isSupabaseConfigured ? (
        <SessionProvider>
          <RootNavigator />
        </SessionProvider>
      ) : (
        <MissingConfig />
      )}
    </SafeAreaProvider>
  );
}
