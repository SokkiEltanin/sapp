import { Image } from 'react-native';
import { TrainingExercise } from '@/utils/personalQuests';
import { exercisePng } from '@/utils/exerciseIcons';

// Ikona/grafika ćwiczenia — prawdziwa grafika (user, 2026-10-14) gdy dostępna, inaczej
// przekazany lucide-icon fallback (na razie: rower — user: "jak jakiś nie ma to bez ikony na
// razie"). Współdzielony między `app/exercises.tsx` (nowy ekran Zdrowia) i `app/pet-quests.tsx`
// (stary self-report, wciąż żyje równolegle do czasu testu na urządzeniu, patrz NEXT_STEPS.md)
// — oba miejsca mają teraz IDENTYCZNE grafiki, nie dwa rozjechane zestawy ikon.
export default function ExerciseIcon({ id, fallback: Fallback, size = 18, color = '#FB923C' }: {
  id: TrainingExercise; fallback: React.ComponentType<{ size?: number; color?: string }>;
  size?: number; color?: string;
}) {
  const png = exercisePng(id);
  if (png) return <Image source={png} style={{ width: size, height: size, tintColor: color }} resizeMode="contain" />;
  return <Fallback size={size} color={color} />;
}
