import { Tabs } from 'expo-router';
import TabBar from '@/components/ui/TabBar';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="tasks" />
      <Tabs.Screen name="finances" />
      <Tabs.Screen name="calendar" options={{ href: null }} />
      <Tabs.Screen name="mood"    options={{ href: null }} />
      <Tabs.Screen name="health"  options={{ href: null }} />
    </Tabs>
  );
}
