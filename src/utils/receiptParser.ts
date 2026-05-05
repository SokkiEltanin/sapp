import { ExpenseCategory } from '@/types';

export interface ReceiptProduct {
  name: string;
  quantity: number;
  unitPrice: number;
  finalPrice: number;
  discount?: number;
  discountPercent?: number;
  promotion?: string;
  category: ExpenseCategory;
}

export interface ParsedReceipt {
  storeName?: string;
  date?: string;
  products: ReceiptProduct[];
  subtotal: number;
  totalDiscount: number;
  total: number;
  raw: string;
}

// ─── Category keywords ────────────────────────────────────────────────────────

const CATEGORY_KEYWORDS: Record<ExpenseCategory, string[]> = {
  food: [
    'pizza', 'burger', 'kebab', 'sushi', 'hot dog', 'zupa', 'kanapka',
    'obiad', 'kolacja', 'śniadanie', 'danie', 'posiłek', 'fast food',
    'mcdonald', 'kfc', 'subway', 'dominos', 'restauracj',
  ],
  groceries: [
    'mleko', 'chleb', 'masło', 'ser', 'jajk', 'mąka', 'cukier', 'ryż', 'makaron',
    'jogurt', 'śmietana', 'kefir', 'twaróg', 'wędlin', 'kiełbas', 'szynka', 'parówk',
    'pomidor', 'ogórek', 'marchew', 'ziemniak', 'cebula', 'czosnek', 'papryka', 'sałat',
    'jabłk', 'banan', 'pomarańcz', 'gruszk', 'truskawk', 'malina', 'winogrono',
    'woda', 'sok', 'napój', 'piwo', 'wino', 'cola', 'fanta', 'sprite', 'pepsi', 'energy',
    'chipsy', 'paluszk', 'krakersy', 'orzech', 'migdał', 'słonecznik',
    'czekolad', 'cukierek', 'batonik', 'lody', 'wafelek', 'ciastk', 'biszkopty',
    'kawa', 'herbata', 'kakao', 'owsianka', 'płatk', 'musli',
    'szampon', 'mydło', 'pasta', 'proszek', 'płyn', 'papier', 'chusteczk',
    'środek czyst', 'zmywak', 'gąbka',
    'lidl', 'biedronka', 'kaufland', 'auchan', 'carrefour', 'żabka', 'netto', 'polo',
  ],
  transport: [
    'paliwo', 'benzyna', 'diesel', 'lpg', 'cng', 'parking', 'autostrada',
    'bilet', 'mpk', 'ztm', 'pkp', 'pkm', 'bus', 'taxi', 'uber', 'bolt',
    'orlen', 'bp', 'shell', 'circle k', 'lotos',
  ],
  entertainment: [
    'kinow', 'film', 'netflix', 'spotify', 'gier', 'steam', 'playstation',
    'xbox', 'nintendo', 'koncert', 'teatr', 'muzeum', 'basen', 'siłowni', 'fitness',
    'książk', 'empik', 'zabawk',
  ],
  health: [
    'aptek', 'lek', 'tabletk', 'witamin', 'suplement', 'maść', 'syrop',
    'opatrunek', 'plaster', 'aspiryn', 'ibuprofen', 'paracetamol', 'ketonal',
    'termometr', 'ciśnieni', 'test ciąż',
  ],
  clothing: [
    'koszulk', 'spodnie', 'sukienk', 'bluza', 'kurtka', 'buty', 'skarpet',
    'bielizna', 'czapk', 'szalik', 'rękawiczk', 'zara', 'hm', 'reserved',
    'cropp', 'house', 'odzież', 'ubranie',
  ],
  housing: [
    'czynsz', 'rachun', 'prąd', 'gaz', 'internet', 'telefon', 'ubezpieczeni',
    'ikea', 'meble', 'farba', 'narzędzi', 'śrub', 'klej', 'taśm',
    'castorama', 'leroy', 'obi', 'selgros',
  ],
  subscriptions: [
    'subskrypcj', 'premium', 'abonament', 'miesięczn', 'roczn',
    'microsoft', 'apple', 'google', 'adobe', 'hbo', 'disney', 'canal',
  ],
  other: [],
};

function categorize(name: string): ExpenseCategory {
  const lower = name.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS) as [ExpenseCategory, string[]][]) {
    if (cat === 'other') continue;
    if (keywords.some(kw => lower.includes(kw))) return cat;
  }
  return 'other';
}

// ─── Promotion detection ──────────────────────────────────────────────────────

function detectPromotion(line: string): string | undefined {
  if (/1\s*\+\s*1/i.test(line)) return '1+1';
  if (/2\s*za\s*cen[ęe]\s*1/i.test(line)) return '2 za cenę 1';
  if (/3\s*za\s*cen[ęe]\s*2/i.test(line)) return '3 za cenę 2';
  if (/opust\s+promocyjn/i.test(line)) return 'Promo';
  const pctMatch = line.match(/-(\d+(?:[.,]\d+)?)\s*%/);
  if (pctMatch) return `-${pctMatch[1]}%`;
  if (/gratis|bezpłatn|free/i.test(line)) return 'gratis';
  return undefined;
}

// ─── VAT code stripping ───────────────────────────────────────────────────────
// Polish receipts append VAT rate letters (A=5%, B=8%, C=23%, D=0%) to lines.
// Format 1 (Lidl/Żabka): "PRODUCT   2,99 A" or "PRODUCT   2,99A"
// Format 2 (Biedronka):  "PRODUCT   A   2,99"

function stripVatCode(line: string): string {
  // "2,99 A" or "2,99A" at end of line
  let s = line.replace(/(\d+[.,]\d{2})\s*[A-E]\s*$/, '$1');
  // "  A   2,99" — VAT letter between name and price
  s = s.replace(/\s{2,}[A-E]\s{2,}(\d+[.,]\d{2}\s*$)/, '  $1');
  return s;
}

// ─── Regex patterns ───────────────────────────────────────────────────────────

// Full product: "NAME   QTY x UNIT   TOTAL"
const FULL_RE  = /^(.+?)\s{2,}(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+[.,]\d{2})\s+(\d+[.,]\d{2})\s*$/i;
// Simple product: "NAME   PRICE"
const SIMPLE_RE = /^(.+?)\s{2,}(\d+[.,]\d{2})\s*$/;
// Weight continuation: "0,538 kg × 4,99" or "1,200 kg x 3,59/kg"
const WEIGHT_RE = /^(\d+[.,]\d+)\s*(?:kg|g|l|ml|szt)\.?\s*[x×*]\s*(\d+[.,]\d{2})(?:[/\\](?:kg|g|l|szt))?/i;
// Lidl format: product info on its own line "QTY * UNIT TOTAL" (name was on previous line)
const PRODUCT_INFO_RE = /^(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+[.,]\d{2})\s+(\d+[.,]\d{2})\s*$/;
// Discount line with keyword (incl. KDR = Karta Dużej Rodziny, Rabat grupowy, etc.)
const DISCOUNT_KW_RE = /^(?:RABAT(?:\s+\w+)?|OPUST|ZNIZKA|ZNIZK|PROMOCJA|OBNIŻKA|OBN|UPUST|KDR)\s+[-–]?(\d+[.,]\d{2})/i;
// Standalone negative price: "-2,99" or "* -2,99"
const DISCOUNT_NEG_RE = /^\*?\s*-(\d+[.,]\d{2})\s*$/;
// Standalone price on its own line (for multi-line products)
const PRICE_ONLY_RE = /^\s*(\d+[.,]\d{2})\s*$/;
// Lines to unconditionally skip
const SKIP_RE = /^(SUMA|RAZEM|DO ZAP[ŁL]ATY|[ŁL][AĄ]CZNIE|PTU|VAT\s+[A-E]|PARAGON|DZIE[NK]UJEMY|THANK|KOD\s|NIP|DATA\s|KASJER|ZAPRASZAMY|ZMIANA|GOT[ÓO]WKA|KARTA|FISKALNY|WYDRUK|POKWITOWANIE|ORYGINAŁ|KOPIA|NUMER)/i;
// Total/sum line
const TOTAL_RE = /(?:SUMA|RAZEM|DO ZAP[ŁL]ATY|[ŁL][AĄ]CZNIE)\s+(?:PLN\s*)?(\d+[.,]\d{2})/i;

const STORE_PATTERNS = [
  'lidl', 'biedronka', 'kaufland', 'auchan', 'carrefour', 'żabka', 'zabka',
  'netto', 'pepco', 'rossmann', 'rossman', 'dino', 'stokrotka', 'delikatesy',
  'intermarche', 'polomarket', 'freshmarket', 'vitalii',
  'orlen', 'bp', 'shell', 'circle k', 'lotos', 'mcdonald', 'kfc', 'subway',
];

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseReceiptText(text: string): ParsedReceipt {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const products: ReceiptProduct[] = [];
  let total = 0;
  let subtotal = 0;
  let totalDiscount = 0;
  let storeName: string | undefined;
  let date: string | undefined;
  let lastProduct: ReceiptProduct | null = null;
  let pendingName: string | null = null;

  // Store name — check first 6 lines before any price appears
  for (const line of lines.slice(0, 6)) {
    const lower = line.toLowerCase();
    if (STORE_PATTERNS.some(s => lower.includes(s))) {
      storeName = line.replace(/\s*nip:?.*/i, '').trim();
      break;
    }
  }

  // Date
  const dateMatch = text.match(/(\d{2}[.\-/]\d{2}[.\-/]\d{2,4})/);
  if (dateMatch) date = dateMatch[1];

  // Total — prefer "Suma PLN X,XX" (Lidl) over bare "Suma X,XX" which can be a VAT subtotal
  const totalPLNMatch = text.match(/SUMA\s+PLN\s+(\d+[.,]\d{2})/i);
  const totalMatch = totalPLNMatch ?? text.match(TOTAL_RE);
  if (totalMatch) total = parseFloat(totalMatch[1].replace(',', '.'));

  const addProduct = (p: ReceiptProduct) => {
    if (p.name.length < 2) return;
    products.push(p);
    lastProduct = p;
    subtotal += p.finalPrice;
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const raw = lines[idx];

    // ── Weight continuation of previous product ───────────────────────────────
    const wm = raw.match(WEIGHT_RE);
    if (wm && lastProduct) {
      const lp   = lastProduct as ReceiptProduct;
      const qty  = parseFloat(wm[1].replace(',', '.'));
      const unit = parseFloat(wm[2].replace(',', '.'));
      const lineTotal = Math.round(qty * unit * 100) / 100;
      subtotal -= lp.finalPrice;
      lp.quantity  = qty;
      lp.unitPrice = unit;
      lp.finalPrice = lineTotal;
      subtotal += lineTotal;
      pendingName = null;
      continue;
    }

    const line = stripVatCode(raw);

    // ── Skip totals, headers, barcodes ────────────────────────────────────────
    if (SKIP_RE.test(line)) continue;
    if (/^\d{8,}$/.test(line)) continue;
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(line)) continue;

    // ── Promotion hint ────────────────────────────────────────────────────────
    const promo = detectPromotion(line);

    // ── Discount lines ────────────────────────────────────────────────────────
    const dkm = line.match(DISCOUNT_KW_RE);
    const dnm = line.match(DISCOUNT_NEG_RE);
    if ((dkm || dnm) && lastProduct) {
      const lp   = lastProduct as ReceiptProduct;
      const disc = parseFloat((dkm ? dkm[1] : dnm![1]).replace(',', '.'));
      if (disc > 0) {
        lp.discount    = (lp.discount ?? 0) + disc;
        lp.finalPrice  = Math.max(0, lp.finalPrice - disc);
        lp.promotion   = lp.promotion ?? detectPromotion(raw) ?? `−${disc.toFixed(2)} zł`;
        subtotal     -= disc;
        totalDiscount += disc;
      }
      pendingName = null;
      continue;
    }

    // ── Resolve pending name (price arrives on this line) ─────────────────────
    if (pendingName) {
      const pm = line.match(PRICE_ONLY_RE);
      if (pm) {
        const price = parseFloat(pm[1].replace(',', '.'));
        if (price > 0 && price < 5000) {
          addProduct({
            name: pendingName, quantity: 1,
            unitPrice: price, finalPrice: price,
            category: categorize(pendingName), promotion: promo,
          });
          pendingName = null;
          continue;
        }
      }
      // Lidl format: "QTY * UNIT TOTAL" on its own line after the name
      const pim = line.match(PRODUCT_INFO_RE);
      if (pim) {
        const qty       = parseFloat(pim[1].replace(',', '.'));
        const unit      = parseFloat(pim[2].replace(',', '.'));
        const lineTotal = parseFloat(pim[3].replace(',', '.'));
        if (lineTotal > 0 && lineTotal < 5000) {
          addProduct({
            name: pendingName, quantity: qty,
            unitPrice: unit, finalPrice: lineTotal,
            category: categorize(pendingName), promotion: promo,
          });
          pendingName = null;
          continue;
        }
      }
      pendingName = null;
    }

    // ── Full product line: NAME   QTY × UNIT   TOTAL ─────────────────────────
    const fm = line.match(FULL_RE);
    if (fm) {
      const name      = fm[1].trim();
      const qty       = parseFloat(fm[2].replace(',', '.'));
      const unit      = parseFloat(fm[3].replace(',', '.'));
      const lineTotal = parseFloat(fm[4].replace(',', '.'));
      if (lineTotal < 5000) {
        addProduct({ name, quantity: qty, unitPrice: unit, finalPrice: lineTotal, category: categorize(name), promotion: promo });
      }
      continue;
    }

    // ── Simple product line: NAME   PRICE ─────────────────────────────────────
    const sm = line.match(SIMPLE_RE);
    if (sm) {
      const name  = sm[1].trim();
      const price = parseFloat(sm[2].replace(',', '.'));
      if (price > 0 && price < 5000 && !/^(PLN|ZŁ|\d+|[A-E])$/i.test(name)) {
        addProduct({ name, quantity: 1, unitPrice: price, finalPrice: price, category: categorize(name), promotion: promo });
      }
      continue;
    }

    // ── Promotion text line — attach to last product ──────────────────────────
    if (promo && lastProduct && !(lastProduct as ReceiptProduct).promotion) {
      (lastProduct as ReceiptProduct).promotion = promo;
      continue;
    }

    // ── Possible product name without price (price may be on next line) ───────
    if (line.length >= 3 && !/^\d/.test(line) && !/^[A-E]\s/.test(line)) {
      const nextRaw = lines[idx + 1];
      if (nextRaw) {
        const nextClean = stripVatCode(nextRaw.trim());
        if (PRICE_ONLY_RE.test(nextClean) || nextClean.match(WEIGHT_RE) || PRODUCT_INFO_RE.test(nextClean)) {
          pendingName = line;
        }
      }
    }
  }

  return {
    storeName,
    date,
    products,
    subtotal: subtotal || total,
    totalDiscount,
    total: total || subtotal,
    raw: text,
  };
}

// ─── Group by category ────────────────────────────────────────────────────────

export function groupReceiptByCategory(receipt: ParsedReceipt): Record<ExpenseCategory, number> {
  const result: Partial<Record<ExpenseCategory, number>> = {};
  for (const p of receipt.products) {
    result[p.category] = (result[p.category] ?? 0) + p.finalPrice;
  }
  return result as Record<ExpenseCategory, number>;
}
