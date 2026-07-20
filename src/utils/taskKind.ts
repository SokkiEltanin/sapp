import { TaskKind } from '@/types';

// Presentation + behaviour metadata per task kind. Icons are lucide names, mapped in
// the component (keeps this file free of RN/SVG imports).
export const KIND_META: Record<TaskKind, { label: string; short: string; hint: string; color: string; icon: string }> = {
  quick:   { label: 'Szybkie',      short: 'Szybkie',   hint: 'Ogarnij od razu',       color: '#2AC68F', icon: 'Zap' },
  deep:    { label: 'Do skupienia', short: 'Skupienie', hint: 'Na dłużej · Focus/🍅',   color: '#6C9EFF', icon: 'Target' },
  waiting: { label: 'Poczekalnia',  short: 'Czekam',    hint: 'Bez terminu · czekasz',  color: '#FBBF24', icon: 'Hourglass' },
};

export const KIND_ORDER: TaskKind[] = ['quick', 'deep', 'waiting'];

// Old tasks (no kind) read as quick.
export function resolveKind(t: { kind?: TaskKind }): TaskKind {
  return t.kind ?? 'quick';
}

// Guess a kind from the title so one-line capture needs zero taps (always overridable).
export function inferKind(title: string): TaskKind {
  const s = title.toLowerCase();
  // waiting: you're blocked / no clear moment ("czekam", "gdy…", "po rozliczeniu", "aż")
  if (/\b(czekam|czeka\b|gdy\s|kiedy\s|aż\s|az\s|po\srozlicz|po\swypłac|po\swyplac|jak\sdostan|jak\sprzyjd|dopiero\sgdy)/i.test(s)) return 'waiting';
  // deep: things you produce / study / big multi-step jobs
  if (/\b(napis|sprawozdani|raport|referat|esej|artyku|prezentacj|projekt|zaprojekt|nauczy|nauka|przygotuj|dokończ|dokoncz|rozdział|rozdzial|praca\sdom|zadani[ea]\sdom|ogarnąć\sduż)/i.test(s)) return 'deep';
  // long, sentence-like titles usually describe a bigger job → deep
  if (s.trim().split(/\s+/).length >= 6) return 'deep';
  return 'quick';
}
