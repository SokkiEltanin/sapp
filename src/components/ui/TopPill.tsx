import { useMemo, useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, AppState } from 'react-native';
import { router } from 'expo-router';
import { Timer, Briefcase, AlertTriangle, ListTodo, Wallet, CalendarClock, Flame, Smile, Check, Sparkles, Cat, Swords } from 'lucide-react-native';
import { usePomodoroStore } from '@/store/pomodoroStore';
import { useCalendarStore } from '@/store/calendarStore';
import { useWorkStore } from '@/store/workStore';
import { useUiActions } from '@/store/uiActions';
import { useExpensesStore } from '@/store/expensesStore';
import { useMoodStore } from '@/store/moodStore';
import { useHabits } from '@/hooks/useHabits';
import { useWorkEarnings } from '@/hooks/useWorkEarnings';
import { usePetStore } from '@/store/petStore';
import { fmtMissionDuration, minibossForMission } from '@/utils/missions';
import { getBudgets, MonthlyBudgets } from '@/utils/budgets';
import { useTimeAccent } from '@/hooks/useTimeAccent';
import { colors, fonts } from '@/theme';
import { useColors } from '@/theme/useColors';
import { haptic } from '@/utils/haptics';
import { plPlural } from '@/utils/plural';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, '0'); }

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function tomorrowIso() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function weekEndIso() {
  const d = new Date(); d.setDate(d.getDate() + 7);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function fmtTimer(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${pad(m)}:${pad(s)}`;
}
function daysUntil(iso: string, today: string) {
  const ms = new Date(iso + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime();
  return Math.round(ms / 86_400_000);
}

// Kontrastowy tekst na badge: ciemny na JASNYM tle (mono/biały akcent), biały na
// ciemnym/kolorowym — inaczej mono-akcent = biały tekst na białym badge (nic nie widać).
function textOn(bg: string): string {
  const h = (bg || '').replace('#', '');
  if (h.length < 6) return '#FFFFFF';
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.6 ? '#0A0B0C' : '#FFFFFF';
}

// Safe uppercase — Google Calendar events can have an empty/undefined title,
// and `undefined.toUpperCase()` would throw and crash the whole pill.
function up(s: string | undefined | null): string {
  return (s ?? '').toUpperCase();
}

// Kontekstowa ikona statusu (po prefiksie klucza) — daje pillowi tożsamość „live island".
function pillIcon(key: string): any {
  if (key.startsWith('pom-')) return Timer;
  if (key.startsWith('earn-') || key.startsWith('shift-')) return Briefcase;
  if (key.startsWith('overdue-')) return AlertTriangle;
  if (key.startsWith('today-') || key.startsWith('pending-')) return ListTodo;
  if (key.startsWith('budget-')) return Wallet;
  if (key.startsWith('gcal-') || key.startsWith('deadline-')) return CalendarClock;
  if (key.startsWith('habit-')) return Flame;
  if (key.startsWith('mission-')) return Cat;
  if (key.startsWith('bossenergy-')) return Swords;
  if (key === 'mood-missing') return Smile;
  if (key === 'all-clear') return Check;
  return Sparkles;
}
// Stany „na żywo" (tykają co sekundę) → pulsująca kropka.
const isLive = (key: string) => key.startsWith('pom-') || key.startsWith('earn-');

// ─── Pill data type ───────────────────────────────────────────────────────────

interface PillItem {
  badge: string;
  color: string;
  text: string;
  route: string;
  key: string; // for animation change detection
  action?: () => void; // if set, run instead of router.push(route) on tap
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TopPill() {
  const today    = todayIso();
  const tomorrow = tomorrowIso();
  const weekEnd  = weekEndIso();
  const hour     = new Date().getHours();
  const { color: timeAccent } = useTimeAccent(); // cyan by day, blue by night
  const theme    = useColors();
  const s        = useMemo(() => makeS(theme), [theme]);

  // ── Store selectors ────────────────────────────────────────────────────────
  const pomRunning   = usePomodoroStore(s => s.isRunning);
  const pomMode      = usePomodoroStore(s => s.mode);
  const pomRemaining = usePomodoroStore(s => s.remaining);
  const pomTitle     = usePomodoroStore(s => s.taskTitle);

  const calTasks   = useCalendarStore(s => s.tasks);
  const gcalEvents = useCalendarStore(s => s.gcalEvents);

  const shifts        = useWorkStore(s => s.shifts);
  const workSettings  = useWorkStore(s => s.settings);
  const workPrefix    = workSettings.workPrefix ?? '';

  const events     = useCalendarStore(s => s.events);
  const expenses   = useExpensesStore(s => s.expenses);
  const openWorkPanel = useUiActions(s => s.openWorkPanel);

  // Live earnings — ticks each second while a work shift is in progress.
  const allEvents    = useMemo(() => [...events, ...gcalEvents], [events, gcalEvents]);
  const workEarnings = useWorkEarnings(shifts, allEvents, workSettings, expenses);

  const { habits, todayDone } = useHabits();
  const todayMoodEntry = useMoodStore(s => s.todayEntry);

  // Pupil (2026-08-23, user: "dodac pupila że jak jest na misji to tez pokazuje że jest") —
  // misja w toku i energia bossów gotowa do walki, oba jako kandydaci na LUŹNĄ (nie-pilną)
  // pulę rotacji niżej, obok habit-risk/mood/pending/all-clear.
  const missionEndsAt = usePetStore(s => s.missionEndsAt);
  const missionStartedAt = usePetStore(s => s.missionStartedAt);
  const bossEnergy    = usePetStore(s => s.energy);

  // The pill never re-focuses (it lives in the tab bar), so reload budgets on
  // cold start AND every foreground — otherwise a limit changed in Settings would
  // leave the pill's "near limit" warning stale for the whole session.
  const [budgets, setBudgets] = useState<MonthlyBudgets>({});
  useEffect(() => {
    const reload = () => getBudgets().then(setBudgets).catch(() => {});
    reload();
    const sub = AppState.addEventListener('change', s => { if (s === 'active') reload(); });
    return () => sub.remove();
  }, []);

  // Rotacja LUŹNEJ puli (2026-08-23, user: "żeby nie pokazywało się miesiąc ten sam że mam
  // jedno zadanie tylko żeby trochę tego trochę tamtego") — dawniej gdy żaden pilny stan
  // (1-7: pomodoro/praca/zaległe/dziś/budżet/kalendarz/deadline) nie pasował, pill pokazywał
  // ZAWSZE TEN SAM fallback (pierwszy pasujący z 8-10 wg sztywnego priorytetu) — jeśli user
  // miał tylko "1 zadanie w toku" i nic innego pilnego, widział dokładnie ten sam napis
  // tygodniami. Teraz WSZYSTKIE luźne kandydaty (streak zagrożony/misja pupila/energia
  // bossów/brak nastroju/zadania w toku/"wszystko ogarnięte") zbierane są do jednej listy i
  // pokazywane PO KOLEI, zmieniając się co CALM_ROTATE_MS — realna odmiana zamiast jednego
  // zamrożonego stanu. Pilne stany (1-7) NADAL mają twardy priorytet i przerywają rotację
  // natychmiast, gdy się pojawią (liczone PRZED tą pulą, bez zmian).
  const CALM_ROTATE_MS = 8000;
  const [calmTick, setCalmTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setCalmTick(t => t + 1), CALM_ROTATE_MS);
    return () => clearInterval(id);
  }, []);

  // ── Priority logic ─────────────────────────────────────────────────────────
  const item: PillItem | null = useMemo(() => {
   try {

    // 1 — Pomodoro running (work session)
    if (pomRunning && pomMode === 'work') {
      return {
        badge:  fmtTimer(pomRemaining),
        color:  colors.tabs.tasks,      // #2EDEA0 green
        text:   (pomTitle ?? 'POMODORO').toUpperCase(),
        route:  '/pomodoro',
        key:    `pom-${pomRemaining}`,
      };
    }

    // 2 — Live earnings (currently in a work shift) — ticks every second
    if (workEarnings.isWorking) {
      return {
        badge: `${workEarnings.totalEarned.toFixed(2)} zł`,
        color: '#2AC68F',
        text:  (workEarnings.activeEventTitle ? workEarnings.activeEventTitle.toUpperCase() : 'JESTEŚ W PRACY'),
        // Stuknięcie w „live earnings" otwiera panel Praca (nie Ustawienia) — tam widać
        // zarobek na sekundę i godziny. Panel to Modal na zamontowanym dashboardzie.
        route: '/(tabs)',
        action: () => { router.push('/(tabs)' as any); openWorkPanel(); },
        key:   `earn-${Math.floor(workEarnings.totalEarned)}`,
      };
    }

    // 3 — Work shift TODAY
    const todayShift = shifts.find(sh => sh.date === today);
    if (todayShift) {
      const pre = workPrefix ? `${workPrefix} ` : '';
      return {
        badge: 'DZISIAJ',
        color:  '#2BC8E0',             // cyan
        text:  `${pre}MASZ ZMIANĘ NA ${todayShift.startTime}`,
        route: '/(tabs)/stats',
        key:   `shift-today`,
      };
    }

    // 3 — Work shift TOMORROW
    const tomShift = shifts.find(sh => sh.date === tomorrow);
    if (tomShift) {
      const pre = workPrefix ? `${workPrefix} ` : '';
      return {
        badge: 'JUTRO',
        color:  colors.text.primary,   // mono
        text:  `${pre}MASZ ZMIANĘ NA ${tomShift.startTime}`,
        route: '/(tabs)/stats',
        key:   `shift-tom`,
      };
    }

    // 4 — Overdue tasks (status pending + deadline < today)
    const overdue = calTasks.filter(t =>
      t.status === 'pending' &&
      t.deadline &&
      t.deadline.split('T')[0] < today
    );
    if (overdue.length > 0) {
      const first = overdue.sort((a, b) => a.deadline!.localeCompare(b.deadline!))[0];
      return {
        badge: `${overdue.length} ${plPlural(overdue.length, 'ZALEGŁE', 'ZALEGŁE', 'ZALEGŁYCH')}`,
        color:  colors.tabs.finances,  // #E63535 red
        text:   up(first.title),
        route:  '/(tabs)/tasks',
        key:    `overdue-${overdue.length}`,
      };
    }

    // 4b — Tasks due / scheduled TODAY (deadline today OR scheduledDate today).
    // These fall between "overdue (<today)" and "near deadline (>today)", so
    // without this the pill would vanish on a day full of today-tasks.
    const todayTasks = calTasks.filter(t =>
      t.status !== 'done' &&
      ((t.deadline && t.deadline.split('T')[0] === today) || t.scheduledDate === today)
    );
    if (todayTasks.length > 0) {
      const first = todayTasks[0];
      return {
        badge: todayTasks.length > 1 ? `${todayTasks.length} DZIŚ` : 'DZIŚ',
        color:  timeAccent,
        text:   up(first.title),
        route:  '/(tabs)/tasks',
        key:    `today-${todayTasks.length}`,
      };
    }

    // 5 — Budget ≥85% of monthly limit
    const monthlySpend: Record<string, number> = {};
    for (const e of expenses) {
      if (e.type && e.type !== 'expense') continue;
      if (e.date.slice(0, 7) !== today.slice(0, 7)) continue;
      monthlySpend[e.category] = (monthlySpend[e.category] ?? 0) + e.amount;
    }
    const budgetAlerts = Object.entries(budgets)
      .map(([cat, limit]) => ({ cat, spend: monthlySpend[cat] ?? 0, limit: limit!, pct: (monthlySpend[cat] ?? 0) / limit! }))
      .filter(a => a.pct >= 0.85)
      .sort((a, b) => b.pct - a.pct);
    if (budgetAlerts.length > 0) {
      const first = budgetAlerts[0];
      return {
        badge: `${Math.round(first.spend)} PLN`,
        color:  colors.tabs.finances,  // #E43434 red
        text:  `ZBLIŻASZ SIĘ DO LIMITU #${first.cat}`,
        route: '/(tabs)/finances',
        key:   `budget-${first.cat}`,
      };
    }

    // 6 — Google Calendar event today (first upcoming by startTime)
    const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
    const gcalToday = gcalEvents
      .filter(e => e.date === today)
      .filter(e => {
        if (!e.startTime) return false;
        const [h, m] = e.startTime.split(':').map(Number);
        return h * 60 + m >= nowMins; // not started yet OR in progress
      })
      .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));
    if (gcalToday.length > 0) {
      const ev = gcalToday[0];
      const [h, m] = ev.startTime!.split(':').map(Number);
      const diffM = h * 60 + m - nowMins;
      const timeLabel = diffM <= 0 ? 'TERAZ' : diffM < 60 ? `ZA ${diffM} MIN` : ev.startTime!;
      return {
        badge: timeLabel,
        color:  '#2BC8E0',
        text:   up(ev.title) || 'WYDARZENIE',
        route:  '/(tabs)/stats',
        key:    `gcal-${ev.id}`,
      };
    }

    // 7 — Nearest task deadline within 7 days (countdown)
    const nearDeadline = calTasks
      .filter(t =>
        t.status !== 'done' &&
        t.deadline &&
        t.deadline.split('T')[0] > today &&
        t.deadline.split('T')[0] <= weekEnd
      )
      .sort((a, b) => a.deadline!.localeCompare(b.deadline!))[0];
    if (nearDeadline) {
      const days = daysUntil(nearDeadline.deadline!.split('T')[0], today);
      const label = days === 1 ? 'JUTRO' : `${days} DNI`;
      return {
        badge:  label,
        color:  colors.tabs.calendar,  // #3A4C9C indigo
        text:   `DO KOŃCA: ${up(nearDeadline.title)}`,
        route:  '/(tabs)/tasks',
        key:    `deadline-${nearDeadline.id}`,
      };
    }

    // 8+ — LUŹNA pula (nic pilne z 1-7 nie pasuje) — zbierz WSZYSTKICH pasujących kandydatów
    // i pokaż jednego na zmianę, nie zawsze tego samego (patrz komentarz przy `calmTick`
    // wyżej). Kolejność w tablicy NIE jest priorytetem — to tylko kolejność rotacji.
    const calmCandidates: PillItem[] = [];

    // Habit streak at risk (after 17:00, any habit not done today)
    if (hour >= 17) {
      const undone = habits.filter(h => !todayDone.includes(h.id));
      if (undone.length > 0) {
        const first = undone[0];
        calmCandidates.push({
          badge: 'SERIA!',
          color:  '#F59E0B',             // amber
          text:   `${up(first.title)} NIE ZAZNACZONY`,
          route:  '/habits',
          key:    `habit-${first.id}`,
        });
      }
    }

    // Pupil na misji (2026-08-23) — dopóki misja trwa, pokaż że pupil jest w podróży.
    if (missionEndsAt) {
      const remainingMs = new Date(missionEndsAt).getTime() - Date.now();
      const ready = remainingMs <= 0;
      // Miejsce (2026-08-31, user: "jak jest powiadomienie że pupil wrócił z misji to niech
      // będzie napisane z jakiego miejsca wrócił") — ta sama `destination` co w push
      // powiadomieniu i na scenie /pet, `numberOfLines={1}` niżej w renderze bezpiecznie
      // przycina dłuższe nazwy zamiast łamać layout pigułki.
      const dest = ready && missionStartedAt ? minibossForMission(missionStartedAt).destination : null;
      calmCandidates.push({
        badge:  ready ? 'GOTOWA' : fmtMissionDuration(remainingMs / 60000),
        color:  '#2AC68F',             // zielony — kolor Pupila w tab barze
        text:   ready ? `PUPIL WRÓCIŁ Z: ${dest ?? 'MISJI'}`.toUpperCase() : 'PUPIL NA MISJI',
        route:  '/pet',
        key:    `mission-${ready ? 'ready' : Math.round(remainingMs / 60000)}`,
      });
    }

    // Energia bossów gotowa do walki (2026-08-23) — patrz komentarz przy `bossEnergy` wyżej.
    if (bossEnergy > 0) {
      calmCandidates.push({
        badge: `${bossEnergy}`,
        color:  '#38BDF8',             // niebieski — kolor energii kampanii w app/bosses.tsx
        text:   'MOŻESZ WALCZYĆ Z BOSSEM',
        route:  '/bosses',
        key:    `bossenergy-${bossEnergy}`,
      });
    }

    // No mood entry today (after 18:00)
    if (hour >= 18 && !todayMoodEntry) {
      calmCandidates.push({
        badge: 'NASTRÓJ',
        color:  '#F472B6',             // pink
        text:   'JAK SIĘ CZUJESZ DZISIAJ?',
        route:  '/(tabs)/mood',
        key:    'mood-missing',
      });
    }

    // Fallback: pending count — zawsze dopisywany, jeśli są jakieś niezrobione zadania.
    const pending = calTasks.filter(t => t.status !== 'done').length;
    if (pending > 0) {
      calmCandidates.push({
        badge: `${pending}`,
        color:  timeAccent,
        text:   `${plPlural(pending, 'ZADANIE', 'ZADANIA', 'ZADAŃ')} W TOKU`,
        route:  '/(tabs)/tasks',
        key:    `pending-${pending}`,
      });
    }

    // Ostateczny fallback — TYLKO gdy nic powyżej nie pasuje, żeby pill nigdy nie znikał.
    if (calmCandidates.length === 0) {
      calmCandidates.push({
        badge: 'LUZ',
        color:  colors.tabs.tasks,       // green
        text:   'WSZYSTKO OGARNIĘTE',
        route:  '/(tabs)/tasks',
        key:    'all-clear',
      });
    }

    return calmCandidates[calmTick % calmCandidates.length];
   } catch {
    // Never let the pill crash — bad data just hides it this render
    return null;
   }
  }, [
    pomRunning, pomMode, pomRemaining, pomTitle,
    workEarnings.isWorking, workEarnings.totalEarned, workEarnings.activeEventTitle,
    shifts, workPrefix,
    calTasks,
    gcalEvents,
    expenses, budgets,
    missionEndsAt, missionStartedAt, bossEnergy, calmTick,
    habits, todayDone,
    todayMoodEntry,
    today, tomorrow, weekEnd, hour, timeAccent, openWorkPanel,
  ]);

  // ── Animation on content change — Dynamic-Island style pop ────────────────
  const opacity  = useRef(new Animated.Value(item ? 1 : 0)).current;
  const scale    = useRef(new Animated.Value(item ? 1 : 0.9)).current;
  const prevKey  = useRef<string | null>(item?.key ?? null);
  const pulse    = useRef(new Animated.Value(0)).current;

  // Pulsująca kropka dla stanów „na żywo" (pomodoro / praca).
  useEffect(() => {
    if (item && isLive(item.key)) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]));
      loop.start();
      return () => loop.stop();
    }
    pulse.setValue(0);
  }, [item?.key]);

  useEffect(() => {
    if (!item) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 0.9, useNativeDriver: true, damping: 16, stiffness: 220 }),
      ]).start();
      return;
    }
    if (prevKey.current !== item.key) {
      // Pop: shrink out, then spring in (the island "morphs" to new content).
      Animated.sequence([
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 110, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0.88, duration: 110, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 240, mass: 0.7 }),
        ]),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 220 }),
      ]).start();
    }
    prevKey.current = item.key;
  }, [item?.key]);

  if (!item) return null;

  const Icon = pillIcon(item.key);
  const live = isLive(item.key);
  const on   = textOn(item.color);

  return (
    <Animated.View style={[s.islandWrap, { opacity, transform: [{ scale }] }]}>
      {/* A single self-contained pill (its own solid background) that hugs its
          content — no surrounding band/border/halo around it. */}
      <TouchableOpacity
        style={s.island}
        onPress={() => { haptic.tap(); if (item.action) item.action(); else router.push(item.route as any); }}
        activeOpacity={0.8}
      >
        <View style={[s.badge, { backgroundColor: item.color }]}>
          <Icon size={12} color={on} strokeWidth={2.6} />
          <Text style={[s.badgeText, { color: on }]} numberOfLines={1}>{item.badge}</Text>
        </View>
        <Text style={s.text} numberOfLines={1}>{item.text}</Text>
        {live && (
          <Animated.View style={[s.liveDot, {
            backgroundColor: item.color,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.25] }) }],
          }]} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeS = (t: any) => StyleSheet.create({
  // The wrap only centers the pill — it has NO background of its own, so there's
  // no band/halo around the island.
  islandWrap: {
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 4,
    paddingHorizontal: 12,
  },
  // A single solid black pill (real dynamic-island look) that hugs its content.
  // NO `elevation` on purpose — Android renders elevation as a grey rounded halo
  // around the pill (the "szary wcięcie" you saw). Float comes from the pill being
  // darker than the page; iOS gets a faint soft shadow, Android none.
  island: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
    maxWidth: '100%',
    borderRadius: 999,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 14,
    backgroundColor: '#0A0B0C',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 7,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minWidth: 48,
  },
  liveDot: {
    width: 7, height: 7, borderRadius: 3.5, marginLeft: 2,
  },
  badgeText: {
    fontFamily: fonts.display,   // Archivo Black — punchy liczba/krótki badge
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  text: {
    flexShrink: 1,
    // Standard font (NIE LexendTera) — LexendTera jest bardzo szeroki i ucinał dłuższe
    // komunikaty („ZBLIŻASZ SIĘ DO LIMITU…"). System font mieści dużo więcej i czyta się lepiej.
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: '#F2F3F3',
  },
});
