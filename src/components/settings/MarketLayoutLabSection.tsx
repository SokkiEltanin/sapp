import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Store, ChevronLeft } from 'lucide-react-native';
import PressableScale from '@/components/ui/PressableScale';
import { colors, spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';

// Link do edytora sceny Rynku (`app/pet-shop.tsx`, stan `editScene`/`ArtAdjust`) — ten sam
// wzorzec-karta co `BattleLayoutLabSection` (sąsiad w tej samej sekcji "Pupil"). Edytor
// mieszka FIZYCZNIE w pet-shop.tsx (nie osobny route jak battle-layout-lab) bo dostraja
// WPROST żywą scenę Rynku, nie podgląd — `?editScene=1` każe ekranowi otworzyć panel od
// razu po wejściu, zamiast polegać na ukrytej ikonce w headerze (2026-10-12, user: "przywróć
// edycje SKLEPIKARZA... nawet gdzieś w ustawieniach jak edytor walk" — trigger w headerze
// Rynku TEŻ wrócił, patrz pet-shop.tsx, to jest DRUGIE wejście, dla odkrywalności).
export default function MarketLayoutLabSection() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Store size={15} color={c.text.secondary} />
        <Text style={s.title}>Edytor sceny Rynku (beta)</Text>
      </View>
      <Text style={s.sub}>
        Dostrój pozycję/skalę tła, tablicy, lady, sklepikarza i itemów bezpośrednio na żywej
        scenie Rynku — przyda się przy nowej grafice. Zmiany zapisują się od razu.
      </Text>
      <PressableScale onPress={() => { haptic.tap(); router.push('/pet-shop?editScene=1' as any); }}>
        <View style={s.panelLinkBtn}>
          <Store size={14} color={c.accent.blue} />
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
