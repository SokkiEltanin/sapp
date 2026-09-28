import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, CalendarClock, Clock3, Trophy, Trash2, TrendingUp, TrendingDown, Minus, ArrowRightLeft, Shuffle } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { colors, spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';
import { useUsageStats } from '@/store/usageStatsStore';
import { screenInfoFor } from '@/utils/screenStats';
import { bucketByDay, bucketByHour, oldestEventDate, periodCounts, screenTrends, screenTransitions, bouncePairs } from '@/utils/usageStatsAnalysis';

const DAYS_SHOWN = 14;
const TRANSITIONS_SHOWN = 6;
const TRENDS_SHOWN = 5;

function fmtDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()}`;
}

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `dziś ${time}`;
  return `${d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })} ${time}`;
}

function labelFor(screenId: string): string {
  return screenInfoFor(screenId)?.label ?? screenId;
}

type Tone = 'up' | 'down' | 'flat';
function toneOf(delta: number): Tone { return delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'; }
function toneColorOf(c: ReturnType<typeof useColors>, tone: Tone): string {
  return tone === 'up' ? '#2AC68F' : tone === 'down' ? (c.accent.red ?? '#EF4444') : c.text.muted;
}

// Kafelek "dziś/ten tydzień/ten miesiąc" z porównaniem do poprzedniego okresu — jedna
// definicja użyta 3× w karcie "Otwarcia" (2026-09-18, user: "Porównań otwarc").
function PeriodTile({ label, current, previous, prevLabel, s, c }: {
  label: string; current: number; previous: number; prevLabel: string;
  s: ReturnType<typeof makeStyles>; c: ReturnType<typeof useColors>;
}) {
  const delta = current - previous;
  const tone = toneOf(delta);
  const color = toneColorOf(c, tone);
  const Icon = tone === 'up' ? TrendingUp : tone === 'down' ? TrendingDown : Minus;
  return (
    <View style={s.periodTile}>
      <Text style={s.periodVal}>{current}</Text>
      <Text style={s.periodLabel}>{label}</Text>
      <View style={s.periodDeltaRow}>
        <Icon size={11} color={color} />
        <Text style={[s.periodDeltaTxt, { color }]}>
          {tone === 'flat' ? `jak ${prevLabel}` : `${delta > 0 ? '+' : ''}${delta} vs ${prevLabel}`}
        </Text>
      </View>
    </View>
  );
}

// Pełny panel "Statystyki apki" (2026-09-15, §102) — user: "chciałem mieć w USTAWIENIACH >
// STATYSTYKI PANEL cały żebym mógł wejść w niego i mieć dużo dokładnych danych jak
// korzystam w co wchodzę kiedy dokładnie itp (wykresy z czasem itp co po kolei (może się
// ładować chwilkę po wejscu to nie main)". Osobna trasa (nie zakładka w Ustawieniach) —
// dostępna z Ustawienia → Dane → "Statystyki apki" → "Zobacz pełny panel". Czyta WYŁĄCZNIE
// `usageStatsStore` (lokalne, nigdzie niewysyłane — patrz komentarz w tym store).
// Trzy zakładki zamiast jednego ciągłego scrolla (2026-09-28, user: "ciągle tam nie ma
// szczegółowych wykresów ja mam co odczytać z tego, popraw te zeby tam byly realnie
// widoczne szczegóły dane, najczęstsze pulpitu i poukładane a nie infinity scroll") —
// ekran miał 7 kart pod sobą, trzeba było scrollować przez wszystkie żeby dotrzeć do
// czegokolwiek. Grupowanie: "Przegląd" (kiedy używam), "Ranking" (co używam), "Wzorce"
// (jak się poruszam między ekranami). Podsumowanie + "Najczęściej używane" zostają
// ZAWSZE widoczne nad zakładkami — to jest właśnie odpowiedź na "najczęstsze [ekrany]
// pulpitu", widoczna od razu, bez wchodzenia w zakładkę.
type Tab = 'przeglad' | 'ranking' | 'wzorce';
const TABS: { id: Tab; label: string }[] = [
  { id: 'przeglad', label: 'Przegląd' },
  { id: 'ranking',  label: 'Ranking' },
  { id: 'wzorce',   label: 'Wzorce' },
];
const MEDALS = ['🥇', '🥈', '🥉'];

export default function UsageStatsScreen() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const screens = useUsageStats(st => st.screens);
  const events = useUsageStats(st => st.events);
  const reset = useUsageStats(st => st.reset);
  const [confirmReset, setConfirmReset] = useState(false);
  const [tab, setTab] = useState<Tab>('przeglad');
  // Ranking domyślnie top 5 (2026-09-28, user po zobaczeniu pierwszej wersji: "nie
  // zakres wszystkie, po kliknięciu tak, top 5 niech będzie żeby nie było zajebania na
  // ekranie") — pełna lista (dziesiątki ekranów) była domyślnie w całości rozwinięta,
  // "Ranking ekranów" samo w sobie było niemal tak długie jak reszta karty razem wzięta.
  const [rankingExpanded, setRankingExpanded] = useState(false);
  const RANKING_COLLAPSED = 5;

  const dayBuckets = useMemo(() => bucketByDay(events, DAYS_SHOWN), [events]);
  const hourBuckets = useMemo(() => bucketByHour(events), [events]);
  const oldest = useMemo(() => oldestEventDate(events), [events]);
  // Rozbudowa (2026-09-18, user: "nie ma otwiarc dzisiaj łącznie... i Porównań otwarc,
  // Porównań ekranów, jakie ekrany po sobie, czy się jakieś zacinają pomiędzy sobie") —
  // cztery nowe agregaty, wszystkie czyste funkcje z usageStatsAnalysis.ts (testowalne bez
  // renderowania tego ekranu).
  const periods = useMemo(() => periodCounts(events), [events]);
  const trends = useMemo(() => screenTrends(events).slice(0, TRENDS_SHOWN).filter(t => t.delta !== 0), [events]);
  const allTransitions = useMemo(() => screenTransitions(events), [events]);
  const transitions = useMemo(() => allTransitions.slice(0, TRANSITIONS_SHOWN), [allTransitions]);
  const bounces = useMemo(() => bouncePairs(allTransitions), [allTransitions]);

  const ranking = useMemo(() => {
    return Object.entries(screens)
      .map(([id, stat]) => ({ id, label: screenInfoFor(id)?.label ?? id, ...stat }))
      .sort((a, b) => b.count - a.count);
  }, [screens]);

  const totalOpens = ranking.reduce((sum, r) => sum + r.count, 0);
  const maxDay = Math.max(1, ...dayBuckets.map(b => b.count));
  const maxHour = Math.max(1, ...hourBuckets.map(b => b.count));
  const top3 = ranking.slice(0, 3);

  // Konkretna liczba zamiast samej wysokości słupka do odczytania (user: "ja mam co
  // odczytać z tego") — który dzień/godzina jest szczytowa, wprost tekstem.
  const peakDay = dayBuckets.reduce((best, b) => (b.count > best.count ? b : best), dayBuckets[0]);
  const peakHour = hourBuckets.reduce((best, b) => (b.count > best.count ? b : best), hourBuckets[0]);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <PressableScale onPress={() => router.back()} style={s.backBtn}>
          <ChevronLeft size={22} color={c.text.secondary} />
        </PressableScale>
        <Text style={s.headerTitle}>Statystyki apki</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <Text style={s.intro}>
          Ile razy i kiedy otwierałeś poszczególne ekrany — WYŁĄCZNIE na tym urządzeniu, nigdzie nie wysyłane.
        </Text>

        <View style={s.summaryRow}>
          <View style={s.summaryTile}>
            <Text style={s.summaryVal}>{totalOpens}</Text>
            <Text style={s.summaryLabel}>otwarć łącznie</Text>
          </View>
          <View style={s.summaryTile}>
            <Text style={s.summaryVal}>{ranking.length}</Text>
            <Text style={s.summaryLabel}>różnych ekranów</Text>
          </View>
          <View style={s.summaryTile}>
            <Text style={s.summaryVal}>{oldest ? Math.max(1, Math.ceil((Date.now() - oldest.getTime()) / 86400000)) : 0}</Text>
            <Text style={s.summaryLabel}>dni danych</Text>
          </View>
        </View>

        {/* "Najczęściej używane" — zawsze widoczne, NIE schowane w zakładce "Ranking":
            to bezpośrednia odpowiedź na "najczęstsze [ekrany] pulpitu", konkretne liczby
            i procent udziału zamiast samej pozycji na liście. */}
        {top3.length > 0 && (
          <View style={s.card}>
            <View style={s.cardHeader}>
              <Trophy size={15} color={c.text.secondary} />
              <Text style={s.cardTitle}>Najczęściej używane</Text>
            </View>
            <View style={s.list}>
              {top3.map((r, i) => (
                <View key={r.id} style={[s.rankRow, i > 0 && s.rankRowBorder]}>
                  <Text style={s.medal}>{MEDALS[i]}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rankLabel} numberOfLines={1}>{r.label}</Text>
                  </View>
                  <Text style={s.rankCount}>{r.count}×</Text>
                  <Text style={s.rankPct}>{totalOpens > 0 ? Math.round((r.count / totalOpens) * 100) : 0}%</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Zakładki zamiast jednej długiej listy kart pod sobą. */}
        <View style={s.tabRow}>
          {TABS.map(t => (
            <PressableScale key={t.id} onPress={() => setTab(t.id)} style={{ flex: 1 }}>
              <View style={[s.tabPill, tab === t.id && s.tabPillActive]}>
                <Text style={[s.tabPillText, tab === t.id && s.tabPillTextActive]}>{t.label}</Text>
              </View>
            </PressableScale>
          ))}
        </View>

        {tab === 'przeglad' && <>

        {/* Otwarcia dziś/tydzień/miesiąc + porównanie do poprzedniego okresu (2026-09-18,
            user: "nie ma otwiarc dzisiaj łącznie, w tym tygodniu i miesiącu łącznie, i
            Porównań otwarc") — dawny summaryRow wyżej miał TYLKO "od zawsze", bez podziału
            na okresy i bez trendu. */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <ArrowRightLeft size={15} color={c.text.secondary} />
            <Text style={s.cardTitle}>Otwarcia</Text>
          </View>
          <View style={s.periodRow}>
            <PeriodTile label="dziś" current={periods.today} previous={periods.yesterday} prevLabel="wczoraj" s={s} c={c} />
            <PeriodTile label="ten tydzień" current={periods.thisWeek} previous={periods.lastWeek} prevLabel="zeszły tydz." s={s} c={c} />
            <PeriodTile label="ten miesiąc" current={periods.thisMonth} previous={periods.lastMonth} prevLabel="zeszły mies." s={s} c={c} />
          </View>
        </View>

        <View style={s.card}>
          <View style={s.cardHeader}>
            <CalendarClock size={15} color={c.text.secondary} />
            <Text style={s.cardTitle}>Aktywność dziennie (ostatnie {DAYS_SHOWN} dni)</Text>
          </View>
          {totalOpens === 0 ? (
            <Text style={s.empty}>Jeszcze za mało danych.</Text>
          ) : (
            <>
              <View style={s.barsRow}>
                {dayBuckets.map(b => {
                  const h = Math.max(b.count > 0 ? 4 : 2, (b.count / maxDay) * 52);
                  return (
                    <View key={b.dateStr} style={s.barCol}>
                      <View style={s.barWrap}>
                        {b.count > 0 && <Text style={s.barValue}>{b.count}</Text>}
                        <View style={[s.bar, { height: h, backgroundColor: b.count > 0 ? c.accent.blue : c.border.subtle }]} />
                      </View>
                      <Text style={[s.barDayLabel, b.isToday && s.barDayLabelToday]}>{fmtDayLabel(b.dateStr)}</Text>
                    </View>
                  );
                })}
              </View>
              {peakDay.count > 0 && (
                <Text style={s.peakLine}>
                  Najaktywniejszy dzień: {fmtDayLabel(peakDay.dateStr)} — {peakDay.count} {peakDay.count === 1 ? 'otwarcie' : 'otwarć'}
                </Text>
              )}
            </>
          )}
        </View>

        <View style={s.card}>
          <View style={s.cardHeader}>
            <Clock3 size={15} color={c.text.secondary} />
            <Text style={s.cardTitle}>O której porze dnia</Text>
          </View>
          {totalOpens === 0 ? (
            <Text style={s.empty}>Jeszcze za mało danych.</Text>
          ) : (
            <>
              <View style={s.barsRow}>
                {hourBuckets.map(b => {
                  const h = Math.max(b.count > 0 ? 4 : 2, (b.count / maxHour) * 64);
                  return (
                    <View key={b.hour} style={s.barColThin}>
                      <View style={s.barWrap}>
                        <View style={[s.barThin, { height: h, backgroundColor: b.count > 0 ? c.accent.purple : c.border.subtle }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
              <View style={s.hourTicks}>
                <Text style={s.hourTickLabel}>0</Text>
                <Text style={s.hourTickLabel}>6</Text>
                <Text style={s.hourTickLabel}>12</Text>
                <Text style={s.hourTickLabel}>18</Text>
                <Text style={s.hourTickLabel}>23</Text>
              </View>
              {peakHour.count > 0 && (
                <Text style={s.peakLine}>
                  Najaktywniejsza godzina: {peakHour.hour}:00 — {peakHour.count} {peakHour.count === 1 ? 'otwarcie' : 'otwarć'}
                </Text>
              )}
            </>
          )}
        </View>

        </>}

        {tab === 'ranking' && <>

        <View style={s.card}>
          <View style={s.cardHeader}>
            <Trophy size={15} color={c.text.secondary} />
            <Text style={s.cardTitle}>Ranking ekranów</Text>
          </View>
          {ranking.length === 0 ? (
            <Text style={s.empty}>Jeszcze za mało danych.</Text>
          ) : (
            <>
              <View style={s.list}>
                {(rankingExpanded ? ranking : ranking.slice(0, RANKING_COLLAPSED)).map((r, i) => (
                  <View key={r.id} style={[s.rankRow, i > 0 && s.rankRowBorder]}>
                    <Text style={s.rankIndex}>{i + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.rankLabel} numberOfLines={1}>{r.label}</Text>
                      <Text style={s.rankWhen}>ostatnio: {fmtWhen(r.lastOpenedAt)}</Text>
                    </View>
                    <Text style={s.rankCount}>{r.count}×</Text>
                    <Text style={s.rankPct}>{totalOpens > 0 ? Math.round((r.count / totalOpens) * 100) : 0}%</Text>
                  </View>
                ))}
              </View>
              {ranking.length > RANKING_COLLAPSED && (
                <PressableScale onPress={() => setRankingExpanded(v => !v)}>
                  <Text style={s.showMore}>
                    {rankingExpanded ? 'Pokaż mniej' : `Pokaż wszystkie (${ranking.length})`}
                  </Text>
                </PressableScale>
              )}
            </>
          )}
        </View>

        {/* Trendy ekranów: ten tydzień vs zeszły (2026-09-18, user: "Porównań ekranów") —
            które ekrany zyskały/straciły otwarcia, nie tylko surowy ranking od zawsze. */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <ArrowRightLeft size={15} color={c.text.secondary} />
            <Text style={s.cardTitle}>Trendy ekranów (ten tydzień vs zeszły)</Text>
          </View>
          {trends.length === 0 ? (
            <Text style={s.empty}>Za mało danych z dwóch tygodni pod rząd.</Text>
          ) : (
            <View style={s.list}>
              {trends.map((t, i) => {
                const tone = toneOf(t.delta);
                const color = toneColorOf(c, tone);
                const Icon = tone === 'up' ? TrendingUp : TrendingDown;
                return (
                  <View key={t.screenId} style={[s.rankRow, i > 0 && s.rankRowBorder]}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.rankLabel} numberOfLines={1}>{labelFor(t.screenId)}</Text>
                      <Text style={s.rankWhen}>{t.previous} → {t.current}</Text>
                    </View>
                    <View style={s.trendBadge}>
                      <Icon size={12} color={color} />
                      <Text style={[s.trendBadgeTxt, { color }]}>{t.delta > 0 ? '+' : ''}{t.delta}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        </>}

        {tab === 'wzorce' && <>

        {/* Kolejność ekranów: z jakiego na jaki NAJCZĘŚCIEJ (2026-09-18, user: "jakie
            ekrany po sobie") — kolejne otwarcia w oknie 30 min, patrz screenTransitions(). */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <ArrowRightLeft size={15} color={c.text.secondary} />
            <Text style={s.cardTitle}>Najczęstsza kolejność ekranów</Text>
          </View>
          {transitions.length === 0 ? (
            <Text style={s.empty}>Jeszcze za mało danych.</Text>
          ) : (
            <View style={s.list}>
              {transitions.map((t, i) => (
                <View key={`${t.from}→${t.to}`} style={[s.rankRow, i > 0 && s.rankRowBorder]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rankLabel} numberOfLines={1}>{labelFor(t.from)} → {labelFor(t.to)}</Text>
                  </View>
                  <Text style={s.rankCount}>{t.count}×</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Ekrany "na przemian" (2026-09-18, user: "czy się jakieś zacinają pomiędzy
            sobie") — pary ekranów gdzie user odbija się w OBIE strony często, patrz
            bouncePairs(). Sygnał że coś nie jest wygodnie dostępne z jednego miejsca. */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Shuffle size={15} color={c.text.secondary} />
            <Text style={s.cardTitle}>Ekrany na przemian</Text>
          </View>
          {bounces.length === 0 ? (
            <Text style={s.empty}>Nie wykryto — nie odbijasz się często między dwoma ekranami.</Text>
          ) : (
            <View style={s.list}>
              {bounces.map((b, i) => (
                <View key={`${b.a}|${b.b}`} style={[s.rankRow, i > 0 && s.rankRowBorder]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rankLabel} numberOfLines={1}>{labelFor(b.a)} ⇄ {labelFor(b.b)}</Text>
                    <Text style={s.rankWhen}>{b.aToB}× tam, {b.bToA}× z powrotem</Text>
                  </View>
                  <Text style={s.rankCount}>{b.total}×</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        </>}

        <PressableScale onPress={() => { haptic.tap(); setConfirmReset(true); }}>
          <View style={s.resetBtn}>
            <Trash2 size={13} color={c.text.muted} />
            <Text style={s.resetText}>Wyczyść statystyki</Text>
          </View>
        </PressableScale>
      </ScrollView>

      <ConfirmDialog
        visible={confirmReset}
        title="Wyczyścić statystyki?"
        message="Cały log otwarć i liczniki zostaną wyzerowane. Tego nie można cofnąć."
        confirmLabel="Wyczyść"
        destructive
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => { setConfirmReset(false); reset(); haptic.medium(); toast.success('Statystyki wyczyszczone'); }}
      />
    </SafeAreaView>
  );
}

const makeStyles = themedStyles((c: typeof colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: c.border.subtle,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: c.bg.card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: c.border.default,
  },
  headerTitle: { ...typography.h3, color: c.text.primary },
  scroll: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[10] },
  intro: { fontSize: 12, color: c.text.muted, lineHeight: 17 },
  summaryRow: { flexDirection: 'row', gap: spacing[2] },
  summaryTile: {
    flex: 1, alignItems: 'center', gap: 2,
    backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default,
    paddingVertical: spacing[3],
  },
  summaryVal: { fontSize: 20, fontWeight: '900', color: c.text.primary },
  summaryLabel: { fontSize: 10, color: c.text.muted, textAlign: 'center' },
  card: {
    backgroundColor: c.bg.card, borderRadius: radius.xl, padding: spacing[4],
    gap: spacing[3], borderWidth: 1, borderColor: c.border.default,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  cardTitle: { ...typography.bodySmall, fontWeight: '700', color: c.text.primary },
  empty: { fontSize: 12, color: c.text.muted, textAlign: 'center', paddingVertical: spacing[2] },
  // Zakładki Przegląd/Ranking/Wzorce (2026-09-28, user: "poukładane a nie infinity
  // scroll") — ten sam pill-row wzorzec co RECURRING_OPTIONS w tasks/[id].tsx, zamiast 7
  // kart jedna pod drugą.
  tabRow: { flexDirection: 'row', gap: spacing[2] },
  tabPill: {
    alignItems: 'center', paddingVertical: spacing[2],
    borderRadius: radius.full, borderWidth: 1,
    borderColor: c.border.default, backgroundColor: c.bg.card,
  },
  tabPillActive: { borderColor: c.accent.blue, backgroundColor: c.accent.blue + '18' },
  tabPillText: { fontSize: 12, fontWeight: '700', color: c.text.muted },
  tabPillTextActive: { color: c.accent.blue },
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  barColThin: { flex: 1, alignItems: 'center' },
  // 68 → 78 (2026-09-28, user: "ja mam co odczytać z tego") — słupek sam w sobie nie
  // niósł żadnej konkretnej liczby, tylko wysokość do zgadywania. Dodatkowe 10px mieści
  // etykietę liczby NAD słupkiem bez przycinania (max wysokość słupka zmniejszona z 64→52).
  barWrap: { height: 78, justifyContent: 'flex-end', alignItems: 'center', width: '100%' },
  bar: { width: 10, borderRadius: 4, minHeight: 2 },
  barThin: { width: 4, borderRadius: 2, minHeight: 2 },
  barValue: { fontSize: 9, fontWeight: '700', color: c.text.secondary, marginBottom: 3 },
  barDayLabel: { fontSize: 8, color: c.text.muted },
  barDayLabelToday: { color: c.accent.blue, fontWeight: '800' },
  hourTicks: { flexDirection: 'row', justifyContent: 'space-between' },
  hourTickLabel: { fontSize: 9, color: c.text.muted },
  // Podpis szczytu wprost tekstem (godzinowy wykres ma 24 cienkie słupki — za wąsko na
  // etykietę liczby przy każdym, więc szczyt dostaje jedno zdanie zamiast tego).
  peakLine: { fontSize: 11, color: c.text.secondary, textAlign: 'center', marginTop: spacing[1] },
  list: { borderRadius: radius.md, overflow: 'hidden' },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[2] },
  rankRowBorder: { borderTopWidth: 1, borderTopColor: c.border.subtle },
  rankIndex: { width: 18, fontSize: 12, fontWeight: '800', color: c.text.muted, textAlign: 'center' },
  medal: { fontSize: 16, width: 22, textAlign: 'center' },
  rankLabel: { fontSize: 13, fontWeight: '600', color: c.text.primary },
  rankWhen: { fontSize: 10.5, color: c.text.muted, marginTop: 1 },
  rankCount: { fontSize: 12, fontWeight: '800', color: c.text.secondary, minWidth: 28, textAlign: 'right' },
  // % udziału w łącznej liczbie otwarć (2026-09-28) — obok surowej liczby w rankingu, żeby
  // "336×" było konkretnie czytelne jako "to prawie 1/5 wszystkich otwarć", nie gołą cyfrą.
  rankPct: { fontSize: 10.5, fontWeight: '700', color: c.text.muted, minWidth: 34, textAlign: 'right' },
  showMore: { fontSize: 12, fontWeight: '700', color: c.accent.blue, textAlign: 'center', paddingTop: spacing[2] },
  // Karta "Otwarcia" (2026-09-18) — 3 kafelki dziś/tydzień/miesiąc, każdy z deltą vs
  // poprzedni okres pod wartością główną.
  periodRow: { flexDirection: 'row', gap: spacing[2] },
  periodTile: { flex: 1, alignItems: 'center', gap: 2 },
  periodVal: { fontSize: 22, fontWeight: '900', color: c.text.primary },
  periodLabel: { fontSize: 10.5, color: c.text.muted, textAlign: 'center' },
  periodDeltaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  periodDeltaTxt: { fontSize: 9.5, fontWeight: '700' },
  // Badge trendu ekranu (2026-09-18) — obok wpisu w "Trendy ekranów".
  trendBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: c.fill.subtle, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 4 },
  trendBadgeTxt: { fontSize: 11, fontWeight: '800' },
  resetBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2],
    paddingVertical: spacing[3], borderRadius: radius.md,
    borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.elevated,
  },
  resetText: { fontSize: 12, fontWeight: '700', color: c.text.secondary },
}));
