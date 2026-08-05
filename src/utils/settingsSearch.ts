import { SettingsSectionDef } from '@/types/settings';

// Same technique as productMemory's normalizeProductName: fold Polish diacritics
// to ASCII so "wypłata" and "wyplata" (or a future non-PL keyboard) both match.
const DIACRITICS: Record<string, string> = {
  ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ż: 'z', ź: 'z',
};

export function normalizeSearch(s: string): string {
  let out = s.toLowerCase().trim();
  out = out.replace(/[ąćęłńóśżź]/g, ch => DIACRITICS[ch] ?? ch);
  out = out.replace(/[^a-z0-9]+/g, ' ').trim();
  return out;
}

export interface FilteredSection {
  section: SettingsSectionDef;
  // null = show every item (section itself matched, e.g. by title); a Set =
  // only these item ids matched, so the section renders narrowed to them.
  matchedItemIds: Set<string> | null;
}

// Every search term must appear somewhere in the haystack (AND, not OR) — so
// "prefiks praca" only hits the work-prefix row, not every row mentioning "praca".
function matchesAllTerms(haystack: string, terms: string[]): boolean {
  return terms.every(t => haystack.includes(t));
}

function sectionHaystack(section: SettingsSectionDef): string {
  return normalizeSearch([section.title, ...section.keywords].join(' '));
}

function itemHaystack(item: SettingsSectionDef['items'][number]): string {
  return normalizeSearch([item.title, item.subtitle ?? '', ...item.keywords].join(' '));
}

// Empty query → everything visible, nothing narrowed (normal browsing).
// Non-empty query → only sections with a section-level or item-level match
// survive; a section-level match (title/section keywords) shows ALL its items
// (context intact), an item-only match narrows to just those items.
export function filterSections(sections: SettingsSectionDef[], query: string): FilteredSection[] {
  const q = normalizeSearch(query);
  if (!q) return sections.map(section => ({ section, matchedItemIds: null }));
  const terms = q.split(' ').filter(Boolean);

  const out: FilteredSection[] = [];
  for (const section of sections) {
    if (matchesAllTerms(sectionHaystack(section), terms)) {
      out.push({ section, matchedItemIds: null });
      continue;
    }
    const matchedItemIds = new Set<string>();
    for (const item of section.items) {
      if (matchesAllTerms(itemHaystack(item), terms)) matchedItemIds.add(item.id);
    }
    if (matchedItemIds.size > 0) out.push({ section, matchedItemIds });
  }
  return out;
}
