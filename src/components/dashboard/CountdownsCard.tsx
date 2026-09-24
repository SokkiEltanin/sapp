import { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CalendarClock } from 'lucide-react-native';
import { router } from 'expo-router';
import { Counter, isDuringEvent, daysUntil, daysUntilEnd, eventProgress, untilProgress, untilProgressStepped } from '@/store/countersStore';
import RingCountdown from '@/components/counters/RingCountdown';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius, fonts } from '@/theme';
import { haptic } from '@/utils/haptics';

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
}

function CountdownsCard({ countdowns, cardBg, accentColor }: CountdownsCardProps) {
  const c = useColors();
  const s = makeS(c);
  if (countdowns.length === 0) return null;
  return (
    <View style={[s.card, { backgroundColor: cardBg }]}>
      <View style={s.cardHeader}>
        <CalendarClock size={13} color={accentColor} />
        <Text style={s.cardTitle}>Odliczania</Text>
        <TouchableOpacity onPress={() => { haptic.tap(); router.navigate('/counters' as any); }} style={{ marginLeft: 'auto' }} activeOpacity={0.7}>
          <Text style={[s.workToggleText, { color: accentColor }]}>Wszystkie</Text>
        </TouchableOpacity>
      </View>
      <View style={{ gap: spacing[3], marginTop: spacing[2] }}>
        {countdowns.slice(0, 3).map(cn => {
          const during = isDuringEvent(cn);
          const left = daysUntil(cn);
          const endLeft = daysUntilEnd(cn);
          const label = during
            ? (endLeft <= 0 ? 'ostatni dzień!' : endLeft === 1 ? 'koniec jutro' : `koniec za ${endLeft} dni`)
            : (left === 0 ? 'dziś!' : left === 1 ? 'jutro!' : `za ${left} dni`);
          const ringColor = during ? '#2AC68F' : (cn.barColor || accentColor);
          const progress = during ? eventProgress(cn) : (cn.fillStyle === 'stepped' ? untilProgressStepped(cn) : untilProgress(cn));
          const ringDays = Math.max(0, during ? endLeft : left);
          const dateShort = cn.date.slice(5).split('-').reverse().join('.');
          return (
            <TouchableOpacity key={cn.id} style={s.cdRow} onPress={() => { haptic.tap(); router.push(`/counters/${cn.id}` as any); }} activeOpacity={0.7}>
              <RingCountdown progress={progress} color={ringColor} days={ringDays} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.cdName} numberOfLines={1}>{cn.name}</Text>
                <Text style={[s.cdStatus, { color: ringColor }]} numberOfLines={1}>{label}</Text>
                <Text style={s.cdMeta} numberOfLines={1}>cel {dateShort}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
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
  cdRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  cdName: { fontSize: 14, fontWeight: '700', color: c.text.primary },
  cdStatus: { fontSize: 13, fontWeight: '800', marginTop: 2 },
  cdMeta: { fontSize: 11, color: c.text.muted, fontWeight: '600', marginTop: 1 },
}));

export default memo(CountdownsCard);
