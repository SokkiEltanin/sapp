import { normalizeSearch, filterSections } from '@/utils/settingsSearch';
import { SettingsSectionDef } from '@/types/settings';

describe('settingsSearch — normalizeSearch', () => {
  test('lowercases and strips Polish diacritics', () => {
    expect(normalizeSearch('Wypłata')).toBe('wyplata');
    expect(normalizeSearch('GODZINY ŚMIECHU')).toBe('godziny smiechu');
  });
  test('collapses punctuation/whitespace to single spaces', () => {
    expect(normalizeSearch('  zł/h,  prefiks  ')).toBe('zl h prefiks');
  });
});

const dummyIcon = (() => null) as any;

function makeSections(): SettingsSectionDef[] {
  return [
    {
      id: 'praca', title: 'Praca', icon: dummyIcon, color: '#60A5FA',
      keywords: ['zmiana', 'kalendarz', '[JD]'],
      items: [
        { id: 'work-prefix', title: 'Prefix eventów pracy', keywords: ['prefiks', 'stawka'], control: { kind: 'none' } },
        { id: 'work-hours', title: 'Godziny — miesiąc liczony', keywords: ['ręcznie', 'nadpisz'], control: { kind: 'none' } },
      ],
    },
    {
      id: 'bank', title: 'Auto-wydatki z banku', icon: dummyIcon, color: '#2AC68F',
      keywords: ['pekao', 'peopay', 'powiadomienia', 'notification listener'],
      items: [
        { id: 'bank-enable', title: 'Czytaj powiadomienia o płatności', keywords: [], control: { kind: 'none' } },
      ],
    },
  ];
}

describe('settingsSearch — filterSections', () => {
  test('empty query shows every section with no item narrowing', () => {
    const res = filterSections(makeSections(), '');
    expect(res).toHaveLength(2);
    expect(res.every(r => r.matchedItemIds === null)).toBe(true);
  });

  test('query matching a section title/keyword shows the whole section', () => {
    const res = filterSections(makeSections(), 'pekao');
    expect(res).toHaveLength(1);
    expect(res[0].section.id).toBe('bank');
    expect(res[0].matchedItemIds).toBeNull();
  });

  test('query matching only an item keyword narrows to that item, drops other sections', () => {
    const res = filterSections(makeSections(), 'stawka');
    expect(res).toHaveLength(1);
    expect(res[0].section.id).toBe('praca');
    expect(res[0].matchedItemIds).toEqual(new Set(['work-prefix']));
  });

  test('diacritic-insensitive: "wyplata" style queries still match Polish text', () => {
    const res = filterSections(makeSections(), 'GODZINY');
    expect(res[0].section.id).toBe('praca');
    expect(res[0].matchedItemIds).toEqual(new Set(['work-hours']));
  });

  test('multi-word query is AND, not OR', () => {
    // "godziny" only lives on work-hours, "stawka" only on work-prefix — no
    // single item has both, so the AND query matches nothing.
    expect(filterSections(makeSections(), 'godziny stawka')).toHaveLength(0);
    expect(filterSections(makeSections(), 'prefiks stawka')).toHaveLength(1);
  });

  test('no match anywhere → empty result', () => {
    expect(filterSections(makeSections(), 'zupa pomidorowa')).toHaveLength(0);
  });
});
