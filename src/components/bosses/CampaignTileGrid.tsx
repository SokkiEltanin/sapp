import { memo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Lock, Swords, Check } from 'lucide-react-native';
import BossArt from './BossArt';
import PressableScale from '@/components/ui/PressableScale';
import { Boss, mysteryBossName, fmtEnergyCountdown } from '@/utils/bosses';
import { spacing, radius } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';

// Zamiennik CampaignMap.tsx (2026-10-25, §422) — user po kolejnej rundzie poprawek mapy
// (§412-§414, lane-model + hydration gate + zawsze-widoczny baner): "ten boss z kampanii
// nadal mapa działa słabo, wywalmy ją i zróbmy po prostu basic kafelki jak kiedyś na razie
// przynajmniej". Zamiast kolejnej łatki na architekturę, która już przeszła kilka pełnych
// przebudów i user i tak jej nie ufa: zwykła, przewijana LISTA (żadnej własnej kamery,
// żadnego layoutu zygzaka/krzywej, żadnych nadpisań pozycji z edytora) — ten sam model co
// dawna "płaska lista pokonani+zablokowani" sprzed CampaignMap (patrz ARCHITECTURE.md §302).
// CampaignMap.tsx/boss-map-editor.tsx/campaign-map-creator.tsx/bossMapLayoutStore.ts/
// campaignMapStyleStore.ts ŚWIADOMIE NIE usunięte (user: "na razie przynajmniej" — to ma
// wrócić w jakiejś formie przy pełnym redesignie appki, nie jest to trwała decyzja) — tylko
// ODPIĘTE z `bosses.tsx` (wejście do edytora lanów usunięte, bo edycja pozycji na torze, który
// się już nie renderuje, nie ma sensu).
//
// Grupowanie wg żywiołu (Las/Lawa/Woda/Burza/Niebo) — TA SAMA kolejność co §413, czytana z
// `order` (bez nowego pola na `Boss` — granice bloków to stały podział 5/5/4/4/4, patrz
// komentarze-nagłówki w bosses.ts przy samej tablicy `BOSSES`).
function elementBlock(order: number): string {
  if (order <= 5) return 'Las';
  if (order <= 10) return 'Lawa';
  if (order <= 14) return 'Woda';
  if (order <= 18) return 'Burza';
  return 'Niebo';
}

type Popup = { kind: 'current' | 'defeated'; boss: Boss };

function CampaignTileGrid({ bosses, currentId, onPressCurrent, energy, energyMax, energyRegenAt, variant = 'campaign', locked, lockMessage }: {
  bosses: Boss[]; currentId: string | null; onPressCurrent: () => void;
  energy?: number; energyMax?: number; energyRegenAt?: string | null;
  variant?: 'campaign' | 'mad'; locked?: boolean; lockMessage?: string;
}) {
  const isMad = variant === 'mad';
  const c = useColors();
  const s = makeS(c);
  const [popup, setPopup] = useState<Popup | null>(null);
  const currentIdx = currentId ? bosses.findIndex(b => b.id === currentId) : bosses.length;
  const accent = isMad ? '#EF4444' : '#38BDF8';

  if (bosses.length === 0) return null;

  let lastBlock = '';

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {bosses.map((b, i) => {
          const block = elementBlock(b.order);
          const showHeader = block !== lastBlock;
          lastBlock = block;
          const isDefeated = i < currentIdx;
          const isCurrent = i === currentIdx;
          const isLocked = i > currentIdx;
          return (
            <View key={b.id}>
              {showHeader && <Text style={s.blockHeader}>{block}</Text>}
              <PressableScale
                disabled={isLocked}
                onPress={() => { haptic.tap(); setPopup({ kind: isCurrent ? 'current' : 'defeated', boss: b }); }}
                style={[s.row, isCurrent && { borderColor: accent, backgroundColor: accent + '14' }]}
              >
                <View style={s.portraitWrap}>
                  <BossArt id={b.id} emoji={b.emoji} size={48} mystery={isLocked} powered={isMad && !isLocked} />
                  {isDefeated && <View style={s.doneBadge}><Check size={11} color="#07160F" /></View>}
                  {isLocked && <View style={s.lockBadge}><Lock size={10} color="rgba(255,255,255,0.75)" /></View>}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[s.rowName, isLocked && { color: c.text.muted }]} numberOfLines={1}>
                    {isLocked ? mysteryBossName(b.id) : b.name}
                  </Text>
                  {isCurrent && <Text style={[s.rowSub, { color: accent }]}>{locked ? 'Zablokowany cel' : 'Twój cel'}</Text>}
                  {isDefeated && <Text style={s.rowSubDone}>Pokonany ✓</Text>}
                </View>
                {isCurrent && (locked ? <Lock size={16} color={accent} /> : <Swords size={16} color={accent} />)}
              </PressableScale>
            </View>
          );
        })}
      </ScrollView>

      {popup && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
          <Pressable style={s.popupBackdrop} onPress={() => setPopup(null)} />
          <View style={s.popup}>
            <View style={{ alignItems: 'center' }}>
              <BossArt id={popup.boss.id} emoji={popup.boss.emoji} size={popup.kind === 'current' ? 88 : 60} mystery={false} powered={isMad} />
            </View>
            {isMad && <Text style={s.popupMadKicker}>OSZALAŁY WARIANT</Text>}
            <Text style={s.popupName}>{popup.boss.name}</Text>
            {popup.kind === 'current' ? (
              <>
                <Text style={s.popupTaunt} numberOfLines={2}>„{popup.boss.taunt}"</Text>
                <Text style={s.popupHp}>{popup.boss.hp} HP · <Text style={{ color: '#2AC68F', fontWeight: '800' }}>{popup.boss.weaknessLabel}</Text></Text>
                {locked ? (
                  <View style={s.popupLockBox}>
                    <Lock size={13} color="rgba(255,255,255,0.6)" />
                    <Text style={s.popupLockTxt}>{lockMessage}</Text>
                  </View>
                ) : (
                  <>
                    {energy != null && energyMax != null && energy < energyMax && energyRegenAt && (
                      <Text style={s.popupEnergyHint}>Kolejna energia za {fmtEnergyCountdown(energyRegenAt)}</Text>
                    )}
                    <PressableScale onPress={() => { haptic.tap(); setPopup(null); onPressCurrent(); }} style={{ width: '100%', marginTop: spacing[2] }}>
                      <View style={[s.attackBtn, energy != null && energy <= 0 && { opacity: 0.5 }]}>
                        <Swords size={15} color="#fff" />
                        <Text style={s.attackTxt}>WALCZ!</Text>
                      </View>
                    </PressableScale>
                  </>
                )}
              </>
            ) : (
              <Text style={s.popupDoneTxt}>
                {isMad ? `Pokonany ✓ · +${popup.boss.xp} XP` : `Pokonany ✓ · ${popup.boss.loot.name}`}
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  // `paddingBottom` hojny, flat (nie liczony z `insets.bottom`) — kafle raid/event +
  // `PupilNavbar` pływają NAD listą z `bosses.tsx`'s `navbarClearance` (zależnym od
  // urządzenia), ten komponent nie zna tej wartości (nie jest jego propem) — 220 z zapasem
  // pokrywa nawet duże dolne inset'y (gesture-nav), reszta to tylko puste miejsce do scrolla.
  scroll: { padding: spacing[4], paddingTop: spacing[3] + 56, paddingBottom: 220, gap: spacing[2] },
  blockHeader: { fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: c.text.muted, marginTop: spacing[3], marginBottom: spacing[1] },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default,
    padding: spacing[2], marginBottom: spacing[2],
  },
  portraitWrap: { position: 'relative' },
  doneBadge: {
    position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#2AC68F', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.bg.card,
  },
  lockBadge: {
    position: 'absolute', top: -2, right: -2, width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  rowName: { fontSize: 14, fontWeight: '800', color: c.text.primary },
  rowSub: { fontSize: 11, fontWeight: '800', marginTop: 2 },
  rowSubDone: { fontSize: 11, fontWeight: '700', color: '#2AC68F', marginTop: 2 },

  popupBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  popup: {
    position: 'absolute', left: spacing[4], right: spacing[4], top: '32%',
    backgroundColor: '#161A1A', borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    padding: spacing[4], gap: 3,
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 12,
  },
  popupMadKicker: { fontSize: 9.5, fontWeight: '900', color: '#DC2626', letterSpacing: 1, textAlign: 'center', marginTop: 4 },
  popupName: { fontSize: 15, fontWeight: '900', color: '#fff', textAlign: 'center', marginTop: 4 },
  popupTaunt: { fontSize: 11.5, color: 'rgba(255,255,255,0.6)', fontStyle: 'italic', textAlign: 'center' },
  popupHp: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: 2 },
  popupEnergyHint: { fontSize: 10.5, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 2 },
  popupDoneTxt: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  popupLockBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing[2] },
  popupLockTxt: { flex: 1, fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 15 },
  attackBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#EF4444', borderRadius: radius.md, paddingVertical: 12 },
  attackTxt: { fontSize: 14, fontWeight: '900', color: '#fff' },
}));

export default memo(CampaignTileGrid);
