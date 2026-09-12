import { Expense } from '@/types';
import { getCategoryMeta } from './categories';

// Eksport wydatków do CSV (2026-09-12, user: "eksport wydatkow spoko możemy dodac w
// ustawieniach") — osobny od istniejącego pełnego JSON-owego exportu w `backupService.ts`
// (ten jest techniczny, do backupu/analizy; CSV ma być czytelne w Excelu/Sheets, jeden
// wiersz = jedna transakcja, kolumny po polsku). Separator PRZECINEK + kwota z KROPKĄ
// dziesiętną (standard RFC4180/Sheets) — NIE polski format średnik+przecinek, żeby plik
// otwierał się poprawnie zarówno w Google Sheets jak i Excelu bez ręcznej zmiany ustawień
// regionalnych przy imporcie.
const HEADER = ['Data', 'Typ', 'Kwota', 'Waluta', 'Kategoria', 'Tagi', 'Notatka', 'Sklep', 'Płatnik', 'Metoda płatności'];

function csvField(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function csvRow(fields: string[]): string {
  return fields.map(csvField).join(',');
}

export function expensesToCsv(expenses: Expense[]): string {
  const sorted = [...expenses].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  const rows = sorted.map(e => csvRow([
    (e.date ?? '').slice(0, 10),
    e.type === 'income' ? 'Przychód' : 'Wydatek',
    e.amount.toFixed(2),
    e.currency || 'PLN',
    getCategoryMeta(e.category).label,
    (e.tags ?? []).join('; '),
    e.note ?? '',
    e.storeName ?? '',
    e.payer ?? '',
    e.paymentMethod === 'cash' ? 'Gotówka' : 'Karta',
  ]));
  // BOM na początku — bez tego Excel na Windows potrafi pokazać polskie znaki jako krzaki.
  return '﻿' + [csvRow(HEADER), ...rows].join('\n');
}
