import { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CalendarDays } from 'lucide-react-native';
import { CalendarEvent } from '@/types';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius, fonts } from '@/theme';
import { useGCalTileStyleStore, GCalTileStyle } from '@/store/gcalTileStyleStore';

// Wyciągnięte 1:1 z `app/(tabs)/index.tsx` `nodes['gcal']` (2026-08-26, kolejny mały krok
// rozbicia dashboardu — patrz NEXT_STEPS.md/ARCHITECTURE.md §4 dla wzorca i historii). Guard
// `.length > 0 &&` ZOSTAJE w `index.tsx`. Style `card`/`cardHeader`/`cardTitle` skopiowane
// verbatim (współdzielone); `gcalDayLabel`/`gcalRow`/`gcalDot`/`gcalTime`/`gcalTitle` były
// używane TYLKO tutaj — przeniesione w całości.
export interface GCalCardProps {
  today: CalendarEvent[];
  tomorrow: CalendarEvent[];
  cardBg: string;
  // Kreator dashboardu, Faza 13 (§339) — ten sam zero-footprint wzorzec co inne karty.
  styleOverride?: GCalTileStyle;
}

function GCalCard({ today, tomorrow, cardBg, styleOverride }: GCalCardProps) {
  const c = useColors();
  const s = makeS(c);
  const liveStyle = useGCalTileStyleStore(st => st.live);
  const tileStyle = styleOverride ?? liveStyle;
  if (today.length === 0 && tomorrow.length === 0) return null;
  const todayShown = today.slice(0, tileStyle.maxVisible);
  const tomorrowShown = tomorrow.slice(0, tileStyle.maxVisible);
  return (
    <View style={[s.card, { backgroundColor: cardBg }]}>
      <View style={s.cardHeader}>
        <CalendarDays size={13} color={c.text.muted} />
        <Text style={s.cardTitle}>Google Kalendarz</Text>
      </View>
      {todayShown.length > 0 && (
        <>
          <Text style={s.gcalDayLabel}>Dziś</Text>
          {todayShown.map(e => (
            <View key={e.id} style={s.gcalRow}>
              {tileStyle.showDot && <View style={[s.gcalDot, { backgroundColor: e.color ?? c.brand.gcal }]} />}
              {tileStyle.showTime && e.startTime ? <Text style={s.gcalTime}>{e.startTime}</Text> : null}
              <Text style={s.gcalTitle} numberOfLines={1}>{e.title}</Text>
            </View>
          ))}
        </>
      )}
      {tomorrowShown.length > 0 && (
        <>
          <Text style={[s.gcalDayLabel, { marginTop: todayShown.length > 0 ? spacing[2] : 0 }]}>Jutro</Text>
          {tomorrowShown.map(e => (
            <View key={e.id} style={s.gcalRow}>
              {tileStyle.showDot && <View style={[s.gcalDot, { backgroundColor: e.color ?? c.brand.gcal }]} />}
              {tileStyle.showTime && e.startTime ? <Text style={s.gcalTime}>{e.startTime}</Text> : null}
              <Text style={s.gcalTitle} numberOfLines={1}>{e.title}</Text>
            </View>
          ))}
        </>
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
  gcalDayLabel: { fontSize: 9, fontWeight: '700', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  gcalRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 3 },
  gcalDot: { width: 6, height: 6, borderRadius: 3 },
  gcalTime: { fontSize: 10, color: c.text.muted, width: 36, fontWeight: '600' },
  gcalTitle: { flex: 1, fontSize: 13, color: c.text.secondary },
}));

export default memo(GCalCard);
