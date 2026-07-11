import { Expense } from '@/types';

// Strip Polish diacritics so "wrzesień"/"września" etc. match one stem.
function dePl(s: string): string {
  return s.toLowerCase()
    .replace(/ą/g, 'a').replace(/ć/g, 'c').replace(/ę/g, 'e').replace(/ł/g, 'l')
    .replace(/ń/g, 'n').replace(/ó/g, 'o').replace(/ś/g, 's').replace(/ż/g, 'z').replace(/ź/g, 'z');
}

// Month stems (diacritics stripped) that match both the nominative and the
// "za <miesiąc>" genitive form: styczeń/stycznia, wrzesień/września, grudzień/grudnia…
const MONTH_STEMS = ['stycz', 'lut', 'mar', 'kwie', 'maj', 'czerw', 'lip', 'sierp', 'wrzes', 'pazdz', 'listop', 'grud'];

function monthIndexFromText(text: string): number {
  const t = dePl(text);
  // Only trust a month name that follows "za " (…WYPŁATA ZA KWIECIEŃ / Wypłata za
  // maj). A bare stem match false-fired on employer names — e.g. "MARKETING
  // INVESTMENT GROUP" contains "mar" (marzec) and mis-assigned the paycheck to March.
  for (let i = 0; i < MONTH_STEMS.length; i++) {
    if (new RegExp(`za\\s+${MONTH_STEMS[i]}`).test(t)) return i;
  }
  return -1;
}

const pad = (n: number) => String(n).padStart(2, '0');

// The YYYY-MM a paycheck is FOR. Preferred source: the title "[JD] WYPŁATA ZA
// <miesiąc>". Fallback: salaries are paid in arrears, so a paycheck dated month M
// is for month M-1.
export function paycheckTargetMonth(e: { note?: string; date: string }): string {
  const [y, m] = e.date.slice(0, 10).split('-').map(Number);
  const mi = monthIndexFromText(e.note ?? '');
  if (mi >= 0) {
    // pick the year so the named month is on-or-before the paycheck's month
    // (a January paycheck "za grudzień" belongs to the previous year)
    const year = mi > (m - 1) ? y - 1 : y;
    return `${year}-${pad(mi + 1)}`;
  }
  const d = new Date(y, m - 2, 1); // month before the paycheck date
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
