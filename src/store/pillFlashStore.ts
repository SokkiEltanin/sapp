import { create } from 'zustand';

// Krótkie, "dynamic island"-owe powiadomienie w TopPill (2026-09-13, user: "niech moze
// tam sie pokazuja te powiadomienia ze sie pill lekko rozszerza i jest napisane ze seria
// logowan, albo ze dodano płatność automatyczna") — te dwa przykłady to już ISTNIEJĄCE
// `toast.success(...)` (rejestracja logowania w index.tsx, auto-dodanie płatności z banku
// w bankAutoProcess.ts) — toast na dole/górze ekranu znika po ~2.6s i łatwo go przegapić,
// bo TopPill (żyjący na stałe w tab-barze) jest dużo bardziej "na oku". Zamiast zastępować
// toast, ten store daje DRUGI kanał: dowolne miejsce w apce może wywołać `pillFlash.show(...)`
// obok istniejącego `toast.success(...)`, a TopPill.tsx pokazuje to z NAJWYŻSZYM priorytetem
// (przerywa nawet pomodoro/live-earnings na czas trwania), używając TEGO SAMEGO "pop" —
// żadnej nowej animacji do budowania. Auto-znika po `durationMs` — czysto stan czasowy, bez
// kolejki (druga wiadomość PODMIENIA pierwszą zamiast czekać w kolejce, świadomie proste).
export interface PillFlash { text: string; badge?: string; color: string; expiresAt: number }

interface PillFlashState {
  flash: PillFlash | null;
  show: (text: string, opts?: { badge?: string; color?: string; durationMs?: number }) => void;
  clear: () => void;
}

export const usePillFlash = create<PillFlashState>((set) => ({
  flash: null,
  show: (text, opts) => set({
    flash: {
      text,
      badge: opts?.badge,
      color: opts?.color ?? '#2AC68F',
      expiresAt: Date.now() + (opts?.durationMs ?? 6000),
    },
  }),
  clear: () => set({ flash: null }),
}));
