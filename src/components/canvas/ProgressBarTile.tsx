import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { Counter, isDuringEvent, eventProgress, untilProgress, untilProgressStepped } from '@/store/countersStore';
import { ProgressBarStyle } from '@/store/progressBarStyleDefaults';

// Renderer paska progresu (Faza §393) — sygnatura `(…, onPress, sizeStyle)` jak reszta typów.
// `counter=null` (niepodpięty) rysuje placeholder — ten sam duch co `boundStreak`/
// `boundCountdown` itd. w `ScreenCanvas.tsx`.
//
// Wypełnienie jako PLAIN RN View (nie SVG) wewnątrz `overflow:'hidden'` toru — `borderRadius`
// RN jest już poprawny geometrycznie niezależnie od proporcji (bez pułapki §387, która
// dotyczyła TYLKO SVG `rx`/`ry` w znormalizowanym viewBoxie) — tor obcina wypełnienie do swojego
// zaokrąglonego kształtu, wypełnienie sam nie potrzebuje własnego zaokrąglenia.
export function ProgressBarTile({ counter, style, onPress, sizeStyle }: {
  counter: Counter | null;
  style: ProgressBarStyle;
  onPress: () => void;
  sizeStyle?: StyleProp<ViewStyle>;
}) {
  if (!counter) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[sizeStyle, s.placeholder]}>
        <Text style={s.placeholderTxt}>Wybierz licznik</Text>
      </TouchableOpacity>
    );
  }
  const during = isDuringEvent(counter);
  const progress = during
    ? eventProgress(counter)
    : (counter.fillStyle === 'stepped' ? untilProgressStepped(counter) : untilProgress(counter));
  const pct = Math.min(1, Math.max(0, progress));
  const horizontal = style.orientation !== 'vertical';

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={sizeStyle}>
      <View style={[s.track, { backgroundColor: style.trackColor, borderRadius: style.cornerRadius }]}>
        <View
          style={horizontal
            ? { width: `${pct * 100}%`, height: '100%', backgroundColor: style.fillColor }
            : { position: 'absolute', left: 0, right: 0, bottom: 0, height: `${pct * 100}%`, backgroundColor: style.fillColor }}
        />
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  track: { flex: 1, overflow: 'hidden' },
  placeholder: {
    flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10,
    borderWidth: 1, borderStyle: 'dashed', borderColor: '#94A3B8', backgroundColor: '#1E293B',
  },
  placeholderTxt: { color: '#94A3B8', fontSize: 11, fontWeight: '700' },
});
