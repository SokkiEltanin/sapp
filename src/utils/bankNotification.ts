// Parses a bank payment push notification into a structured transaction, and matches
// it to an already-scanned receipt (same amount, close in time, matching store) so the
// two don't double-count. Currently tuned for Bank Pekao S.A.
//
// Example Pekao body:
//   "Zapłacono kwotę 10,18 PLN karta *8743 dnia 03-07-2026 godz. 06:37:30
//    w LIDL HETMANSKA LIDL HETMANSKA Rzeszow POL. Bank Pekao S.A."

export interface ParsedBankTx {
  amount: number;        // 10.18
  currency: string;      // 'PLN' | 'EUR' | 'USD' … (foreign-card payments abroad)
  dateISO: string;       // 2026-07-03T06:37:30 (local)
  store: string;         // outgoing: merchant ("LIDL HETMANSKA"); incoming: sender/title
  storeKey: string;      // first word lowercased — for fuzzy matching / merchant memory
  method: 'card' | 'blik' | 'transfer' | 'cash';
  direction: 'out' | 'in'; // out = expense (payment), in = income (incoming transfer)
  isSalary?: boolean;    // incoming looks like a paycheck (wynagrodzenie / wypłata)
  raw: string;
}

// Bank app package names we listen to (Pekao PeoPay / Pekao24).
export const BANK_PACKAGES = ['pl.pekao24.peopay', 'eu.eleader.mobilebanking.pekao', 'pl.pkobp.iko'];

const num = (s: string) => parseFloat(s.replace(/\s/g, '').replace(',', '.'));

export function parseBankNotification(title: string, text: string): ParsedBankTx | null {
  const body = `${title ?? ''} ${text ?? ''}`.replace(/\s+/g, ' ').trim();
  if (!body) return null;

  // Amount + currency: "kwotę 10,18 PLN" / "22,14 EUR" (payments abroad aren't PLN).
  const CUR = 'PLN|zł|z\\u0142|EUR|USD|GBP|CHF|CZK|SEK|NOK|DKK|HUF';
  const amtM = body.match(new RegExp(`kwot[ęe]\\s+([\\d\\s]+[.,]\\d{2})\\s*(${CUR})`, 'i'))
    ?? body.match(new RegExp(`([\\d\\s]+[.,]\\d{2})\\s*(${CUR})`, 'i'));
  if (!amtM) return null;
  const amount = num(amtM[1]);
  if (!(amount > 0)) return null;
  const currency = /z[łl]/i.test(amtM[2]) ? 'PLN' : amtM[2].toUpperCase();

  // Incoming (money IN) vs outgoing (money OUT). Incoming = a credit / transfer in;
  // outgoing = a card payment / purchase. If neither is recognised, skip the push.
  const inTrig = /przelew\s+przychodz|uznanie\s+rachunku|wp[łl]yn[ęęąe][łl]|wp[łl]yn[ęe][łl]o|wynagrodzen|zasilenie|otrzyma[łl]e[śs]|zaksi[ęe]gowano\s+wp[łl]at|\bwp[łl]ata\b|na\s+rachunek/i.test(body);
  const paidOut = /zap[łl]acono/i.test(body);
  const outTrig = /zap[łl]acono|transakcj|p[łl]atno[śs][cć]|platnosc|blik|zakup/i.test(body);
  if (!inTrig && !outTrig) return null;
  const direction: 'in' | 'out' = (inTrig && !paidOut) ? 'in' : 'out';

  // Date + time: "dnia 03-07-2026 godz. 06:37:30" (fallback: now)
  let dateISO = new Date().toISOString().slice(0, 19);
  const dtM = body.match(/(\d{2})-(\d{2})-(\d{4}).*?(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (dtM) {
    const [, dd, mm, yyyy, hh, mi, ss] = dtM;
    dateISO = `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss ?? '00'}`;
  }

  // ── Incoming transfer → income ──────────────────────────────────────────────
  if (direction === 'in') {
    const isSalary = /wynagrodzen|wyp[łl]at|pensj|sal(?:ary|ariu)/i.test(body);
    // Sender/title: after "od"/"nadawca:"/"tytuł:" up to the next section marker.
    const senderM = body.match(/(?:nadawca:?|\bod\s+nadawcy:?|\bod:)\s*(.+?)(?:\s*(?:tytu[łl]|tyt\.?|kwot|dnia|nr\b|rachun|\.\s*Bank|$))/i)
      ?? body.match(/\bod\s+([A-ZŁŚŻĆŃÓĄĘ][^.,;]+?)(?:\s*(?:tytu[łl]|tyt\.?|kwot|dnia|nr\b|rachun|\.\s*Bank|$))/);
    const titleM = body.match(/tytu[łl][:\s]+(.+?)(?:\s*(?:dnia|nr\b|kwot|rachun|\.\s*Bank|$))/i);
    let store = (senderM?.[1] ?? titleM?.[1] ?? (isSalary ? 'Wynagrodzenie' : 'Przelew')).replace(/\s+/g, ' ').trim();
    if (store.length > 40) store = store.slice(0, 40).trim();
    const storeKey = (store.split(/\s+/)[0] ?? 'przelew').toLowerCase();
    return { amount, currency, dateISO, store, storeKey, method: 'transfer', direction, isSalary, raw: body };
  }

  // ── Outgoing payment → expense ──────────────────────────────────────────────
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
      .replace(/[\s\-–—.,;:*]+$/, '')   // trailing punctuation ("NÚVEI GLOBAL SERVICES-")
      .replace(/^[\s\-–—.,;:*]+/, '')
      .trim();
  }
  const storeKey = (store.split(/\s+/)[0] ?? '').toLowerCase();

  const method: ParsedBankTx['method'] = /blik/i.test(body) ? 'blik'
    : /przelew/i.test(body) ? 'transfer'
    : /karta|kart[aąy]/i.test(body) ? 'card' : 'card';

  return { amount, currency, dateISO, store, storeKey, method, direction: 'out', raw: body };
}

// Match an incoming transfer to income already logged (same amount, same day) so a
// paycheck you entered by hand isn't duplicated by the auto-capture.
export function findMatchingIncome(tx: ParsedBankTx, expenses: MatchExpense[], windowMin = 1440): MatchExpense | null {
  const txTime = new Date(tx.dateISO).getTime();
  for (const e of expenses) {
    if (e.type !== 'income' || e.bankMatched) continue;
    if (Math.abs(e.amount - tx.amount) > 0.011) continue;
    const et = new Date(e.date ?? '').getTime();
    if (!et) continue;
    if (sameLocalDay(et, txTime) || Math.abs(et - txTime) / 60000 <= windowMin) return e;
  }
  return null;
}

// ── Match a parsed bank tx to an existing (scanned) expense ──────────────────
// Same amount (±1 gr), within `windowMin` minutes, store name related. Returns the
// best candidate expense id or null (→ create a fresh expense from the notification).
export interface MatchExpense { id: string; type?: string; amount: number; date?: string; storeName?: string; note?: string; bankMatched?: boolean }

export function sameLocalDay(a: number, b: number): boolean {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

export function findMatchingExpense(tx: ParsedBankTx, expenses: MatchExpense[], windowMin = 150): MatchExpense | null {
  const txTime = new Date(tx.dateISO).getTime();
  let best: { e: MatchExpense; score: number } | null = null;
  for (const e of expenses) {
    if (e.type === 'income' || e.bankMatched) continue;
    if (Math.abs(e.amount - tx.amount) > 0.011) continue;               // amount must match
    const et = new Date(e.date ?? '').getTime();
    if (!et) continue;
    const diffMin = Math.abs(et - txTime) / 60000;
    const hay = `${e.storeName ?? ''} ${e.note ?? ''}`.toLowerCase();
    const storeOk = !tx.storeKey || hay.includes(tx.storeKey) || tx.storeKey.includes((e.storeName ?? '').toLowerCase().split(/\s+/)[0] ?? '');
    const sameDay = sameLocalDay(et, txTime);
    // Normally require the payment within `windowMin`. But a SCANNED receipt is
    // stored at noon (OCR gives no clock time) while the bank push carries the real
    // time, so they can be hours apart. When the store also matches and it's the same
    // calendar day, exact-amount + same-store is certainly the same purchase — widen
    // the window to the whole day so the receipt and the notification don't double up.
    if (diffMin > windowMin && !(storeOk && sameDay)) continue;
    const score = (storeOk ? 100 : 0) + (sameDay ? 50 : 0) - diffMin;   // prefer store + same day, then closest
    if (!best || score > best.score) best = { e, score };
  }
  return best ? best.e : null;
}
