// Parses a bank payment push notification into a structured transaction, and matches
// it to an already-scanned receipt (same amount, close in time, matching store) so the
// two don't double-count. Currently tuned for Bank Pekao S.A.
//
// Example Pekao body:
//   "Zapłacono kwotę 10,18 PLN karta *8743 dnia 03-07-2026 godz. 06:37:30
//    w LIDL HETMANSKA LIDL HETMANSKA Rzeszow POL. Bank Pekao S.A."

export interface ParsedBankTx {
  amount: number;        // 10.18
  dateISO: string;       // 2026-07-03T06:37:30 (local)
  store: string;         // "LIDL HETMANSKA Rzeszow" (cleaned)
  storeKey: string;      // "lidl" — first word, for fuzzy matching
  method: 'card' | 'blik' | 'transfer' | 'cash';
  raw: string;
}

// Bank app package names we listen to (Pekao PeoPay / Pekao24).
export const BANK_PACKAGES = ['pl.pekao24.peopay', 'eu.eleader.mobilebanking.pekao', 'pl.pkobp.iko'];

const num = (s: string) => parseFloat(s.replace(/\s/g, '').replace(',', '.'));

export function parseBankNotification(title: string, text: string): ParsedBankTx | null {
  const body = `${title ?? ''} ${text ?? ''}`.replace(/\s+/g, ' ').trim();
  if (!body) return null;

  // Amount: "kwotę 10,18 PLN" (fallback: first "NN,NN PLN/zł")
  const amtM = body.match(/kwot[ęe]\s+([\d\s]+[.,]\d{2})\s*(?:PLN|zł)/i)
    ?? body.match(/([\d\s]+[.,]\d{2})\s*(?:PLN|zł)/i);
  if (!amtM) return null;
  const amount = num(amtM[1]);
  if (!(amount > 0)) return null;

  // Only payment/purchase notifications — skip balance/info pushes.
  if (!/zapłacono|transakcj|płatność|platnosc|blik|zakup/i.test(body)) return null;

  // Date + time: "dnia 03-07-2026 godz. 06:37:30"
  let dateISO = new Date().toISOString().slice(0, 19);
  const dtM = body.match(/(\d{2})-(\d{2})-(\d{4}).*?(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (dtM) {
    const [, dd, mm, yyyy, hh, mi, ss] = dtM;
    dateISO = `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss ?? '00'}`;
  }

  // Store: text after " w " up to " POL" / ". Bank" / end.
  let store = '';
  const stM = body.match(/\bw\s+(.+?)(?:\s+POL\b|\.\s*Bank|\.\s*$|$)/i);
  if (stM) {
    // Pekao repeats the merchant ("LIDL HETMANSKA LIDL HETMANSKA Rzeszow") — dedupe words
    // (keep first occurrence, preserve order) and drop obvious noise.
    const seen = new Set<string>();
    store = stM[1].split(/\s+/)
      .filter(w => { const k = w.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return w.length > 1; })
      .join(' ')
      .replace(/\s*(POL|POLSKA)\s*$/i, '')
      .trim();
  }
  const storeKey = (store.split(/\s+/)[0] ?? '').toLowerCase();

  const method: ParsedBankTx['method'] = /blik/i.test(body) ? 'blik'
    : /przelew/i.test(body) ? 'transfer'
    : /karta|kart[aąy]/i.test(body) ? 'card' : 'card';

  return { amount, dateISO, store, storeKey, method, raw: body };
}

// ── Match a parsed bank tx to an existing (scanned) expense ──────────────────
// Same amount (±1 gr), within `windowMin` minutes, store name related. Returns the
// best candidate expense id or null (→ create a fresh expense from the notification).
export interface MatchExpense { id: string; type?: string; amount: number; date?: string; storeName?: string; note?: string; bankMatched?: boolean }

export function findMatchingExpense(tx: ParsedBankTx, expenses: MatchExpense[], windowMin = 150): MatchExpense | null {
  const txTime = new Date(tx.dateISO).getTime();
  let best: { e: MatchExpense; score: number } | null = null;
  for (const e of expenses) {
    if (e.type === 'income' || e.bankMatched) continue;
    if (Math.abs(e.amount - tx.amount) > 0.011) continue;               // amount must match
    const et = new Date(e.date ?? '').getTime();
    if (!et) continue;
    const diffMin = Math.abs(et - txTime) / 60000;
    if (diffMin > windowMin) continue;                                  // within the time window
    const hay = `${e.storeName ?? ''} ${e.note ?? ''}`.toLowerCase();
    const storeOk = !tx.storeKey || hay.includes(tx.storeKey) || tx.storeKey.includes((e.storeName ?? '').toLowerCase().split(/\s+/)[0] ?? '');
    const score = (storeOk ? 100 : 0) - diffMin;                        // prefer store match, then closest in time
    if (!best || score > best.score) best = { e, score };
  }
  return best ? best.e : null;
}
