import { useBankRules, matchBankRule } from '@/store/bankRulesStore';
import { parseBankNotification } from '@/utils/bankNotification';
import { ingestBankNotification } from '@/services/bankIngest';
import { useBankQueue } from '@/store/bankQueueStore';

// 2026-09-08 — user przesłał realną obcowalutową płatność subskrypcji ("Zapłacono kwotę
// 22,14 EUR ... w ANTHROPIC* CLAUDE SUB ...") i poprosił o możliwość z góry nauczenia apki
// (Ustawienia → Auto-wydatki z banku → Szablony powiadomień), tak samo dla PGE/przejazdów —
// zamiast czekać, aż pierwsza płatność wyląduje ze zgadniętą (często złą) kategorią.
const CLAUDE_EUR = 'Zapłacono kwotę 22,14 EUR kartą *8743 dnia 07-09-2026 godz. 02:03:56 w ANTHROPIC* CLAUDE SUB ANTHROPIC* CLAUDE SUB DUBLIN 4 IRL. Bank Pekao S.A.';

describe('matchBankRule', () => {
  beforeEach(() => { useBankRules.setState({ rules: [] }); });

  test('dopasowuje regułę po fragmencie obecnym w surowym tekście powiadomienia', () => {
    useBankRules.getState().addRule({ pattern: 'anthropic', name: 'Subskrypcja Claude', category: 'subscriptions' });
    const tx = parseBankNotification('Pekao', CLAUDE_EUR)!;
    const rule = matchBankRule(tx.store, tx.raw, useBankRules.getState().rules);
    expect(rule?.name).toBe('Subskrypcja Claude');
    expect(rule?.category).toBe('subscriptions');
  });

  test('nie dopasowuje, gdy fragment nigdzie nie występuje', () => {
    useBankRules.getState().addRule({ pattern: 'pge', name: 'Prąd', category: 'housing' });
    const tx = parseBankNotification('Pekao', CLAUDE_EUR)!;
    expect(matchBankRule(tx.store, tx.raw, useBankRules.getState().rules)).toBeUndefined();
  });

  test('pattern jest normalizowany do małych liter przy zapisie', () => {
    useBankRules.getState().addRule({ pattern: 'ANTHROPIC', name: 'Claude', category: 'subscriptions' });
    expect(useBankRules.getState().rules[0].pattern).toBe('anthropic');
  });

  test('pusty pattern nie jest zapisywany', () => {
    useBankRules.getState().addRule({ pattern: '   ', name: 'Coś', category: 'other' });
    expect(useBankRules.getState().rules).toHaveLength(0);
  });

  test('removeRule usuwa dokładnie jedną regułę po id', () => {
    useBankRules.getState().addRule({ pattern: 'pge', name: 'Prąd', category: 'housing' });
    useBankRules.getState().addRule({ pattern: 'mpk', name: 'Bilet MPK', category: 'transport' });
    const [first] = useBankRules.getState().rules;
    useBankRules.getState().removeRule(first.id);
    expect(useBankRules.getState().rules).toHaveLength(1);
    expect(useBankRules.getState().rules[0].pattern).toBe('pge');
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
    useBankRules.getState().addRule({ pattern: 'anthropic', name: 'Subskrypcja Claude', category: 'subscriptions' });
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
