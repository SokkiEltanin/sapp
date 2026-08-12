import AsyncStorage from '@react-native-async-storage/async-storage';
import { activityFloor, bmrMifflin, getHealthGoals, saveHealthGoals, ActivityLevel } from '@/utils/healthGoals';

beforeEach(async () => { await AsyncStorage.clear(); });

describe('healthGoals — bmrMifflin (wzór Mifflin-St Jeor)', () => {
  test('mężczyzna: 70kg/175cm/30lat → 1649 kcal (+5 w formule)', () => {
    expect(bmrMifflin(70, 175, 30, 'm')).toBe(1649);
  });
  test('ta sama sylwetka u kobiety → 1483 kcal (-161 zamiast +5, różnica 166)', () => {
    expect(bmrMifflin(70, 175, 30, 'f')).toBe(1483);
  });
  test('brak jakiejkolwiek danej (waga/wzrost/wiek/płeć) → 0, nie NaN', () => {
    expect(bmrMifflin(0, 175, 30, 'm')).toBe(0);
    expect(bmrMifflin(70, 0, 30, 'm')).toBe(0);
    expect(bmrMifflin(70, 175, 0, 'm')).toBe(0);
    expect(bmrMifflin(70, 175, 30, '')).toBe(0);
  });
});

describe('healthGoals — activityFloor ("podłoga" spalania na dni bez zegarka)', () => {
  test('BMR × współczynnik poziomu, zaokrąglone', () => {
    expect(activityFloor(1649, 'mod')).toBe(742);
    expect(activityFloor(1649, 'high')).toBe(1022);
  });
  test('bmr<=0 → zawsze 0, niezależnie od poziomu', () => {
    expect(activityFloor(0, 'high')).toBe(0);
    expect(activityFloor(-100, 'mod')).toBe(0);
  });
  test('nieznany/uszkodzony poziom (np. ze starych danych) → pada na współczynnik "mod"', () => {
    expect(activityFloor(1649, 'nonsense' as ActivityLevel)).toBe(activityFloor(1649, 'mod'));
  });
});

describe('healthGoals — getHealthGoals (odczyt z sanityzacją per-pole)', () => {
  test('brak zapisanych danych → domyślne wartości', async () => {
    const g = await getHealthGoals();
    expect(g.stepGoal).toBe(10_000);
    expect(g.activityLevel).toBe('mod');
    expect(g.sex).toBe('');
  });

  test('poprawnie zapisane dane wracają bez zmian', async () => {
    await saveHealthGoals({ stepGoal: 12000, heightCm: 180, ageYears: 25, sex: 'f', activityLevel: 'high' });
    const g = await getHealthGoals();
    expect(g.stepGoal).toBe(12000);
    expect(g.heightCm).toBe(180);
    expect(g.sex).toBe('f');
    expect(g.activityLevel).toBe('high');
  });

  test('uszkodzone/niepoprawne pole NIE psuje pozostałych — każde pole sanityzowane osobno', async () => {
    // symulacja zepsutego/starego zapisu w AsyncStorage, z pominięciem saveHealthGoals
    await AsyncStorage.setItem('health_goals', JSON.stringify({
      stepGoal: -5,           // niepoprawne → fallback do domyślnego
      waterGoal: 6,           // poprawne → zostaje
      sex: 'x',               // niepoprawne → fallback do ''
      activityLevel: 'bogus', // niepoprawne → fallback do 'mod'
    }));
    const g = await getHealthGoals();
    expect(g.stepGoal).toBe(10_000); // fallback
    expect(g.waterGoal).toBe(6);     // zachowane
    expect(g.sex).toBe('');          // fallback
    expect(g.activityLevel).toBe('mod'); // fallback
  });

  test('kompletnie zepsuty JSON w storage → łapane, wraca do domyślnych (nie crash)', async () => {
    await AsyncStorage.setItem('health_goals', 'to nie jest json {{{');
    const g = await getHealthGoals();
    expect(g.stepGoal).toBe(10_000);
  });
});

describe('healthGoals — saveHealthGoals (częściowa aktualizacja, merge)', () => {
  test('zapisanie JEDNEGO pola nie kasuje wcześniej ustawionych innych', async () => {
    await saveHealthGoals({ heightCm: 180, ageYears: 25 });
    await saveHealthGoals({ stepGoal: 15000 }); // tylko to jedno pole
    const g = await getHealthGoals();
    expect(g.stepGoal).toBe(15000);
    expect(g.heightCm).toBe(180); // przetrwało poprzedni zapis
    expect(g.ageYears).toBe(25);
  });
});
