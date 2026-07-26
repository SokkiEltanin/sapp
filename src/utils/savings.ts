import { Expense } from '@/types';

// Money saved on receipts — the discount lines the parser already detects (RABAT /
// LIDL PLUS / KUPON / BON / app coupons → ReceiptItem.discount). We just sum them.
// Lidl is called out separately because Lidl Plus coupons are the ones that reliably
// land on the receipt (other shops rarely print the coupon breakdown).
export interface SavingsStat {
  total: number;      // all detected discounts, zł
  thisMonth: number;
  lidlTotal: number;
  count: number;      // number of discounted line-items
}

export function computeSavings(expenses: Expense[], now: Date = new Date()): SavingsStat {
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  let total = 0, thisMonth = 0, lidlTotal = 0, count = 0;
  for (const e of expenses) {
    if (e.type === 'income') continue;
    const isLidl = /lidl/i.test(e.storeName ?? '');
    const inMonth = (e.date ?? '').slice(0, 7) === ym;
    for (const it of (e.receiptItems ?? [])) {
      const d = it.discount ?? 0;
      if (!(d > 0)) continue;
      total += d; count++;
      if (isLidl) lidlTotal += d;
      if (inMonth) thisMonth += d;
    }
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return { total: r2(total), thisMonth: r2(thisMonth), lidlTotal: r2(lidlTotal), count };
}
