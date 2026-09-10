import { addDoc, updateDoc, deleteDoc, getDocs, query, orderBy, where } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { userCol, userDoc } from './firebase';
import { WorkShift, WorkSettings, DEFAULT_WORK_SETTINGS, Employer } from '@/types';

const SHIFTS_COL     = 'workShifts';
const SETTINGS_KEY   = 'work_settings_v1';
const EMPLOYERS_KEY  = 'work_employers_v1';
const ACTIVE_EMPLOYER_KEY = 'work_active_employer_v1';

const rid = () => `emp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

// Pola `WorkSettings` które faktycznie różnią się per-pracodawca (currency/notifyEveryMinutes
// zostają globalne — patrz komentarz przy `Employer` w types/index.ts).
function employerFromLegacySettings(s: WorkSettings): Employer {
  return {
    id: rid(), name: 'Praca', createdAt: Date.now(),
    workMode: s.workMode, workColor: s.workColor, workPrefix: s.workPrefix,
    monthlySalary: s.monthlySalary, hoursPerMonth: s.hoursPerMonth,
    rateOverride: s.rateOverride, monthRateOverride: s.monthRateOverride,
    hoursOverride: s.hoursOverride, salaryOverride: s.salaryOverride,
    confirmedMonths: s.confirmedMonths, excludedPayMonths: s.excludedPayMonths,
  };
}

const strip = <T extends Record<string, any>>(obj: T): T =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;

export const workService = {
  // ── Shifts (Firebase) ────────────────────────────────────────────────────────

  async getShifts(fromDate?: string, toDate?: string): Promise<WorkShift[]> {
    let q = query(userCol(SHIFTS_COL), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    let shifts = snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkShift));
    if (fromDate) shifts = shifts.filter(s => s.date >= fromDate);
    if (toDate)   shifts = shifts.filter(s => s.date <= toDate);
    return shifts;
  },

  async addShift(shift: Omit<WorkShift, 'id' | 'createdAt'>): Promise<WorkShift> {
    const now = new Date().toISOString();
    const ref = await addDoc(userCol(SHIFTS_COL), strip({ ...shift, createdAt: now }));
    return { ...shift, id: ref.id, createdAt: now };
  },

  async updateShift(id: string, updates: Partial<WorkShift>): Promise<void> {
    await updateDoc(userDoc(SHIFTS_COL, id), strip(updates));
  },

  async deleteShift(id: string): Promise<void> {
    await deleteDoc(userDoc(SHIFTS_COL, id));
  },

  // ── Settings (AsyncStorage) ──────────────────────────────────────────────────

  async getSettings(): Promise<WorkSettings> {
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      return raw ? { ...DEFAULT_WORK_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_WORK_SETTINGS };
    } catch {
      return { ...DEFAULT_WORK_SETTINGS }; // corrupt JSON → fall back instead of throwing
    }
  },

  async saveSettings(settings: WorkSettings): Promise<void> {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  },

  // ── Pracodawcy (AsyncStorage) — 2026-09-10, user: "żeby dało się zmienić prefiks w razie
  // czego i działał jak zmienię pracę" + "wyłączyć stare żeby one były ale widzieć tylko z
  // nowej pracy". Patrz pełny komentarz przy `Employer` w types/index.ts. ──────────────────

  // Pierwsze wywołanie NA URZĄDZENIU bez zapisanej listy → jednorazowa, idempotentna migracja
  // z pojedynczego globalnego `WorkSettings` (jeśli user go w ogóle skonfigurował — pusty
  // prefiks + domyślne wartości = nic do migrowania, zwraca pustą listę). Migracja NIE kasuje
  // ani nie zmienia `WorkSettings` — zostaje nietknięty jako "zwierciadło aktywnej pracy" dla
  // istniejących odczytów (dashboard, bank, osiągnięcia...), patrz `setActiveEmployer` niżej.
  async getEmployers(): Promise<Employer[]> {
    try {
      const raw = await AsyncStorage.getItem(EMPLOYERS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    const legacy = await this.getSettings();
    const hasLegacyPrefix = !!(legacy.workPrefix ?? '').trim() || !!legacy.workColor;
    const hasLegacyManual = legacy.workMode === 'manual'
      && (legacy.monthlySalary !== DEFAULT_WORK_SETTINGS.monthlySalary || legacy.hoursPerMonth !== DEFAULT_WORK_SETTINGS.hoursPerMonth);
    if (!hasLegacyPrefix && !hasLegacyManual) return [];
    const migrated = employerFromLegacySettings(legacy);
    await this.saveEmployers([migrated]);
    // ZaraZ po migracji ta jedna praca to jedyna, więc jest domyślnie "aktywna" — bez tego
    // ekran Pracy pokazałby świeżo zmigrowaną listę bez żadnej oznaczonej jako bieżąca.
    await AsyncStorage.setItem(ACTIVE_EMPLOYER_KEY, migrated.id);
    return [migrated];
  },

  async getActiveEmployerId(): Promise<string | null> {
    try { return await AsyncStorage.getItem(ACTIVE_EMPLOYER_KEY); } catch { return null; }
  },

  async saveEmployers(employers: Employer[]): Promise<void> {
    await AsyncStorage.setItem(EMPLOYERS_KEY, JSON.stringify(employers));
  },

  async addEmployer(input: Omit<Employer, 'id' | 'createdAt'>): Promise<Employer> {
    const employers = await this.getEmployers();
    const emp: Employer = { ...input, id: rid(), createdAt: Date.now() };
    await this.saveEmployers([...employers, emp]);
    return emp;
  },

  async updateEmployer(id: string, patch: Partial<Employer>): Promise<Employer[]> {
    const employers = (await this.getEmployers()).map(e => (e.id === id ? { ...e, ...patch } : e));
    await this.saveEmployers(employers);
    return employers;
  },

  // "Wyłącz stare żeby one były ale widzieć tylko z nowej pracy jak będę chciał" — miękkie
  // ukrycie z ŁĄCZNYCH statystyk (nowy ekran Pracy), dane zostają w 100% nietknięte, można
  // odkryć z powrotem w każdej chwili. Nigdy nie usuwa (usuwanie pracodawcy z danymi to
  // świadomie NIE zaimplementowane — zbyt ryzykowne dla realnych zarobków bez wyraźnego asku).
  async toggleEmployerHidden(id: string): Promise<Employer[]> {
    const employers = await this.getEmployers();
    const target = employers.find(e => e.id === id);
    if (!target) return employers;
    return this.updateEmployer(id, { hidden: !target.hidden });
  },

  // Ustawia pracodawcę jako AKTYWNEGO — zwierciadli jego pola do globalnego `WorkSettings`,
  // żeby dashboard/bank/osiągnięcia (czytające WYŁĄCZNIE `workSettings.workPrefix` itd., bez
  // pojęcia o liście pracodawców) automatycznie zaczęły liczyć nową pracę, zero zmian w tamtych
  // 17 miejscach. To właśnie ROZWIĄZUJE "działał jak zmienię pracę" — dodajesz nowego
  // pracodawcę z nowym prefiksem, ustawiasz go aktywnym, i cała reszta apki przełącza się sama.
  async setActiveEmployer(id: string): Promise<void> {
    const employers = await this.getEmployers();
    const emp = employers.find(e => e.id === id);
    if (!emp) return;
    const current = await this.getSettings();
    await this.saveSettings({
      ...current,
      workMode: emp.workMode, workColor: emp.workColor, workPrefix: emp.workPrefix,
      monthlySalary: emp.monthlySalary, hoursPerMonth: emp.hoursPerMonth,
      rateOverride: emp.rateOverride, monthRateOverride: emp.monthRateOverride,
      hoursOverride: emp.hoursOverride, salaryOverride: emp.salaryOverride,
      confirmedMonths: emp.confirmedMonths, excludedPayMonths: emp.excludedPayMonths,
    });
    await AsyncStorage.setItem(ACTIVE_EMPLOYER_KEY, id);
  },

  // Edycja pól przez ISTNIEJĄCE ekrany (Ustawienia → Praca) edytuje `WorkSettings`
  // bezpośrednio (bez zmian w tamtym kodzie) — ta funkcja dogrywa TĘ SAMĄ zmianę do
  // rekordu aktywnego pracodawcy, żeby lista pracodawców nie rozjechała się z tym co
  // faktycznie jest w użyciu. No-op gdy nie ma jeszcze żadnego aktywnego pracodawcy
  // (np. zupełnie świeża instalacja bez skonfigurowanej pracy).
  async syncActiveEmployerFromSettings(settings: WorkSettings): Promise<void> {
    const activeId = await this.getActiveEmployerId();
    if (!activeId) return;
    await this.updateEmployer(activeId, {
      workMode: settings.workMode, workColor: settings.workColor, workPrefix: settings.workPrefix,
      monthlySalary: settings.monthlySalary, hoursPerMonth: settings.hoursPerMonth,
      rateOverride: settings.rateOverride, monthRateOverride: settings.monthRateOverride,
      hoursOverride: settings.hoursOverride, salaryOverride: settings.salaryOverride,
      confirmedMonths: settings.confirmedMonths, excludedPayMonths: settings.excludedPayMonths,
    });
  },
};
