import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { throttledAsyncStorage } from '@/utils/throttledStorage';
import { ExpenseCategory } from '@/types';

// User-defined recognition templates for bank notifications (2026-09-08, user: "kiedyś
// robiliśmy jak łapanie z powiadomien z banku że jak wykryje to to zeby mnie zapytało o
// subskrypcję claudie... zeby dodac co jest wyplata co subskrypcję jaka itp zeby jak
// wykryje zeby łapało dobrze"). Bez tego pierwsza płatność od nowego nadawcy (Anthropic/
// Claude, PGE, bilet komunikacji…) zawsze domyślnie zgaduje kategorię ze sztywnego
// słownika w `merchantMemory.ts` (`STORE_CAT`, nie zna "anthropic"/"pge" itp.) i trzeba ją
// ręcznie poprawić RAZ w `bank-review.tsx`, dopiero potem `merchantMemory` się tego uczy.
// Ten store pozwala user'owi wkleić przykładowe powiadomienie z wyprzedzeniem i z góry
// zadeklarować kategorię/nazwę/tagi — patrz `matchBankRule`, wpięte w `bankIngest.ts`
// PRZED sztywnym `guessCategory()` (ale PO już nauczonym `merchantMemory`, które zostaje
// najbardziej wiarygodne, bo pochodzi z realnie zaakceptowanej płatności).
export interface BankRule {
  id: string;
  pattern: string;        // lowercased substring — dopasowywane do nazwy sklepu + surowego tekstu powiadomienia
  name: string;           // nazwa do pokazania zamiast surowego tekstu z banku (np. "Subskrypcja Claude")
  category: ExpenseCategory;
  tags?: string[];
  createdAt: string;
}

interface BankRulesState {
  rules: BankRule[];
  addRule: (r: { pattern: string; name: string; category: ExpenseCategory; tags?: string[] }) => void;
  removeRule: (id: string) => void;
}

export const useBankRules = create<BankRulesState>()(
  persist(
    (set, get) => ({
      rules: [],
      addRule: (r) => {
        const pattern = r.pattern.trim().toLowerCase();
        if (!pattern) return;
        const rule: BankRule = {
          id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          pattern,
          name: r.name.trim() || pattern,
          category: r.category,
          ...(r.tags?.length ? { tags: r.tags } : {}),
          createdAt: new Date().toISOString(),
        };
        set({ rules: [rule, ...get().rules] });
      },
      removeRule: (id) => set((s) => ({ rules: s.rules.filter(r => r.id !== id) })),
    }),
    { name: 'bank-rules-v1', storage: createJSONStorage(() => throttledAsyncStorage()) },
  ),
);

// Case-insensitive substring match against the parsed store name AND the raw notification
// text — a pasted template might only recognisably appear in the free-text body (e.g.
// "ANTHROPIC* CLAUDE SUB"), so checking both means a slightly different extracted `store`
// next time (word order, stray punctuation) doesn't silently miss the match.
export function matchBankRule(store: string, raw: string, rules: BankRule[]): BankRule | undefined {
  const hay = `${store} ${raw}`.toLowerCase();
  return rules.find(r => r.pattern && hay.includes(r.pattern));
}
