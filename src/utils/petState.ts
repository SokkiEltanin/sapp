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

export interface PetNeed { key: string; label: string; value: number; met: boolean }

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
  const energy = inp.sleepMinutes > 0 ? clamp(inp.sleepMinutes / 450 * 100) : null;      // ~7.5h = full
  const activity = inp.stepGoal > 0 ? clamp(inp.stepsToday / inp.stepGoal * 100) : null;
  const habits = inp.habitsTotal > 0 ? clamp(inp.habitsDone / inp.habitsTotal * 100) : null;
  const mood = inp.moodLoggedToday && inp.avgMoodToday != null ? clamp(inp.avgMoodToday / 5 * 100) : (inp.moodLoggedToday ? 60 : 25);

  const needs: PetNeed[] = [
    { key: 'energy', label: 'Energia', value: energy ?? 50, met: (energy ?? 50) >= 55 },
    { key: 'activity', label: 'Ruch', value: activity ?? 0, met: (activity ?? 0) >= 55 },
    { key: 'habits', label: 'Nawyki', value: habits ?? 100, met: (habits ?? 100) >= 55 },
    { key: 'mood', label: 'Nastrój', value: mood, met: mood >= 55 },
  ];

  const vals = [energy, activity, habits, mood].filter((v): v is number => v != null);
  const wellbeing = vals.length ? clamp(vals.reduce((a, b) => a + b, 0) / vals.length) : 50;

  const asleep = inp.hour >= 22 || inp.hour < 6;
  let expression: PetExpression;
  if (asleep && activity != null && activity < 80) expression = 'sleeping';
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
