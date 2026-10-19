import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import PressableScale from '@/components/ui/PressableScale';
import ScreenCanvas from '@/components/canvas/ScreenCanvas';
import { useCanvasComponentsStore } from '@/store/canvasComponentsStore';
import { PUPIL_NAV_TABS } from '@/data/pupilNavTabs';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, typography, radius } from '@/theme';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';

// Edytor Navbaru Pupila (Faza §392, 2026-10-19) — user: "pełna przebudowa jak Figma" dla
// navbaru, po jawnym wyborze tej (ryzykowniejszej) opcji z trzech przedstawionych. Dedykowany
// ekran (nie osadzenie w jednym z 4 ekranów Pupila — `screenKey='navbar'` nie "należy" do
// żadnego z nich) hostujący ZWYKŁE `ScreenCanvas` (`screenKey="navbar"`) — pełny edytor bez
// żadnego nowego kodu renderowania.
//
// Walidacja NA TYM EKRANIE, nie dopiero w `PupilNavbar.tsx` — user widzi OD RAZU czy jego
// układ jest "gotowy" (wszystkie 4 taby podpięte), zamiast dowiadywać się po fakcie, że navbar
// na żywo i tak wrócił do domyślnego. Przełącznik "Użyj własnego navbaru" NIE DA SIĘ włączyć,
// gdy układ jest niekompletny (patrz `onValueChange` — toast wyjaśnia czego brakuje) — ale
// WYŁĄCZYĆ można zawsze, nawet jeśli coś potem usunięto i stał się nieprawidłowy.
export default function NavbarEditorScreen() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const items = useCanvasComponentsStore(st => st.items);
  const customNavbarEnabled = useCanvasComponentsStore(st => st.customNavbarEnabled);
  const setCustomNavbarEnabled = useCanvasComponentsStore(st => st.setCustomNavbarEnabled);

  const navbarItems = items.filter(i => i.screenKey === 'navbar');
  const boundKeys = new Set(
    navbarItems.filter(i => i.componentType === 'navTab' && i.bindingKey).map(i => i.bindingKey),
  );
  const missing = PUPIL_NAV_TABS.filter(t => !boundKeys.has(t.key));
  const isValid = missing.length === 0;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <PressableScale onPress={() => router.back()} style={s.backBtn}>
          <ChevronLeft size={22} color={c.text.primary} />
        </PressableScale>
        <Text style={s.headerTitle}>Navbar Pupila</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing[4], paddingBottom: 60, gap: spacing[3] }}>
        <Text style={s.hint}>
          Zbuduj własny navbar dla ekranów Pupila (Pupil / Bossy / Sklep / Questy). Dodaj
          wszystkie 4 przyciski nawigacji — inaczej, dla bezpieczeństwa, appka zawsze użyje
          domyślnego navbaru, nie zepsutego.
        </Text>

        <View style={s.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.toggleLabel}>Użyj własnego navbaru</Text>
            <Text style={s.toggleSub}>
              {isValid ? 'Gotowe — wszystkie 4 przyciski są podpięte.' : `Brakuje: ${missing.map(t => t.label).join(', ')}`}
            </Text>
          </View>
          <Switch
            value={customNavbarEnabled}
            onValueChange={(v) => {
              if (v && !isValid) {
                haptic.medium();
                toast.error(`Podepnij najpierw: ${missing.map(t => t.label).join(', ')}`);
                return;
              }
              haptic.tap();
              setCustomNavbarEnabled(v);
            }}
            trackColor={{ false: c.bg.elevated, true: c.accent.blue + '88' }}
            thumbColor={customNavbarEnabled ? c.accent.blue : undefined}
          />
        </View>

        <ScreenCanvas screenKey="navbar" title="Przyciski i dekoracje" />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', ...typography.h3, color: c.text.primary },
  hint: { fontSize: 12, color: c.text.muted, lineHeight: 17 },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default,
    padding: spacing[3],
  },
  toggleLabel: { fontSize: 13.5, fontWeight: '700', color: c.text.primary },
  toggleSub: { fontSize: 11, color: c.text.muted, marginTop: 2 },
}));
