import { memo } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { Moon, Search } from 'lucide-react-native';
import { router } from 'expo-router';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius, fonts } from '@/theme';
import { haptic } from '@/utils/haptics';

// Wyciągnięte 1:1 z `app/(tabs)/index.tsx` `nodes['sleep-chart']` (2026-08-26, kolejny krok
// rozbicia dashboardu — patrz NEXT_STEPS.md/ARCHITECTURE.md §4 dla wzorca i historii). Sekcja
// "Sen" jest ESENCJALNA (żywa, nie w `DEFERRED_SECTIONS`) i `nodes['sleep-chart']` to
// TERNARY, nie `warunek && (...)` — więc, w przeciwieństwie do poprzednich kroków, NIE ma tu
// guardu do zostawienia w `index.tsx`: node jest zawsze prawdziwym elementem (albo wykres,
// albo pusty stan), więc `nodes[id]`'s truthiness (czytana przez edytor dashboardu) i tak
// zawsze jest `true` — bez zmiany zachowania. `sleepDashRange` (toggle Tydzień/Miesiąc)
// zostaje jako STAN w `index.tsx` (inne sekcje go nie potrzebują, ale to jedyny stan tej
// sekcji, więc prościej trzymać go tam i przekazać callback niż przenosić cały stan + jego
// `useState` tutaj). Style `card`/`cardHeader`/`cardTitle`/`cdDays`/`workToggle`/
// `workToggleText`/`factText` skopiowane verbatim (współdzielone z innymi sekcjami —
// zweryfikowane `grep`iem, że każdy ma jeszcze usage gdzie indziej w `index.tsx`);
// `sleepEmptyIcon`/`sleepEmptyTitle`/`sleepEmptyBtn`/`sleepEmptyBtnText` używane TYLKO tu →
// przeniesione w całości.
const SLEEP_DOW = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];

export interface SleepDay { date: string; sleepMinutes: number }

export interface SleepChartCardProps {
  sleepNights: SleepDay[];
  sleepDaysShown: SleepDay[];
  sleepMaxMin: number;
  sleepAvgMin: number;
  sleepDashRange: 7 | 30;
  onToggleRange: () => void;
  cardBg: string;
  accentColor: string;
}

function SleepChartCard({ sleepNights, sleepDaysShown, sleepMaxMin, sleepAvgMin, sleepDashRange, onToggleRange, cardBg, accentColor }: SleepChartCardProps) {
  const c = useColors();
  const s = makeS(c);

  if (sleepNights.length === 0) {
    // Puste, ale nie gołe (2026-08-14, user: "nie ma danych na nim brakuje mi wyglądowo") —
    // ikona-bąbelek zamiast małego tekstowego linku, wypełniony przycisk zamiast szarego
    // chipa, żeby karta nie wyglądała jak coś zepsutego pośród reszty dashboardu.
    // Diagnostyka pod spodem BEZ ZMIAN (patrz NEXT_STEPS.md „Diagnostyka faz snu").
    return (
      <View style={[s.card, { backgroundColor: cardBg, alignItems: 'center', paddingVertical: spacing[5] }]}>
        <View style={[s.sleepEmptyIcon, { backgroundColor: accentColor + '18' }]}>
          <Moon size={22} color={accentColor} />
        </View>
        <Text style={s.sleepEmptyTitle}>Brak danych o śnie</Text>
        <Text style={[s.factText, { textAlign: 'center', marginTop: 2 }]}>
          Ostatnie 30 dni bez ani jednej nocy z zegarka.
        </Text>
        <TouchableOpacity
          onPress={async () => {
            haptic.tap();
            const { probeSleep, sleepProbeVerdict } = await import('@/services/healthConnectService');
            const p = await probeSleep(7);
            const { lines, verdict } = sleepProbeVerdict(p);
            Alert.alert('Diagnostyka faz snu', lines.join('\n\n') + '\n\n' + verdict);
          }}
          activeOpacity={0.85}
          style={[s.sleepEmptyBtn, { backgroundColor: accentColor }]}
        >
          <Search size={14} color={c.bg.primary} />
          <Text style={[s.sleepEmptyBtnText, { color: c.bg.primary }]}>Sprawdź dlaczego</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[s.card, { backgroundColor: cardBg }]}>
      <View style={s.cardHeader}>
        <Moon size={13} color={accentColor} />
        <Text style={s.cardTitle}>Sen</Text>
        <Text style={[s.cdDays, { marginLeft: 4 }]}>śr. {(sleepAvgMin / 60).toFixed(1).replace('.0', '')}h</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={() => { haptic.tap(); onToggleRange(); }} style={s.workToggle} activeOpacity={0.8}>
          <Text style={[s.workToggleText, { color: accentColor }]}>{sleepDashRange === 7 ? 'Tydzień' : 'Miesiąc'}</Text>
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: sleepDashRange === 7 ? 4 : 1.5, height: 56, marginTop: spacing[3] }}>
        {sleepDaysShown.map(d => {
          const h = d.sleepMinutes > 0 ? Math.max(3, (d.sleepMinutes / sleepMaxMin) * 56) : 2;
          return (
            <View key={d.date} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: 56 }}>
              <View style={{
                width: '100%', height: h, borderRadius: 2, minHeight: 2,
                backgroundColor: d.sleepMinutes === 0 ? c.border.subtle : d.sleepMinutes >= 420 ? accentColor : c.text.muted,
                opacity: d.sleepMinutes === 0 ? 0.5 : 0.85,
              }} />
            </View>
          );
        })}
      </View>
      {sleepDashRange === 7 && (
        <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
          {sleepDaysShown.map(d => (
            <Text key={d.date} style={[s.cdDays, { flex: 1, textAlign: 'center', fontSize: 9, fontWeight: '600', color: c.text.muted }]}>
              {SLEEP_DOW[new Date(d.date + 'T00:00:00').getDay()]}
            </Text>
          ))}
        </View>
      )}
      {/* Rzadkie dane (mniej niż tydzień realnych nocy w 30-dniowym oknie) — zamiast
          milcząco pustego wykresu, jasny powód + akcja. Automatyczny sync przy starcie
          apki dobija tylko do 30 dni wstecz OD TERAZ, więc nie ma jak magicznie wypełnić
          starszej historii — jedyny sposób to ręczny "Zsynchronizuj z zegarka" w Zdrowiu
          (force=true, pełne okno), patrz memory backlog_2026-08-07. */}
      {sleepNights.length < 7 && (
        <TouchableOpacity onPress={() => { haptic.tap(); router.navigate('/health' as any); }} activeOpacity={0.7} style={{ marginTop: 6 }}>
          <Text style={[s.cdDays, { fontSize: 10, color: c.text.muted }]}>
            Tylko {sleepNights.length} {sleepNights.length === 1 ? 'noc' : 'nocy'} z danymi — otwórz Zdrowie i „Zsynchronizuj z zegarka" po więcej historii
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  card: {
    backgroundColor: c.bg.card,
    borderRadius: radius.xl,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: c.border.card,
    gap: spacing[3],
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' },
  cardTitle: { fontFamily: fonts.label, fontSize: 11, color: c.text.secondary, textTransform: 'uppercase', letterSpacing: 0.9, flexShrink: 1 },
  cdDays: { fontSize: 12, fontWeight: '800', color: c.tabs?.day ?? '#46B0DE' },
  workToggle: {
    marginLeft: 'auto', paddingHorizontal: spacing[3], paddingVertical: 4,
    borderRadius: radius.full, backgroundColor: c.border.subtle,
  },
  workToggleText: { fontSize: 10, fontWeight: '700' },
  factText: { flex: 1, fontSize: 12.5, color: c.text.secondary, fontWeight: '500' },
  sleepEmptyIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sleepEmptyTitle: { fontSize: 14, fontWeight: '800', color: c.text.primary, marginTop: spacing[3] },
  sleepEmptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.full, paddingHorizontal: spacing[4], paddingVertical: 9, marginTop: spacing[3] },
  sleepEmptyBtnText: { fontSize: 12.5, fontWeight: '800' },
}));

export default memo(SleepChartCard);
