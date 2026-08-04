import { View, Text, StyleSheet } from 'react-native';
import { ChevronRight, Gift } from 'lucide-react-native';
import CatArt from '@/components/pet/CatArt';
import { PetState, petStatusLine } from '@/utils/petState';
import { usePetStore } from '@/store/petStore';
import { paletteById } from '@/utils/catPalettes';
import { useColors } from '@/theme/useColors';

// Dashboard companion tile: a mini cat + its name + a kind status line.
// Taps through to the full pet page.
export default function PetTile({ name, pet, level, claimable = 0 }: { name: string; pet: PetState; level: number; claimable?: number }) {
  const c = useColors();
  // wear the coat you actually bought — the tile used to always show the default blue
  const catColor = usePetStore(s => s.catColor);
  const catStripes = usePetStore(s => s.catStripes);
  const catEyeColor = usePetStore(s => s.catEyeColor);
  const catNoseColor = usePetStore(s => s.catNoseColor);
  const catWhiskers = usePetStore(s => s.catWhiskers);
  const catLegStripes = usePetStore(s => s.catLegStripes);
  return (
    <View style={[st.card, { backgroundColor: c.bg.card, borderColor: c.border.default }]}>
      <CatArt expression={pet.expression} size={70} animate={false} palette={paletteById(catColor)} stripes={catStripes}
        eyeColor={catEyeColor} noseColor={catNoseColor} whiskers={catWhiskers} legStripes={catLegStripes} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={st.top}>
          <Text style={[st.name, { color: c.text.primary }]} numberOfLines={1}>{name}</Text>
          <View style={[st.lvl, { backgroundColor: '#A78BFA22' }]}><Text style={st.lvlTxt}>lvl {level}</Text></View>
        </View>
        <Text style={[st.status, { color: pet.color }]}>{pet.label}</Text>
        {claimable > 0
          ? <View style={st.claim}><Gift size={11} color="#0B0E1A" /><Text style={st.claimTxt}>{claimable} nagród do odbioru</Text></View>
          : <Text style={[st.tip, { color: c.text.muted }]} numberOfLines={1}>{petStatusLine(pet)}</Text>}
      </View>
      <ChevronRight size={18} color={c.text.muted} />
    </View>
  );
}

const st = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, borderWidth: 1, padding: 12, paddingRight: 10 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 16, fontWeight: '800', flexShrink: 1 },
  lvl: { borderRadius: 20, paddingHorizontal: 7, paddingVertical: 1 },
  lvlTxt: { fontSize: 10, fontWeight: '900', color: '#A78BFA', letterSpacing: 0.3 },
  status: { fontSize: 13, fontWeight: '800', marginTop: 2 },
  tip: { fontSize: 11.5, fontWeight: '500', marginTop: 1 },
  claim: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: '#FBBF24', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, marginTop: 3 },
  claimTxt: { fontSize: 10.5, fontWeight: '900', color: '#0B0E1A' },
});
