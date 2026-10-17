import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { CalendarClock } from 'lucide-react-native';
import { Counter, isDuringEvent, daysUntil, daysUntilEnd, eventProgress, untilProgress, untilProgressStepped } from '@/store/countersStore';
import RingCountdown from '@/components/counters/RingCountdown';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius, fonts } from '@/theme';

export interface CountdownTileStyle {
  cornerRadius: number;
  ringSize: number;
  ringStrokeWidth: number;
}

export const DEFAULT_COUNTDOWN_TILE_STYLE: CountdownTileStyle = {
  cornerRadius: 16,
  ringSize: 56,
  ringStrokeWidth: 6,
};

// Wyekstrahowane z `CountdownsCard.tsx`'s per-wiersz renderu (system kopiowania komponentów,
// drugi typ komponentu po `StreakTile`, 2026-10-17) — dowód że `componentType` w
// `canvasComponentsStore.ts` faktycznie generalizuje się na więcej niż jeden kształt treści
// (tu: pierścień+tekst w rzędzie, nie kwadratowy kafel). `accentColor` (domyślny kolor
// pierścienia gdy licznik nie ma własnego `barColor`) jako prop, nie zaszyty — na dashboardzie
// to `useTimeAccent()`, na płótnie stały neutralny kolor (nie ma tam "akcentu czasu dnia").
//
// `item: null` (zamiast fabrykowania sztucznego `Counter` z wymyślonymi datami dla stanu
// "niepodpięty") — czystszy wariant tego samego problemu co `StreakTile`'s placeholder
// `{name:'Wybierz metrykę', days:0}`: tu placeholder MUSIAŁBY zgadywać `startDate`/`createdAt`
// (pola wymagane przez `Counter`), więc osobna, jawna gałąź "brak" jest prostsza i poprawniejsza
// niż fałszywe dane przepuszczone przez prawdziwą logikę `daysUntil`/`untilProgress`.
//
// `boxed` (domyślnie false) — `CountdownsCard.tsx` renderuje wiersze BEZ własnego tła/paddingu
// (gołe rzędy w jednej wspólnej karcie, `s.cdRow` tam ma tylko `flexDirection+gap`), a wolne
// płótno potrzebuje WIDOCZNEGO pudełka (samotna, swobodnie postawiona instancja bez
// otaczającej karty). Jeden komponent, dwa konteksty — zamiast force'owania tła na dashboard
// (zmieniłoby jego dzisiejszy wygląd) albo duplikowania komponentu po raz drugi.
export function CountdownTile({ item, tileStyle, accentColor, onPress, sizeStyle, boxed = false }: {
  item: Counter | null;
  tileStyle: CountdownTileStyle;
  accentColor: string;
  onPress: () => void;
  sizeStyle?: StyleProp<ViewStyle>;
  boxed?: boolean;
}) {
  const c = useColors();
  const s = makeS(c);

  if (!item) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={sizeStyle}>
        <View style={[s.tile, boxed && s.tileBoxed, s.tileEmpty, { borderRadius: tileStyle.cornerRadius }]}>
          <CalendarClock size={tileStyle.ringSize * 0.5} color={c.text.muted} />
          <Text style={s.emptyLabel} numberOfLines={1}>Wybierz odliczanie</Text>
        </View>
      </TouchableOpacity>
    );
  }

  const during = isDuringEvent(item);
  const left = daysUntil(item);
  const endLeft = daysUntilEnd(item);
  const label = during
    ? (endLeft <= 0 ? 'ostatni dzień!' : endLeft === 1 ? 'koniec jutro' : `koniec za ${endLeft} dni`)
    : (left === 0 ? 'dziś!' : left === 1 ? 'jutro!' : `za ${left} dni`);
  const ringColor = during ? '#2AC68F' : (item.barColor || accentColor);
  const progress = during ? eventProgress(item) : (item.fillStyle === 'stepped' ? untilProgressStepped(item) : untilProgress(item));
  const ringDays = Math.max(0, during ? endLeft : left);
  const dateShort = item.date.slice(5).split('-').reverse().join('.');

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={sizeStyle}>
      <View style={[s.tile, boxed && s.tileBoxed, { borderRadius: tileStyle.cornerRadius }]}>
        <RingCountdown progress={progress} color={ringColor} days={ringDays} size={tileStyle.ringSize} strokeWidth={tileStyle.ringStrokeWidth} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.name} numberOfLines={1}>{item.name}</Text>
          <Text style={[s.status, { color: ringColor }]} numberOfLines={1}>{label}</Text>
          <Text style={s.meta} numberOfLines={1}>cel {dateShort}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  tile: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  tileBoxed: { backgroundColor: c.bg.elevated, padding: spacing[3] },
  tileEmpty: {
    justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.border.subtle,
    backgroundColor: 'transparent',
  },
  emptyLabel: { fontSize: 11.5, fontWeight: '700', color: c.text.muted, flexShrink: 1 },
  name: { fontSize: 14, fontWeight: '700', color: c.text.primary },
  status: { fontSize: 13, fontWeight: '800', marginTop: 2 },
  meta: { fontSize: 11, color: c.text.muted, fontWeight: '600', marginTop: 1 },
}));
