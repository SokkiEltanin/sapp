import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import {
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Link2,
  CreditCard, Utensils, Candy, Wallet, Scale, PiggyBank, BarChart2, Package, Apple,
  ShoppingCart, Store, Smile, Zap, Flame, Footprints, Moon, Briefcase, Coins, ListChecks, Heart,
} from 'lucide-react-native';

import { CustomTile } from '@/store/dashboardLayout';
import {
  StatCtx, metricById, metricNumber, metricSeries, metricList, dailyValue,
  isMoodPixelMetric, pixelTiers,
} from '@/utils/statWidgets';
import { metricTagLabel, fmtChartPt, fmtStat, unitChip, periodCaption } from '@/utils/dashboard/format';
import { carryForward, lastNonZero, zoomFloor, compareVerdict } from '@/utils/dashboard/chart';
import YearPixels from '@/components/dashboard/YearPixels';
import WaveChart from '@/components/dashboard/WaveChart';
import DualWaveChart from '@/components/dashboard/DualWaveChart';
import StatDonut from '@/components/dashboard/StatDonut';
import { Colors } from '@/theme/colors';
import { spacing } from '@/theme';
import { haptic } from '@/utils/haptics';

// Per-metric icon for custom stat tiles, so each widget's preview is glanceable at a
// distance instead of every card wearing the same generic bar-chart glyph. Falls back
// to a per-group icon, then a bar chart. Wyniesione z app/(tabs)/index.tsx razem z resztą
// StatTile (2026-09-08) — index.tsx's modal szczegółów kafelka importuje `metricIcon` stąd.
const STAT_METRIC_ICON: Record<string, React.ComponentType<any>> = {
  spend: CreditCard, food: Utensils, sweets: Candy, income: Wallet, net: Scale,
  savings: PiggyBank, avgExpense: CreditCard, expenseCount: CreditCard, biggestExpense: CreditCard,
  byCategory: BarChart2, cheeseKg: Package, meatKg: Package, fruitKg: Apple, vegKg: Apple,
  topProducts: Package, favSweets: Candy, itemsCount: ShoppingCart, tagSpend: Store,
  tagCount: Package, tagKg: Scale, moodAvg: Smile, energyAvg: Zap, moodStreak: Flame,
  steps: Footprints, sleepAvg: Moon, weight: Scale, workHours: Briefcase, earnings: Coins,
  lastShift: Briefcase, tasksDone: ListChecks,
};
const STAT_GROUP_ICON: Record<string, React.ComponentType<any>> = {
  'Finanse': Wallet, 'Konsumpcja': ShoppingCart, 'Nastrój i zdrowie': Heart, 'Praca i zadania': Briefcase,
};
export function metricIcon(def: { id: string; group: string }): React.ComponentType<any> {
  return STAT_METRIC_ICON[def.id] ?? STAT_GROUP_ICON[def.group] ?? BarChart2;
}

interface StatTileProps {
  tile: CustomTile;
  statCtx: StatCtx;
  accentColor: string;
  cardBgDark: string;
  colors: Colors;
  // Współdzielony arkusz stylów dashboardu (`buildStyles(colors)` w index.tsx, budowany raz
  // na motyw i cache'owany) — przekazywany jak jest, bez redefiniowania stylów tutaj, żeby
  // ta ekstrakcja była czysto mechaniczna (te same klucze `s.card`/`s.cardHeader`/itd. co
  // dotąd w index.tsx).
  s: any;
  updateCustomTile: (id: string, patch: Partial<CustomTile>) => void;
  pixelDayCache: Record<string, Record<string, number>>;
}

// Wydzielone z app/(tabs)/index.tsx (2026-09-08, user: "znowu laguje... musimy zoptymalizować
// apkę" — druga runda po naprawie 1Hz-timera w useWorkEarnings, PR #163). Root cause z audytu:
// custom stat tiles robiły po 8 pełnych skanów historii wydatków (`metricSeries`/`metricList`/
// `metricNumber` → `bucketValue` w statWidgets.ts) NA KAŻDYM renderze całego 5000-liniowego
// dashboardu, bo `renderStatTile` był plain function odtwarzaną w zamkniętej `nodes` IIFE, bez
// żadnej memoizacji — im więcej kafelków user skonfigurował, tym drożej. `React.memo` tutaj
// skips a re-render CAŁKOWICIE, gdy żaden prop (tile/statCtx/motyw) się nie zmienił — a
// `statCtx` jest już zmemoizowany w index.tsx (`useMemo` z realną tablicą zależności), więc w
// typowym renderze (np. otwarcie modala gdzieś indziej na ekranie) te skany w ogóle się nie
// odpalają. Logika renderowania SKOPIOWANA 1:1 z dawnego `renderStatTile` — zero zmian w
// zachowaniu, tylko przeniesienie + memoizacja.
function StatTileImpl({ tile: t, statCtx, accentColor, cardBgDark, colors, s, updateCustomTile, pixelDayCache }: StatTileProps) {
  const def = metricById(t.metric);
  if (!def) return <View style={[s.card, { backgroundColor: cardBgDark }]}><Text style={s.cardTitle}>Widget — błąd</Text></View>;
  const period = (t.period ?? 'month') as 'week' | 'month';
  const viz = t.viz ?? 'number';
  const Ic = metricIcon(def);
  // ZAROBEK: a month is CONFIRMED once its real [JD] paycheck is known; the current
  // month is only a projection (all calendar hours × rate). Surface that — a lone
  // big number read as "I'm definitely earning this".
  const paidBy = statCtx.paycheckByMonth ?? {};
  const ymBack = (back: number) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - back); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  // month buckets only — ymBack maps bucket→month, which is meaningless for weeks
  const isEarnings = t.metric === 'earnings' && period === 'month';
  const earningsForecast = isEarnings && !((paidBy[ymBack(0)] ?? 0) > 0);
  const uChip = unitChip(def.unit);
  const header = (
    <View style={s.cardHeader}>
      <View style={[s.statIconChip, { backgroundColor: accentColor + '1A' }]}><Ic size={13} color={accentColor} /></View>
      <Text style={s.cardTitle} numberOfLines={1}>{t.title || def.label}</Text>
      {uChip ? <View style={[s.unitPill, { borderColor: accentColor + '44', backgroundColor: accentColor + '14' }]}><Text style={[s.unitPillTxt, { color: accentColor }]}>{uChip}</Text></View> : null}
    </View>
  );

  // PIXELS — a year-in-pixels calendar grid, one square per day coloured by the
  // metric's daily value. Checked FIRST so a 'weight'/'mood' pixels tile isn't
  // swallowed by the weight/number branches below.
  if (viz === 'pixels') {
    // Zmiana roku (2026-08-24, user: "w ustawieniach w personalizacji nie dałeś mi
    // możliwości zmiany roku xdd") — dawniej `year` był na sztywno bieżącym rokiem, bez
    // żadnego sposobu podejrzenia poprzednich lat. `t.year` (nowe, opcjonalne pole
    // CustomTile) trzyma wybór PER KAFELEK; brak = bieżący rok, więc istniejące kafelki
    // (bez tego pola) zachowują się dokładnie jak wcześniej. Strzałki NIŻEJ wołają
    // `updateCustomTile` — PIERWSZE realne użycie tej akcji w index.tsx (dotąd
    // `period`/`target`/itd. dawały się ustawić TYLKO przy tworzeniu kafelka, nie
    // edytować później) — celowo NIE osobny ekran ustawień, tylko strzałki wprost na
    // widgecie (dane i tak są per-dzień, `dailyValue()` nie zakłada "bieżącego roku").
    // Prawa strzałka zablokowana na bieżącym roku (nie ma sensu podglądać przyszłości).
    const currentYear = new Date().getFullYear();
    const year = t.year ?? currentYear;
    const mood = isMoodPixelMetric(t.metric!);
    // Czyta z `pixelDayCache` (raz-na-dzień cache w tle, patrz komentarz nad
    // `pixelTilesSig` w index.tsx) zamiast liczyć 365× dailyValue() na KAŻDYM renderze. Zanim
    // cache się wypełni (świeżo dodany kafel / pierwsze sekundy po starcie appki) — fallback
    // na bezpośrednie liczenie, żeby kafelek nie pokazywał samych zer w międzyczasie.
    const pixelCached = pixelDayCache[`pixels:${t.id}:${year}`];
    const valueFor = pixelCached
      ? (d: string) => pixelCached[d] ?? 0
      : (d: string) => dailyValue(t.metric!, statCtx, d);
    const tiers = pixelTiers(t.metric!);
    // human hint of the absolute tiers (steps: "co 5k · 30k+ złoty")
    const tierHint = tiers ? (t.metric === 'steps' ? 'co 5k kroków · 30k+ = złoty'
      : t.metric === 'sleepAvg' ? 'progi snu · ≥8,5 h = złoty'
      : t.metric === 'tasksDone' ? 'liczba zadań · ≥8 = złoty' : null) : null;
    return (
      <View style={[s.card, { backgroundColor: cardBgDark }]}>
        {header}
        <YearPixels year={year} valueFor={valueFor} mood={mood} accent={accentColor} tiers={tiers} />
        <View style={s.pxLegendRow}>
          <View style={s.pxYearRow}>
            <TouchableOpacity onPress={() => { haptic.tap(); updateCustomTile(t.id, { year: year - 1 }); }} hitSlop={8}>
              <ChevronLeft size={13} color={colors.text.muted} />
            </TouchableOpacity>
            <Text style={s.statSub}>Rok {year}{tierHint ? ` · ${tierHint}` : ''}</Text>
            <TouchableOpacity onPress={() => { if (year >= currentYear) return; haptic.tap(); updateCustomTile(t.id, { year: year + 1 }); }} hitSlop={8} disabled={year >= currentYear}>
              <ChevronRight size={13} color={year >= currentYear ? colors.border.default : colors.text.muted} />
            </TouchableOpacity>
          </View>
          {!mood && (
            <View style={s.pxLegend}>
              <Text style={[s.statSub, { fontSize: 10 }]}>mniej</Text>
              {['26', '58', 'A0', 'CC'].map((a, i) => (
                <View key={i} style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: accentColor + a }} />
              ))}
              <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: '#FFCB47' }} />
            </View>
          )}
        </View>
      </View>
    );
  }

  // WEIGHT — always a clean, readable tile no matter which viz was picked: big
  // current weight on the right, delta vs the previous reading (green = toward the
  // goal when one is set), a zoomed trend line so tiny changes are visible, and the
  // range. (Weight in a generic 'number'/'compare' tile was the unreadable case.)
  if (t.metric === 'weight' && viz !== 'compare') {
    const ser = metricSeries('weight', statCtx, period, 8, t.tag);
    const raw = ser.values;                     // per-bucket latest reading, 0 = no reading
    const nz = raw.filter(v => v > 0);
    const latest = nz.length ? nz[nz.length - 1] : 0;
    const prev   = nz.length > 1 ? nz[nz.length - 2] : 0;
    const delta  = latest && prev ? latest - prev : 0;
    const lo = nz.length ? Math.min(...nz) : 0;
    const hi = nz.length ? Math.max(...nz) : 0;
    const towardGoal = t.target && t.target > 0 && latest && prev
      ? Math.abs(latest - t.target) < Math.abs(prev - t.target) : null;
    const deltaColor = towardGoal == null ? colors.text.muted : towardGoal ? '#2AC68F' : '#F87171';
    // Weight never legitimately drops to 0, but empty buckets (no reading that
    // month) would plunge the line to the axis and look broken. Carry the last
    // known weight forward (and backfill leading gaps with the first reading) so
    // the trend line is continuous; only REAL readings get a dot + a number.
    const filled = carryForward(raw);
    const dotColors = raw.map(v => (v > 0 ? accentColor : 'transparent'));
    return (
      <View style={[s.card, { backgroundColor: cardBgDark }]}>
        <View style={s.waveHeadRow}>
          <View style={[s.cardHeader, { flex: 1, marginBottom: 0 }]}>
            <View style={[s.statIconChip, { backgroundColor: accentColor + '1A' }]}><Ic size={13} color={accentColor} /></View>
            <Text style={s.cardTitle} numberOfLines={1}>{t.title || def.label}</Text>
            {uChip ? <View style={[s.unitPill, { borderColor: accentColor + '44', backgroundColor: accentColor + '14' }]}><Text style={[s.unitPillTxt, { color: accentColor }]}>{uChip}</Text></View> : null}
          </View>
          <View style={s.waveNowWrap}>
            <Text style={[s.waveNow, { color: accentColor }]} numberOfLines={1}>{latest > 0 ? `${latest.toFixed(1)} kg` : '—'}</Text>
            {delta !== 0 && <Text style={[s.waveDelta, { color: deltaColor }]}>{delta > 0 ? '+' : '−'}{Math.abs(delta).toFixed(1)} kg</Text>}
          </View>
        </View>
        {nz.length === 0 ? (
          <Text style={[s.statSub, { marginTop: spacing[2] }]}>Brak wpisów wagi — dodaj wagę w Zdrowiu lub zsynchronizuj zegarek.</Text>
        ) : (
          <>
            {/* value above each REAL reading — numbers ON the chart, placed
                proportionally over the wave (carried-forward points stay unlabelled). */}
            <View style={{ height: 13 }}>
              {raw.map((v, i) => v > 0 ? (
                <Text key={i} style={[s.wDot, { left: `${((i + 0.5) / raw.length) * 100}%` }]} numberOfLines={1}>{v.toFixed(1)}</Text>
              ) : null)}
            </View>
            <WaveChart data={filled} color={accentColor} dotColors={dotColors} target={t.target} zoom />
            <Text style={s.chartCaption}>{periodCaption(period, raw.length)}</Text>
            {nz.length > 1 && (
              <Text style={s.statSub}>Zakres {lo.toFixed(1)}–{hi.toFixed(1)} kg{t.target ? ` · cel ${Number(t.target).toFixed(1)} kg` : ''}</Text>
            )}
          </>
        )}
      </View>
    );
  }

  if (viz === 'wave') {
    const ser = metricSeries(t.metric!, statCtx, period, 6, t.tag);
    // Prominent CURRENT value (last non-zero) on the right; the history stays on
    // the chart. The old row of 6 tiny numbers above the wave was unreadable for
    // weight — near-identical values, no way to tell which one is "now".
    const nz = ser.values.filter(v => v > 0);
    const latest = nz.length ? nz[nz.length - 1] : 0;
    const prev   = nz.length > 1 ? nz[nz.length - 2] : 0;
    const delta  = latest && prev ? latest - prev : 0;
    const dec    = (ser.unit === 'kg' || ser.unit === 'h') ? 1 : 0;
    return (
      <View style={[s.card, { backgroundColor: cardBgDark }]}>
        <View style={s.waveHeadRow}>
          <View style={[s.cardHeader, { flex: 1, marginBottom: 0 }]}>
            <View style={[s.statIconChip, { backgroundColor: accentColor + '1A' }]}><Ic size={13} color={accentColor} /></View>
            <Text style={s.cardTitle} numberOfLines={1}>{t.title || def.label}</Text>
            {uChip ? <View style={[s.unitPill, { borderColor: accentColor + '44', backgroundColor: accentColor + '14' }]}><Text style={[s.unitPillTxt, { color: accentColor }]}>{uChip}</Text></View> : null}
          </View>
          <View style={s.waveNowWrap}>
            <Text style={[s.waveNow, { color: accentColor }]} numberOfLines={1}>{fmtStat(latest, ser.unit)}</Text>
            {delta !== 0 && (
              <Text style={s.waveDelta}>{delta > 0 ? '+' : '−'}{Math.abs(delta).toFixed(dec)}{ser.unit}</Text>
            )}
          </View>
        </View>
        <View style={s.waveValRow}>
          {ser.values.map((v, i) => (
            <Text key={i} style={[s.waveValLabel, i === ser.values.length - 1 && { color: accentColor, fontWeight: '800' }]} numberOfLines={1}>{fmtChartPt(v, ser.unit)}</Text>
          ))}
        </View>
        <WaveChart data={ser.values} color={accentColor} target={t.target} zoom={t.metric === 'weight'}
          dotColors={isEarnings ? ser.values.map((_, i) => ((paidBy[ymBack(ser.values.length - 1 - i)] ?? 0) > 0 ? '#2AC68F' : '#FBBF24')) : undefined} />
        <View style={s.waveLabels}>
          {ser.labels.map((l, i) => (
            <Text key={i} style={[s.waveLabel, i === ser.labels.length - 1 && { color: accentColor, fontWeight: '700' }]}>{l}</Text>
          ))}
        </View>
        <Text style={s.chartCaption}>{periodCaption(period, ser.values.length)}</Text>
        {isEarnings && (
          <View style={s.fvLegend}>
            <View style={s.fvLegItem}><View style={[s.fvDotSm, { backgroundColor: '#2AC68F' }]} /><Text style={s.fvLegTxt}>potwierdzone wypłatą</Text></View>
            <View style={s.fvLegItem}><View style={[s.fvDotSm, { backgroundColor: '#FBBF24' }]} /><Text style={s.fvLegTxt}>prognoza</Text></View>
          </View>
        )}
        {earningsForecast && <Text style={s.forecastNote}>Bieżący miesiąc to szacunek z kalendarza × stawka — nie potwierdzony wypłatą.</Text>}
        {t.target ? <Text style={s.statSub}>Cel: {fmtStat(t.target, ser.unit)}</Text> : null}
      </View>
    );
  }

  if (viz === 'donut') {
    const rows = metricList(t.metric!, statCtx, 6);
    return (
      <View style={[s.card, { backgroundColor: cardBgDark }]}>
        {header}
        {rows.length === 0
          ? <Text style={s.statSub}>Brak danych jeszcze.</Text>
          : <StatDonut rows={rows} fmt={fmtStat} />}
      </View>
    );
  }

  if (viz === 'compare') {
    // Self-comparison: same metric, current period vs `compareOffset` periods ago.
    if (t.metric2 === '__self__') {
      const off = t.compareOffset ?? 1;
      const n = Math.max(6, off + 1);
      const ser = metricSeries(t.metric!, statCtx, period, n, t.tag);
      const vals = t.metric === 'weight' ? carryForward(ser.values) : ser.values;
      const nowV = vals[vals.length - 1] ?? 0;
      const thenIdx = vals.length - 1 - off;
      const thenV = thenIdx >= 0 ? vals[thenIdx] : 0;
      const nowL = ser.labels[ser.labels.length - 1] ?? 'teraz';
      const thenL = thenIdx >= 0 ? ser.labels[thenIdx] : '—';
      const dPct = thenV > 0 ? Math.round(((nowV - thenV) / thenV) * 100) : null;
      const up = nowV >= thenV;
      return (
        <View style={[s.card, { backgroundColor: cardBgDark }]}>
          {header}
          <View style={s.statCmpRow}>
            <View><Text style={[s.statCmpVal, { color: accentColor }]}>{fmtStat(nowV, ser.unit)}</Text><Text style={s.statCmpKey}>{nowL}</Text></View>
            {dPct != null && (
              <View style={[s.statDelta, { backgroundColor: (up ? '#2AC68F' : '#FF6B6B') + '1E' }]}>
                {up ? <TrendingUp size={11} color="#2AC68F" /> : <TrendingDown size={11} color="#FF6B6B" />}
                <Text style={[s.statDeltaText, { color: up ? '#2AC68F' : '#FF6B6B' }]}>{dPct >= 0 ? '+' : ''}{dPct}%</Text>
              </View>
            )}
            <View style={{ alignItems: 'flex-end' }}><Text style={[s.statCmpVal, { color: '#9CA3AF' }]}>{fmtStat(thenV, ser.unit)}</Text><Text style={s.statCmpKey}>{thenL}</Text></View>
          </View>
          <View style={s.waveValRow}>
            {vals.map((v, i) => (
              <Text key={i} style={[s.waveValLabel, (i === vals.length - 1 || i === thenIdx) && { color: accentColor, fontWeight: '800' }]} numberOfLines={1}>{fmtChartPt(v, ser.unit)}</Text>
            ))}
          </View>
          <WaveChart data={vals} color={accentColor} zoom={t.metric === 'weight'} />
          <View style={s.waveLabels}>
            {ser.labels.map((l, i) => <Text key={i} style={[s.waveLabel, (i === ser.labels.length - 1 || i === thenIdx) && { color: accentColor, fontWeight: '700' }]}>{l}</Text>)}
          </View>
          <Text style={s.chartCaption}>{periodCaption(period, vals.length)}</Text>
        </View>
      );
    }
    // Compare vs your own recent average.
    if (t.metric2 === '__avg__') {
      const ser = metricSeries(t.metric!, statCtx, period, 6, t.tag);
      const vals = t.metric === 'weight' ? carryForward(ser.values) : ser.values;
      const nowV = vals[vals.length - 1] ?? 0;
      const prior = vals.slice(0, -1).filter(v => v !== 0);
      const avgV = prior.length ? prior.reduce((sum, v) => sum + v, 0) / prior.length : 0;
      const dPct = avgV > 0 ? Math.round(((nowV - avgV) / avgV) * 100) : null;
      const up = nowV >= avgV;
      return (
        <View style={[s.card, { backgroundColor: cardBgDark }]}>
          {header}
          <View style={s.statCmpRow}>
            <View><Text style={[s.statCmpVal, { color: accentColor }]}>{fmtStat(nowV, ser.unit)}</Text><Text style={s.statCmpKey}>teraz</Text></View>
            {dPct != null && (
              <View style={[s.statDelta, { backgroundColor: (up ? '#2AC68F' : '#FF6B6B') + '1E' }]}>
                {up ? <TrendingUp size={11} color="#2AC68F" /> : <TrendingDown size={11} color="#FF6B6B" />}
                <Text style={[s.statDeltaText, { color: up ? '#2AC68F' : '#FF6B6B' }]}>{dPct >= 0 ? '+' : ''}{dPct}%</Text>
              </View>
            )}
            <View style={{ alignItems: 'flex-end' }}><Text style={[s.statCmpVal, { color: '#9CA3AF' }]}>{fmtStat(avgV, ser.unit)}</Text><Text style={s.statCmpKey}>Twoja średnia</Text></View>
          </View>
          <View style={s.waveValRow}>
            {vals.map((v, i) => (
              <Text key={i} style={[s.waveValLabel, i === vals.length - 1 && { color: accentColor, fontWeight: '800' }]} numberOfLines={1}>{fmtChartPt(v, ser.unit)}</Text>
            ))}
          </View>
          <WaveChart data={vals} color={accentColor} zoom={t.metric === 'weight'} />
          <View style={s.waveLabels}>{ser.labels.map((l, i) => <Text key={i} style={[s.waveLabel, i === ser.labels.length - 1 && { color: accentColor, fontWeight: '700' }]}>{l}</Text>)}</View>
          <Text style={s.chartCaption}>{periodCaption(period, vals.length)}</Text>
        </View>
      );
    }
    const a = metricSeries(t.metric!, statCtx, period, 6, t.tag);
    const defB = metricById(t.metric2);
    const b = defB ? metricSeries(t.metric2!, statCtx, period, 6) : { values: a.values.map(() => 0), labels: a.labels, unit: '' };
    // Weight side(s) carry forward so the line is continuous, use the last real
    // reading for the headline, and zoom their band so variance is visible even
    // next to a big-magnitude metric like steps.
    const aW = t.metric === 'weight', bW = t.metric2 === 'weight';
    const aVals = aW ? carryForward(a.values) : a.values;
    const bVals = bW ? carryForward(b.values) : b.values;
    const aNow = aW ? lastNonZero(a.values) : (a.values[a.values.length - 1] ?? 0);
    const bNow = bW ? lastNonZero(b.values) : (b.values[b.values.length - 1] ?? 0);
    // A tag metric's generic label ("Wydatki na tag…") never says WHICH tag, so a
    // "przekąski vs słodycze" tile read as "Wydatki na tag… vs Słodycze" — unreadable.
    const aLabel = metricTagLabel(def, t.tag);
    const bLabel = defB?.label ?? '—';
    // clearer than "X to 395% Y": name the bigger side and by how many ×
    const ratio = aNow > 0 && bNow > 0
      ? (bNow >= aNow ? `${bLabel}: ${(bNow / aNow).toFixed(1)}× tego co „${aLabel}"` : `${aLabel}: ${(aNow / bNow).toFixed(1)}× tego co „${bLabel}"`)
      : null;
    // The whole point of comparing two metrics: do they move TOGETHER across the same
    // periods? Pearson over matched non-zero pairs → a plain-language verdict, so a
    // "sen vs energia" tile says "zwykle idą w parze" instead of two mute bars.
    const cmpVerdict = compareVerdict(a.values, b.values, colors.text.muted);
    return (
      <View style={[s.card, { backgroundColor: cardBgDark }]}>
        {header}
        <View style={s.statCmpRow}>
          <View style={{ flex: 1 }}>
            <View style={s.cmpDotRow}><View style={[s.cmpDot, { backgroundColor: accentColor }]} /><Text style={s.statCmpKey} numberOfLines={1}>{aLabel}</Text></View>
            <Text style={[s.statCmpVal, { color: accentColor }]}>{fmtStat(aNow, a.unit)}</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <View style={s.cmpDotRow}><View style={[s.cmpDot, { backgroundColor: '#FBBF24' }]} /><Text style={s.statCmpKey} numberOfLines={1}>{bLabel}</Text></View>
            <Text style={[s.statCmpVal, { color: '#FBBF24' }]}>{fmtStat(bNow, b.unit)}</Text>
          </View>
        </View>
        {ratio && a.unit === b.unit && <Text style={[s.statSub, { marginTop: 2 }]}>{ratio}</Text>}
        <View style={s.waveValRow}>
          {a.values.map((v, i) => (
            <Text key={i} style={[s.waveValLabel, { color: accentColor, fontWeight: i === a.values.length - 1 ? '800' : '600' }]} numberOfLines={1}>{fmtChartPt(v, a.unit)}</Text>
          ))}
        </View>
        <View style={s.waveValRow}>
          {b.values.map((v, i) => (
            <Text key={i} style={[s.waveValLabel, { color: '#FBBF24', fontWeight: i === b.values.length - 1 ? '800' : '600' }]} numberOfLines={1}>{fmtChartPt(v, b.unit)}</Text>
          ))}
        </View>
        <DualWaveChart data1={aVals} data2={bVals} color1={accentColor} color2={'#FBBF24'} independent={a.unit !== b.unit}
          min1={aW ? zoomFloor(aVals) : 0} min2={bW ? zoomFloor(bVals) : 0} />
        <View style={s.waveLabels}>
          {a.labels.map((l, i) => <Text key={i} style={s.waveLabel}>{l}</Text>)}
        </View>
        <Text style={s.chartCaption}>Średnie w tych samych {a.values.length} {period === 'month' ? 'miesiącach' : 'tygodniach'}</Text>
        {cmpVerdict && (
          <View style={[s.cmpVerdict, { borderColor: cmpVerdict.color + '40', backgroundColor: cmpVerdict.color + '12' }]}>
            <Link2 size={12} color={cmpVerdict.color} />
            <Text style={[s.cmpVerdictTxt, { color: cmpVerdict.color }]}>{cmpVerdict.text}</Text>
          </View>
        )}
      </View>
    );
  }

  if (viz === 'list') {
    const rows = metricList(t.metric!, statCtx);
    const maxV = rows[0]?.value || 1;
    return (
      <View style={[s.card, { backgroundColor: cardBgDark }]}>
        {header}
        {rows.length === 0 ? (
          <Text style={s.statSub}>Brak danych jeszcze.</Text>
        ) : rows.map((r, i) => (
          <View key={r.label + i} style={s.statListRow2}>
            <Text style={s.statListRank}>{i + 1}</Text>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={s.topNameRow}>
                <Text style={s.statListLabel} numberOfLines={1}>{r.label}</Text>
                <Text style={[s.statListVal, { color: accentColor }]}>{fmtStat(r.value, r.unit)}</Text>
              </View>
              <View style={s.topBarTrack}>
                <View style={[s.topBarFill, { width: `${Math.max(6, (r.value / maxV) * 100)}%`, backgroundColor: accentColor }]} />
              </View>
            </View>
          </View>
        ))}
      </View>
    );
  }

  // number — big value + trend vs previous period + optional goal/sparkline
  const r = metricNumber(t.metric!, statCtx, period, t.tag);
  const pct = t.target && t.target > 0 ? Math.min(1, r.value / t.target) : null;
  const over = t.target ? r.value > t.target : false;
  let deltaPct: number | null = null; let trendUp = false; let spark: number[] | null = null; let sparkLabels: string[] = [];
  if (def.periodic) {
    const ser = metricSeries(t.metric!, statCtx, period, 6, t.tag);
    spark = ser.values;
    sparkLabels = ser.labels;
    const cur = ser.values[ser.values.length - 1] ?? 0;
    const prev = ser.values[ser.values.length - 2] ?? 0;
    if (prev > 0) { deltaPct = Math.round(((cur - prev) / prev) * 100); trendUp = cur >= prev; }
  }
  return (
    <View style={[s.card, { backgroundColor: cardBgDark }]}>
      {header}
      <View style={s.statNumRow}>
        <Text style={[s.statBig, { color: over ? colors.accent.red : accentColor }]}>{fmtStat(r.value, r.unit)}</Text>
        {earningsForecast && (
          <View style={s.forecastChip}><Text style={s.forecastChipTxt}>PROGNOZA</Text></View>
        )}
        {deltaPct != null && (
          <View style={[s.statDelta, { backgroundColor: (trendUp ? '#2AC68F' : '#FF6B6B') + '1E' }]}>
            {trendUp ? <TrendingUp size={11} color="#2AC68F" /> : <TrendingDown size={11} color="#FF6B6B" />}
            <Text style={[s.statDeltaText, { color: trendUp ? '#2AC68F' : '#FF6B6B' }]}>{deltaPct >= 0 ? '+' : ''}{deltaPct}%</Text>
          </View>
        )}
      </View>
      {earningsForecast && (
        <Text style={s.forecastNote}>Szacunek na CAŁY miesiąc (godziny z kalendarza × stawka) — jeszcze nie potwierdzone wypłatą. Poprzednie miesiące to realne wypłaty.</Text>
      )}
      {pct != null ? (
        <>
          <View style={s.statTargetTrack}>
            <View style={[s.statTargetFill, { width: `${pct * 100}%`, backgroundColor: over ? colors.accent.red : accentColor }]} />
          </View>
          <Text style={s.statSub}>{Math.round((r.value / t.target!) * 100)}% celu ({fmtStat(t.target!, r.unit)})</Text>
        </>
      ) : (
        <Text style={s.statSub}>
          {r.sub}{deltaPct != null ? `  ·  ${trendUp ? '↑' : '↓'} vs ${period === 'month' ? 'poprz. miesiąc' : 'poprz. tydzień'}` : ''}
        </Text>
      )}
      {spark && spark.some(v => v > 0) && (
        <View style={{ marginTop: spacing[2] }}>
          <View style={s.waveValRow}>
            {spark.map((v, i) => (
              <Text key={i} style={[s.waveValLabel, i === spark!.length - 1 && { color: over ? colors.accent.red : accentColor, fontWeight: '800' }]} numberOfLines={1}>{fmtChartPt(v, r.unit)}</Text>
            ))}
          </View>
          <View style={{ opacity: 0.85 }}>
            <WaveChart data={spark} color={over ? colors.accent.red : accentColor} target={t.target} zoom={t.metric === 'weight'}
              dotColors={isEarnings ? spark.map((_, i) => ((paidBy[ymBack(spark!.length - 1 - i)] ?? 0) > 0 ? '#2AC68F' : '#FBBF24')) : undefined} />
          </View>
          {sparkLabels.length === spark.length && (
            <View style={s.waveLabels}>
              {sparkLabels.map((l, i) => <Text key={i} style={[s.waveLabel, i === sparkLabels.length - 1 && { color: over ? colors.accent.red : accentColor, fontWeight: '700' }]}>{l}</Text>)}
            </View>
          )}
          <Text style={s.chartCaption}>{periodCaption(period, spark.length)}</Text>
          {isEarnings && (
            <View style={s.fvLegend}>
              <View style={s.fvLegItem}><View style={[s.fvDotSm, { backgroundColor: '#2AC68F' }]} /><Text style={s.fvLegTxt}>potwierdzone wypłatą</Text></View>
              <View style={s.fvLegItem}><View style={[s.fvDotSm, { backgroundColor: '#FBBF24' }]} /><Text style={s.fvLegTxt}>prognoza</Text></View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export default React.memo(StatTileImpl);
