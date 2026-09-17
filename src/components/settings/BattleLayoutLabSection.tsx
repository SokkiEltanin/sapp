import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Swords, ChevronLeft } from 'lucide-react-native';
import PressableScale from '@/components/ui/PressableScale';
import { colors, spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';

// Link do /battle-layout-lab (2026-09-17, user: "Daj mi mozliwosc zmienic sam obrazek tla
// walk... wielkość i pozycje pupila, bossa i ich pasków HP, wtedy wyeksportować i zrobisz dla
// wszystkich") — mieszka w Ustawienia → Dane, ten sam wzorzec-karta co `BoxStatsSection`
// (sąsiad), tylko bez własnych statystyk — to poligon do WYPRACOWANIA liczb, nie panel danych.
export default function BattleLayoutLabSection() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Swords size={15} color={c.text.secondary} />
        <Text style={s.title}>Edytor układu walki (beta)</Text>
      </View>
      <Text style={s.sub}>
        Podgląd areny — przeciągnij pupila/bossa/paski HP, zmień tło i rozmiary, wyeksportuj
        wynik. Zmiany tu NIE wpływają na prawdziwą walkę, dopóki nie zgłosisz eksportu.
      </Text>
      <PressableScale onPress={() => { haptic.tap(); router.push('/battle-layout-lab' as any); }}>
        <View style={s.panelLinkBtn}>
          <Swords size={14} color={c.accent.blue} />
          <Text style={s.panelLinkText}>Otwórz edytor</Text>
          <ChevronLeft size={14} color={c.accent.blue} style={{ transform: [{ rotate: '180deg' }] }} />
        </View>
      </PressableScale>
    </View>
  );
}

const makeStyles = themedStyles((c: typeof colors) => StyleSheet.create({
  card: {
    backgroundColor: c.bg.card, borderRadius: radius.xl, padding: spacing[4],
    gap: spacing[3], borderWidth: 1, borderColor: c.border.default, marginTop: spacing[3],
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { ...typography.body, fontWeight: '700', color: c.text.primary },
  sub: { fontSize: 12, color: c.text.muted, lineHeight: 17, marginTop: -spacing[1] },
  panelLinkBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2],
    paddingVertical: spacing[2], borderRadius: radius.md,
    borderWidth: 1, borderColor: c.accent.blue + '40', backgroundColor: c.accent.blue + '14',
  },
  panelLinkText: { fontSize: 12, fontWeight: '700', color: c.accent.blue },
}));
