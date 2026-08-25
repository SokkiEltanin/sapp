import { View, Text, StyleSheet } from 'react-native';
import { ChevronRight, Gift } from 'lucide-react-native';
import CatArt from '@/components/pet/CatArt';
import { PetState } from '@/utils/petState';
import { usePetStore } from '@/store/petStore';
import { paletteById } from '@/utils/catPalettes';
import { useColors } from '@/theme/useColors';

// Dashboard companion tile: a mini cat + its name + level.
// Taps through to the full pet page.
// `bare` (2026-08-24, user: "zróbmy te ilość seri jako łączny kafelek z pupilem po prostu po
// prawej stronie") — gdy kafel pupila dzieli jedną ramkę kafla z kolumną serii (index.tsx
// `nodes['pet']`), własna karta/obwódka/chevron by dublowały ramkę hosta — `bare` zwraca sam
// wiersz treści (kot + tekst), bez opakowania. Domyślne `bare=false` = stary, samodzielny
// wygląd, używany gdy nie ma żadnej aktywnej serii do pokazania obok.
//
// Głowa kotka, powiększona + przycięta (2026-08-25, user: "zeby ten pupil jakby był w kafelku
// większy praktycznie sama głowa i tak dorobić mu łapki zeby lekko wyglądały jakby sie opierał
// o krawędź kafelka"). CatArt renderuje CAŁEGO kota w stałym `viewBox 0 0 2000 2000` (patrz
// CatArt.tsx) — nie da się wyciągnąć "samej głowy" bez rozbierania SVG na części, więc zamiast
// tego: render W WIĘKSZYM rozmiarze niż widoczny kontener (który ma `overflow:hidden`),
// przesunięty tak żeby okno łapało dokładnie od czubka uszu do dołu łapek. Liczby wyliczone
// z geometrii CatArt (nie zgadywane): uszy — apex trójkąta ucha po transformacie macierzy
// ląduje na y≈436 (`Ear`, wariant R, spoczynek/rotate=0) → górna krawędź okna na y=430 z
// małym marginesem; łapki — `Paw` rysuje elipsę cy=1541 ry=48 → dół na y=1589 (dokładnie na
// dole okna, więc łapki "leżą" na krawędzi kafelka). Szerokość okna z bounding boxu
// głowa+uszy (x≈560–1340, symetrycznie wokół środka głowy x≈953). Jeśli po teście na
// urządzeniu trzeba doregulować kadr — to tylko te cztery stałe.
const CROP_SIZE = 135;          // pełny render CatArt (viewBox 2000 → 135px, czyli unit≈0.0675)
const CROP_W = 54, CROP_H = 78; // widoczne okno (kontener z overflow:hidden)
const CROP_TOP = -29;           // viewBox y=430 (czubek uszu) → góra okna
const CROP_LEFT = -38;          // viewBox x=560 (lewe ucho) → lewa okna
export default function PetTile({ name, pet, level, claimable = 0, bare = false }: { name: string; pet: PetState; level: number; claimable?: number; bare?: boolean }) {
  const c = useColors();
  // wear the coat you actually bought — the tile used to always show the default blue
  const catColor = usePetStore(s => s.catColor);
  const catStripes = usePetStore(s => s.catStripes);
  const catEyeColor = usePetStore(s => s.catEyeColor);
  const catNoseColor = usePetStore(s => s.catNoseColor);
  const catWhiskers = usePetStore(s => s.catWhiskers);
  const catLegStripes = usePetStore(s => s.catLegStripes);
  const row = (
    <>
      <View style={st.headCrop}>
        <View style={st.headCropInner}>
          <CatArt expression={pet.expression} size={CROP_SIZE} animate={false} palette={paletteById(catColor)} stripes={catStripes}
            eyeColor={catEyeColor} noseColor={catNoseColor} whiskers={catWhiskers} legStripes={catLegStripes} />
        </View>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={st.top}>
          <Text style={[st.name, { color: c.text.primary }]} numberOfLines={1}>{name}</Text>
          <View style={[st.lvl, { backgroundColor: '#A78BFA22' }]}><Text style={st.lvlTxt}>lvl {level}</Text></View>
        </View>
        <Text style={[st.status, { color: pet.color }]}>{pet.label}</Text>
        {claimable > 0 && (
          <View style={st.claim}><Gift size={11} color="#0B0E1A" /><Text style={st.claimTxt}>{claimable} nagród do odbioru</Text></View>
        )}
      </View>
    </>
  );
  if (bare) return <View style={st.bareRow}>{row}</View>;
  return (
    <View style={[st.card, { backgroundColor: c.bg.card, borderColor: c.border.default }]}>
      {row}
      <ChevronRight size={18} color={c.text.muted} />
    </View>
  );
}

const st = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, borderWidth: 1, padding: 12, paddingRight: 10 },
  bareRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  headCrop: { width: CROP_W, height: CROP_H, overflow: 'hidden' },
  headCropInner: { position: 'absolute', top: CROP_TOP, left: CROP_LEFT, width: CROP_SIZE, height: CROP_SIZE },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 16, fontWeight: '800', flexShrink: 1 },
  lvl: { borderRadius: 20, paddingHorizontal: 7, paddingVertical: 1 },
  lvlTxt: { fontSize: 10, fontWeight: '900', color: '#A78BFA', letterSpacing: 0.3 },
  status: { fontSize: 13, fontWeight: '800', marginTop: 2 },
  claim: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: '#FBBF24', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, marginTop: 3 },
  claimTxt: { fontSize: 10.5, fontWeight: '900', color: '#0B0E1A' },
});
