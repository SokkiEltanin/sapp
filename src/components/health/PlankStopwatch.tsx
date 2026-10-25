import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Play, Square } from 'lucide-react-native';
import PressableScale from '@/components/ui/PressableScale';
import { spacing, radius } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';

// Stoper deski (2026-10-25, §417) — user, w ramach dużej listy "do ogarnięcia": "jak pokazuje
// się deska to timer jest tylko nie 40s tylko od 0s do kliknięcia STOP jakby przez co widać
// czy wyrobiłem cel np 40s czy zrobiłem dłużej np 110s". Dotąd deska logowała się TAK SAMO jak
// pompki/przysiady — ręczny numeryczny input, user sam szacował/liczył sekundy w głowie. Teraz:
// START zapamiętuje `Date.now()`, STOP liczy różnicę i OD RAZU loguje wynik (`onDone`) —
// czasomierz oparty o zegar ścienny (`Date.now()`), nie licznik inkrementowany co tick, więc
// zostaje dokładny nawet jeśli JS na chwilę przyśnie (throttling w tle/stary telefon).
// Świadomie BEZ pauzy — deska to jeden ciągły wysiłek, pauza nie miałaby sensu w tym ćwiczeniu.
export default function PlankStopwatch({ onDone }: { onDone: (seconds: number) => void }) {
  const c = useColors();
  const s = makeS(c);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      if (startedAt.current != null) setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 200);
    return () => clearInterval(id);
  }, [running]);

  const start = () => {
    haptic.tap();
    startedAt.current = Date.now();
    setElapsed(0);
    setRunning(true);
  };
  const stop = () => {
    haptic.success();
    setRunning(false);
    onDone(Math.max(1, elapsed));
  };

  return (
    <View style={s.wrap}>
      <Text style={[s.time, running && s.timeRunning]}>{elapsed}s</Text>
      {running ? (
        <PressableScale onPress={stop} style={s.stopBtn}>
          <Square size={16} color="#fff" fill="#fff" />
          <Text style={s.btnTxt}>STOP</Text>
        </PressableScale>
      ) : (
        <PressableScale onPress={start} style={s.startBtn}>
          <Play size={16} color="#07160F" fill="#07160F" />
          <Text style={[s.btnTxt, s.startBtnTxt]}>START</Text>
        </PressableScale>
      )}
    </View>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[1] },
  time: { flex: 1, fontSize: 28, fontWeight: '900', color: c.text.primary, fontVariant: ['tabular-nums'] },
  timeRunning: { color: '#FB923C' },
  startBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2AC68F', borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 18 },
  stopBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EF4444', borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 18 },
  btnTxt: { fontSize: 13, fontWeight: '900', color: '#fff' },
  startBtnTxt: { color: '#07160F' },
}));
