import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { throttledPersistStorage } from '@/utils/throttledStorage';
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
//
// ROZSZERZONE (2026-09-08, user: "chce miec opcje do słownego polaczenia tego że
// subskrypcja oraz np że to jest wyplata i zeby targował automatycznie lub że za prąd bo
// tam nie mam takich tagow wgle. I zeby mogc edytowac te szablony") — trzy braki z
// pierwszej wersji: (1) szablon mógł oznaczyć TYLKO wydatek (kategoria), nie przychód —
// `kind` rozróżnia teraz `'expense'` (jak dotąd) od `'income'` (nadawca = wypłata/pensja,
// dopasowywane w gałęzi PRZYCHODZĄCEJ w bankIngest.ts, nie wydatkowej); (2) formularz w
// Ustawieniach nigdy nie pytał o `tags` mimo że store je od początku wspierał — teraz jest
// pole tekstowe; (3) `updateRule` — edycja istniejącego szablonu w miejscu, nie tylko
// dodaj/usuń. `kind` może brakować na już zapisanych (starszych) szablonach — traktowany
// wtedy jak `'expense'` (jedyny rodzaj jaki wcześniej istniał), patrz `ruleKind()` niżej.
export type BankRuleKind = 'expense' | 'income';

export interface BankRule {
  id: string;
  pattern: string;        // lowercased substring — dopasowywane do nazwy sklepu + surowego tekstu powiadomienia
  name: string;           // nazwa do pokazania zamiast surowego tekstu z banku (np. "Subskrypcja Claude")
  kind: BankRuleKind;
  category?: ExpenseCategory; // tylko dla kind='expense'
  tags?: string[];
  createdAt: string;
}

// Starsze zapisane szablony (sprzed `kind`) nie mają tego pola — jedyny rodzaj jaki wtedy
// istniał to dzisiejsze 'expense'.
export function ruleKind(r: BankRule): BankRuleKind { return r.kind ?? 'expense'; }

interface BankRuleInput {
  pattern: string;
  name: string;
  kind: BankRuleKind;
  category?: ExpenseCategory;
  tags?: string[];
}

interface BankRulesState {
  rules: BankRule[];
  addRule: (r: BankRuleInput) => void;
  updateRule: (id: string, patch: Partial<BankRuleInput>) => void;
  removeRule: (id: string) => void;
}

const cleanTags = (tags?: string[]) => {
  const t = (tags ?? []).map(x => x.trim().toLowerCase()).filter(Boolean);
  return t.length ? Array.from(new Set(t)) : undefined;
};

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
          kind: r.kind,
          ...(r.kind === 'expense' ? { category: r.category ?? 'other' } : {}),
          ...(cleanTags(r.tags) ? { tags: cleanTags(r.tags) } : {}),
          createdAt: new Date().toISOString(),
        };
        set({ rules: [rule, ...get().rules] });
      },
      updateRule: (id, patch) => set((s) => ({
        rules: s.rules.map(r => {
          if (r.id !== id) return r;
          const kind = patch.kind ?? ruleKind(r);
          return {
            ...r,
            ...(patch.pattern !== undefined ? { pattern: patch.pattern.trim().toLowerCase() || r.pattern } : {}),
            ...(patch.name !== undefined ? { name: patch.name.trim() || r.name } : {}),
            kind,
            category: kind === 'expense' ? (patch.category ?? r.category ?? 'other') : undefined,
            tags: patch.tags !== undefined ? cleanTags(patch.tags) : r.tags,
          };
        }),
      })),
      removeRule: (id) => set((s) => ({ rules: s.rules.filter(r => r.id !== id) })),
    }),
    { name: 'bank-rules-v1', storage: throttledPersistStorage() },
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
