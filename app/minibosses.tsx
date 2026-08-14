import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Modal, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Swords, Droplets, Footprints, Coins } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import { usePetStore, levelFromXp, catMaxHp, todayISO } from '@/store/petStore';
import { bossBonuses, simulateFight, MAX_FIGHT_ROUNDS, EquippedItem } from '@/utils/bosses';
import {
  minibossForDay, minibossAsBoss, minibossCoins, minibossXp, STEPS_MILESTONE, MinibossLane,
} from '@/utils/minibosses';
import { minibossPng } from '@/utils/minibossIcons';
import { getHealthHistory } from '@/utils/healthHistory';
import { useHabits } from '@/hooks/useHabits';
import { spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';

// PIĄTY tryb walki (2026-08-14, patrz src/utils/minibosses.ts) — osobny ekran (user: "zupełnie
// nowy ekran"), nie kolejny ?kind= w boss-fight.tsx. Celowo BEZ animacji pocisków/łap jak tam —
// walka rozstrzyga się od razu w jednym simulateFight (pełna symulacja rundowa, prawdziwy
// kontratak), a UI pokazuje tylko wynik + liczbę rund. Jeśli kiedyś ma dostać tę samą
// choreografię co boss-fight.tsx, to osobna decyzja/sesja — pierwsza wersja stawia na to, żeby
// codzienne 1-2 starcia nie wymagały czekania na animacje.
type FightOutcome = { lane: MinibossLane; won: boolean; name: string; coins: number; xp: number; rounds: number } | null;

export default function Minibosses() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const {
    xp, ownedItems, atkStatBonus, catMaxHpBonus, dayClaims,
    ownedCombatItems, equippedCombatItems, resetCatHp, damageCat, claimMiniboss,
  } = usePetStore();
  const { habits, getTodayCount } = useHabits();

  const level = useMemo(() => levelFromXp(xp).level, [xp]);
  const bonuses = useMemo(() => bossBonuses(ownedItems), [ownedItems]);
  const catMax = catMaxHp(catMaxHpBonus);
  const equippedItems: EquippedItem[] = useMemo(
    () => equippedCombatItems.map(id => ({ id, level: ownedCombatItems[id] ?? 1 })),
    [equippedCombatItems, ownedCombatItems],
  );

  const today = todayISO();
  const [stepsToday, setStepsToday] = useState(0);
  useEffect(() => { getHealthHistory(1).then(h => setStepsToday(h[today]?.steps ?? 0)).catch(() => {}); }, [today]);

  const waterHabit = habits.find(h => h.kind === 'water');
  const waterCount = waterHabit ? getTodayCount(waterHabit.id) : 0;
  const waterGoal = waterHabit?.dailyGoal || 1;

  const [fighting, setFighting] = useState<MinibossLane | null>(null);
  const [outcome, setOutcome] = useState<FightOutcome>(null);

  const claimedToday = (lane: MinibossLane) => !!dayClaims[`miniboss_${lane}:${today}`];

  const fight = (lane: MinibossLane) => {
    if (fighting || claimedToday(lane)) return;
    haptic.tap();
    setFighting(lane);
    const mb = minibossForDay(today, lane);
    resetCatHp();
    const result = simulateFight(atkStatBonus, level, bonuses, minibossAsBoss(mb, level), catMax, MAX_FIGHT_ROUNDS, equippedItems);
    damageCat(catMax - result.catHpLeft);
    const coinsWon = minibossCoins(level);
    const xpWon = minibossXp(level);
    if (result.won) {
      claimMiniboss(lane, coinsWon, xpWon, mb.name, level);
      haptic.success();
    } else {
      haptic.error();
    }
    setFighting(null);
    setOutcome({ lane, won: result.won, name: mb.name, coins: result.won ? coinsWon : 0, xp: result.won ? xpWon : 0, rounds: result.rounds.length });
  };

  const LaneCard = ({ lane }: { lane: MinibossLane }) => {
    const mb = minibossForDay(today, lane);
    const png = minibossPng(mb.id);
    const value = lane === 'water' ? waterCount : stepsToday;
    const goal = lane === 'water' ? waterGoal : STEPS_MILESTONE;
    const ready = value >= goal;
    const done = claimedToday(lane);
    const pct = Math.max(0, Math.min(1, goal > 0 ? value / goal : 0));
    const laneColor = lane === 'water' ? '#38BDF8' : '#2AC68F';
    return (
      <View style={s.card}>
        <View style={s.cardHeader}>
          {lane === 'water' ? <Droplets size={16} color={laneColor} /> : <Footprints size={16} color={laneColor} />}
          <Text style={s.cardTitle}>{lane === 'water' ? 'Woda' : 'Kroki'}</Text>
        </View>
        <View style={s.portrait}>
          {png ? <Image source={png} style={{ width: 84, height: 84 }} resizeMode="contain" /> : <Text style={{ fontSize: 60 }}>{mb.emoji}</Text>}
        </View>
        <Text style={s.mbName}>{mb.name}</Text>
        <View style={s.track}><View style={[s.fill, { width: `${pct * 100}%`, backgroundColor: laneColor }]} /></View>
        <Text style={s.progressTxt}>
          {lane === 'water' ? `${value}/${goal} szklanek` : `${value.toLocaleString('pl-PL')}/${goal.toLocaleString('pl-PL')} kroków`}
        </Text>
        {done ? (
          <View style={s.doneBadge}><Text style={s.doneTxt}>✓ Pokonany dziś</Text></View>
        ) : (
          <PressableScale onPress={() => fight(lane)} disabled={!ready || fighting !== null}
            style={[s.fightBtn, { backgroundColor: laneColor }, (!ready || fighting !== null) && s.fightBtnOff]}>
            <Swords size={16} color="#fff" />
            <Text style={s.fightTxt}>{ready ? 'Walcz!' : 'Jeszcze nie gotowe'}</Text>
          </PressableScale>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <PressableScale onPress={() => router.back()} style={s.backBtn}><ChevronLeft size={22} color={c.text.primary} /></PressableScale>
        <Text style={s.headerTitle}>Minibossy</Text>
        <View style={s.backBtn} />
      </View>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.intro}>Wypełnij cel dnia — po drugiej stronie czeka łatwa walka. Codziennie świeży przeciwnik, dwa niezależne tory.</Text>
        <LaneCard lane="water" />
        <LaneCard lane="steps" />
      </ScrollView>

      <Modal visible={!!outcome} transparent statusBarTranslucent animationType="fade" onRequestClose={() => setOutcome(null)}>
        <Pressable style={s.vBackdrop} onPress={() => setOutcome(null)}>
          {outcome && (
            <View style={s.vCenter}>
              <Text style={s.vKicker}>{outcome.won ? 'WYGRANA!' : 'PORAŻKA'}</Text>
              <Text style={s.vName}>{outcome.name}</Text>
              <Text style={s.vSub}>{outcome.rounds} {outcome.rounds === 1 ? 'runda' : 'rund'} walki</Text>
              {outcome.won ? (
                <View style={s.vRewardRow}>
                  <Coins size={16} color="#FDE047" /><Text style={s.vReward}>{outcome.coins} · +{outcome.xp} XP</Text>
                </View>
              ) : (
                <Text style={s.vDefeatSub}>Kotek padł — spróbuj ponownie, HP wróci do pełna.</Text>
              )}
            </View>
          )}
          <Text style={s.vHint}>Stuknij, aby zamknąć</Text>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', ...typography.h3, color: c.text.primary },
  scroll: { padding: spacing[4], paddingTop: spacing[2], paddingBottom: 60, gap: spacing[4] },
  intro: { fontSize: 12.5, color: c.text.muted, textAlign: 'center', lineHeight: 17, marginBottom: spacing[1] },

  card: { alignItems: 'center', backgroundColor: c.bg.card, borderRadius: radius.xl, borderWidth: 1, borderColor: c.border.default, padding: spacing[4] },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  cardTitle: { fontSize: 13, fontWeight: '800', color: c.text.primary },
  portrait: { height: 96, width: '100%', alignItems: 'center', justifyContent: 'center', marginTop: spacing[2] },
  mbName: { fontSize: 15, fontWeight: '800', color: c.text.primary, marginTop: 4 },
  track: { width: '100%', height: 8, borderRadius: 4, backgroundColor: c.bg.elevated, overflow: 'hidden', marginTop: spacing[3] },
  fill: { height: '100%', borderRadius: 4 },
  progressTxt: { fontSize: 11.5, color: c.text.muted, fontWeight: '700', marginTop: 4 },

  doneBadge: { marginTop: spacing[3], backgroundColor: '#2AC68F18', borderWidth: 1, borderColor: '#2AC68F55', borderRadius: radius.lg, paddingVertical: 10, paddingHorizontal: 16 },
  doneTxt: { fontSize: 13, fontWeight: '800', color: '#2AC68F' },

  fightBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.lg, paddingVertical: 12, paddingHorizontal: 24, marginTop: spacing[3], width: '100%' },
  fightBtnOff: { opacity: 0.4 },
  fightTxt: { fontSize: 14, fontWeight: '900', color: '#fff' },

  vBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8,8,16,0.94)', paddingHorizontal: 32 },
  vCenter: { alignItems: 'center' },
  vKicker: { fontSize: 14, fontWeight: '900', letterSpacing: 3, color: '#FDE047', marginBottom: 10 },
  vName: { fontSize: 20, fontWeight: '900', color: '#fff', marginTop: 6, textAlign: 'center' },
  vSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  vDefeatSub: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 10, textAlign: 'center', maxWidth: 260 },
  vRewardRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing[4] },
  vReward: { fontSize: 14, fontWeight: '800', color: '#FDE047' },
  vHint: { position: 'absolute', bottom: 48, color: 'rgba(255,255,255,0.5)', fontSize: 12.5, fontWeight: '600' },
}));
