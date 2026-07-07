// Derives the blob's LIVE mood from your real self-care data — no separate
// simulation, no new daily chore. Neglect your sleep/steps/habits/mood and the
// blob visibly sags (real consequences), but it never dies silently and bounces
// back the moment you do. Persisted growth/coins live in petStore.

export type PetExpression = 'happy' | 'content' | 'meh' | 'sad' | 'sick' | 'sleeping';

export interface PetInput {
  stepsToday: number;
  stepGoal: number;
  sleepMinutes: number;       // last night (0 = unknown)
  habitsDone: number;
  habitsTotal: number;
  moodLoggedToday: boolean;
  avgMoodToday: number | null; // 1..5
  hour: number;               // 0..23
}

export interface PetNeed { key: string; label: string; value: number; met: boolean; unknown?: boolean }

export interface PetState {
  needs: PetNeed[];
  wellbeing: number;          // 0..100
  expression: PetExpression;
  label: string;
  color: string;              // body colour
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

const COLORS: Record<PetExpression, string> = {
  happy:    '#2AC68F',
  content:  '#48C9A9',
  meh:      '#8FA37C',
  sad:      '#7C93B5',
  sick:     '#9FB08C',
  sleeping: '#7C6FB5',
};

const LABELS: Record<PetExpression, string> = {
  happy: 'Szczęśliwy', content: 'Zadowolony', meh: 'Taki sobie',
  sad: 'Smutny', sick: 'Choruje', sleeping: 'Śpi',
};

export function computePetState(inp: PetInput): PetState {
  // A metric only counts once we actually HAVE it. In particular steps==0 almost
  // always means "not synced from the watch yet", not "walked zero" — treating it
  // as 0% used to make the pet falsely sad, then jump to happy once steps loaded.
  // Unknown metrics are excluded from wellbeing instead of dragging it down.
  const energy = inp.sleepMinutes > 0 ? clamp(inp.sleepMinutes / 450 * 100) : null;      // ~7.5h = full
  const activity = (inp.stepGoal > 0 && inp.stepsToday > 0) ? clamp(inp.stepsToday / inp.stepGoal * 100) : null;
  const habits = inp.habitsTotal > 0 ? clamp(inp.habitsDone / inp.habitsTotal * 100) : null;
  const mood = inp.moodLoggedToday ? (inp.avgMoodToday != null ? clamp(inp.avgMoodToday / 5 * 100) : 60) : null;

  const need = (key: string, label: string, v: number | null, dflt: number): PetNeed =>
    ({ key, label, value: v ?? dflt, met: v == null ? true : v >= 55, unknown: v == null });
  const needs: PetNeed[] = [
    need('energy', 'Energia', energy, 0),
    need('activity', 'Ruch', activity, 0),
    need('habits', 'Nawyki', habits, 100),
    need('mood', 'Nastrój', mood, 0),
  ];

  const vals = [energy, activity, habits, mood].filter((v): v is number => v != null);
  // No data yet → gently neutral (never sad on an empty/just-opened day).
  const wellbeing = vals.length ? clamp(vals.reduce((a, b) => a + b, 0) / vals.length) : 60;

  const asleep = inp.hour >= 22 || inp.hour < 6;
  let expression: PetExpression;
  if (asleep && (activity == null || activity < 80)) expression = 'sleeping';
  else if (wellbeing >= 80) expression = 'happy';
  else if (wellbeing >= 60) expression = 'content';
  else if (wellbeing >= 42) expression = 'meh';
  else if (wellbeing >= 22) expression = 'sad';
  else expression = 'sick';

  return { needs, wellbeing, expression, label: LABELS[expression], color: COLORS[expression] };
}

// A short, kind status line for the dashboard tile — nudges without shaming.
export function petStatusLine(st: PetState): string {
  switch (st.expression) {
    case 'happy':    return 'Świetnie się czuje!';
    case 'content':  return 'Zadowolony i najedzony';
    case 'meh':      return 'Trochę się nudzi…';
    case 'sad':      return 'Tęskni — zajrzyj do niego';
    case 'sick':     return 'Kiepsko się czuje — zadbaj o siebie';
    case 'sleeping': return 'Smacznie śpi 💤';
  }
}
