import { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, Image, ScrollView } from 'react-native';
import { Check } from 'lucide-react-native';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { CRATE_META } from '@/utils/crates';
import { BoxReward } from '@/utils/petBoxes';
import { RARITY_META, gearById } from '@/utils/gear';
import { itemById } from '@/utils/combatItems';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';

// Paczkowe otwieranie (2026-10-11, user: "dodaj mi te skrzynki szybsze otwieranie np
// natychmiastowo otworzyć 5 i pokazują się tylko karty z otwarcia" — kontynuacja wcześniejszej
// prośby o szybsze otwieranie po dodaniu przycisku "Pomiń" w BoxRevealModal.tsx). Zamiast N razy
// odtwarzać ~3.4s spin reela (BoxRevealModal), długie przytrzymanie skrzynki w Rynku otwiera od
// razu N sztuk BEZ animacji — wszystkie nagrody są już wylosowane i przyznane (patrz
// `onBuyBoxMulti` w pet-shop.tsx) ZANIM ten modal się pokaże, więc to czysto podsumowujący
// widok, nie kolejny krok loterii.
//
// Sprzedaż wprost z odsłony (2026-10-11, user: "mogę od razu loot sprzedać... moge wybrać
// które chce sprzedać") — każda karta EKWIPUNKU jest zaznaczalna (tap = toggle), karty
// monet/perków nie (nic tu nie sprzedają — brak mechaniki sprzedaży dla nich w appce).
// Wołający (pet-shop.tsx) dolicza `sellCoins`/`betterThanEquipped` RAZ, od razu po przyznaniu
// (patrz `onBuyBoxMulti`) — ten komponent zostaje czysto prezentacyjny + lokalny stan
// zaznaczenia, realną sprzedaż (sellGear × N) wykonuje `onSellSelected`.
export interface MultiRewardEntry {
  reward: BoxReward;
  instanceId: string | null;       // null = nie-gear (nic do sprzedania)
  sellCoins: number;
  betterThanEquipped: boolean;
}

function rewardMeta(reward: BoxReward) {
  return reward.type === 'gear' ? RARITY_META[reward.rarity] : CRATE_META[reward.rarity];
}

function rewardLabel(reward: BoxReward): string {
  if (reward.type === 'coins') return `+${reward.coins}`;
  if (reward.type === 'combatItem') return `${reward.name}${reward.isUpgrade ? ` Lv.${reward.level}` : ''}`;
  return reward.name;
}

function RewardCard({ entry, selected, sold, onToggle }: {
  entry: MultiRewardEntry; selected: boolean; sold: boolean; onToggle: () => void;
}) {
  const { reward } = entry;
  const meta = rewardMeta(reward);
  const sellable = !!entry.instanceId;
  const card = (
    <View style={[
      st.card,
      { borderColor: meta.color },
      selected && { backgroundColor: meta.color + '1A' },
      sold && st.cardSold,
    ]}>
      {sellable && (
        <View style={[st.checkbox, selected && { backgroundColor: meta.color, borderColor: meta.color }]}>
          {selected && <Check size={11} color="#0E1113" strokeWidth={3} />}
        </View>
      )}
      {reward.type === 'gear' ? (() => {
        const g = gearById(reward.itemId);
        return g
          ? <Image source={g.icon} style={st.img} resizeMode="contain" />
          : <Text style={st.fallbackEmoji}>🎁</Text>;
      })() : reward.type === 'combatItem' ? (
        <Image
          source={itemById(reward.itemId).icons[Math.min(reward.level, itemById(reward.itemId).icons.length) - 1]}
          style={st.img} resizeMode="contain"
        />
      ) : (
        <Text style={st.coinEmoji}>🪙</Text>
      )}
      <Text style={[st.cardLabel, { color: meta.color }]} numberOfLines={2}>{rewardLabel(reward)}</Text>
      {sellable && entry.betterThanEquipped && !sold && <Text style={st.betterTag}>lepsze!</Text>}
      {sold && <Text style={st.soldTag}>sprzedano</Text>}
    </View>
  );
  if (!sellable || sold) return card;
  return <Pressable onPress={onToggle} hitSlop={4}>{card}</Pressable>;
}

export default function MultiBoxRevealModal({ visible, boxName, rewards, onClose, onSellSelected }: {
  visible: boolean; boxName: string; rewards: MultiRewardEntry[]; onClose: () => void;
  onSellSelected: (instanceIds: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [sold, setSold] = useState<Set<number>>(new Set());
  const [confirmSell, setConfirmSell] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setSelected(new Set()); setSold(new Set()); setConfirmSell(false);
  }, [visible]);

  const totalCoins = rewards.reduce((sum, e) => sum + (e.reward.type === 'coins' ? e.reward.coins : 0), 0);
  const selectedEntries = [...selected].map(i => rewards[i]);
  const sellTotal = selectedEntries.reduce((sum, e) => sum + e.sellCoins, 0);
  const anyBetterSelected = selectedEntries.some(e => e.betterThanEquipped);

  const toggle = (i: number) => {
    if (sold.has(i)) return;
    haptic.tap();
    setSelected(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });
  };

  const doSell = () => {
    const ids = selectedEntries.map(e => e.instanceId).filter((id): id is string => !!id);
    if (ids.length === 0) return;
    onSellSelected(ids);
    toast.success(`Sprzedano ${ids.length} — +${sellTotal} 🪙`);
    setSold(s => new Set([...s, ...selected]));
    setSelected(new Set());
  };

  return (
    <>
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={st.overlay} onPress={onClose}>
        <Pressable style={st.sheet} onPress={() => {}}>
          <Text style={st.title}>Otworzono {rewards.length}× {boxName}</Text>
          <ScrollView contentContainerStyle={st.grid} style={st.gridScroll}>
            {rewards.map((entry, i) => (
              <RewardCard key={i} entry={entry} selected={selected.has(i)} sold={sold.has(i)} onToggle={() => toggle(i)} />
            ))}
          </ScrollView>
          {totalCoins > 0 && <Text style={st.totalTxt}>Razem monety: +{totalCoins} 🪙</Text>}

          {selected.size > 0 && (
            <Pressable
              style={st.sellBtn}
              onPress={() => { haptic.tap(); if (anyBetterSelected) setConfirmSell(true); else doSell(); }}
            >
              <Text style={st.sellBtnTxt}>Sprzedaj zaznaczone ({selected.size}) — +{sellTotal} 🪙</Text>
            </Pressable>
          )}

          <Pressable style={st.btn} onPress={() => { haptic.tap(); onClose(); }}>
            <Text style={st.btnTxt}>Super!</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
    <ConfirmDialog
      visible={confirmSell}
      title="Sprzedać mimo że lepsze?"
      message={`${anyBetterSelected ? 'Część zaznaczonych itemów ma' : 'Zaznaczony item ma'} wyższy stat niż to, co masz teraz założone — sprzedaż da +${sellTotal} 🪙, ale tracisz realne wzmocnienie. Na pewno?`}
      confirmLabel="Sprzedaj"
      cancelLabel="Zatrzymaj"
      destructive
      onConfirm={() => { doSell(); setConfirmSell(false); }}
      onCancel={() => setConfirmSell(false)}
    />
    </>
  );
}

const st = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { width: '100%', maxWidth: 380, maxHeight: '80%', backgroundColor: '#161A1A', borderRadius: 20, padding: 18, alignItems: 'center', gap: 12 },
  title: { color: '#fff', fontSize: 15, fontWeight: '900', textAlign: 'center' },
  gridScroll: { alignSelf: 'stretch' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, paddingBottom: 4 },
  card: { width: 86, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 14, borderWidth: 2, backgroundColor: '#0E1113', alignItems: 'center', gap: 6 },
  cardSold: { opacity: 0.4 },
  checkbox: { position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: 5, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  img: { width: 40, height: 40 },
  fallbackEmoji: { fontSize: 32 },
  coinEmoji: { fontSize: 32 },
  cardLabel: { fontSize: 11, fontWeight: '800', textAlign: 'center' },
  betterTag: { fontSize: 8.5, fontWeight: '900', color: '#FBBF24', letterSpacing: 0.3 },
  soldTag: { fontSize: 8.5, fontWeight: '800', color: 'rgba(255,255,255,0.6)', letterSpacing: 0.3 },
  totalTxt: { color: '#FBBF24', fontSize: 13, fontWeight: '800' },
  sellBtn: { alignSelf: 'stretch', paddingVertical: 11, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(239,68,68,0.5)', alignItems: 'center' },
  sellBtnTxt: { color: '#EF4444', fontSize: 12.5, fontWeight: '800' },
  btn: { paddingHorizontal: 26, paddingVertical: 13, borderRadius: 14, backgroundColor: '#4DA8FF' },
  btnTxt: { color: '#07160F', fontSize: 15, fontWeight: '900' },
});
