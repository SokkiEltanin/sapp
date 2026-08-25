import { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CalendarClock } from 'lucide-react-native';
import { router } from 'expo-router';
import { Counter, isDuringEvent, daysUntil, daysUntilEnd, eventProgress, untilProgress } from '@/store/countersStore';
import WalkProgress from '@/components/counters/WalkProgress';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius, fonts } from '@/theme';
import { haptic } from '@/utils/haptics';

// Wyciągnięte 1:1 z `app/(tabs)/index.tsx` `nodes['countdowns']` (2026-08-25, kolejny mały
// krok rozbicia dashboardu — patrz NEXT_STEPS.md/ARCHITECTURE.md §4 dla wzorca i historii).
// Guard `.length > 0 &&` ZOSTAJE w `index.tsx` (edytor dashboardu czyta `nodes[id]`'s
// truthiness, patrz ARCHITECTURE.md). Style `card`/`cardHeader`/`cardTitle`/`workToggleText`/
// `cdDays` skopiowane verbatim — współdzielone z innymi sekcjami w `index.tsx`; `cdName` było
// używane TYLKO tutaj, więc przeniesione w całości (usunięte z `index.tsx`, nie duplikat).
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
          return (
            <TouchableOpacity key={cn.id} onPress={() => { haptic.tap(); router.push(`/counters/${cn.id}` as any); }} activeOpacity={0.7}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 1 }}>
                <Text style={s.cdName} numberOfLines={1}>{cn.name}</Text>
                <Text style={[s.cdDays, during && { color: '#2AC68F' }]}>{label}</Text>
              </View>
              <WalkProgress progress={during ? eventProgress(cn) : untilProgress(cn)} color={during ? '#2AC68F' : accentColor} mode={during ? 'drive' : 'walk'} emoji={cn.emoji} />
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
  cdName: { flex: 1, fontSize: 13, fontWeight: '700', color: c.text.primary },
  cdDays: { fontSize: 12, fontWeight: '800', color: c.tabs?.day ?? '#46B0DE' },
}));

export default memo(CountdownsCard);
