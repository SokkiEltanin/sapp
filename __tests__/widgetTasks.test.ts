import { pickWidgetTasks } from '@/utils/widgetTasks';
import { Task } from '@/types';

const TODAY = '2026-10-05';

function mkTask(over: Partial<Task>): Task {
  return {
    id: over.id ?? Math.random().toString(36),
    title: 'Zadanie',
    status: 'pending',
    priority: 'normal',
    tags: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

describe('pickWidgetTasks — dobór i sortowanie zadań pod widget pulpitu', () => {
  test('pomija zadania done/snoozed — widget pokazuje tylko pending', () => {
    const tasks = [
      mkTask({ id: 'a', status: 'done' }),
      mkTask({ id: 'b', status: 'snoozed' }),
      mkTask({ id: 'c', status: 'pending' }),
    ];
    const rows = pickWidgetTasks(tasks, TODAY);
    expect(rows.map(r => r.id)).toEqual(['c']);
  });

  test('zaległe → dziś → jutro → reszta wg terminu rosnąco → bez terminu na końcu', () => {
    const tasks = [
      mkTask({ id: 'none' }),
      mkTask({ id: 'future', deadline: '2026-10-10' }),
      mkTask({ id: 'overdue', deadline: '2026-10-01' }),
      mkTask({ id: 'today', deadline: '2026-10-05' }),
      mkTask({ id: 'tomorrow', deadline: '2026-10-06' }),
    ];
    const rows = pickWidgetTasks(tasks, TODAY);
    expect(rows.map(r => r.id)).toEqual(['overdue', 'today', 'tomorrow', 'future', 'none']);
  });

  test('etykiety: Zaległe/Dziś/Jutro/Za N dni, pusty string bez terminu', () => {
    const tasks = [
      mkTask({ id: 'overdue', deadline: '2026-10-01' }),
      mkTask({ id: 'today', deadline: '2026-10-05' }),
      mkTask({ id: 'tomorrow', deadline: '2026-10-06' }),
      mkTask({ id: 'plus3', deadline: '2026-10-08' }),
      mkTask({ id: 'none' }),
    ];
    const rows = pickWidgetTasks(tasks, TODAY);
    const byId = Object.fromEntries(rows.map(r => [r.id, r.sub]));
    expect(byId.overdue).toBe('Zaległe');
    expect(byId.today).toBe('Dziś');
    expect(byId.tomorrow).toBe('Jutro');
    expect(byId.plus3).toBe('Za 3 dni');
    expect(byId.none).toBe('');
  });

  test('overdue flag odzwierciedla przeterminowanie', () => {
    const tasks = [mkTask({ id: 'a', deadline: '2026-10-01' }), mkTask({ id: 'b', deadline: '2026-10-10' })];
    const rows = pickWidgetTasks(tasks, TODAY);
    expect(rows.find(r => r.id === 'a')?.overdue).toBe(true);
    expect(rows.find(r => r.id === 'b')?.overdue).toBe(false);
  });

  test('kolor rodzaju — quick/deep/waiting mają różne kolory z KIND_META', () => {
    const tasks = [
      mkTask({ id: 'q', kind: 'quick' }),
      mkTask({ id: 'd', kind: 'deep' }),
      mkTask({ id: 'w', kind: 'waiting' }),
    ];
    const rows = pickWidgetTasks(tasks, TODAY);
    const byId = Object.fromEntries(rows.map(r => [r.id, r.color]));
    expect(byId.q).toBe('#2AC68F');
    expect(byId.d).toBe('#6C9EFF');
    expect(byId.w).toBe('#FBBF24');
  });

  test('respektuje limit', () => {
    const tasks = Array.from({ length: 10 }, (_, i) => mkTask({ id: `t${i}`, deadline: `2026-10-${10 + i}` }));
    expect(pickWidgetTasks(tasks, TODAY, 3)).toHaveLength(3);
    expect(pickWidgetTasks(tasks, TODAY)).toHaveLength(6);
  });
});
