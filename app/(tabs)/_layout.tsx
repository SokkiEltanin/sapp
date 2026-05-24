import { Tabs } from 'expo-router';
import TabBar from '@/components/ui/TabBar';
import { colors } from '@/theme';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // Eliminates black flash between tab swipes
        contentStyle: { backgroundColor: colors.bg.primary },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="tasks" />
      <Tabs.Screen name="finances" />
      <Tabs.Screen name="stats" />
      <Tabs.Screen name="analytics" />
      <Tabs.Screen name="calendar" options={{ href: null }} />
      <Tabs.Screen name="mood"      options={{ href: null }} />
      <Tabs.Screen name="health"    options={{ href: null }} />
    </Tabs>
  );
}
