import { isMine, inScope, countsForConsumption, itemInScope, consumesInScope, MY_PAYER } from '@/store/statsScope';

describe('statsScope — isMine / inScope (kto ZAPŁACIŁ)', () => {
  test('brak payera (stare wpisy) liczy się jako moje', () => {
    expect(isMine({})).toBe(true);
  });
  test('payer = "Ja" → moje; inny payer → nie moje', () => {
    expect(isMine({ payer: MY_PAYER })).toBe(true);
    expect(isMine({ payer: 'Partnerka' })).toBe(false);
  });
  test('scope "all" ignoruje payera; scope "mine" deleguje do isMine', () => {
    expect(inScope({ payer: 'Partnerka' }, 'all')).toBe(true);
    expect(inScope({ payer: 'Partnerka' }, 'mine')).toBe(false);
    expect(inScope({ payer: MY_PAYER }, 'mine')).toBe(true);
  });
});

describe('statsScope — countsForConsumption (czy w ogóle liczyć do spożycia)', () => {
  test('zwykła pozycja liczy się', () => {
    expect(countsForConsumption({})).toBe(true);
  });
  test('wykluczona pozycja lub depozyt NIE liczy się (nadal jest wydatkiem, nie jedzeniem)', () => {
    expect(countsForConsumption({ excluded: true })).toBe(false);
    expect(countsForConsumption({ kind: 'deposit' })).toBe(false);
  });
});

describe('statsScope — itemInScope (kto ZJADŁ, niezależne od kto zapłacił)', () => {
  test('scope "all" → zawsze true, niezależnie od eaters', () => {
    expect(itemInScope({ eaters: ['Partnerka'] }, 'all')).toBe(true);
  });
  test('scope "mine": brak eaters (nieotagowane/wspólne) liczy się jako moje domyślnie', () => {
    expect(itemInScope({}, 'mine')).toBe(true);
    expect(itemInScope({ eaters: [] }, 'mine')).toBe(true);
  });
  test('scope "mine": otagowane WYŁĄCZNIE dla kogoś innego → nie moje', () => {
    expect(itemInScope({ eaters: ['Partnerka'] }, 'mine')).toBe(false);
  });
  test('scope "mine": otagowane współdzielone (ja + ktoś) → nadal moje', () => {
    expect(itemInScope({ eaters: [MY_PAYER, 'Partnerka'] }, 'mine')).toBe(true);
  });
});

describe('statsScope — consumesInScope (predykat używany przez estimateItemKcal itp.)', () => {
  test('zwykła pozycja w zasięgu → true', () => {
    expect(consumesInScope({}, 'mine')).toBe(true);
  });
  test('wykluczenie WYGRYWA nawet jeśli jestem w eaters (excluded nadrzędny nad itemInScope)', () => {
    expect(consumesInScope({ excluded: true, eaters: [MY_PAYER] }, 'mine')).toBe(false);
  });
  test('depozyt nigdy nie liczy się do spożycia, niezależnie od scope', () => {
    expect(consumesInScope({ kind: 'deposit' }, 'all')).toBe(false);
  });
  test('pozycja zjedzona wyłącznie przez kogoś innego → poza scope "mine"', () => {
    expect(consumesInScope({ eaters: ['Partnerka'] }, 'mine')).toBe(false);
    expect(consumesInScope({ eaters: ['Partnerka'] }, 'all')).toBe(true);
  });
});
