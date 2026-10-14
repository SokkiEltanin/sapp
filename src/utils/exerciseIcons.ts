import { TrainingExercise } from './personalQuests';

// Grafiki ćwiczeń (2026-10-14, user wgrał do assets/cwiczeniaikony/ przez GitHub web upload
// na master — "dodałem wszystkie jakie miałem na ten moment jak jakiś nie ma to bez ikony na
// razie"). Pliki mają generyczne nazwy ze stockowego paczki ikon (nie "pompki.png" itd.) —
// dopasowane RĘCZNIE po obejrzeniu każdej grafiki, nie po nazwie pliku:
// - pushups-man.png            → pompki (prosta linia ciała, wsparcie na ramieniu — nazwa też się zgadza)
// - abdominal-exercise.png     → brzuszki (sylwetka w leżeniu, unoszenie tułowia — "abdominal" = brzuch)
// - man-exercising-on-the-floor.png → deska (klasyczna pozioma sylwetka na przedramionach)
// - man-exercising-legs.png    → przysiady (stojąca sylwetka, wykrok/przysiad)
// - man-exercising-hips.png    → rozciąganie (pochylenie w biodrach, pozycja rozciągająca)
// Bez grafiki na razie: rower (brak pasującej wśród wgranych — placeholder-ikona zostaje, patrz
// `ExerciseIcon.tsx`), oraz dwie nadmiarowe grafiki (`sitting-man.png`,
// `man-exercising-leg-on-the-flor.png`) bez jednoznacznego dopasowania do żadnego z 6 ćwiczeń —
// zostają w folderze nieużywane, do ew. wykorzystania później.
const EXERCISE_PNG: Partial<Record<TrainingExercise, number>> = {
  pushups: require('../../assets/cwiczeniaikony/pushups-man.png'),
  situps: require('../../assets/cwiczeniaikony/abdominal-exercise.png'),
  plank: require('../../assets/cwiczeniaikony/man-exercising-on-the-floor.png'),
  squats: require('../../assets/cwiczeniaikony/man-exercising-legs.png'),
  stretch: require('../../assets/cwiczeniaikony/man-exercising-hips.png'),
};

export function exercisePng(id: TrainingExercise): number | null {
  return EXERCISE_PNG[id] ?? null;
}
