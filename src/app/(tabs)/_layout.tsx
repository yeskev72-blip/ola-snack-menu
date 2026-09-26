import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/components/TabBar';
import { t } from '@/i18n';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: t('tabs.journal') }} />
      <Tabs.Screen name="history" options={{ title: t('tabs.history') }} />
      <Tabs.Screen name="scan" options={{ title: t('tabs.scan') }} />
      <Tabs.Screen name="foods" options={{ title: t('tabs.foods') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile') }} />
    </Tabs>
  );
}
