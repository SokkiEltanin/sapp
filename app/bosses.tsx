import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated, Easing, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { ChevronLeft, Zap, Lock, Check, Swords, Trophy, Coins, Shield, HeartPulse } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import BossArt from '@/components/bosses/BossArt';
import PupilNavbar from '@/components/pet/PupilNavbar';
import Confetti from '@/components/achievements/Confetti';
import { usePetStore, levelFromXp } from '@/store/petStore';
import { BOSSES, bossBonuses, atkPower, dailyAttempts, computeDamage, FIGHT_ROUNDS } from '@/utils/bosses';
import { raidForWeek, raidHpFor, raidCoins, raidXp } from '@/utils/raid';
import { currentEventBoss, eventPeriodKey, eventHpFor, eventCoins, eventXp, eventBossFromKey } from '@/utils/seasonalEvents';
import { monthlyWorkHours, monthlySweetsSpend, thisMonthVsAvg } from '@/utils/menaceStats';
import { weekKeyOf } from '@/utils/quests';
import { useExpensesStore } from '@/store/expensesStore';
import { useCalendarStore } from '@/store/calendarStore';
import { useWorkStore } from '@/store/workStore';
import { spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';

// kolor aury bossa wg jego słabości (arty/klimat)
const WEAK_COLOR: Record<string, string> = {
  steps: '#46B0DE', sweetless: '#F472B6', habits: '#2AC68F', mood: '#A78BFA', sleep: '#5B7BE3', water: '#38BDF8',
};

// Ekran-LISTA (S&F-style, 2026-08-09 — patrz memory boss_design.md): user "nie
// zrobiłeś jak w SFGAME... tam są tylko bossy i jak klikam WALCZ to przechodzę do
// [osobnej] zakładki i tam się walczy do zera hp". Ten ekran jest teraz WYŁĄCZNIE
// listą/przeglądem (kampania + raid + wydarzenie); klik "WALCZ" na aktualnym bossie
// kampanii nawiguje do app/boss-fight.tsx, gdzie faktycznie toczy się starcie rundowe
// z paskami HP. Raid/wydarzenie ZOSTAJĄ tutaj jako proste jednorazowe kliknięcia
// (single-hit, nie rundowe — nie ma kontrataku ani paska HP kotka, więc osobny ekran
// walki nic by tu nie dodał).
export default function Bosses() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const {
    xp, energy, raidEnergy, eventEnergy, ownedItems, defeatedBosses, syncEnergy, syncRaidEnergy, syncEventEnergy,
    raidWeek, raidHp, raidWon, raidEnsure, raidAttack, raidClaim, eventHp, eventWon, eventAttack, eventClaim,
    atkStatBonus,
  } = usePetStore();
  const { expenses } = useExpensesStore();
  const { events, gcalEvents } = useCalendarStore();
  const { settings: workSettings } = useWorkStore();

  const [raidVictory, setRaidVictory] = useState(false);
  const [eventVictory, setEventVictory] = useState(false);
  const bonuses = useMemo(() => bossBonuses(ownedItems), [ownedItems]);
  const level = useMemo(() => levelFromXp(xp).level, [xp]);

  // v5 pivot: energia to płaski dzienny limit prób (dailyAttempts), NIE liczony już z
  // danych samo-opieki — patrz memory boss_design.md. Ten sam limit dobija niezależnie
  // 3 pule (boss/raid/wydarzenie).
  const reload = useCallback(() => {
    const attempts = dailyAttempts(bonuses.energyMult);
    syncEnergy(attempts, 0);
    syncRaidEnergy(attempts, 0);
    syncEventEnergy(attempts, 0);
    raidEnsure(weekKeyOf(), raidHpFor(level, weekKeyOf()));
  }, [bonuses.energyMult, syncEnergy, syncRaidEnergy, syncEventEnergy, level, raidEnsure]);
  useFocusEffect(reload);

  // sequential campaign: current = pierwszy niepokonany. HP resetuje się co próbę
  // (karczma S&F) — pasek nie ma sensu tutaj, tylko na ekranie walki.
  const current = BOSSES.find(b => !defeatedBosses.includes(b.id)) ?? null;
  const unlocked = current ? level >= current.unlockLevel : false;
  const previewDmg = current ? Math.round(atkPower(atkStatBonus, level, bonuses)) : 0;

  // ── raid tygodniowy ──
  const weekKey = weekKeyOf();
  const raid = raidForWeek(weekKey);
  const raidMaxHp = raidHpFor(level, weekKey);
  const raidRemaining = raidWeek === weekKey ? raidHp : raidMaxHp;
  const raidDone = raidWon.includes(weekKey);
  const raidUnlocked = level >= 3;
  const raidPreviewDmg = Math.round(atkPower(atkStatBonus, level, bonuses));

  // ── wydarzenie (sezonowe święto LUB „nemesis miesiąca"). Sezonowy zawsze wygrywa. ──
  const now = new Date();
  const workByMonth = monthlyWorkHours([...events, ...gcalEvents], workSettings, now);
  const sweetsByMonth = monthlySweetsSpend(expenses, now);
  const workVsAvg = thisMonthVsAvg(workByMonth, now);
  const sweetsVsAvg = thisMonthVsAvg(sweetsByMonth, now);
  const menaceCtx = {
    workHoursThisMonth: workVsAvg.thisMonth, workHoursAvg: workVsAvg.avg,
    sweetsThisMonth: sweetsVsAvg.thisMonth, sweetsAvg: sweetsVsAvg.avg,
  };
  const eventBoss = currentEventBoss(now, menaceCtx);
  const eventKey = eventBoss ? eventPeriodKey(eventBoss, now) : null;
  const eventMaxHp = eventHpFor(level);
  const eventRemaining = eventKey ? (eventHp[eventKey] ?? eventMaxHp) : 0;
  const eventDone = eventKey ? eventWon.includes(eventKey) : false;
  const eventUnlocked = level >= 2;
  const eventPreviewDmg = Math.round(atkPower(atkStatBonus, level, bonuses));

  // raid/wydarzenie — proste jednorazowe kliknięcie, animacja lokalna (nie rundowa)
  const rShake = useRef(new Animated.Value(0)).current;
  const rDmgY = useRef(new Animated.Value(0)).current;
  const [raidHit, setRaidHit] = useState<{ dmg: number; crit: boolean } | null>(null);
  const eShake = useRef(new Animated.Value(0)).current;
  const eDmgY = useRef(new Animated.Value(0)).current;
  const [eventHitFx, setEventHitFx] = useState<{ dmg: number; crit: boolean } | null>(null);

  const doRaid = () => {
    if (raidDone) { haptic.tap(); toast.info('Raid tego tygodnia pokonany! Nowy w poniedziałek.'); return; }
    if (!raidUnlocked) { haptic.error(); toast.info('Raid odblokujesz na poziomie 3'); return; }
    if (raidEnergy <= 0) { haptic.error(); toast.info('Brak prób ataku raidu na dziś — wróć jutro po nowe.'); return; }
    const { damage, crit } = computeDamage(atkStatBonus, level, bonuses);
    haptic.medium();
    setRaidHit({ dmg: damage, crit });
    rShake.setValue(0); rDmgY.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(rShake, { toValue: 1, duration: 55, useNativeDriver: true }),
        Animated.timing(rShake, { toValue: -1, duration: 55, useNativeDriver: true }),
        Animated.timing(rShake, { toValue: 0, duration: 55, useNativeDriver: true }),
      ]),
      Animated.timing(rDmgY, { toValue: 1, duration: 800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
    const res = raidAttack(damage);
    if (res.defeated) {
      setTimeout(() => { raidClaim(weekKey, raidCoins(level), raidXp(level)); haptic.success(); setRaidVictory(true); }, 300);
    }
  };

  const doEvent = () => {
    if (!eventBoss || !eventKey) return;
    if (eventDone) { haptic.tap(); toast.info('Wydarzenie już pokonane w tym okresie!'); return; }
    if (!eventUnlocked) { haptic.error(); toast.info('Wydarzenia odblokujesz na poziomie 2'); return; }
    if (eventEnergy <= 0) { haptic.error(); toast.info('Brak prób ataku wydarzenia na dziś — wróć jutro po nowe.'); return; }
    const { damage, crit } = computeDamage(atkStatBonus, level, bonuses);
    haptic.medium();
    setEventHitFx({ dmg: damage, crit });
    eShake.setValue(0); eDmgY.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(eShake, { toValue: 1, duration: 55, useNativeDriver: true }),
        Animated.timing(eShake, { toValue: -1, duration: 55, useNativeDriver: true }),
        Animated.timing(eShake, { toValue: 0, duration: 55, useNativeDriver: true }),
      ]),
      Animated.timing(eDmgY, { toValue: 1, duration: 800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
    const res = eventAttack(eventKey, eventMaxHp, damage);
    if (res.defeated) {
      setTimeout(() => { eventClaim(eventKey, eventCoins(level), eventXp(level)); haptic.success(); setEventVictory(true); }, 300);
    }
  };

  const rShakeX = rShake.interpolate({ inputRange: [-1, 1], outputRange: [-7, 7] });
  const rFloatY = rDmgY.interpolate({ inputRange: [0, 1], outputRange: [0, -44] });
  const rFloatOp = rDmgY.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] });
  const eShakeX = eShake.interpolate({ inputRange: [-1, 1], outputRange: [-7, 7] });
  const eFloatY = eDmgY.interpolate({ inputRange: [0, 1], outputRange: [0, -44] });
  const eFloatOp = eDmgY.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] });

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <PressableScale onPress={() => router.back()} style={s.backBtn}><ChevronLeft size={22} color={c.text.primary} /></PressableScale>
        <Text style={s.headerTitle}>Bossy</Text>
        <View style={s.energyPill}><Zap size={13} color="#38BDF8" /><Text style={s.energyTxt}>{energy}</Text></View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* ── RAID + WYDARZENIE: kompaktowe kafle, jednorazowe kliknięcie tu na miejscu ── */}
        <View style={s.miniRow}>
          <View style={s.miniCard}>
            <View style={s.miniHead}>
              <View style={s.miniKickerRow}>
                <Text style={s.miniKicker}>RAID</Text>
                <Trophy size={9} color={c.text.muted} />
                <Text style={s.miniKicker}>{raidWon.length}</Text>
              </View>
              <View style={s.miniEnergyRow}>
                <Zap size={10} color="#38BDF8" />
                <Text style={s.miniEnergy}>{raidEnergy}</Text>
              </View>
            </View>
            <View style={s.miniBody}>
              <View>
                <Animated.Text style={[s.miniEmoji, { transform: [{ translateX: rShakeX }] }]}>{raid.emoji}</Animated.Text>
                {raidHit && (
                  <Animated.Text style={[s.miniDmgFloat, { opacity: rFloatOp, transform: [{ translateY: rFloatY }], color: raidHit.crit ? '#FDE047' : '#F87171' }]}>-{raidHit.dmg}</Animated.Text>
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.miniName} numberOfLines={1}>{raid.name}</Text>
                <View style={s.miniHpTrack}><View style={[s.miniHpFill, { width: `${Math.round((raidDone ? 0 : raidRemaining) / raidMaxHp * 100)}%`, backgroundColor: WEAK_COLOR[raid.weakness] ?? '#888' }]} /></View>
              </View>
            </View>
            {raidDone ? (
              <Text style={s.miniDoneTxt}>Pokonany ✓ · nowy w pon.</Text>
            ) : raidUnlocked ? (
              <PressableScale onPress={doRaid}>
                <View style={[s.miniBtn, { backgroundColor: '#A78BFA' }, raidEnergy <= 0 && { opacity: 0.5 }]}>
                  <Text style={s.miniBtnTxt}>Atakuj · ~{raidPreviewDmg}</Text>
                </View>
              </PressableScale>
            ) : (
              <Text style={s.miniLockTxt}>Odblokuj: lvl 3</Text>
            )}
          </View>

          {eventBoss && eventKey && (
            <View style={s.miniCard}>
              <View style={s.miniHead}>
                <View style={s.miniKickerRow}>
                  <Text style={s.miniKicker} numberOfLines={1}>{eventBoss.kind === 'seasonal' ? 'WYDARZENIE' : 'NEMESIS'}</Text>
                  <Trophy size={9} color={c.text.muted} />
                  <Text style={s.miniKicker}>{eventWon.length}</Text>
                </View>
                <View style={s.miniEnergyRow}>
                  <Zap size={10} color="#38BDF8" />
                  <Text style={s.miniEnergy}>{eventEnergy}</Text>
                </View>
              </View>
              <View style={s.miniBody}>
                <View>
                  <Animated.Text style={[s.miniEmoji, { transform: [{ translateX: eShakeX }] }]}>{eventBoss.emoji}</Animated.Text>
                  {eventHitFx && (
                    <Animated.Text style={[s.miniDmgFloat, { opacity: eFloatOp, transform: [{ translateY: eFloatY }], color: eventHitFx.crit ? '#FDE047' : '#F87171' }]}>-{eventHitFx.dmg}</Animated.Text>
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.miniName} numberOfLines={1}>{eventBoss.name}</Text>
                  <View style={s.miniHpTrack}><View style={[s.miniHpFill, { width: `${Math.round((eventDone ? 0 : eventRemaining) / eventMaxHp * 100)}%`, backgroundColor: WEAK_COLOR[eventBoss.weakness] ?? '#888' }]} /></View>
                </View>
              </View>
              {eventDone ? (
                <Text style={s.miniDoneTxt}>Pokonany ✓</Text>
              ) : eventUnlocked ? (
                <PressableScale onPress={doEvent}>
                  <View style={[s.miniBtn, { backgroundColor: '#F4B740' }, eventEnergy <= 0 && { opacity: 0.5 }]}>
                    <Text style={s.miniBtnTxt}>Atakuj · ~{eventPreviewDmg}</Text>
                  </View>
                </PressableScale>
              ) : (
                <Text style={s.miniLockTxt}>Odblokuj: lvl 2</Text>
              )}
            </View>
          )}
        </View>

        {/* ── KAMPANIA: aktualny boss jako karta-bohater z jednym przyciskiem WALCZ,
            który przenosi na osobny ekran walki (S&F). Reszta = zwykła lista. ── */}
        {!current ? (
          <View style={s.done}>
            <Swords size={30} color={c.text.muted} />
            <Text style={s.doneTxt}>Wszyscy bossowie pokonani! Kolejni wkrótce.</Text>
          </View>
        ) : (
          <View style={s.heroCard}>
            <View style={s.bossTop}>
              <View style={[s.aura, { backgroundColor: (WEAK_COLOR[current.weakness] ?? '#888') + '22', borderColor: (WEAK_COLOR[current.weakness] ?? '#888') + '55' }]} pointerEvents="none" />
              <BossArt id={current.id} emoji={current.emoji} size={82} />
            </View>
            <Text style={s.bossName}>{current.name}</Text>
            <Text style={s.bossTaunt}>„{current.taunt}"</Text>
            <Text style={s.hpTxt}>{current.hp} HP · Motyw: <Text style={{ color: '#2AC68F', fontWeight: '800' }}>{current.weaknessLabel}</Text></Text>

            {unlocked ? (
              <>
                <Text style={s.previewTxt}>Twój cios: ~{previewDmg} obrażeń/rundę × {FIGHT_ROUNDS} rundy · prób dziś: {energy}</Text>
                {(current.guard || current.regenPct) && (
                  <View style={s.mechRow}>
                    {current.guard && <><Shield size={11} color={c.text.muted} /><Text style={s.mechHint}>wrodzona osłona (ciosy ×0.5)</Text></>}
                    {current.regenPct && <><HeartPulse size={11} color={c.text.muted} /><Text style={s.mechHint}>regeneruje się, gdy przeżyje rundę</Text></>}
                  </View>
                )}
                <PressableScale onPress={() => { haptic.tap(); router.push('/boss-fight' as any); }} style={{ width: '100%' }}>
                  <View style={[s.attackBtn, energy <= 0 && { opacity: 0.5 }]}>
                    <Swords size={18} color="#0B0E1A" />
                    <Text style={s.attackTxt}>WALCZ!</Text>
                  </View>
                </PressableScale>
                <View style={s.lootRow}>
                  <Text style={s.loot}>Nagroda: {current.loot.emoji} {current.loot.name} · {current.loot.desc} ·</Text>
                  <Coins size={11} color="#FBBF24" />
                  <Text style={s.lootCoins}>{current.coins}</Text>
                </View>
              </>
            ) : (
              <View style={s.lockBox}>
                <Lock size={16} color={c.text.muted} />
                <Text style={s.lockTxt}>Odblokujesz na poziomie {current.unlockLevel} (masz {level}). Rozwijaj pupila questami.</Text>
              </View>
            )}
          </View>
        )}

        {/* campaign list */}
        <Text style={s.section}>Kampania</Text>
        <View style={{ gap: spacing[2] }}>
          {BOSSES.map(b => {
            const def = defeatedBosses.includes(b.id);
            const isCur = current?.id === b.id;
            const lock = !def && level < b.unlockLevel;
            return (
              <View key={b.id} style={[s.row, isCur && { borderColor: '#38BDF8' }]}>
                <View style={(def || lock) && { opacity: 0.5 }}>
                  <BossArt id={b.id} emoji={b.emoji} size={32} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.rowName} numberOfLines={1}>{b.name}</Text>
                  <Text style={s.rowSub}>{def ? `Pokonany · ${b.loot.emoji} ${b.loot.name}` : lock ? `Poziom ${b.unlockLevel}` : `${b.hp} HP · ${b.weaknessLabel}`}</Text>
                </View>
                {def ? <View style={s.rowBadge}><Check size={14} color="#2AC68F" /></View>
                  : lock ? <Lock size={15} color={c.text.muted} />
                    : isCur ? <View style={[s.rowBadge, { backgroundColor: '#38BDF822' }]}><Swords size={13} color="#38BDF8" /></View> : null}
              </View>
            );
          })}
        </View>

        {raidWon.length > 0 && (
          <>
            <Text style={s.section}>Medale raidów ({raidWon.length})</Text>
            <View style={s.medalWall}>
              {raidWon.slice().reverse().map(wk => (
                <View key={wk} style={s.medal}>
                  <Text style={s.medalEmoji}>{raidForWeek(wk).trophyEmoji}</Text>
                  <Text style={s.medalWk} numberOfLines={1}>{wk}</Text>
                </View>
              ))}
            </View>
          </>
        )}
        {eventWon.length > 0 && (
          <>
            <Text style={s.section}>Medale wydarzeń ({eventWon.length})</Text>
            <View style={s.medalWall}>
              {eventWon.slice().reverse().map(key => (
                <View key={key} style={s.medal}>
                  <Text style={s.medalEmoji}>{eventBossFromKey(key)?.trophyEmoji ?? '🏆'}</Text>
                  <Text style={s.medalWk} numberOfLines={1}>{key}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* raid victory */}
      <RaidVictoryModal visible={raidVictory} onClose={() => setRaidVictory(false)} raid={raid} level={level} c={c} s={s} />
      {/* event victory */}
      <EventVictoryModal visible={eventVictory} onClose={() => setEventVictory(false)} eventBoss={eventBoss} level={level} c={c} s={s} />

      <PupilNavbar current="bosses" />
    </SafeAreaView>
  );
}

// Małe, lokalne modale (raid/wydarzenie zostają na tym ekranie — patrz komentarz u góry
// pliku). Wydzielone z JSX głównego komponentu tylko żeby return() był czytelny.
function RaidVictoryModal({ visible, onClose, raid, level, c, s }: any) {
  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.vBackdrop} onPress={onClose}>
        <Confetti colors={['#FDE047', '#38BDF8', '#2AC68F', '#F472B6']} />
        <View style={s.vCenter} pointerEvents="none">
          <Text style={s.vKicker}>RAID POKONANY!</Text>
          <Text style={s.vBoss}>{raid.trophyEmoji}</Text>
          <Text style={s.vName}>{raid.name}</Text>
          <View style={s.vRewardRow}>
            <Coins size={15} color="#FDE047" />
            <Text style={s.vReward}>Medal tygodnia · {raidCoins(level)} · +{raidXp(level)} XP</Text>
          </View>
        </View>
        <Text style={s.vHint}>Stuknij, aby zamknąć</Text>
      </Pressable>
    </Modal>
  );
}
function EventVictoryModal({ visible, onClose, eventBoss, level, c, s }: any) {
  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.vBackdrop} onPress={onClose}>
        <Confetti colors={['#F4B740', '#FDE047', '#38BDF8', '#F472B6']} />
        {eventBoss && (
          <View style={s.vCenter} pointerEvents="none">
            <Text style={s.vKicker}>WYDARZENIE POKONANE!</Text>
            <Text style={s.vBoss}>{eventBoss.trophyEmoji}</Text>
            <Text style={s.vName}>{eventBoss.name}</Text>
            <View style={s.vRewardRow}>
              <Coins size={15} color="#FDE047" />
              <Text style={s.vReward}>Medal · {eventCoins(level)} · +{eventXp(level)} XP</Text>
            </View>
          </View>
        )}
        <Text style={s.vHint}>Stuknij, aby zamknąć</Text>
      </Pressable>
    </Modal>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', ...typography.h3, color: c.text.primary },
  energyPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#38BDF818', borderRadius: radius.full, paddingHorizontal: 10, height: 30, borderWidth: 1, borderColor: '#38BDF840' },
  energyTxt: { fontSize: 13, fontWeight: '800', color: '#38BDF8' },
  scroll: { padding: spacing[4], paddingTop: spacing[2], paddingBottom: 110 },

  done: { alignItems: 'center', gap: spacing[3], paddingVertical: spacing[8] },
  doneTxt: { fontSize: 13, color: c.text.muted, textAlign: 'center', maxWidth: 260 },

  heroCard: { alignItems: 'center', backgroundColor: c.bg.card, borderRadius: radius.xl, borderWidth: 1, borderColor: c.border.default, padding: spacing[4] },
  bossTop: { height: 92, justifyContent: 'center', alignItems: 'center' },
  bossName: { fontSize: 20, fontWeight: '900', color: c.text.primary, marginTop: 4 },
  bossTaunt: { fontSize: 12.5, color: c.text.muted, fontStyle: 'italic', marginTop: 2, marginBottom: spacing[2] },
  hpTxt: { fontSize: 12.5, fontWeight: '700', color: c.text.secondary },

  previewTxt: { fontSize: 12, color: c.text.muted, textAlign: 'center', marginTop: spacing[2] },
  attackBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FBBF24', borderRadius: radius.lg, paddingVertical: 16, marginTop: spacing[3], width: '100%' },
  attackTxt: { fontSize: 17, fontWeight: '900', color: '#0B0E1A' },
  lootRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: spacing[3], flexWrap: 'wrap' },
  loot: { fontSize: 11.5, color: c.text.muted, textAlign: 'center' },
  lootCoins: { fontSize: 11.5, color: '#FBBF24', fontWeight: '800' },
  lockBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing[3], paddingHorizontal: spacing[3] },
  lockTxt: { flex: 1, fontSize: 12.5, color: c.text.muted, lineHeight: 17 },

  section: { fontSize: 11, fontWeight: '800', color: c.text.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: spacing[5], marginBottom: spacing[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, padding: spacing[3] },
  rowName: { fontSize: 14, fontWeight: '800', color: c.text.primary },
  rowSub: { fontSize: 11.5, color: c.text.muted, marginTop: 1 },
  rowBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#2AC68F1A', alignItems: 'center', justifyContent: 'center' },

  vBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8,8,16,0.94)', paddingHorizontal: 32 },
  vCenter: { alignItems: 'center' },
  vKicker: { fontSize: 14, fontWeight: '900', letterSpacing: 3, color: '#FDE047', marginBottom: 10 },
  vBoss: { fontSize: 72, opacity: 0.6 },
  vName: { fontSize: 22, fontWeight: '900', color: '#fff', marginTop: 6 },
  vRewardRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing[4] },
  vReward: { fontSize: 14, fontWeight: '800', color: '#FDE047' },
  vHint: { position: 'absolute', bottom: 48, color: 'rgba(255,255,255,0.5)', fontSize: 12.5, fontWeight: '600' },

  aura: { position: 'absolute', width: 116, height: 116, borderRadius: 58, borderWidth: 1 },
  mechRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, justifyContent: 'center', flexWrap: 'wrap' },
  mechHint: { fontSize: 11, color: c.text.muted, textAlign: 'center', lineHeight: 15 },

  miniRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[3] },
  miniCard: { flex: 1, minWidth: 0, backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, padding: spacing[3], gap: 6 },
  miniHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  miniKickerRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3, minWidth: 0 },
  miniKicker: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.8, color: c.text.muted },
  miniEnergyRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  miniEnergy: { fontSize: 10.5, fontWeight: '800', color: '#38BDF8' },
  miniBody: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  miniEmoji: { fontSize: 30 },
  miniDmgFloat: { position: 'absolute', top: -8, left: 0, fontSize: 12, fontWeight: '900' },
  miniName: { fontSize: 12.5, fontWeight: '800', color: c.text.primary },
  miniHpTrack: { width: '100%', height: 6, borderRadius: 3, backgroundColor: c.bg.elevated, overflow: 'hidden', marginTop: 4 },
  miniHpFill: { height: '100%', borderRadius: 3 },
  miniBtn: { alignItems: 'center', borderRadius: radius.md, paddingVertical: 8 },
  miniBtnTxt: { fontSize: 11.5, fontWeight: '800', color: '#0B0E1A' },
  miniDoneTxt: { fontSize: 10.5, fontWeight: '700', color: '#2AC68F', textAlign: 'center' },
  miniLockTxt: { fontSize: 10.5, color: c.text.muted, textAlign: 'center' },
  medalWall: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  medal: { width: 64, alignItems: 'center', backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, paddingVertical: spacing[2] },
  medalEmoji: { fontSize: 24 },
  medalWk: { fontSize: 9, color: c.text.muted, marginTop: 2 },
}));
