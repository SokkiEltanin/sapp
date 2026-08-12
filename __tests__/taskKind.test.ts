import { resolveKind, inferKind, KIND_ORDER, KIND_META } from '@/utils/taskKind';

describe('taskKind — resolveKind', () => {
  test('brak kind (stare zadania) → czytane jako quick', () => {
    expect(resolveKind({})).toBe('quick');
  });
  test('jawnie ustawiony kind zostaje', () => {
    expect(resolveKind({ kind: 'deep' })).toBe('deep');
  });
});

describe('taskKind — inferKind (zgadywanie rodzaju z tytułu, priorytet: waiting > deep-po-słowie > deep-po-długości > quick)', () => {
  test('słowa kluczowe "czekania" → waiting', () => {
    expect(inferKind('Czekam na fakturę')).toBe('waiting');
    expect(inferKind('Zadzwonić gdy oddzwonią')).toBe('waiting');
  });
  test('wariant bez polskich znaków ("az" zamiast "aż") też trafia', () => {
    expect(inferKind('Zrobie to az skonczysz prace')).toBe('waiting');
  });
  test('słowa kluczowe dużych/wieloetapowych zadań → deep', () => {
    expect(inferKind('Napisz raport z projektu')).toBe('deep');
  });
  test('krótki, prosty tytuł bez słów kluczowych → quick', () => {
    expect(inferKind('Kup mleko')).toBe('quick');
  });
  test('długi, zdaniopodobny tytuł (>=6 słów) bez słów kluczowych i tak trafia w deep', () => {
    expect(inferKind('Zadzwoń dziś do taty wieczorem')).toBe('quick'); // 5 słów — jeszcze nie
    expect(inferKind('Zadzwoń dziś do taty rano koniecznie')).toBe('deep'); // 6 słów — już tak
  });
  test('waiting wygrywa nad deep gdy tytuł pasuje do obu wzorców', () => {
    expect(inferKind('Napisz gdy skończysz')).toBe('waiting');
  });
  test('pusty tytuł → quick, nie crash', () => {
    expect(inferKind('')).toBe('quick');
  });
});

describe('taskKind — stałe (KIND_ORDER / KIND_META)', () => {
  test('KIND_ORDER i KIND_META mają spójny zestaw rodzajów', () => {
    for (const k of KIND_ORDER) {
      expect(KIND_META[k]).toBeDefined();
      expect(KIND_META[k].label).toBeTruthy();
    }
    expect(KIND_ORDER).toHaveLength(Object.keys(KIND_META).length);
  });
});
