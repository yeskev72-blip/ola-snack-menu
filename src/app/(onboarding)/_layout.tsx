import { Stack } from 'expo-router';

import { OnboardingDraftProvider } from '@/state/onboardingDraft';
import { colors } from '@/theme';

export const unstable_settings = { initialRouteName: 'goal' };

export default function OnboardingLayout() {
  return (
    <OnboardingDraftProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          headerTintColor: colors.primary,
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerTitle: '',
          contentStyle: { backgroundColor: colors.background },
        }}>
        <Stack.Screen name="goal" />
        <Stack.Screen name="body" options={{ headerShown: true }} />
        <Stack.Screen name="target" options={{ headerShown: true }} />
      </Stack>
    </OnboardingDraftProvider>
  );
}
