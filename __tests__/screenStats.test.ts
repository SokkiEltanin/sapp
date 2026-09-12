import { screenInfoFor } from '@/utils/screenStats';

describe('screenStats — screenInfoFor', () => {
  test('dashboard (pusty pathname) i znane top-level ekrany', () => {
    expect(screenInfoFor('/')).toEqual({ id: '/', label: 'Dashboard' });
    expect(screenInfoFor('/tasks')).toEqual({ id: '/tasks', label: 'Zadania' });
    expect(screenInfoFor('/finances')).toEqual({ id: '/finances', label: 'Finanse' });
  });

  test('nieznany segment dostaje fallback (capitalize, myślnik→spacja)', () => {
    expect(screenInfoFor('/nowy-ekran')).toEqual({ id: '/nowy-ekran', label: 'Nowy Ekran' });
  });

  test('zwija długi alfanumeryczny (Firestore-style) id do :id', () => {
    const r = screenInfoFor('/expenses/AbCdEfGhIjKlMnOpQrSt');
    expect(r?.id).toBe('/expenses/:id');
    expect(r?.label).toBe('Wydatki — szczegóły');
  });

  test('zwija czysto liczbowy (Date.now()-owy) id do :id', () => {
    const r = screenInfoFor('/counters/1736531200123');
    expect(r?.id).toBe('/counters/:id');
  });

  test('NIE zwija krótkiego, nazwanego podsegmentu (scan/manual/add)', () => {
    expect(screenInfoFor('/expenses/scan')).toEqual({ id: '/expenses/scan', label: 'Wydatki — skan' });
    expect(screenInfoFor('/expenses/manual')).toEqual({ id: '/expenses/manual', label: 'Wydatki — ręcznie' });
  });

  test('ignoruje query string przy budowaniu id', () => {
    const r = screenInfoFor('/notes?noteId=abc123');
    expect(r?.id).toBe('/notes');
  });
});
