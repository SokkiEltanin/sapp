import { todayReminders } from '@/utils/todayReminders';
import { Debt, Subscription } from '@/types';
import { Note } from '@/utils/notesStorage';
import { CapsuleLetter } from '@/store/timeCapsuleStore';

const NOW = new Date(2026, 8, 29); // 29 września 2026

const debt = (o: Partial<Debt>): Debt => ({
  id: 'd1', person: 'Kasia', amount: 50, currency: 'PLN', askDate: '2026-09-29',
  createdAt: '', updatedAt: '', ...o,
} as Debt);

const sub = (o: Partial<Subscription>): Subscription => ({
  id: 's1', name: 'Netflix', amount: 43, currency: 'PLN', category: 'subscriptions',
  billingCycle: 'monthly', nextBillingDate: '2026-10-02', reminderDaysBefore: 3,
  active: true, createdAt: '', updatedAt: '', ...o,
} as Subscription);

const note = (o: Partial<Note>): Note => ({
  id: 'n1', title: 'Kupić karmę', body: '', tags: [], pinned: false,
  createdAt: '', updatedAt: '', ...o,
} as Note);

const capsule = (o: Partial<CapsuleLetter>): CapsuleLetter => ({
  id: 'c1', text: 'Cześć przyszły ja', createdAt: 0, unlockAt: NOW.getTime(), ...o,
} as CapsuleLetter);

const empty = { debts: [], subscriptions: [], notes: [], capsules: [] };

describe('todayReminders', () => {
  it('zwraca pustą listę gdy nic nie jest dziś zaplanowane', () => {
    expect(todayReminders(empty, NOW)).toEqual([]);
  });

  it('łapie dług z askDate=dziś', () => {
    const items = todayReminders({ ...empty, debts: [debt({})] }, NOW);
    expect(items).toEqual([{ kind: 'debt', label: 'dług: Kasia' }]);
  });

  it('pomija rozliczony dług nawet z askDate=dziś', () => {
    const items = todayReminders({ ...empty, debts: [debt({ settled: true })] }, NOW);
    expect(items).toEqual([]);
  });

  it('pomija dług z askDate innym niż dziś', () => {
    const items = todayReminders({ ...empty, debts: [debt({ askDate: '2026-09-30' })] }, NOW);
    expect(items).toEqual([]);
  });

  it('łapie subskrypcję gdy nextBillingDate - reminderDaysBefore = dziś', () => {
    // nextBillingDate 2026-10-02, reminderDaysBefore 3 → fire 2026-09-29 (dziś)
    const items = todayReminders({ ...empty, subscriptions: [sub({})] }, NOW);
    expect(items).toEqual([{ kind: 'subscription', label: 'subskrypcja: Netflix' }]);
  });

  it('pomija nieaktywną subskrypcję i subskrypcję z wyłączonym przypomnieniem', () => {
    const inactive = sub({ id: 's1', active: false });
    const noReminder = sub({ id: 's2', reminderDaysBefore: 0 });
    const items = todayReminders({ ...empty, subscriptions: [inactive, noReminder] }, NOW);
    expect(items).toEqual([]);
  });

  it('łapie notatkę z reminderAt=dziś', () => {
    const items = todayReminders({ ...empty, notes: [note({ reminderAt: '2026-09-29T09:00' })] }, NOW);
    expect(items).toEqual([{ kind: 'note', label: 'notatka: Kupić karmę' }]);
  });

  it('pomija notatkę bez reminderAt i z reminderAt innego dnia', () => {
    const noReminder = note({ id: 'n1' });
    const otherDay = note({ id: 'n2', reminderAt: '2026-09-30T09:00' });
    const items = todayReminders({ ...empty, notes: [noReminder, otherDay] }, NOW);
    expect(items).toEqual([]);
  });

  it('łapie kapsułę odblokowującą się dziś', () => {
    const items = todayReminders({ ...empty, capsules: [capsule({})] }, NOW);
    expect(items).toEqual([{ kind: 'capsule', label: 'kapsuła czasu' }]);
  });

  it('zwraca kilka pozycji naraz gdy wszystko wypada tego samego dnia', () => {
    const items = todayReminders({
      debts: [debt({})],
      subscriptions: [sub({})],
      notes: [note({ reminderAt: '2026-09-29T09:00' })],
      capsules: [capsule({})],
    }, NOW);
    expect(items).toHaveLength(4);
    expect(items.map(i => i.kind)).toEqual(['debt', 'subscription', 'note', 'capsule']);
  });
});
