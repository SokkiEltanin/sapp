import { Text, TextProps } from 'react-native';
import { useFontsStore } from '@/store/fontsStore';
import { fonts } from '@/theme';

// Wrapper dla WSZYSTKICH miejsc które renderują `fontFamily: fonts.display` (Archivo
// Black) — ten font ładuje się NIEBLOKUJĄCO w tle (`useFonts()` w `app/_layout.tsx`, patrz
// komentarz w `fontsStore.ts`). Tekst z tym fontem wpisanym na sztywno w statyczny styl,
// renderowany ZANIM font się załaduje, dostaje na Androidzie tofu-glify (wyglądające jak
// kropki) zamiast cyfr — i ten stan potrafi ZOSTAĆ na stałe, jeśli nic nie wymusi kolejnego
// renderu (zgłoszone dla RingCountdown, ARCHITECTURE.md §222). Zamiast kopiować ten sam
// `fontsLoaded && {fontFamily: fonts.display}` w 13 plikach, jeden komponent: przed
// załadowaniem fonta spada na systemowy (nigdy tofu), po załadowaniu przeskakuje na
// docelowy — bez zmiany zachowania wywołującego (przyjmuje te same propsy co `Text`).
export default function DisplayText({ style, ...props }: TextProps) {
  const fontsLoaded = useFontsStore(s => s.loaded);
  return <Text {...props} style={[style, fontsLoaded && { fontFamily: fonts.display }]} />;
}
