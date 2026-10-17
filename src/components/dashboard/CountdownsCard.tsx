import { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CalendarClock } from 'lucide-react-native';
import { router } from 'expo-router';
import { Counter } from '@/store/countersStore';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius, fonts } from '@/theme';
import { haptic } from '@/utils/haptics';
import { useCountdownsTileStyleStore, CountdownsTileStyle } from '@/store/countdownsTileStyleStore';
import { CountdownTile } from './CountdownTile';

// Wyciągnięte 1:1 z `app/(tabs)/index.tsx` `nodes['countdowns']` (2026-08-25, kolejny mały
// krok rozbicia dashboardu — patrz NEXT_STEPS.md/ARCHITECTURE.md §4 dla wzorca i historii).
// Guard `.length > 0 &&` ZOSTAJE w `index.tsx` (edytor dashboardu czyta `nodes[id]`'s
// truthiness, patrz ARCHITECTURE.md).
//
// RingCountdown (2026-09-24, user: "ten pasek za gruby, tanio... przerób na highend" —
// zamockowałem 3 kierunki, user wybrał pierścień) zastąpił DonationBar (gruby pasek z
// tekstem wpisanym w środek, 2026-09-23 — user: "wygląda na za gruby, tanio, stary chujowy
// look"). Wiersz teraz: pierścień po lewej (liczba dni w środku) + nazwa/status/cel po
// prawej, zamiast nazwy nad paskiem na całą szerokość.
export interface CountdownsCardProps {
  countdowns: Counter[];
  cardBg: string;
  accentColor: string;
  // `styleOverride` (2026-10-15, Kreator dashboardu Faza 3, §329) — ten sam wzorzec co
  // StreakWallCard (§327)/PersonalRecordsCard (§328): bez override karta czyta `live` ze
  // store'a, kreator podaje `draft`.
  styleOverride?: CountdownsTileStyle;
}

function CountdownsCard({ countdowns, cardBg, accentColor, styleOverride }: CountdownsCardProps) {
  const c = useColors();
  const s = makeS(c);
  const liveTileStyle = useCountdownsTileStyleStore(st => st.live);
  const tileStyle = styleOverride ?? liveTileStyle;
  if (countdowns.length === 0) return null;
  return (
    <View style={[s.card, { backgroundColor: cardBg, borderRadius: tileStyle.cornerRadius }]}>
      <View style={s.cardHeader}>
        <CalendarClock size={13} color={accentColor} />
        <Text style={s.cardTitle}>Odliczania</Text>
        <TouchableOpacity onPress={() => { haptic.tap(); router.navigate('/counters' as any); }} style={{ marginLeft: 'auto' }} activeOpacity={0.7}>
          <Text style={[s.workToggleText, { color: accentColor }]}>Wszystkie</Text>
        </TouchableOpacity>
      </View>
      <View style={{ gap: spacing[3], marginTop: spacing[2] }}>
        {countdowns.slice(0, tileStyle.maxVisible).map(cn => (
          <CountdownTile key={cn.id} item={cn} tileStyle={tileStyle} accentColor={accentColor}
            onPress={() => { haptic.tap(); router.push(`/counters/${cn.id}` as any); }} />
        ))}
      </View>
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
  workToggleText: { fontSize: 10, fontWeight: '700' },
}));

export default memo(CountdownsCard);
