import { Tabs } from 'expo-router';
import TabBar from '@/components/ui/TabBar';
import { colors } from '@/theme';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="tasks" />
      <Tabs.Screen name="calendar" />
      <Tabs.Screen name="finances" />
      <Tabs.Screen name="mood"   options={{ href: null }} />
      <Tabs.Screen name="health" options={{ href: null }} />
    </Tabs>
  );
}
