import { isClassEvent, parseClassEvent, CLASS_TYPE_LABEL, fmtNextClassLabel } from '@/utils/classSchedule';

// Fixtures = REALNE tytuły z planu zajęć usera (2 Inżynieria Materiałowa, sem. zimowy
// 2026/2027, wygenerowane z jego prawdziwego planu + zarządzenia Rektora UR) — nie
// wymyślone przykłady, dokładnie to co trafi do `gcalEvents` po imporcie.

describe('isClassEvent — rozpoznawanie prefiksu', () => {
  test('tytuł zaczynający się od prefiksu → true', () => {
    expect(isClassEvent('[PUR] W - Komp. model. struktur i wł. mat. - 203 B3', '[PUR]')).toBe(true);
  });
  test('inny prefiks / brak prefiksu → false', () => {
    expect(isClassEvent('[JD] 10:00 - 18:00', '[PUR]')).toBe(false);
    expect(isClassEvent('Zwykłe wydarzenie', '[PUR]')).toBe(false);
  });
  test('case-insensitive (jak workPrefix)', () => {
    expect(isClassEvent('[pur] W - Coś - 1 B1', '[PUR]')).toBe(true);
  });
  test('pusty prefiks → nigdy nie dopasowuje (nie łapie wszystkiego)', () => {
    expect(isClassEvent('cokolwiek', '')).toBe(false);
  });
  test('undefined title → false, nie wywala się', () => {
    expect(isClassEvent(undefined, '[PUR]')).toBe(false);
  });
});

describe('parseClassEvent — pełny format [PUR] TYP - NAZWA - SALA (realne tytuły usera)', () => {
  test('wykład', () => {
    expect(parseClassEvent('[PUR] W - Komp. model. struktur i wł. mat. - 203 B3', '[PUR]'))
      .toEqual({ type: 'W', subject: 'Komp. model. struktur i wł. mat.', room: '203 B3' });
  });
  test('ćwiczenia (typ C)', () => {
    expect(parseClassEvent('[PUR] C - Język obcy naukowo-techniczny - 203 B3', '[PUR]'))
      .toEqual({ type: 'C', subject: 'Język obcy naukowo-techniczny', room: '203 B3' });
  });
  test('laboratorium (typ L)', () => {
    expect(parseClassEvent('[PUR] L - Cięcie wiązką elektronową i laserową - 69 B2', '[PUR]'))
      .toEqual({ type: 'L', subject: 'Cięcie wiązką elektronową i laserową', room: '69 B2' });
  });
  test('projekt (typ P, dodany dla sesji "pr.")', () => {
    expect(parseClassEvent('[PUR] P - Obróbka cieplno-chemiczna - 135-136 B1', '[PUR]'))
      .toEqual({ type: 'P', subject: 'Obróbka cieplno-chemiczna', room: '135-136 B1' });
  });
  test('sala z myślnikiem w środku (135-136 B1) nie myli parsera co do liczby segmentów', () => {
    const r = parseClassEvent('[PUR] P - Obróbka cieplno-chemiczna - 135-136 B1', '[PUR]');
    expect(r?.room).toBe('135-136 B1');
  });
});

describe('parseClassEvent — fallbacki dla nietypowego formatu (event i tak widoczny, nie znika)', () => {
  test('brak litery typu, 2 segmenty → subject+room, type null', () => {
    expect(parseClassEvent('[PUR] Egzamin - 203 B3', '[PUR]'))
      .toEqual({ type: null, subject: 'Egzamin', room: '203 B3' });
  });
  test('tylko prefiks + tekst bez żadnych " - " → cały tekst jako subject, room null', () => {
    expect(parseClassEvent('[PUR] Dzień wolny', '[PUR]'))
      .toEqual({ type: null, subject: 'Dzień wolny', room: null });
  });
  test('event bez prefiksu → null (nie parsuje niezwiązanych eventów)', () => {
    expect(parseClassEvent('Zwykłe wydarzenie', '[PUR]')).toBeNull();
  });
});

describe('CLASS_TYPE_LABEL — czytelne etykiety dla wszystkich 4 typów', () => {
  test('W/C/L/P mają polskie etykiety', () => {
    expect(CLASS_TYPE_LABEL.W).toBe('Wykład');
    expect(CLASS_TYPE_LABEL.C).toBe('Ćwiczenia');
    expect(CLASS_TYPE_LABEL.L).toBe('Laboratorium');
    expect(CLASS_TYPE_LABEL.P).toBe('Projekt');
  });
});

describe('fmtNextClassLabel — etykieta najbliższego dnia z zajęciami (fallback kafelka)', () => {
  test('odmiana "dzień" dla 1', () => {
    expect(fmtNextClassLabel('2026-10-05', 1)).toBe('Pon 5 paź · za 1 dzień');
  });
  test('odmiana "dni" dla 2-4', () => {
    expect(fmtNextClassLabel('2026-10-07', 3)).toBe('Śr 7 paź · za 3 dni');
  });
  test('odmiana "dni" dla 5+ (i dla 12-14, wyjątek od "few")', () => {
    expect(fmtNextClassLabel('2026-10-17', 12)).toBe('Sob 17 paź · za 12 dni');
  });
  test('dzień tygodnia liczony poprawnie z YMD (niedziela)', () => {
    expect(fmtNextClassLabel('2026-10-11', 6)).toBe('Nie 11 paź · za 6 dni');
  });
});
