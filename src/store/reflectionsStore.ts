import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { throttledAsyncStorage } from '@/utils/throttledStorage';

// Szybkie ZAPISKI / refleksje — jedna myśl na raz, podpisana i datowana automatycznie
// ("— Sokki · 02.08.2026"). Dziennik impulsów/uczuć (np. „czułem znudzenie, chciałem
// słodyczy, kupiłem, zjadłem i żałuję"). Persist → łapie backup (snapshotuje klucze AsyncStorage).

export interface Reflection { id: string; text: string; ts: number }

interface ReflectionsState {
  reflections: Reflection[];   // newest first
  author: string;              // podpis (domyślnie „Sokki")
  add: (text: string) => void;
  remove: (id: string) => void;
  setAuthor: (name: string) => void;
}

export const useReflections = create<ReflectionsState>()(
  persist(
    (set) => ({
      reflections: [],
      author: 'Sokki',
      add: (text) => set((s) => {
        const t = text.trim();
        if (!t) return s;
        const entry: Reflection = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, text: t, ts: Date.now() };
        return { reflections: [entry, ...s.reflections].slice(0, 300) };
      }),
      remove: (id) => set((s) => ({ reflections: s.reflections.filter(r => r.id !== id) })),
      setAuthor: (name) => set({ author: name.trim() || 'Sokki' }),
    }),
    { name: 'reflections-v1', storage: createJSONStorage(() => throttledAsyncStorage()) },
  ),
);

// „02.08.2026" — data pod podpisem.
export function reflectionDate(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}
