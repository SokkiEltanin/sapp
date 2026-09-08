import { useBankRules, matchBankRule, ruleKind } from '@/store/bankRulesStore';
import { parseBankNotification } from '@/utils/bankNotification';
import { ingestBankNotification } from '@/services/bankIngest';
import { useBankQueue } from '@/store/bankQueueStore';

// 2026-09-08 — user przesłał realną obcowalutową płatność subskrypcji ("Zapłacono kwotę
// 22,14 EUR ... w ANTHROPIC* CLAUDE SUB ...") i poprosił o możliwość z góry nauczenia apki
// (Ustawienia → Auto-wydatki z banku → Szablony powiadomień), tak samo dla PGE/przejazdów —
// zamiast czekać, aż pierwsza płatność wyląduje ze zgadniętą (często złą) kategorią.
const CLAUDE_EUR = 'Zapłacono kwotę 22,14 EUR kartą *8743 dnia 07-09-2026 godz. 02:03:56 w ANTHROPIC* CLAUDE SUB ANTHROPIC* CLAUDE SUB DUBLIN 4 IRL. Bank Pekao S.A.';
const SALARY_IN = 'Wpłynęło 4500,00 PLN na konto *6332 od PRACODAWCA SP ZOO. Bank Pekao S.A.';

describe('matchBankRule', () => {
  beforeEach(() => { useBankRules.setState({ rules: [] }); });

  test('dopasowuje regułę po fragmencie obecnym w surowym tekście powiadomienia', () => {
    useBankRules.getState().addRule({ pattern: 'anthropic', name: 'Subskrypcja Claude', kind: 'expense', category: 'subscriptions' });
    const tx = parseBankNotification('Pekao', CLAUDE_EUR)!;
    const rule = matchBankRule(tx.store, tx.raw, useBankRules.getState().rules);
    expect(rule?.name).toBe('Subskrypcja Claude');
    expect(rule?.category).toBe('subscriptions');
  });

  test('nie dopasowuje, gdy fragment nigdzie nie występuje', () => {
    useBankRules.getState().addRule({ pattern: 'pge', name: 'Prąd', kind: 'expense', category: 'housing' });
    const tx = parseBankNotification('Pekao', CLAUDE_EUR)!;
    expect(matchBankRule(tx.store, tx.raw, useBankRules.getState().rules)).toBeUndefined();
  });

  test('pattern jest normalizowany do małych liter przy zapisie', () => {
    useBankRules.getState().addRule({ pattern: 'ANTHROPIC', name: 'Claude', kind: 'expense', category: 'subscriptions' });
    expect(useBankRules.getState().rules[0].pattern).toBe('anthropic');
  });

  test('pusty pattern nie jest zapisywany', () => {
    useBankRules.getState().addRule({ pattern: '   ', name: 'Coś', kind: 'expense', category: 'other' });
    expect(useBankRules.getState().rules).toHaveLength(0);
  });

  test('removeRule usuwa dokładnie jedną regułę po id', () => {
    useBankRules.getState().addRule({ pattern: 'pge', name: 'Prąd', kind: 'expense', category: 'housing' });
    useBankRules.getState().addRule({ pattern: 'mpk', name: 'Bilet MPK', kind: 'expense', category: 'transport' });
    const [first] = useBankRules.getState().rules;
    useBankRules.getState().removeRule(first.id);
    expect(useBankRules.getState().rules).toHaveLength(1);
    expect(useBankRules.getState().rules[0].pattern).toBe('pge');
  });

  test('tagi są zapisywane, znormalizowane (małe litery, bez duplikatów/pustych)', () => {
    useBankRules.getState().addRule({ pattern: 'pge', name: 'Prąd', kind: 'expense', category: 'housing', tags: ['Prąd', 'PRĄD', '  ', 'elektryczność'] });
    expect(useBankRules.getState().rules[0].tags).toEqual(['prąd', 'elektryczność']);
  });
});

// 2026-09-08 — user: "chce miec opcje do słownego polaczenia tego że subskrypcja oraz np że
// to jest wyplata i zeby targował automatycznie... I zeby mocy edytowac te szablony".
describe('BankRule — rodzaj "income" (wypłata) + edycja w miejscu', () => {
  beforeEach(() => {
    useBankRules.setState({ rules: [] });
    useBankQueue.setState({ pending: [], enabled: true, autoAll: false });
  });

  test('szablon kind=income dopasowuje się, kind=expense (domyślny fallback na starych wpisach) też działa', () => {
    useBankRules.getState().addRule({ pattern: 'pracodawca', name: 'Wypłata', kind: 'income' });
    expect(ruleKind(useBankRules.getState().rules[0])).toBe('income');
    // starszy zapisany szablon bez pola `kind` w ogóle (dane sprzed tej zmiany)
    useBankRules.setState({ rules: [{ id: 'old', pattern: 'pge', name: 'Prąd', category: 'housing', createdAt: '' } as any] });
    expect(ruleKind(useBankRules.getState().rules[0])).toBe('expense');
  });

  test('dopasowany szablon income → jd=true i auto-księgowanie NAWET gdy autoAll=false', async () => {
    useBankRules.getState().addRule({ pattern: 'pracodawca', name: 'Wypłata z pracy', kind: 'income' });
    const ok = await ingestBankNotification('Pekao', SALARY_IN);
    expect(ok).toBe(true);
    const [tx] = useBankQueue.getState().pending;
    expect(tx.jd).toBe(true);
    expect(tx.auto).toBe(true);
    expect(tx.store).toBe('Wypłata z pracy');
  });

  test('szablon income NIE wpływa na kategoryzację wydatków (osobna pula od kind=expense)', async () => {
    useBankRules.getState().addRule({ pattern: 'anthropic', name: 'Coś przychodowego', kind: 'income' });
    const ok = await ingestBankNotification('Pekao', CLAUDE_EUR);
    expect(ok).toBe(true);
    const [tx] = useBankQueue.getState().pending;
    expect(tx.category).not.toBe('subscriptions');
    expect(tx.store).not.toBe('Coś przychodowego');
  });

  test('updateRule zmienia pattern/nazwę/kategorię/tagi istniejącego szablonu', () => {
    useBankRules.getState().addRule({ pattern: 'pge', name: 'Prąd', kind: 'expense', category: 'housing' });
    const id = useBankRules.getState().rules[0].id;
    useBankRules.getState().updateRule(id, { name: 'Prąd (Tauron)', tags: ['prąd', 'tauron'] });
    const updated = useBankRules.getState().rules[0];
    expect(updated.name).toBe('Prąd (Tauron)');
    expect(updated.tags).toEqual(['prąd', 'tauron']);
    expect(updated.pattern).toBe('pge'); // niezmienione pole zostaje
    expect(updated.category).toBe('housing'); // niezmienione pole zostaje
  });

  test('updateRule może przełączyć kind z expense na income (czyści category)', () => {
    useBankRules.getState().addRule({ pattern: 'pge', name: 'Prąd', kind: 'expense', category: 'housing' });
    const id = useBankRules.getState().rules[0].id;
    useBankRules.getState().updateRule(id, { kind: 'income' });
    const updated = useBankRules.getState().rules[0];
    expect(updated.kind).toBe('income');
    expect(updated.category).toBeUndefined();
  });
});

describe('ingestBankNotification — szablon zmienia kategorię pierwszej płatności', () => {
  beforeEach(() => {
    useBankRules.setState({ rules: [] });
    useBankQueue.setState({ pending: [], enabled: true, autoAll: false });
  });

  test('bez szablonu nowy nadawca "anthropic" zgaduje domyślnie (nie subskrypcje)', async () => {
    const ok = await ingestBankNotification('Pekao', CLAUDE_EUR);
    expect(ok).toBe(true);
    const [tx] = useBankQueue.getState().pending;
    expect(tx.category).not.toBe('subscriptions');
  });

  test('z zapisanym szablonem "anthropic" → od razu kategoria + nazwa z szablonu', async () => {
    useBankRules.getState().addRule({ pattern: 'anthropic', name: 'Subskrypcja Claude', kind: 'expense', category: 'subscriptions' });
    const ok = await ingestBankNotification('Pekao', CLAUDE_EUR);
    expect(ok).toBe(true);
    const [tx] = useBankQueue.getState().pending;
    expect(tx.category).toBe('subscriptions');
    expect(tx.suggestedCategory).toBe('subscriptions');
    expect(tx.store).toBe('Subskrypcja Claude');
    // Obca waluta (EUR) i tak wymaga ręcznego wpisania kwoty w PLN w bank-review —
    // szablon zmienia TYLKO kategorię/nazwę, nie omija tego bezpiecznika.
    expect(tx.currency).toBe('EUR');
  });
});
