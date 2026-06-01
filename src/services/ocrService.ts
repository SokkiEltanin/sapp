import * as FileSystem from 'expo-file-system/legacy';

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_VISION_API_KEY ?? '';
const ENDPOINT = 'https://vision.googleapis.com/v1/images:annotate';

// ─── Layout-aware line reconstruction ──────────────────────────────────────────
// Google's `fullTextAnnotation.text` linearises a receipt in its own reading
// order, which for two-column layouts (PRODUCT .......... PRICE) often merges
// rows or scrambles columns. We instead rebuild each visual line ourselves from
// the per-word bounding boxes: group words by their vertical centre (same row),
// then order each row left→right by horizontal position. This keeps the product
// name and its price on the same line — much easier for the parser to read.

interface Vertex { x?: number; y?: number; }
interface WordBox { text: string; midY: number; left: number; height: number; }

function symbolsToText(word: any): string {
  const syms = word?.symbols ?? [];
  let out = '';
  for (const s of syms) {
    out += s.text ?? '';
    const brk = s.property?.detectedBreak?.type;
    if (brk === 'SPACE' || brk === 'SURE_SPACE' || brk === 'EOL_SURE_SPACE') out += ' ';
  }
  return out;
}

function boxMetrics(vertices: Vertex[]): { midY: number; left: number; height: number } | null {
  if (!vertices?.length) return null;
  const ys = vertices.map(v => v.y ?? 0);
  const xs = vertices.map(v => v.x ?? 0);
  const top = Math.min(...ys), bottom = Math.max(...ys);
  const left = Math.min(...xs);
  return { midY: (top + bottom) / 2, left, height: Math.max(1, bottom - top) };
}

function reconstructLines(fullTextAnnotation: any): string {
  const words: WordBox[] = [];
  for (const page of fullTextAnnotation?.pages ?? []) {
    for (const block of page.blocks ?? []) {
      for (const para of block.paragraphs ?? []) {
        for (const word of para.words ?? []) {
          const m = boxMetrics(word.boundingBox?.vertices ?? []);
          const text = symbolsToText(word).trim();
          if (!m || !text) continue;
          words.push({ text, midY: m.midY, left: m.left, height: m.height });
        }
      }
    }
  }
  if (words.length === 0) return '';

  // Median word height → row-grouping tolerance.
  const heights = words.map(w => w.height).sort((a, b) => a - b);
  const medianH = heights[Math.floor(heights.length / 2)] || 12;
  const rowTol = medianH * 0.6;

  // Sort top→bottom, then greedily bucket into rows by vertical proximity.
  words.sort((a, b) => a.midY - b.midY);
  const rows: WordBox[][] = [];
  for (const w of words) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(w.midY - row[0].midY) <= rowTol) row.push(w);
    else rows.push([w]);
  }

  return rows
    .map(row => row.sort((a, b) => a.left - b.left).map(w => w.text).join(' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

export async function extractTextFromImage(imageUri: string): Promise<string> {
  if (!API_KEY) {
    throw new Error('Brak klucza API — dodaj EXPO_PUBLIC_GOOGLE_VISION_API_KEY do pliku .env');
  }

  const base64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const body = {
    requests: [{
      image: { content: base64 },
      features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
      imageContext: { languageHints: ['pl', 'en'] },
    }],
  };

  const res = await fetch(`${ENDPOINT}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error?.message ?? 'OCR nie powiodło się');
  }

  const annotation = data.responses?.[0]?.fullTextAnnotation;
  // Prefer our layout-aware reconstruction; fall back to Google's raw text.
  const reconstructed = reconstructLines(annotation);
  const text: string = reconstructed || annotation?.text || '';

  if (!text) throw new Error('Nie rozpoznano tekstu na zdjęciu — spróbuj wyraźniejsze zdjęcie');

  return text;
}
