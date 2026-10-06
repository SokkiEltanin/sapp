import { isClassEvent, parseClassEvent, CLASS_TYPE_LABEL, fmtNextClassLabel, isHappeningNow, computeClassReminder, fmtClassEventLabel, abbreviateSubject, classGapMinutes, classGapLabel } from '@/utils/classSchedule';
import { CalendarEvent } from '@/types';

const ev = (o: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 'e1', title: '[PUR] L - Cięcie wiązką elektronową i laserową - 69 B2',
  date: '2026-10-12', startTime: '08:00', endTime: '09:30', allDay: false,
  priority: 'normal', createdAt: '2026-10-01T00:00:00', ...o,
});

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

// 2026-10-06, user: "jak jestem to pokazuje podświetla aktualny" — podświetlenie trwającego
// TERAZ zajęcia, zarówno na kafelku dashboardu jak i w pełnym planie.
describe('isHappeningNow — podświetlenie trwających TERAZ zajęć', () => {
  test('ten sam dzień, godzina w środku przedziału → true', () => {
    expect(isHappeningNow(ev(), new Date('2026-10-12T08:45:00'))).toBe(true);
  });
  test('dokładnie startTime (granica domknięta) → true', () => {
    expect(isHappeningNow(ev(), new Date('2026-10-12T08:00:00'))).toBe(true);
  });
  test('dokładnie endTime (granica otwarta — zajęcia już się skończyły) → false', () => {
    expect(isHappeningNow(ev(), new Date('2026-10-12T09:30:00'))).toBe(false);
  });
  test('przed startem tego samego dnia → false', () => {
    expect(isHappeningNow(ev(), new Date('2026-10-12T07:59:00'))).toBe(false);
  });
  test('inny dzień, ta sama godzina → false', () => {
    expect(isHappeningNow(ev(), new Date('2026-10-13T08:45:00'))).toBe(false);
  });
  test('event bez godzin (allDay) → nigdy nie "trwa"', () => {
    expect(isHappeningNow(ev({ startTime: undefined, endTime: undefined }), new Date('2026-10-12T08:45:00'))).toBe(false);
  });
});

// 2026-10-06, user: "mogę zaznaczyć i to się pokazuje na planie i przypomina przed zajęciami".
describe('computeClassReminder — data/godzina przypomnienia liczona wstecz od startu zajęć', () => {
  test('30 min przed 8:00 → 7:30 tego samego dnia', () => {
    expect(computeClassReminder(ev(), 30)).toEqual({ date: '2026-10-12', time: '07:30' });
  });
  test('przejście przez północ (15 min przed 0:05) → poprzedni dzień', () => {
    expect(computeClassReminder(ev({ date: '2026-10-13', startTime: '00:05', endTime: '01:35' }), 15))
      .toEqual({ date: '2026-10-12', time: '23:50' });
  });
  test('event bez startTime → null (nie da się policzyć "przed czym")', () => {
    expect(computeClassReminder(ev({ startTime: undefined }), 30)).toBeNull();
  });
});

describe('fmtClassEventLabel — etykieta do wyświetlenia/cache na Task.classEventLabel', () => {
  test('dzień + godzina + przedmiot', () => {
    expect(fmtClassEventLabel(ev(), '[PUR]')).toBe('Pon 12.10 · 08:00 · Cięcie wiązką elektronową i laserową');
  });
  test('event bez rozpoznanego przedmiotu (zły prefiks) → bez segmentu przedmiotu', () => {
    expect(fmtClassEventLabel(ev(), '[INNY]')).toBe('Pon 12.10 · 08:00');
  });
});

// 2026-10-06, user zrzutem pilla: "za dlugi jest ten komunikat na pillu, ciężko cokolwiek
// widac nazwa skrócona najlepiej plus sala i budynek".
describe('abbreviateSubject — deterministyczne cięcie długich nazw przedmiotów', () => {
  test('krótsza niż limit → bez zmian', () => {
    expect(abbreviateSubject('Obróbka cieplno-chemiczna', 28)).toBe('Obróbka cieplno-chemiczna');
  });
  test('dokładnie na limicie → bez zmian (brak zbędnego cięcia na granicy)', () => {
    expect(abbreviateSubject('1234567890', 10)).toBe('1234567890');
  });
  test('dłuższa niż limit → ucięta z wielokropkiem, długość = maxLen', () => {
    const r = abbreviateSubject('Struktura powierzchni i jej modyfikacje', 20);
    expect(r.length).toBe(20);
    expect(r.endsWith('…')).toBe(true);
    expect(r).toBe('Struktura powierzch…');
  });
  test('nie ucina w połowie białego znaku na granicy (trimEnd przed wielokropkiem)', () => {
    // limit pada DOKŁADNIE na spacji — bez trimEnd wyszłoby "Struktura …" z nadmiarową spacją
    const r = abbreviateSubject('Struktura cos', 10);
    expect(r).toBe('Struktura…');
  });
});

// 2026-10-06, user o kafelku dashboardu: "musi być czasowo... blokowo od której do której,
// potem żeby było widać czy mam 15 min przerwy pomiędzy czy ze np mam okienko".
describe('classGapMinutes — przerwa między kolejnymi zajęciami, w minutach', () => {
  test('prosta różnica w tej samej godzinie', () => {
    expect(classGapMinutes('08:00', '08:15')).toBe(15);
  });
  test('przechodzi przez pełną godzinę', () => {
    expect(classGapMinutes('09:45', '10:00')).toBe(15);
  });
  test('zajęcia bezpośrednio po sobie → 0', () => {
    expect(classGapMinutes('09:30', '09:30')).toBe(0);
  });
  test('nakładające się (koniec po starcie następnych) → ujemne', () => {
    expect(classGapMinutes('10:15', '10:00')).toBe(-15);
  });
  test('wielogodzinne okienko', () => {
    expect(classGapMinutes('09:45', '13:15')).toBe(3 * 60 + 30);
  });
});

describe('classGapLabel — etykieta "15min przerwy" vs "1h 30min okienko"', () => {
  test('poniżej godziny → "przerwy"', () => {
    expect(classGapLabel(15)).toBe('15min przerwy');
    expect(classGapLabel(59)).toBe('59min przerwy');
  });
  test('od godziny wzwyż → "okienko"', () => {
    expect(classGapLabel(60)).toBe('1h 0min okienko');
    expect(classGapLabel(90)).toBe('1h 30min okienko');
    expect(classGapLabel(210)).toBe('3h 30min okienko');
  });
});
