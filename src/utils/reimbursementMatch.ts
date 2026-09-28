import AsyncStorage from '@react-native-async-storage/async-storage';
import { Expense } from '@/types';

// Auto-dopasowanie zwrotu (2026-09-28, user zaakceptował pomysł — konkretny przykład:
// "dziewczyna oddaje mi część za zakupy, np. przelewa 50 zł za zakupy za 116,69 zł").
// Dziś przychodzący przelew (np. od partnerki, albo zwrot ze sklepu za oddany towar)
// księguje się jako zwykły, oderwany przychód (`commitBankTx`'s `direction === 'in'`
// gałąź) — appka nie próbuje go powiązać z wcześniejszym wydatkiem, który realnie
// rozlicza. Ten plik szuka najlepszego kandydata (wcześniejszy WYDATEK, nie w pełni
// jeszcze zwrócony, w rozsądnym oknie czasowym, kwota nie większa niż to co zostało do
// zwrotu) — dashboard potem pyta, czy połączyć. Świadomie NIE wymaga dopasowania po
// nadawcy/sklepie: dla jednego użytkownika + jednej bliskiej osoby fałszywe trafienie
// jest mało prawdopodobne, a wymaganie identyczności nazwy nadawcy z paragonem
// ("Zabka" vs imię i nazwisko partnerki) w ogóle nie miałoby czego dopasować.

const MS_DAY = 86400000;
const WINDOW_DAYS = 14;      // zwrot musi przyjść w ciągu 14 dni od zakupu
const MIN_AMOUNT = 5;        // ignoruj drobne przelewy (nie każdy BLIK to zwrot za zakupy)
const TOLERANCE = 0.5;       // zł — zaokrąglenia

export interface ReimbursementCandidate {
  expense: Expense;
  remaining: number; // ile jeszcze nie było zwrócone PRZED tym przelewem
}

// Only 'expense' (or legacy undefined-type) entries — nigdy income, nigdy self-transfer.
function isExpenseLike(e: Expense): boolean {
  return !e.type || e.type === 'expense';
}

export function findReimbursementCandidate(
  incoming: { amount: number; dateISO: string },
  expenses: Expense[],
): ReimbursementCandidate | null {
  if (incoming.amount < MIN_AMOUNT) return null;
  const txTime = new Date(incoming.dateISO).getTime();
  if (!txTime) return null;

  let best: { c: ReimbursementCandidate; score: number } | null = null;
  for (const e of expenses) {
    if (!isExpenseLike(e)) continue;
    const et = new Date(e.date ?? '').getTime();
    if (!et || et > txTime) continue;                    // zwrot przychodzi PO zakupie
    const ageDays = (txTime - et) / MS_DAY;
    if (ageDays > WINDOW_DAYS) continue;
    const remaining = e.amount - (e.reimbursedAmount ?? 0);
    if (remaining <= 0.01) continue;                      // już w pełni zwrócone
    if (incoming.amount > remaining + TOLERANCE) continue; // nie można zwrócić więcej niż zostało
    const score = 1000 - ageDays * 10 - Math.abs(remaining - incoming.amount);
    if (!best || score > best.score) best = { c: { expense: e, remaining }, score };
  }
  return best?.c ?? null;
}

// ── Pending "to zwrot za ten zakup?" confirmations (surfaced on dashboardzie) ──
// Ten sam wzorzec co `pending_sub_confirm` w subscriptionAuto.ts — osobna kolejka, bo to
// inna domena (expenseId, nie subId), ale identyczny kształt (load/queue z dedupem/remove).
const CONFIRM_KEY = 'pending_reimbursement_confirm';

export interface PendingReimbursement {
  id: string;
  expenseId: string;
  expenseNote: string;
  expenseAmount: number;
  expenseDate: string;   // YYYY-MM-DD
  incomingAmount: number;
  currency: string;
  sender: string;
  date: string;          // YYYY-MM-DD — dzień przelewu
}

export async function loadReimbursementConfirms(): Promise<PendingReimbursement[]> {
  try { const raw = await AsyncStorage.getItem(CONFIRM_KEY); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
}

export async function queueReimbursementConfirm(c: Omit<PendingReimbursement, 'id'>): Promise<void> {
  try {
    const list = await loadReimbursementConfirms();
    // de-dupe: jeden pending wpis per wydatek per dzień przelewu (re-drain notyfikacji nie zdubluje)
    if (list.some(x => x.expenseId === c.expenseId && x.date.slice(0, 10) === c.date.slice(0, 10))) return;
    list.push({ ...c, id: `${c.expenseId}:${Date.now()}` });
    await AsyncStorage.setItem(CONFIRM_KEY, JSON.stringify(list.slice(-10)));
  } catch {}
}

export async function removeReimbursementConfirm(id: string): Promise<void> {
  try {
    const list = (await loadReimbursementConfirms()).filter(x => x.id !== id);
    await AsyncStorage.setItem(CONFIRM_KEY, JSON.stringify(list));
  } catch {}
}
