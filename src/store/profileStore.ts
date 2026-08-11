import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Osobowa personalizacja (Ustawienia → Personalizacja) — wiek liczony z daty urodzenia,
// płeć, poziom treningowy. Karmi trudność pupilowych questów treningowych (src/utils/
// personalQuests.ts), nic więcej: brak tych pól = questy po prostu się nie pokazują
// (patrz `available` w quests.ts BONUS).
export type Gender = 'kobieta' | 'mężczyzna' | 'inna';
export type TrainingLevel = 'poczatkujacy' | 'sredni' | 'zaawansowany';

interface ProfileState {
  birthdate: string | null;   // YYYY-MM-DD
  gender: Gender | null;
  trainingLevel: TrainingLevel | null;
  _hydrated: boolean;
  setBirthdate: (v: string | null) => void;
  setGender: (v: Gender | null) => void;
  setTrainingLevel: (v: TrainingLevel | null) => void;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      birthdate: null,
      gender: null,
      trainingLevel: null,
      _hydrated: false,
      setBirthdate: (v) => set({ birthdate: v }),
      setGender: (v) => set({ gender: v }),
      setTrainingLevel: (v) => set({ trainingLevel: v }),
    }),
    {
      name: 'profile-v1',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => { if (state) state._hydrated = true; },
    },
  ),
);
