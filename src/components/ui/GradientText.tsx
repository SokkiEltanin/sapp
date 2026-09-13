import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Text as SvgText } from 'react-native-svg';

// Napis z poziomym gradientem kolor→biel — RN <Text> nie ma natywnego gradientowego
// wypełnienia (brak background-clip:text / MaskedView jako zależności projektu), więc to
// prawdziwe SVG (już projektowa zależność przez CatArt/GroundShadow/GradientGreeting),
// `fill="url(#...)"` na <SvgText>, ten sam wzorzec co `GradientGreeting.tsx` (dashboard),
// tylko bez zależności od `useHeroFont` — stały rozmiar/waga, do użycia gdziekolwiek trzeba
// "premium" gradientowego tytułu (np. nazwa itemu w sklepie wg rzadkości).
//
// Fit-scale dla długich nazw (2026-09-13) — najdłuższe nazwy w `gear.ts` mają do 28 znaków
// ("Talizman Spadającej Gwiazdy"); SVG text NIE zawija ani nie skraca się jak RN <Text
// numberOfLines>, więc bez tego długie nazwy mogłyby wystawać poza dostępną szerokość.
// Ten sam mechanizm co `GradientGreeting` (skaluj w dół powyżej progu znaków).
export default function GradientText({ text, color, fontSize = 16, fontWeight = '800', maxChars = 22 }: {
  text: string; color: string; fontSize?: number; fontWeight?: string; maxChars?: number;
}) {
  const fit = text.length > maxChars ? maxChars / text.length : 1;
  const size = fontSize * fit;
  // Marginesy nad/pod baseline dobrane hojnie (2026-09-13, po realnym buku na urządzeniu:
  // poprzednia próba samym `lineHeight` na zwykłym <Text> obok osobnego elementu NIE
  // wystarczyła, patrz ARCHITECTURE.md §73e/§87) — ~0.8×size nad baseline (wersaliki+akcenty
  // polskie jak Ł/Ż), ~0.3×size pod (ogonki g/y/ą/ę), z zapasem.
  const height = Math.ceil(size * 1.5);
  const baseline = Math.ceil(size * 1.05);
  return (
    <Svg height={height} width="100%">
      <Defs>
        <SvgLinearGradient id="gradText" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={color} stopOpacity="1" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.92" />
        </SvgLinearGradient>
      </Defs>
      <SvgText
        x="0"
        y={baseline}
        fontSize={size}
        fontWeight={fontWeight as any}
        fill="url(#gradText)"
      >
        {text}
      </SvgText>
    </Svg>
  );
}
