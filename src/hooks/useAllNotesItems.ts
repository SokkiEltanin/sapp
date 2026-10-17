import { useEffect, useState } from 'react';
import { getAllNotes, Note } from '@/utils/notesStorage';

// Wszystkie notatki (nie tylko przypięte — user kopiujący notatkę jako osobny widget na
// płótnie może chcieć DOWOLNĄ, nie tylko tę oznaczoną pinezką na dashboardzie), sortowane
// pinned-first/najnowsze (ten sam porządek co `getAllNotes()` sam w sobie). Ładowane RAZ przy
// montażu — ten sam, świadomy kompromis co `dashboard-tile-creator.tsx`'s `realPinnedNotes`
// (AsyncStorage, nie Zustand, więc brak taniego live-refresh na fokusie jak dashboard). `.catch`
// zjada błąd odczytu zamiast rzucać — zgodnie z `getAllNotes()`'s własnym kontraktem (zwraca
// `[]` przy błędzie, nigdy nie rzuca), ale `useEffect` + `.then` i tak teoretycznie mogłoby
// odrzucić promise gdyby coś poszło katastrofalnie źle w samym wywołaniu.
export function useAllNotesItems(): Note[] {
  const [notes, setNotes] = useState<Note[]>([]);
  useEffect(() => { getAllNotes().then(setNotes).catch(() => {}); }, []);
  return notes;
}
