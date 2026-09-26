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
          contentStyle: { backgroundColor: colors.background },
        }}>
        <Stack.Screen name="goal" />
        <Stack.Screen name="body" />
        <Stack.Screen name="measures" />
        <Stack.Screen name="activity" />
        <Stack.Screen name="target" />
      </Stack>
    </OnboardingDraftProvider>
  );
}
