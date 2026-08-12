import { makeBlock, serializeBlocks, deserializeBlocks, blocksToPlainText, RichBlock } from '@/utils/richText';

describe('richText — makeBlock', () => {
  test('tworzy blok z unikalnym id i podanym tekstem', () => {
    const a = makeBlock('cześć');
    const b = makeBlock('cześć');
    expect(a.text).toBe('cześć');
    expect(a.id).not.toBe(b.id); // różne wywołania → różne id
  });
  test('domyślnie pusty tekst', () => {
    expect(makeBlock().text).toBe('');
  });
});

describe('richText — serializeBlocks / deserializeBlocks (round-trip)', () => {
  test('poprawny JSON bloków odczytany bez zmian', () => {
    const blocks: RichBlock[] = [{ id: 'a', text: 'hej', bold: true }];
    expect(deserializeBlocks(serializeBlocks(blocks))).toEqual(blocks);
  });

  test('brak zapisanej notatki (undefined) → jeden pusty blok, nie crash', () => {
    expect(deserializeBlocks(undefined)).toEqual([expect.objectContaining({ text: '' })]);
  });

  test('stara notatka zwykłym tekstem (nie JSON) — fallback: każda linia to osobny blok', () => {
    const blocks = deserializeBlocks('linia pierwsza\nlinia druga');
    expect(blocks.map(b => b.text)).toEqual(['linia pierwsza', 'linia druga']);
  });

  test('zepsuty/nie-JSON tekst też pada na fallback linia-po-linii, nie wywala się', () => {
    const blocks = deserializeBlocks('{to nie jest poprawny json');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe('{to nie jest poprawny json');
  });

  test('pusta tablica JSON "[]" jest technicznie poprawnym JSON-em ale ma length=0, więc PADA na fallback (traktuje "[]" jako tekst linii)', () => {
    // Udokumentowane rzeczywiste zachowanie (nie "jak powinno być") — warunek to
    // `Array.isArray(parsed) && parsed.length > 0`, więc pusta tablica nie przechodzi
    // i cały string "[]" leci przez split('\n') jako zwykły tekst.
    const blocks = deserializeBlocks('[]');
    expect(blocks).toEqual([expect.objectContaining({ text: '[]' })]);
  });
});

describe('richText — blocksToPlainText (odwrotność legacy split)', () => {
  test('łączy teksty bloków znakiem nowej linii', () => {
    const blocks: RichBlock[] = [makeBlock('a'), makeBlock('b'), makeBlock('c')];
    expect(blocksToPlainText(blocks)).toBe('a\nb\nc');
  });
  test('pusta lista bloków → pusty string', () => {
    expect(blocksToPlainText([])).toBe('');
  });
});
