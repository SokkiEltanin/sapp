import { Modal, View, Text, StyleSheet, Pressable, Image, ScrollView } from 'react-native';
import { CRATE_META } from '@/utils/crates';
import { BoxReward } from '@/utils/petBoxes';
import { RARITY_META, gearById } from '@/utils/gear';
import { itemById } from '@/utils/combatItems';
import { haptic } from '@/utils/haptics';

// Paczkowe otwieranie (2026-10-11, user: "dodaj mi te skrzynki szybsze otwieranie np
// natychmiastowo otworzyć 5 i pokazują się tylko karty z otwarcia" — kontynuacja wcześniejszej
// prośby o szybsze otwieranie po dodaniu przycisku "Pomiń" w BoxRevealModal.tsx). Zamiast N razy
// odtwarzać ~3.4s spin reela (BoxRevealModal), długie przytrzymanie skrzynki w Rynku otwiera od
// razu N sztuk BEZ animacji — wszystkie nagrody są już wylosowane i przyznane (patrz
// `onBuyBoxMulti` w pet-shop.tsx) ZANIM ten modal się pokaże, więc to czysto podsumowujący
// widok, nie kolejny krok loterii.

function rewardMeta(reward: BoxReward) {
  return reward.type === 'gear' ? RARITY_META[reward.rarity] : CRATE_META[reward.rarity];
}

function rewardLabel(reward: BoxReward): string {
  if (reward.type === 'coins') return `+${reward.coins}`;
  if (reward.type === 'combatItem') return `${reward.name}${reward.isUpgrade ? ` Lv.${reward.level}` : ''}`;
  return reward.name;
}

function RewardCard({ reward }: { reward: BoxReward }) {
  const meta = rewardMeta(reward);
  return (
    <View style={[st.card, { borderColor: meta.color }]}>
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
    </View>
  );
}

export default function MultiBoxRevealModal({ visible, boxName, rewards, onClose }: {
  visible: boolean; boxName: string; rewards: BoxReward[]; onClose: () => void;
}) {
  const totalCoins = rewards.reduce((sum, r) => sum + (r.type === 'coins' ? r.coins : 0), 0);
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={st.overlay} onPress={onClose}>
        <Pressable style={st.sheet} onPress={() => {}}>
          <Text style={st.title}>Otworzono {rewards.length}× {boxName}</Text>
          <ScrollView contentContainerStyle={st.grid} style={st.gridScroll}>
            {rewards.map((r, i) => <RewardCard key={i} reward={r} />)}
          </ScrollView>
          {totalCoins > 0 && <Text style={st.totalTxt}>Razem monety: +{totalCoins} 🪙</Text>}
          <Pressable style={st.btn} onPress={() => { haptic.tap(); onClose(); }}>
            <Text style={st.btnTxt}>Super!</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const st = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { width: '100%', maxWidth: 380, maxHeight: '80%', backgroundColor: '#161A1A', borderRadius: 20, padding: 18, alignItems: 'center', gap: 12 },
  title: { color: '#fff', fontSize: 15, fontWeight: '900', textAlign: 'center' },
  gridScroll: { alignSelf: 'stretch' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, paddingBottom: 4 },
  card: { width: 86, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 14, borderWidth: 2, backgroundColor: '#0E1113', alignItems: 'center', gap: 6 },
  img: { width: 40, height: 40 },
  fallbackEmoji: { fontSize: 32 },
  coinEmoji: { fontSize: 32 },
  cardLabel: { fontSize: 11, fontWeight: '800', textAlign: 'center' },
  totalTxt: { color: '#FBBF24', fontSize: 13, fontWeight: '800' },
  btn: { paddingHorizontal: 26, paddingVertical: 13, borderRadius: 14, backgroundColor: '#4DA8FF' },
  btnTxt: { color: '#07160F', fontSize: 15, fontWeight: '900' },
});
