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
// PORZUCONE CAŁKOWICIE: "wystająca głowa" (2026-08-27, user ze screenshotem: "co ty z tym
// pupilem odjebałem teraz jak pulpet wygląda ja pierdółek") — od PR #84 przez #88/#89 do #98
// (patrz git history) czterokrotnie: crop pełnego CatArt (kruche na Androidzie, ostatecznie
// dalej za duże), potem dedykowany osobny `PetTileCat` z ręcznie rysowanym SVG — wynik wizualnie
// nie do przyjęcia (bez prawdziwego artu/referencji nie da się ręcznie dopieścić twarzy kota w
// surowych ścieżkach SVG na tym poziomie detalu). WRÓCONE do DOKŁADNIE oryginalnego,
// sprawdzonego renderu: zwykły, mały, PEŁNY `CatArt` (`size=70`, `animate=false`) — ten sam
// komponent i te same proporcje co w commitcie 584d86d, sprzed całej serii eksperymentów.
// `PetTileCat.tsx` USUNIĘTY CAŁKOWICIE — dead code po nieudanym eksperymencie, nie zostawiany
// "na później". Jeśli user kiedyś dostarczy realny art/referencję do tej pozy, to osobna,
// świeża robota — nie odgrzebywanie tego pliku.
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
      <CatArt expression={pet.expression} size={70} animate={false} palette={paletteById(catColor)} stripes={catStripes}
        eyeColor={catEyeColor} noseColor={catNoseColor} whiskers={catWhiskers} legStripes={catLegStripes} />
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
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 16, fontWeight: '800', flexShrink: 1 },
  lvl: { borderRadius: 20, paddingHorizontal: 7, paddingVertical: 1 },
  lvlTxt: { fontSize: 10, fontWeight: '900', color: '#A78BFA', letterSpacing: 0.3 },
  status: { fontSize: 13, fontWeight: '800', marginTop: 2 },
  claim: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: '#FBBF24', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, marginTop: 3 },
  claimTxt: { fontSize: 10.5, fontWeight: '900', color: '#0B0E1A' },
});
