import { MoodEntry } from '@/types';

// Wydzielone z `app/(tabs)/mood.tsx` (2026-10-05, audyt trzech niezsynchronizowanych
// "silników korelacji" dot. humoru — user: "rob to samo z humorem"). To TRZECI silnik,
// osobny od `correlations.ts`/`dashboard/correlations.ts` — NIE Pearson, a różnica średnich
// między dwiema grupami dni (np. dni pracy vs wolne, dobrze vs źle spane noce). To
// fundamentalnie inna metoda statystyczna niż korelacja ciągła, bo odpowiada na inne
// pytanie ("czy X różni się istotnie między typem dnia A i B", nie "czy X i Y rosną razem
// liniowo") — NIE scalone w Pearsona, bo to realnie zmieniłoby semantykę istniejących
// wniosków. Była wcześniej inline w komponencie ekranu, zupełnie bez testów — tu jest
// czystą, testowalną funkcją, tak jak oba pozostałe silniki od dawna są.

const DOW_WEEKEND = new Set([0, 6]);

function dayBeforeStr(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d - 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

// ─── Słowa kluczowe z notatek ──────────────────────────────────────────────────

const PL_STOPWORDS = new Set([
  'i','w','z','do','na','że','się','jest','to','nie','ale','jak','też','już',
  'ten','ta','tam','tak','bo','po','przy','przez','od','dla','go','mu','ich',
  'jej','tego','temu','mnie','mi','ja','ty','on','ona','my','wy','oni','co',
  'kto','czy','ani','by','być','mieć','mam','masz','mają','mamy','bardzo',
  'jeszcze','tylko','właśnie','jednak','teraz','tutaj','trochę','dużo','więc',
  'może','chyba','dzisiaj','dziś','wczoraj','jutro','czasem','zawsze','nigdy',
  'każdy','coś','nic','tej','jest','są','był','była','było','będzie','będę',
  'sobie','swój','swoją','jego','jej','nam','nas','was','was','tego','tych',
  'było','który','która','które','tego','przy','nad','pod','przed','między',
  'żeby','kiedy','gdzie','skąd','wtedy','potem','zaraz','już','znowu','chyba',
  // dorzucone po feedbacku „korelacje błędne" — częste PL wypełniacze, które łapały się jako „słowa"
  'mimo','oraz','lub','albo','czyli','gdy','aby','ażeby','więcej','mniej','znów',
  'całkiem','raczej','nawet','wcale','około','ponieważ','dlatego','bardziej','jakoś',
  'jakiś','jakaś','jakieś','taki','taka','takie','przecież','ogóle','wogóle','ogólnie',
  'generalnie','typu','jakby','dobra','okej','wogole','naprawdę','normalnie','totalnie',
  'kurde','kurwa','blin','spoko','trochę','bardzo','strasznie','mega','super',
]);
// Śmieci/śmiech — „xddd", „hahaha", „lol" itp. nie są słowem-kluczem.
const NOISE_WORD = /^(x+d+|d+x+|ha(ha)+|he(he)+|hi(hi)+|lo+l|rofl|kek|heh|hah|xd+)$/i;
const HAS_VOWEL = /[aąeęioóuy]/;

export interface KeywordStat {
  word: string;
  goodCount: number;
  badCount: number;
  totalCount: number;
  sentiment: number; // -1..+1
}

export function extractKeywords(entries: MoodEntry[]): { positive: KeywordStat[]; negative: KeywordStat[] } {
  const stats: Record<string, { good: number; bad: number }> = {};

  for (const entry of entries) {
    if (!entry.note?.trim()) continue;
    const isGood = entry.mood >= 4;
    const isBad  = entry.mood <= 2;
    if (!isGood && !isBad) continue; // skip neutral entries (mood 3)

    const words = [...new Set(entry.note   // dedupe per wpis → totalCount = liczba DNI ze słowem
      .toLowerCase()
      .replace(/[^a-ząćęłńóśźżA-ZĄĆĘŁŃÓŚŹŻ\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 4 && !PL_STOPWORDS.has(w) && !/^\d+$/.test(w) && !NOISE_WORD.test(w) && HAS_VOWEL.test(w))
    )];

    for (const word of words) {
      if (!stats[word]) stats[word] = { good: 0, bad: 0 };
      if (isGood) stats[word].good++;
      if (isBad)  stats[word].bad++;
    }
  }

  const all: KeywordStat[] = Object.entries(stats)
    .map(([word, s]) => ({
      word,
      goodCount: s.good,
      badCount: s.bad,
      totalCount: s.good + s.bad,
      sentiment: (s.good - s.bad) / (s.good + s.bad),
    }))
    .filter(k => k.totalCount >= 2);

  const positive = all
    .filter(k => k.sentiment > 0.2)
    .sort((a, b) => b.sentiment * Math.log(b.totalCount + 1) - a.sentiment * Math.log(a.totalCount + 1))
    .slice(0, 8);

  const negative = all
    .filter(k => k.sentiment < -0.2)
    .sort((a, b) => a.sentiment * Math.log(b.totalCount + 1) - b.sentiment * Math.log(a.totalCount + 1))
    .slice(0, 8);

  return { positive, negative };
}

// ─── Wnioski (różnica średnich między dwiema grupami dni) ─────────────────────

export function buildPatterns(
  entries: MoodEntry[],
  workByDate: Record<string, number>,
  spendByDate: Record<string, number>,
  doneTasksByDate: Record<string, number>,
  sleepMinByDate: Record<string, number>,
  stepsByDate: Record<string, number>,
  habitRateByDate: Record<string, number>,
): string[] {
  const out: string[] = [];
  const mean = (a: number[]) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
  // Progi podniesione po feedbacku „korelacje w większości błędne": za mało próbek / za mała
  // różnica = szum podawany jako fakt. Lepiej mniej wniosków, ale prawdziwych.
  const MIN_N = 5;       // min próbek po KAŻDEJ stronie (było 3)
  const D_MOOD = 0.45;   // min różnica nastroju/energii (było 0.35)
  const D_SPEND = 60;    // min różnica wydatków w zł (było 10)

  // Work days vs days off
  const workMood: number[] = [], offMood: number[] = [];
  for (const e of entries) ((workByDate[e.date] ?? 0) > 0 ? workMood : offMood).push(e.mood);
  const wM = mean(workMood), oM = mean(offMood);
  if (wM != null && oM != null && workMood.length >= MIN_N && offMood.length >= MIN_N && Math.abs(oM - wM) >= D_MOOD) {
    out.push(oM > wM
      ? `W dni wolne masz lepszy humor (${oM.toFixed(1)}) niż w dni pracy (${wM.toFixed(1)}).`
      : `W dni pracy masz lepszy humor (${wM.toFixed(1)}) niż w wolne (${oM.toFixed(1)}).`);
  }

  // Energy the day AFTER a work day
  const afterWork: number[] = [], afterRest: number[] = [];
  for (const e of entries) ((workByDate[dayBeforeStr(e.date)] ?? 0) > 0 ? afterWork : afterRest).push(e.energy);
  const aw = mean(afterWork), ar = mean(afterRest);
  if (aw != null && ar != null && afterWork.length >= MIN_N && afterRest.length >= MIN_N && Math.abs(ar - aw) >= D_MOOD) {
    out.push(ar > aw
      ? `Dzień po pracy masz zwykle mniej energii (${aw.toFixed(1)} vs ${ar.toFixed(1)}).`
      : `Dzień po pracy masz zwykle więcej energii (${aw.toFixed(1)} vs ${ar.toFixed(1)}).`);
  }

  // Longer shifts → next-day mood
  const afterLong: number[] = [], afterShort: number[] = [];
  for (const e of entries) {
    const h = workByDate[dayBeforeStr(e.date)] ?? 0;
    if (h > 0) (h >= 9 ? afterLong : afterShort).push(e.mood);
  }
  const al = mean(afterLong), as = mean(afterShort);
  if (al != null && as != null && afterLong.length >= MIN_N && afterShort.length >= MIN_N && Math.abs(as - al) >= D_MOOD) {
    out.push(`Po dłuższych zmianach (9h+) masz nazajutrz ${al < as ? 'gorszy' : 'lepszy'} humor (${al.toFixed(1)} vs ${as.toFixed(1)}).`);
  }

  // Weekend vs weekday
  const wknd: number[] = [], wkdy: number[] = [];
  for (const e of entries) { const dow = new Date(e.date).getDay(); (DOW_WEEKEND.has(dow) ? wknd : wkdy).push(e.mood); }
  const we = mean(wknd), wd = mean(wkdy);
  if (we != null && wd != null && wknd.length >= MIN_N && wkdy.length >= MIN_N && Math.abs(we - wd) >= D_MOOD) {
    out.push(we > wd
      ? `W weekendy masz lepszy humor (${we.toFixed(1)}) niż w tygodniu (${wd.toFixed(1)}).`
      : `W tygodniu masz lepszy humor (${wd.toFixed(1)}) niż w weekendy (${we.toFixed(1)}).`);
  }

  // Spending vs mood — mine-spend on low-mood vs good-mood days.
  const lowSpend: number[] = [], goodSpend: number[] = [];
  for (const e of entries) {
    const sp = spendByDate[e.date];
    if (sp == null) continue;
    if (e.mood <= 2) lowSpend.push(sp);
    else if (e.mood >= 4) goodSpend.push(sp);
  }
  const ls = mean(lowSpend), gs = mean(goodSpend);
  if (ls != null && gs != null && lowSpend.length >= MIN_N && goodSpend.length >= MIN_N && Math.abs(ls - gs) >= D_SPEND) {
    out.push(ls > gs
      ? `W gorsze dni wydajesz więcej — śr. ${Math.round(ls)} zł vs ${Math.round(gs)} zł w dobre.`
      : `W lepsze dni wydajesz więcej — śr. ${Math.round(gs)} zł vs ${Math.round(ls)} zł w gorsze.`);
  }

  // Tasks done vs mood — days with ≥1 completed task vs none.
  const doneMood: number[] = [], idleMood: number[] = [];
  for (const e of entries) ((doneTasksByDate[e.date] ?? 0) > 0 ? doneMood : idleMood).push(e.mood);
  const dm = mean(doneMood), im = mean(idleMood);
  if (dm != null && im != null && doneMood.length >= MIN_N && idleMood.length >= MIN_N && Math.abs(dm - im) >= D_MOOD) {
    out.push(dm > im
      ? `W dni, gdy domykasz zadania, masz lepszy humor (${dm.toFixed(1)} vs ${im.toFixed(1)}).`
      : `W dni z domkniętymi zadaniami humor jest niższy (${dm.toFixed(1)} vs ${im.toFixed(1)}) — może przeciążenie?`);
  }

  // Sleep ↔ energy / mood — well-slept (≥7h) vs short (<6h) nights.
  const wellEnergy: number[] = [], shortEnergy: number[] = [];
  const wellMood: number[] = [], shortMood: number[] = [];
  for (const e of entries) {
    const min = sleepMinByDate[e.date];
    if (min == null || min <= 0) continue;
    if (min >= 420) { wellEnergy.push(e.energy); wellMood.push(e.mood); }
    else if (min < 360) { shortEnergy.push(e.energy); shortMood.push(e.mood); }
  }
  const wellEn = mean(wellEnergy), shortEn = mean(shortEnergy);
  if (wellEn != null && shortEn != null && wellEnergy.length >= MIN_N && shortEnergy.length >= MIN_N && Math.abs(wellEn - shortEn) >= D_MOOD) {
    out.push(wellEn > shortEn
      ? `Po dobrym śnie (7h+) masz więcej energii (${wellEn.toFixed(1)} vs ${shortEn.toFixed(1)} po krótkim).`
      : `Po krótkim śnie masz więcej energii (${shortEn.toFixed(1)} vs ${wellEn.toFixed(1)}) — ciekawe.`);
  }
  const wellMd = mean(wellMood), shortMd = mean(shortMood);
  if (wellMd != null && shortMd != null && wellMood.length >= MIN_N && shortMood.length >= MIN_N && Math.abs(wellMd - shortMd) >= D_MOOD && out.length < 6) {
    out.push(wellMd > shortMd
      ? `Lepiej wyspany masz lepszy humor (${wellMd.toFixed(1)} vs ${shortMd.toFixed(1)} po krótkim śnie).`
      : `Po krótkim śnie humor bywa lepszy (${shortMd.toFixed(1)} vs ${wellMd.toFixed(1)}).`);
  }

  // Steps ↔ mood / energy — active days (8k+) vs low-movement (<4k).
  const activeMood: number[] = [], lazyMood: number[] = [];
  const activeEn: number[] = [], lazyEn: number[] = [];
  for (const e of entries) {
    const st = stepsByDate[e.date];
    if (st == null || st <= 0) continue;
    if (st >= 8000) { activeMood.push(e.mood); activeEn.push(e.energy); }
    else if (st < 4000) { lazyMood.push(e.mood); lazyEn.push(e.energy); }
  }
  const aMd = mean(activeMood), lMd = mean(lazyMood);
  if (aMd != null && lMd != null && activeMood.length >= MIN_N && lazyMood.length >= MIN_N && Math.abs(aMd - lMd) >= D_MOOD && out.length < 6) {
    out.push(aMd > lMd
      ? `W dni z ruchem (8k+ kroków) masz lepszy humor (${aMd.toFixed(1)} vs ${lMd.toFixed(1)} w mało aktywne).`
      : `W mało aktywne dni humor bywa lepszy (${lMd.toFixed(1)} vs ${aMd.toFixed(1)}).`);
  }
  const aEn = mean(activeEn), lEn = mean(lazyEn);
  if (aEn != null && lEn != null && activeEn.length >= MIN_N && lazyEn.length >= MIN_N && Math.abs(aEn - lEn) >= D_MOOD && out.length < 6) {
    out.push(aEn > lEn
      ? `Więcej kroków = więcej energii (${aEn.toFixed(1)} vs ${lEn.toFixed(1)} w mało aktywne dni).`
      : `Mniej kroków, a więcej energii (${lEn.toFixed(1)} vs ${aEn.toFixed(1)}) — ciekawe.`);
  }

  // Habits ↔ mood — days with most habits done (≥80%) vs few (≤30%).
  const habitfulMood: number[] = [], sparseMood: number[] = [];
  for (const e of entries) {
    const r = habitRateByDate[e.date];
    if (r == null) continue;
    if (r >= 0.8) habitfulMood.push(e.mood);
    else if (r <= 0.3) sparseMood.push(e.mood);
  }
  const hfm = mean(habitfulMood), spm = mean(sparseMood);
  if (hfm != null && spm != null && habitfulMood.length >= MIN_N && sparseMood.length >= MIN_N && Math.abs(hfm - spm) >= D_MOOD) {
    out.push(hfm > spm
      ? `W dni z odhaczonymi nawykami masz lepszy humor (${hfm.toFixed(1)} vs ${spm.toFixed(1)}).`
      : `Więcej nawyków, a humor niższy (${hfm.toFixed(1)} vs ${spm.toFixed(1)}) — może presja?`);
  }

  // Most common stress keyword
  const { negative, positive } = extractKeywords(entries);
  if (negative.length > 0) out.push(`Najczęściej stresują Cię: ${negative.slice(0, 2).map(k => k.word).join(', ')}.`);
  if (positive.length > 0 && out.length < 6) out.push(`Najlepiej działają na Ciebie: ${positive.slice(0, 2).map(k => k.word).join(', ')}.`);

  return out.slice(0, 6);
}
