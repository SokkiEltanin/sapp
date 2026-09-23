import { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CalendarClock } from 'lucide-react-native';
import { router } from 'expo-router';
import { Counter, isDuringEvent, daysUntil, daysUntilEnd, eventProgress, untilProgress, untilProgressStepped } from '@/store/countersStore';
import DonationBar from '@/components/counters/DonationBar';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius, fonts } from '@/theme';
import { haptic } from '@/utils/haptics';

// Wyciągnięte 1:1 z `app/(tabs)/index.tsx` `nodes['countdowns']` (2026-08-25, kolejny mały
// krok rozbicia dashboardu — patrz NEXT_STEPS.md/ARCHITECTURE.md §4 dla wzorca i historii).
// Guard `.length > 0 &&` ZOSTAJE w `index.tsx` (edytor dashboardu czyta `nodes[id]`'s
// truthiness, patrz ARCHITECTURE.md).
//
// DonationBar (2026-09-23, user: "gruby napis w pasku wypełniając się jak donate na twitch")
// zastąpił WalkProgress — nazwa licznika teraz mały podpis NAD paskiem (jak tytuł celu
// donacji), a "za X dni"/"dziś!" ląduje W ŚRODKU grubego paska zamiast osobnym tekstem obok
// nazwy — `cdDays` (stary, osobny tekst liczby dni) już nieużywany, usunięty.
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
          const barColor = during ? '#2AC68F' : (cn.barColor || accentColor);
          const progress = during ? eventProgress(cn) : (cn.fillStyle === 'stepped' ? untilProgressStepped(cn) : untilProgress(cn));
          return (
            <TouchableOpacity key={cn.id} onPress={() => { haptic.tap(); router.push(`/counters/${cn.id}` as any); }} activeOpacity={0.7}>
              <Text style={s.cdName} numberOfLines={1}>{cn.name}</Text>
              <DonationBar progress={progress} color={barColor} label={label} />
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
  cdName: { fontSize: 12, fontWeight: '700', color: c.text.secondary, marginBottom: 4 },
}));

export default memo(CountdownsCard);
