import { MoodEntry, MOOD_LABELS, ENERGY_LABELS } from '@/types';

// Eksport humoru do CSV (2026-10-05, user: "dawaj eksport danych żebym wrzucić ci gdzieś") —
// ten sam wzorzec co `expensesCsv.ts`: osobny od pełnego JSON-owego backupu w
// `backupService.ts` (ten jest techniczny; CSV ma być czytelne w Excelu/Sheets, jeden wiersz
// = jeden wpis humoru). Separator PRZECINEK + BOM, jak w `expensesCsv.ts` — patrz komentarz
// tam po uzasadnienie (zgodność z Excel/Sheets bez ręcznej zmiany regionu przy imporcie).
const HEADER = ['Data', 'Nastrój', 'Energia', 'Tagi', 'Notatka'];

function csvField(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function csvRow(fields: string[]): string {
  return fields.map(csvField).join(',');
}

export function moodToCsv(entries: MoodEntry[]): string {
  const sorted = [...entries].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  const rows = sorted.map(e => csvRow([
    (e.date ?? '').slice(0, 10),
    MOOD_LABELS[e.mood] ?? String(e.mood),
    ENERGY_LABELS[e.energy] ?? String(e.energy),
    (e.tags ?? []).join('; '),
    e.note ?? '',
  ]));
  // BOM na początku — bez tego Excel na Windows potrafi pokazać polskie znaki jako krzaki.
  return '﻿' + [csvRow(HEADER), ...rows].join('\n');
}
