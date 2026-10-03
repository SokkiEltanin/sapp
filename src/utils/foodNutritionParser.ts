// Parser wklejonego tekstu z wartościami odżywczymi (2026-10-03, user: wklejam ze strony typu
// fitatu.com albo z odpowiedzi AI (Gemini/Google AI search) i chcę żeby appka sama wyłapała
// kalorie/makro, zamiast przepisywać liczby ręcznie). Czysta funkcja (zero importów RN) — testowana
// wprost w __tests__/foodNutritionParser.test.ts.
//
// Rozpoznaje DWA realne formaty wklejki (różne serwisy/AI inaczej formatują ten sam fakt):
//   A) fitatu.com — "Wartość energetyczna561\nBiałka8.40...\nTłuszcze34.90...\n
//      Węglowodany52.60Węglowodany netto52.60Cukry52.30" (liczby BEZ jednostki "g", zlepione
//      z etykietą) + blok "Ile kalorii ma 1× opakowanie\n20 ml\n112 kcal" (porcja).
//   B) podsumowanie AI — "W 100 g produktu: ok. 552–560 kcal (tłuszcz: ok. 34 g, węglowodany:
//      ok. 52 g)." + "W 1 jajku (20 g): ok. 110–112 kcal, w tym ok. 6,8 g tłuszczu i 10,4 g
//      cukru..." — tu ten SAM makroskładnik bywa wymieniony DWA razy (porcja + 100g), więc
//      wyszukiwanie makro jest zawężone do linii "100 g produktu" (gdy istnieje), żeby nie
//      pomylić wartości na porcję z wartością na 100g.
export interface ParsedNutrition {
  name?: string;
  kcalPer100g?: number;
  protein100?: number;
  carbs100?: number;
  fat100?: number;
  sugar100?: number;
  servingGrams?: number;
  servingUnit?: 'g' | 'ml';
  kcalPerServing?: number;
}

// Liczba albo zakres ("110–112" / "110-112" / "6,8") — przecinek jako separator dziesiętny,
// zakres liczony jako średnia (fitatu podaje jedną liczbę, AI często zakres "ok. X–Y").
const N = '\\d+(?:[.,]\\d+)?(?:\\s*[–-]\\s*\\d+(?:[.,]\\d+)?)?';

function num(raw: string): number {
  const parts = raw.split(/[–-]/).map(p => parseFloat(p.trim().replace(',', '.')));
  const valid = parts.filter(n => Number.isFinite(n));
  if (!valid.length) return NaN;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}
const round1 = (n: number) => Math.round(n * 10) / 10;

// Szuka wartości makro w `scope` — próbuje DWIE konstrukcje językowe (różny szyk w PL):
// "6,8 g tłuszczu" (liczba PRZED słowem, typowe dla podsumowań AI) i "tłuszcz: ok. 34 g" /
// "Tłuszcze34.90" (słowo PRZED liczbą, typowe dla fitatu) — w TEJ kolejności, bo próbowanie
// wzorca 2 pierwszego na tekście typu "...6,8 g tłuszczu i 10,4 g cukru..." złapałoby
// przypadkiem wartość SĄSIEDNIEGO makroskładnika (cukru) jako rzekomy tłuszcz.
function findMacro(scope: string | undefined, stem: string): number | undefined {
  if (!scope) return undefined;
  let m = scope.match(new RegExp(`(${N})\\s*g\\s*${stem}`, 'i'));
  if (m) return round1(num(m[1]));
  m = scope.match(new RegExp(`${stem}[^\\d]{0,12}(${N})`, 'i'));
  if (m) return round1(num(m[1]));
  return undefined;
}

export function parsePastedNutrition(raw: string): ParsedNutrition | null {
  const text = raw.replace(/\r/g, '');
  const out: ParsedNutrition = {};

  // Nazwa — tylko fitatu: "Wartości odżywcze w <nazwa> 20 g na 100g:"
  const nameM = text.match(/Wartości odżywcze w\s+(.+?)\s+\d+(?:[.,]\d+)?\s*(?:g|ml)\s*na\s*100\s*g/i);
  if (nameM) out.name = nameM[1].trim();

  // ── fitatu: "Wartość energetyczna561" ──────────────────────────────────
  const energM = text.match(new RegExp(`Wartość energetyczna\\s*(${N})`, 'i'));
  if (energM) out.kcalPer100g = Math.round(num(energM[1]));

  // ── AI: "W 100 g produktu: ok. 552–560 kcal (tłuszcz: ok. 34 g, węglowodany: ok. 52 g)." ──
  const per100Line = text.match(/W\s*100\s*g\s*produktu[^\n]*/i)?.[0];
  if (per100Line && out.kcalPer100g == null) {
    const m = per100Line.match(new RegExp(`(${N})\\s*kcal`, 'i'));
    if (m) out.kcalPer100g = Math.round(num(m[1]));
  }

  // Makro per-100g: jeśli jest linia "100 g produktu" (AI) zawężamy do NIEJ (patrz komentarz
  // przy findMacro — inaczej złapałoby wartość z linii "na porcję" niżej); fitatu nie ma takiej
  // linii, więc szukamy w całym tekście (bezpiecznie — fitatu wspomina każde makro tylko raz).
  const macroScope = per100Line ?? text;
  out.protein100 = findMacro(macroScope, 'białk');
  out.fat100 = findMacro(macroScope, 'tłuszcz');
  out.carbs100 = findMacro(macroScope, 'węglowodan');
  out.sugar100 = findMacro(macroScope, 'cukr');

  // ── fitatu: "Ile kalorii ma 1× opakowanie\n20 ml\n112 kcal" ────────────────
  // `1(?!\d)` żeby nie złapać "10×"/"12×" itp. gdy akurat "1×" nie jest pierwszą pozycją na liście.
  const fitatuServ = text.match(new RegExp(
    `Ile kalorii ma 1(?!\\d)\\s*[×x]\\s*\\S+\\s*\\n\\s*(${N})\\s*(g|ml)\\s*\\n\\s*(${N})\\s*kcal`, 'i'));
  if (fitatuServ) {
    out.servingGrams = num(fitatuServ[1]);
    out.servingUnit = fitatuServ[2].toLowerCase() as 'g' | 'ml';
    out.kcalPerServing = Math.round(num(fitatuServ[3]));
  }

  // ── AI: "W 1 jajku (20 g): ok. 110–112 kcal, w tym ok. 6,8 g tłuszczu i 10,4 g cukru..." ──
  const aiServ = text.match(new RegExp(
    `W\\s*1(?!\\d)\\s*[^\\n(]*\\(\\s*(${N})\\s*(g|ml)\\s*\\)([^\\n]*)`, 'i'));
  if (aiServ && out.servingGrams == null) {
    const grams = num(aiServ[1]);
    const rest = aiServ[3];
    out.servingGrams = grams;
    out.servingUnit = aiServ[2].toLowerCase() as 'g' | 'ml';
    const kcalM = rest.match(new RegExp(`(${N})\\s*kcal`, 'i'));
    if (kcalM) out.kcalPerServing = Math.round(num(kcalM[1]));
    if (grams > 0) {
      // Dociąga makro z linii "na porcję" TYLKO gdy "na 100g" ich nie dało — przeskalowane
      // razy (100/porcja), żeby zostać w tej samej jednostce co resztę (g/100g).
      if (out.fat100 == null) { const f = findMacro(rest, 'tłuszcz'); if (f != null) out.fat100 = round1(f * 100 / grams); }
      if (out.sugar100 == null) { const sg = findMacro(rest, 'cukr'); if (sg != null) out.sugar100 = round1(sg * 100 / grams); }
      if (out.protein100 == null) { const p = findMacro(rest, 'białk'); if (p != null) out.protein100 = round1(p * 100 / grams); }
      if (out.carbs100 == null) { const cb = findMacro(rest, 'węglowodan'); if (cb != null) out.carbs100 = round1(cb * 100 / grams); }
    }
  }

  // Brak wprost "na 100g" ale znana porcja → dolicz kcal/100g z niej (rzadki przypadek — oba
  // znane formaty podają też wartość na 100g wprost, ale AI czasem skraca do samej porcji).
  if (out.kcalPer100g == null && out.kcalPerServing != null && out.servingGrams) {
    out.kcalPer100g = Math.round(out.kcalPerServing * 100 / out.servingGrams);
  }

  if (out.kcalPer100g == null && out.kcalPerServing == null) return null;
  return out;
}
