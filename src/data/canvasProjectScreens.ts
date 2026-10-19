import * as LucideIcons from 'lucide-react-native';
import { LucideIcon } from '@/types/settings';

// Lista WSZYSTKICH ekranów hostujących płótno (Faza §390, WYDZIELONE z `app/settings.tsx` w
// Fazie §398, ten sam powód co `pupilNavTabs.ts` — teraz DWA miejsca potrzebują tej samej
// listy: `EditorProjectsList` w Ustawieniach I nowy `app/canvas-draft-editor.tsx`, patrz
// ARCHITECTURE.md §398). `screenKey` z `ScreenCanvas`/`ScreenCanvasBase` w `app/**`, 13
// "prawdziwych" ekranów + Navbar Pupila (bez własnego hosta, patrz komentarz przy wpisie
// `navbar` niżej).
export interface CanvasProjectScreen {
  key: string;
  label: string;
  route: string;
  icon: LucideIcon;
}

export const PROJECT_SCREENS: CanvasProjectScreen[] = [
  { key: 'dashboard', label: 'Dashboard', route: '/(tabs)', icon: LucideIcons.LayoutDashboard },
  { key: 'health', label: 'Zdrowie', route: '/health', icon: LucideIcons.HeartPulse },
  { key: 'food', label: 'Jedzenie', route: '/food', icon: LucideIcons.Apple },
  { key: 'tasks', label: 'Zadania', route: '/tasks', icon: LucideIcons.ListTodo },
  { key: 'finances', label: 'Finanse', route: '/finances', icon: LucideIcons.Wallet },
  // `stats`/`calendar` — dwa RÓŻNE ekrany, oba z UI tytułem "Kalendarz" (nazwa pliku/screenKey
  // "stats" to HISTORYCZNA niespójność, nie błąd — patrz `app/(tabs)/stats.tsx`'s nagłówek).
  // Rozróżnione w etykiecie, żeby user nie trafił przez przypadek na złe z dwóch.
  { key: 'stats', label: 'Kalendarz (zakładka)', route: '/stats', icon: LucideIcons.CalendarDays },
  { key: 'calendar', label: 'Kalendarz (pełny widok)', route: '/calendar', icon: LucideIcons.Calendar },
  { key: 'mood', label: 'Nastrój', route: '/mood', icon: LucideIcons.Smile },
  { key: 'habits', label: 'Nawyki', route: '/habits', icon: LucideIcons.Flame },
  { key: 'notes', label: 'Notatki', route: '/notes', icon: LucideIcons.FileText },
  { key: 'pet', label: 'Pupil', route: '/pet', icon: LucideIcons.PawPrint },
  { key: 'counters', label: 'Liczniki', route: '/counters', icon: LucideIcons.Hourglass },
  { key: 'exercises', label: 'Ćwiczenia', route: '/exercises', icon: LucideIcons.Dumbbell },
  // Navbar Pupila (§392) — JEDYNY wpis bez własnego, "normalnego" ekranu-hosta: `/navbar-editor`
  // to dedykowany ekran zbudowany SPECJALNIE dla tego celu. Celowo NIE dostaje
  // draft/symulator/wdrożenie (§398) — ma WŁASNY, już bezpieczny system walidacji
  // (`customNavbarEnabled` + sprawdzenie 4 podpiętych tabów w `navbar-editor.tsx`), patrz
  // komentarz w `EditorProjectsList`.
  { key: 'navbar', label: 'Navbar Pupila', route: '/navbar-editor', icon: LucideIcons.Compass },
];
