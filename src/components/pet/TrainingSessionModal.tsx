import { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, TouchableOpacity } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { haptic } from '@/utils/haptics';
import type { TrainingExercise } from '@/utils/personalQuests';

// Self-report training questy (b_pushups/b_squats/b_situps/b_plank/b_stretch, quests.ts) nie
// mają czujnika liczącego powtórzenia/czas — dawniej jedno bezmyślne tapnięcie "Zrobione".
// User (2026-08-15): chce realny przebieg ćwiczenia. Rozpocznij → (deska/rozciąganie: realnie
// ODLICZANY timer na ekranie; pompki/przysiady/brzuszki: ekran z docelową liczbą powtórzeń) →
// potwierdzenie. Wciąż samo-raportowanie (bez czujnika), tylko z rytmem sesji zamiast jednego
// tapnięcia — onComplete woła to samo mark*Done co wcześniej.
export type SelfReportExercise = Exclude<TrainingExercise, 'bike'>;

const TIMED: SelfReportExercise[] = ['plank', 'stretch'];

const META: Record<SelfReportExercise, { label: string; emoji: string; unit: 'reps' | 'seconds' | 'minutes' }> = {
  pushups: { label: 'Pompki', emoji: '💪', unit: 'reps' },
  squats:  { label: 'Przysiady', emoji: '🦵', unit: 'reps' },
  situps:  { label: 'Brzuszki', emoji: '🔥', unit: 'reps' },
  plank:   { label: 'Deska', emoji: '🧘', unit: 'seconds' },
  stretch: { label: 'Rozciąganie', emoji: '🤸', unit: 'minutes' },
};

function fmt(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}`;
}

interface Props {
  visible: boolean;
  exercise: SelfReportExercise;
  target: number; // powtórzenia (reps), sekundy (plank) albo minuty (stretch)
  onClose: () => void;
  onComplete: () => void;
}

export default function TrainingSessionModal({ visible, exercise, target, onClose, onComplete }: Props) {
  const meta = META[exercise];
  const timed = TIMED.includes(exercise);
  const totalSeconds = meta.unit === 'minutes' ? target * 60 : target;

  const [phase, setPhase] = useState<'ready' | 'active' | 'done'>('ready');
  const [remaining, setRemaining] = useState(totalSeconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!visible) return;
    setPhase('ready');
    setRemaining(totalSeconds);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, exercise, target]);

  const start = () => {
    haptic.tap();
    setPhase('active');
    if (timed) {
      setRemaining(totalSeconds);
      intervalRef.current = setInterval(() => {
        setRemaining(r => {
          if (r <= 1) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            haptic.success();
            setPhase('done');
            return 0;
          }
          return r - 1;
        });
      }, 1000);
    }
  };

  const finish = () => { haptic.success(); setPhase('done'); };

  const close = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    onClose();
  };

  const claim = () => { onComplete(); close(); };

  const progress = timed && totalSeconds > 0 ? 1 - remaining / totalSeconds : 0;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      <Pressable style={st.overlay} onPress={phase === 'active' ? undefined : close}>
        <Pressable style={st.card} onPress={() => {}}>
          {phase !== 'active' && (
            <TouchableOpacity style={st.closeBtn} onPress={close} hitSlop={12}>
              <X size={18} color="#8A93A8" />
            </TouchableOpacity>
          )}
          <Text style={st.emoji}>{meta.emoji}</Text>

          {phase === 'ready' && (
            <>
              <Text style={st.title}>{meta.label}</Text>
              <Text style={st.sub}>
                {meta.unit === 'reps' ? `Cel: ${target} powtórzeń` : meta.unit === 'seconds' ? `Cel: ${target}s` : `Cel: ${target} min`}
              </Text>
              <TouchableOpacity style={st.startBtn} onPress={start} activeOpacity={0.85}>
                <Text style={st.startTxt}>Rozpocznij</Text>
              </TouchableOpacity>
            </>
          )}

          {phase === 'active' && timed && (
            <>
              <Text style={st.timer}>{fmt(remaining)}</Text>
              <View style={st.track}><View style={[st.fill, { width: `${Math.round(progress * 100)}%` }]} /></View>
              <Text style={st.hint}>Trzymaj do końca odliczania…</Text>
            </>
          )}

          {phase === 'active' && !timed && (
            <>
              <Text style={st.repsTarget}>{target}</Text>
              <Text style={st.sub}>{meta.label.toLowerCase()} do zrobienia</Text>
              <TouchableOpacity style={st.doneBtn} onPress={finish} activeOpacity={0.85}>
                <Check size={16} color="#07160F" />
                <Text style={st.doneTxt}>UKOŃCZYŁEM</Text>
              </TouchableOpacity>
            </>
          )}

          {phase === 'done' && (
            <>
              <Text style={st.title}>Świetna robota!</Text>
              <Text style={st.sub}>{meta.label} — zaliczone</Text>
              <TouchableOpacity style={st.doneBtn} onPress={claim} activeOpacity={0.85}>
                <Check size={16} color="#07160F" />
                <Text style={st.doneTxt}>Super!</Text>
              </TouchableOpacity>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const st = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  card: { width: '100%', maxWidth: 340, backgroundColor: '#161A1A', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 26, alignItems: 'center', gap: 6 },
  closeBtn: { position: 'absolute', top: 14, right: 14, padding: 4 },
  emoji: { fontSize: 40, marginBottom: 4 },
  title: { fontSize: 19, fontWeight: '900', color: '#fff' },
  sub: { fontSize: 13, fontWeight: '600', color: '#9AA6B2', marginBottom: 10, textAlign: 'center' },
  startBtn: { marginTop: 6, paddingHorizontal: 34, paddingVertical: 14, borderRadius: 14, backgroundColor: '#2AC68F' },
  startTxt: { color: '#07160F', fontSize: 15, fontWeight: '900' },
  timer: { fontSize: 56, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  track: { width: '100%', height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden', marginTop: 14, marginBottom: 10 },
  fill: { height: '100%', borderRadius: 4, backgroundColor: '#2AC68F' },
  hint: { fontSize: 12, color: '#8A93A8', fontWeight: '600' },
  repsTarget: { fontSize: 56, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  doneBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingHorizontal: 30, paddingVertical: 14, borderRadius: 14, backgroundColor: '#2AC68F' },
  doneTxt: { color: '#07160F', fontSize: 14, fontWeight: '900' },
});
