import { Cat, Swords, ShoppingBag, ClipboardList, LucideIcon } from 'lucide-react-native';

// Źródło prawdy dla 4 tabów Navbaru Pupila (Faza §392, 2026-10-19) — WYDZIELONE z
// `PupilNavbar.tsx` (gdzie żyło jako prywatny `TABS`), żeby system płótna
// (`ScreenCanvas.tsx`'s nowy typ `'navTab'`) mógł podpinać się do TYCH SAMYCH, stałych 4
// wpisów — zamknięta lista, nie dowolna trasa, więc nie da się skonfigurować przycisku
// prowadzącego do nieistniejącej strony. `PupilNavbar.tsx` importuje stąd, zero zmiany
// zachowania (ten sam kształt danych, ta sama kolejność).
export type PupilTab = 'pet' | 'bosses' | 'shop' | 'quests';

export interface PupilNavTabDef {
  key: PupilTab;
  Icon: LucideIcon;
  path: string;
  accent: string;
  label: string;
}

export const PUPIL_NAV_TABS: PupilNavTabDef[] = [
  { key: 'pet',    Icon: Cat,           path: '/pet',        accent: '#2AC68F', label: 'Pupil' },
  { key: 'bosses', Icon: Swords,        path: '/bosses',     accent: '#38BDF8', label: 'Bossy' },
  { key: 'shop',   Icon: ShoppingBag,   path: '/pet-shop',   accent: '#A78BFA', label: 'Sklep' },
  { key: 'quests', Icon: ClipboardList, path: '/pet-quests', accent: '#FBBF24', label: 'Questy' },
];
