import { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { goBackOrHome } from '@/utils/nav';
import { X, Check, Tag, PenLine, Plus, Trash2 } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import AnimatedButton from '@/components/ui/AnimatedButton';
import DatePickerField from '@/components/ui/DatePickerField';
import { parseReceiptText, ParsedReceipt, ReceiptProduct, getFoodTags } from '@/utils/receiptParser';
import { sameLocalDay } from '@/utils/bankNotification';
import { toast } from '@/store/toastStore';
import { expensesService } from '@/services/expensesService';
import { useExpensesStore } from '@/store/expensesStore';
import { getCategoryMeta, CATEGORY_META } from '@/utils/categories';
import {
  loadProductMemory, applyProductMemory, saveProductCategories, saveCustomProductsToMemory,
  loadTagMemory, applyTagMemory, saveTagMemory, saveCustomTagsToMemory, getTagFrequency,
  loadLineMemory, lineVerdict, saveLineVerdicts, saveNameAliases,
  loadWeightMemory, saveWeightMemory, weightFor, parseWeightFromName, WeightMemory, brandTag,
  loadPriceMemory, savePriceMemory, priceFor, priceAnomaly, PriceMemory, PriceFlag,
  loadNameAliases, suggestSimilarName,
} from '@/utils/productMemory';
import { Expense, ExpenseCategory, ReceiptItem, PaymentMethod } from '@/types';
import { colors, spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { haptic } from '@/utils/haptics';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { getPayers, addPayer } from '@/utils/payers';
import * as LucideIcons from 'lucide-react-native';

// ─── Sort ─────────────────────────────────────────────────────────────────────

type SortMode = 'order' | 'category' | 'price';

const ITEM_TAGS = ['słodycze', 'przekąski', 'nabiał', 'mięso', 'ryby', 'warzywa', 'owoce', 'pieczywo', 'napoje', 'chemia', 'higiena', 'dania gotowe'];

const SORT_OPTS: { mode: SortMode; label: string }[] = [
  { mode: 'order',    label: 'Paragon'   },
  { mode: 'category', label: 'Kategoria' },
  { mode: 'price',    label: 'Cena ↓'   },
];

function todayIso() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ScanReceiptModal() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // Directed attach: opened from a bank-logged (or bare) expense that has no receipt
  // yet — the scanned receipt replaces THAT specific stub instead of relying on the
  // amount/day auto-match. `attachTo` = the target expense id.
  const params = useLocalSearchParams<{ attachTo?: string }>();
  const attachToId = typeof params.attachTo === 'string' ? params.attachTo : undefined;
  const attachTarget = useExpensesStore(s => attachToId ? s.expenses.find(e => e.id === attachToId) : undefined);
  const [receipt, setReceipt]       = useState<ParsedReceipt | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [selected, setSelected]     = useState<Set<number>>(new Set());
  const [saving, setSaving]         = useState(false);
  const [sortMode, setSortMode]     = useState<SortMode>('order');
  const [editedCats, setEditedCats]   = useState<Record<number, ExpenseCategory>>({});
  const [editedPrices, setEditedPrices] = useState<Record<number, string>>({});
  const [editedNames, setEditedNames] = useState<Record<number, string>>({});
  const [catPickerFor, setCatPickerFor] = useState<number | null>(null);
  const [customProducts, setCustomProducts] = useState<{ name: string; price: string; quantity: string; category: ExpenseCategory; tags: string[] }[]>([]);
  const [customCatPickerFor, setCustomCatPickerFor] = useState<number | null>(null);
  const [editedTags, setEditedTags]   = useState<Record<number, string[]>>({});
  const [editedExcluded, setEditedExcluded] = useState<Record<number, boolean>>({});
  const [editedEaters, setEditedEaters] = useState<Record<number, string[]>>({});
  const [editedWeight, setEditedWeight] = useState<Record<number, string>>({}); // GRAMS per piece (user-typed)
  const [editedQty, setEditedQty]       = useState<Record<number, string>>({}); // pieces (user-edited)
  const [weightMemory, setWeightMemory] = useState<WeightMemory>({});
  const [priceMemory, setPriceMemory] = useState<PriceMemory>({});
  const kb = useKeyboardHeight();
  const [knownNames, setKnownNames] = useState<string[]>([]); // confirmed canonical names (alias values)
  const [dismissedSug, setDismissedSug] = useState<Set<number>>(new Set()); // "to samo?" suggestions the user waved off
  const [tagPickerFor, setTagPickerFor] = useState<number | null>(null);
  const [customTagPickerFor, setCustomTagPickerFor] = useState<number | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [dateInput, setDateInput]   = useState(todayIso);
  const [tagFreq, setTagFreq]       = useState<Record<string, number>>({});
  const [payers, setPayers]         = useState<string[]>([]);
  const [payer, setPayer]           = useState<string>('');
  const [addingPayer, setAddingPayer] = useState(false);
  const [newPayer, setNewPayer]     = useState('');
  const addPending = useExpensesStore(s => s.addPending);
  const deleteExpense = useExpensesStore(s => s.deleteExpense);
  const updateExpense = useExpensesStore(s => s.updateExpense);
  const confirmSync = useExpensesStore(s => s.confirmSync);

  useEffect(() => { getTagFrequency().then(setTagFreq).catch(() => {}); }, []);
  useEffect(() => { getPayers().then(setPayers).catch(() => {}); }, []);
  useEffect(() => { loadWeightMemory().then(setWeightMemory).catch(() => {}); }, []);
  useEffect(() => { loadPriceMemory().then(setPriceMemory).catch(() => {}); }, []);
  useEffect(() => { loadNameAliases().then(a => setKnownNames([...new Set(Object.values(a))])).catch(() => {}); }, []);
  // When attaching to an existing payment, default the date + payer to it so the
  // receipt lines up with the bank charge (the receipt's own parsed date still wins
  // if it has one — applyParsedReceipt runs later and overrides).
  useEffect(() => {
    if (!attachTarget) return;
    const d = new Date(attachTarget.date ?? Date.now());
    const p = (n: number) => String(n).padStart(2, '0');
    setDateInput(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
    if (attachTarget.payer) setPayer(attachTarget.payer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachTarget?.id]);

  // "To samo?" merge suggestion for a row: a known product name that's similar but
  // below the auto-merge threshold, so the user confirms it. Hidden once the row's
  // name already equals it, or the user dismissed it.
  const getMergeSuggestion = (i: number): string | null => {
    if (dismissedSug.has(i)) return null;
    const name = getProductName(i);
    if (!name.trim()) return null;
    const s = suggestSimilarName(name, knownNames);
    return s && s.toLowerCase() !== name.trim().toLowerCase() ? s : null;
  };

  const getCategory = (i: number): ExpenseCategory =>
    editedCats[i] ?? (receipt?.products[i].category ?? 'other');

  const getPrice = (i: number): number => {
    const edited = editedPrices[i];
    if (edited !== undefined) {
      const parsed = parseFloat(edited.replace(',', '.'));
      return isNaN(parsed) ? (receipt?.products[i].finalPrice ?? 0) : parsed;
    }
    return receipt?.products[i].finalPrice ?? 0;
  };

  const getProductName = (i: number): string =>
    editedNames[i] ?? (receipt?.products[i].name ?? '');

  const getProductTags = (i: number): string[] => {
    if (editedTags[i]) return editedTags[i];
    const name = getProductName(i);
    const auto = getFoodTags(name);
    if (auto.length > 0) return auto;
    const bt = brandTag(name);          // fallback: recognised brand → its sub-tag
    return bt ? [bt] : [];
  };

  // Weighable food groups get an editable weight (receipts rarely list grams).
  // Dairy (ser) defaults to 1 kg — the user's usual XXL pack.
  const WEIGH_TAGS = ['nabiał', 'mięso', 'ryby', 'owoce', 'warzywa'];
  // Weight is editable when the group is weighable OR a per-piece weight is
  // detectable from the name ("Szynka 250g") or remembered for this product.
  const isWeighable = (i: number) => {
    const name = getProductName(i);
    return getProductTags(i).some(t => WEIGH_TAGS.includes(t)) || !!parseWeightFromName(name) || !!weightFor(name, weightMemory);
  };
  // Editable pieces (defaults to the parsed quantity).
  const getQuantity = (i: number): string => editedQty[i] ?? String(receipt?.products[i]?.quantity ?? 1);
  // Per-piece weight in GRAMS for the UI — user-typed wins, else parsed from the
  // name, else remembered per product, else dairy's usual 250 g pack.
  const getWeightG = (i: number): string => {
    if (editedWeight[i] !== undefined) return editedWeight[i];
    const name = getProductName(i);
    const fromName = parseWeightFromName(name);  // kg, ground truth for this line
    if (fromName) return String(Math.round(fromName * 1000));
    const learned = weightFor(name, weightMemory); // kg, remembered (e.g. XXL PIKOK = 0.25)
    if (learned) return String(Math.round(learned * 1000));
    return getProductTags(i).includes('nabiał') ? '1000' : '';
  };

  // Flag a line whose unit price looks implausibly high vs what this product
  // usually costs (learned) — catches OCR grabbing a wrong number / a total line.
  // Discounts (lower prices) are never flagged.
  const priceFlagFor = (i: number): PriceFlag => {
    const p = receipt?.products[i];
    if (!p || p.kind === 'deposit') return null;
    const qty = parseFloat(getQuantity(i).replace(',', '.')) || 1;
    const finalPrice = getPrice(i);
    const unit = qty > 1 ? finalPrice / qty : finalPrice;
    return priceAnomaly(unit, priceFor(getProductName(i), priceMemory));
  };

  const addCustomProduct = () => {
    setCustomProducts(prev => [...prev, { name: '', price: '0.00', quantity: '1', category: 'groceries', tags: [] }]);
    setCustomCatPickerFor(null);
    setCatPickerFor(null);
  };

  const removeCustomProduct = (idx: number) => {
    setCustomProducts(prev => prev.filter((_, i) => i !== idx));
    if (customCatPickerFor === idx) setCustomCatPickerFor(null);
  };

  const processText = () => {
    const text = pastedText.trim();
    if (!text) { Alert.alert('Brak tekstu', 'Wklej tekst paragonu'); return; }
    const parsed = parseReceiptText(text);
    if (parsed.products.length === 0) {
      Alert.alert('Brak produktów', 'Nie udało się rozpoznać produktów. Sprawdź format tekstu — musi zawierać linie z cenami (np. "1 * 7,99 7,99 C").');
      return;
    }
    applyParsedReceipt(parsed);
  };

  const applyParsedReceipt = async (parsed: ParsedReceipt) => {
    // Apply what we've learned about this store's lines: drop the ones marked
    // "not a product", and un-flag the ones confirmed as real products.
    const lineMem = await loadLineMemory();
    const kept = parsed.products.filter(p =>
      p.kind === 'deposit' || lineVerdict(lineMem, parsed.storeName, p.name) !== 'ignore'
    );
    const products = kept.map(p => {
      if (p.kind === 'deposit') return p;
      const v = lineVerdict(lineMem, parsed.storeName, p.name);
      return { ...p, suspect: p.suspect && v !== 'product' };
    });
    const r: ParsedReceipt = { ...parsed, products };

    setReceipt(r);
    setPaymentMethod(r.paymentMethod ?? 'card');
    // Select everything except the still-suspect lines (user confirms by ticking).
    setSelected(new Set(products.map((_, i) => i).filter(i => !products[i].suspect)));
    setCatPickerFor(null);
    setEditedPrices({});
    setEditedNames({});
    setEditedTags({});
    setEditedExcluded({});
    setEditedEaters({});
    setEditedWeight({});
    setTagPickerFor(null);
    setCustomProducts([]);
    setCustomCatPickerFor(null);
    setCustomTagPickerFor(null);
    if (r.date) setDateInput(r.date);
    const [catMemory, tagMemory] = await Promise.all([loadProductMemory(), loadTagMemory()]);
    const [rememberedCats, rememberedTags] = await Promise.all([
      applyProductMemory(r.products, catMemory),
      applyTagMemory(r.products, tagMemory),
    ]);
    setEditedCats(rememberedCats);
    setEditedTags(rememberedTags);
  };

  // ── Selection ────────────────────────────────────────────────────────────────

  const toggleProduct = (i: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const toggleAll = () => {
    if (!receipt) return;
    setSelected(selected.size === receipt.products.length
      ? new Set()
      : new Set(receipt.products.map((_, i) => i))
    );
  };

  // ── Category editing ─────────────────────────────────────────────────────────

  const changeCategory = (i: number, cat: ExpenseCategory) => {
    setEditedCats(prev => ({ ...prev, [i]: cat }));
    setCatPickerFor(null);
  };

  // ── Sorted/grouped products ───────────────────────────────────────────────────

  const displayItems = useMemo(() => {
    if (!receipt) return [];
    const items = receipt.products.map((p, i) => ({ p, i }));
    switch (sortMode) {
      case 'price':
        return [...items].sort((a, b) => b.p.finalPrice - a.p.finalPrice);
      case 'category':
        return [...items].sort((a, b) =>
          (editedCats[a.i] ?? a.p.category).localeCompare(editedCats[b.i] ?? b.p.category)
        );
      default:
        return items;
    }
  }, [receipt, sortMode, editedCats]);

  const groups = useMemo(() => {
    if (sortMode !== 'category' || !receipt) return null;
    const map = new Map<ExpenseCategory, { p: ReceiptProduct; i: number }[]>();
    for (const item of displayItems) {
      const cat = editedCats[item.i] ?? item.p.category;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    return Array.from(map.entries());
  }, [displayItems, sortMode, editedCats]);

  // ── Reconciliation: selected sum vs receipt total ──────────────────────────────
  const selectedSum = useMemo(() => {
    let s = 0;
    if (receipt) for (const i of selected) s += getPrice(i);
    for (const p of customProducts) {
      if (!p.name.trim()) continue;
      s += parseFloat(p.price.replace(',', '.')) || 0;
    }
    return Math.round(s * 100) / 100;
  }, [receipt, selected, customProducts, editedPrices]);

  const reconDelta = receipt?.total ? Math.round((selectedSum - receipt.total) * 100) / 100 : 0;
  const reconOk = Math.abs(reconDelta) <= 0.05;

  // ── Save ──────────────────────────────────────────────────────────────────────

  const saveSelected = async () => {
    const validCustom = customProducts.filter(p => p.name.trim());
    if (!receipt || (selected.size === 0 && validCustom.length === 0)) return;
    setSaving(true);
    try {
      let dateParsed = new Date().toISOString();
      if (dateInput) {
        const parts = dateInput.split('-').map(Number);
        if (parts.length === 3) {
          const dt = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
          if (!isNaN(dt.getTime())) dateParsed = dt.toISOString();
        }
      }

      const parsedItems: ReceiptItem[] = Array.from(selected).map(i => {
        const p = receipt.products[i];
        const finalPrice = getPrice(i);
        const name = getProductName(i);
        const qtyEdited = parseFloat(getQuantity(i).replace(',', '.'));
        const qty = !isNaN(qtyEdited) && qtyEdited > 0 ? qtyEdited : p.quantity;
        const item: ReceiptItem = {
          name,
          price: finalPrice,
          category: getCategory(i),
          quantity: qty,
          unitPrice: qty !== 1 ? finalPrice / qty : finalPrice,
          tags: getProductTags(i),
        };
        if (p.discount != null) item.discount = p.discount;
        if (editedExcluded[i]) item.excluded = true;
        if (editedEaters[i]?.length) item.eaters = editedEaters[i];
        if (p.kind) item.kind = p.kind;
        // Weight field is PER PIECE (g/szt). weightKg stored = TOTAL of the line
        // = per-piece grams × whole-piece count, so "2 serki · 200 g/szt" = 0,4 kg
        // in stats. Weighed loose goods use a fractional quantity, so don't scale.
        const g = parseFloat(getWeightG(i).replace(',', '.'));
        if (!isNaN(g) && g > 0) {
          const wKg = g / 1000;
          item.weightKg = (Number.isInteger(qty) && qty > 1)
            ? Math.round(wKg * qty * 1000) / 1000
            : wKg;
        }
        return item;
      });

      const customItems: ReceiptItem[] = validCustom.map(p => {
        const price = parseFloat(p.price.replace(',', '.')) || 0;
        const qty   = parseFloat(p.quantity.replace(',', '.')) || 1;
        return {
          name: p.name.trim(),
          price,
          category: p.category,
          quantity: qty,
          unitPrice: qty !== 1 ? price / qty : price,
          tags: p.tags.length > 0 ? p.tags : getFoodTags(p.name),
        };
      });

      const receiptItems = [...parsedItems, ...customItems];
      const total = receiptItems.reduce((s, it) => s + it.price, 0);

      const catAmts = new Map<ExpenseCategory, number>();
      for (const it of receiptItems) catAmts.set(it.category, (catAmts.get(it.category) ?? 0) + it.price);
      const dominantCat = [...catAmts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'groceries';

      const storeTag = receipt.storeName?.toLowerCase().split(' ')[0];
      const foodTags = [...new Set(receiptItems.flatMap(it => it.tags))];
      const tags = [storeTag, ...foodTags].filter(Boolean) as string[];

      const roundedTotal = Math.round(total * 100) / 100;

      // Directed attach: the scanner was opened from a specific bare payment (e.g. one
      // logged from a bank notification). Enrich THAT expense IN PLACE — keep its id so
      // returning to it shows the products, keep bankMatched, and never make a duplicate.
      const attachExisting = attachToId
        ? useExpensesStore.getState().expenses.find(e => e.id === attachToId)
        : undefined;

      if (attachExisting) {
        const updates: Partial<Expense> = {
          amount: roundedTotal,
          category: dominantCat,
          tags,
          paymentMethod,
          date: dateParsed,
          receiptItems,
          ...(receipt.storeName ? { storeName: receipt.storeName, note: receipt.storeName } : {}),
          ...(payer ? { payer } : {}),
          updatedAt: new Date().toISOString(),
        };
        updateExpense(attachExisting.id, updates);
        expensesService.update(attachExisting.id, updates).catch(() => {}); // retried on next foreground
        toast.success('Dodano paragon do płatności');
      } else {
        // Reverse-merge: a bank notification for this purchase may already have created
        // a bare expense (bankMatched, no receiptItems). If one matches on amount + same
        // day + store, enrich THAT one with the receipt instead of adding a duplicate.
        const store0 = receipt.storeName?.toLowerCase().split(/\s+/).filter(Boolean)[0] ?? '';
        const dTime = new Date(dateParsed).getTime();
        // Match a bank-created expense on AMOUNT + SAME DAY (the bank's merchant string
        // and the receipt's store name are often totally different — e.g. "ZABKA
        // Z1234 K.1" vs "Żabka" — so the store name must NOT gate the match, only
        // break ties when several transactions share the exact amount+day).
        const candidates = useExpensesStore.getState().expenses.filter(e =>
          e.bankMatched && !e.receiptItems && (e.type === 'expense' || !e.type) &&
          Math.abs(e.amount - roundedTotal) <= 0.011 &&
          !!e.date && sameLocalDay(new Date(e.date).getTime(), dTime),
        );
        const storeMatch = store0
          ? candidates.find(e => {
              const es = (e.storeName ?? '').toLowerCase().split(/\s+/).filter(Boolean)[0] ?? '';
              return `${e.storeName ?? ''} ${e.note ?? ''}`.toLowerCase().includes(store0) || (!!es && store0.includes(es));
            })
          : undefined;
        const existingBank = storeMatch ?? candidates[0];

        // Always add the receipt as its OWN clean expense (identical shape whether or
        // not a bank payment matched — no special "hybrid" bank+receipt row, which was
        // the suspected black-screen trigger). Build locally + write to Firestore in the
        // BACKGROUND: the web SDK's write promise only resolves on server ack, so
        // awaiting it froze the screen on weak signal. The local store persists to
        // AsyncStorage immediately (safe even if the app is killed first).
        const now = new Date().toISOString();
        const expense: Expense = {
          id: expensesService.newId(),
          type: 'expense',
          amount: roundedTotal,
          currency: 'PLN',
          category: dominantCat,
          tags,
          note: receipt.storeName || 'Paragon',
          date: dateParsed,
          ...(receipt.storeName ? { storeName: receipt.storeName } : {}),
          ...(payer ? { payer } : {}),
          paymentMethod,
          receiptItems,
          createdAt: now,
          updatedAt: now,
        };
        addPending(expense);   // shows immediately + survives a refresh until synced
        expensesService.addWithId(expense.id, expense)
          .then(() => confirmSync(expense.id))
          .catch(() => {}); // stays pending; retried on next foreground

        if (existingBank) {
          // Auto-merge, done SAFELY: the receipt above now represents this purchase, so
          // drop the bare bank stub (matched on amount+day, case-insensitive) to avoid a
          // duplicate — instead of mutating the stub in place.
          deleteExpense(existingBank.id);
          expensesService.remove(existingBank.id).catch(() => {});
          toast.success('Połączono z płatnością z banku — bez duplikatu');
        }
      }
      // Persist corrections to memory for future receipts
      const parsedCats: Record<number, ExpenseCategory> = {};
      receipt.products.forEach((p, i) => { parsedCats[i] = p.category; });
      saveProductCategories(receipt.products, editedCats, parsedCats, editedNames).catch(() => {});
      saveTagMemory(receipt.products, editedTags, editedNames).catch(() => {});
      // Learn renamed products → canonical name (unifies stats across OCR/stores).
      saveNameAliases(receipt.products, editedNames).catch(() => {});
      // Learn per-product weights — only the ones the user TYPED (editedWeight),
      // e.g. "XXL PIKOK PIERŚ Z KURCZAKA" = 0.25 kg. These persist and overwrite
      // the old learned value. Weights written into the name ("Ogórki 700g") are
      // re-parsed every time, so they're not stored (keeps memory clean).
      saveWeightMemory(Array.from(selected)
        .filter(i => editedWeight[i] !== undefined && getProductName(i).trim())
        .map(i => {
          const g = parseFloat((editedWeight[i] ?? '').replace(',', '.')); // grams
          return { name: getProductName(i), kg: isNaN(g) ? 0 : g / 1000 };
        })).catch(() => {});
      // Learn each product's unit price so future scans can flag nonsense prices.
      savePriceMemory(receiptItems
        .filter(it => it.kind !== 'deposit' && it.unitPrice > 0)
        .map(it => ({ name: it.name, unitPrice: it.unitPrice }))).catch(() => {});
      // Learn per-store verdicts on SUSPECT lines: kept = real product, dropped = junk.
      const verdicts = receipt.products
        .map((p, i) => ({ p, i }))
        .filter(({ p }) => p.suspect)
        .map(({ p, i }) => ({ name: (editedNames[i]?.trim() || p.name), verdict: (selected.has(i) ? 'product' : 'ignore') as 'product' | 'ignore' }));
      saveLineVerdicts(receipt.storeName, verdicts).catch(() => {});
      if (validCustom.length > 0) {
        saveCustomProductsToMemory(validCustom.map(p => ({ name: p.name.trim(), category: p.category }))).catch(() => {});
        const taggedCustom = validCustom.filter(p => p.tags.length > 0).map(p => ({ name: p.name.trim(), tags: p.tags }));
        if (taggedCustom.length > 0) saveCustomTagsToMemory(taggedCustom).catch(() => {});
      }
      haptic.success();
      goBackOrHome();   // deep-linked scan has no back stack → don't leave a black screen
    } catch (e: any) {
      setSaving(false);
      Alert.alert('Błąd', e?.message ?? 'Nie udało się zapisać paragonu');
    }
  };

  const resetScan = () => {
    setReceipt(null);
    setSelected(new Set());
    setEditedCats({});
    setEditedPrices({});
    setEditedNames({});
    setEditedTags({});
    setEditedExcluded({});
    setEditedEaters({});
    setEditedWeight({});
    setTagPickerFor(null);
    setCatPickerFor(null);
    setCustomProducts([]);
    setCustomCatPickerFor(null);
    setCustomTagPickerFor(null);
    setSortMode('order');
    setPastedText('');
    setDateInput(todayIso());
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1, paddingBottom: Platform.OS === 'android' ? kb : 0 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <View style={styles.header}>
        <PressableScale onPress={() => { haptic.tap(); goBackOrHome(); }} style={styles.closeBtn}>
          <X size={20} color={colors.text.secondary} />
        </PressableScale>
        <Text style={styles.title}>Wklej paragon</Text>
        {receipt ? (
          <PressableScale onPress={resetScan} style={styles.closeBtn}>
            <X size={16} color={colors.text.muted} />
          </PressableScale>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      {attachTarget && (
        <View style={styles.attachBanner}>
          <LucideIcons.Link2 size={14} color={colors.accent.blue} />
          <Text style={styles.attachBannerText} numberOfLines={2}>
            Doskanowujesz paragon do płatności {attachTarget.amount.toFixed(2)} zł
            {attachTarget.storeName ? ` · ${attachTarget.storeName}` : (attachTarget.note ? ` · ${attachTarget.note}` : '')}
          </Text>
        </View>
      )}

      {!receipt ? (
        <View style={{ flex: 1, padding: spacing[4], gap: spacing[3] }}>
          <TextInput
            style={styles.pasteInput}
            multiline
            value={pastedText}
            onChangeText={setPastedText}
            placeholder={'Wklej tu cały tekst paragonu z aplikacji Lidl, Biedronka itp.\n\nNp.:\nPolędwica z kurczaka\n      1 * 9.99 9.99 C\n   Lidl Plus voucher  -1,00\nJaja ściółkowe M\n      1 * 10.49 10.49 C'}
            placeholderTextColor={colors.text.muted}
            textAlignVertical="top"
            autoFocus
          />
          <AnimatedButton
            onPress={processText}
            label="Analizuj paragon"
            icon={<Check size={18} color={colors.bg.primary} />}
            size="lg"
            fullWidth
            disabled={!pastedText.trim()}
          />
          <PressableScale onPress={() => router.push('/expenses/manual' as any)} style={styles.manualBtn}>
            <PenLine size={14} color={colors.text.secondary} />
            <Text style={styles.manualBtnText}>Wpisz ręcznie produkty</Text>
          </PressableScale>
        </View>
      ) : (
        <>
          {/* Receipt summary */}
          <View style={styles.receiptMeta}>
            {receipt.storeName && <Text style={styles.storeName}>{receipt.storeName}</Text>}
            <View style={styles.metaRow}>
              {receipt.totalDiscount > 0 && (
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>
                    Zaoszczędzono {receipt.totalDiscount.toFixed(2)} zł
                  </Text>
                </View>
              )}
              <Text style={styles.total}>Razem: {receipt.total.toFixed(2)} zł</Text>
            </View>
            {(() => {
              const diff = Math.abs(receipt.subtotal - receipt.total);
              if (receipt.total > 0 && receipt.subtotal > 0 && diff > 0.05) {
                const over = receipt.subtotal > receipt.total;
                return (
                  <View style={styles.mismatchBadge}>
                    <Text style={styles.mismatchText}>
                      {over
                        ? `Suma produktów (${receipt.subtotal.toFixed(2)} zł) > kwota na paragonie — brakuje rabatów lub produktów`
                        : `Suma produktów (${receipt.subtotal.toFixed(2)} zł) < kwota na paragonie — mogły zostać pominięte pozycje`
                      }
                    </Text>
                  </View>
                );
              }
              return null;
            })()}
          </View>

          {/* Sort bar */}
          <View style={styles.sortBar}>
            {SORT_OPTS.map(({ mode, label }) => (
              <PressableScale
                key={mode}
                onPress={() => { setSortMode(mode); setCatPickerFor(null); }}
              >
                <View style={[styles.sortPill, sortMode === mode && styles.sortPillActive]}>
                  <Text style={[styles.sortText, sortMode === mode && styles.sortTextActive]}>
                    {label}
                  </Text>
                </View>
              </PressableScale>
            ))}
            <View style={{ flex: 1 }} />
            <PressableScale onPress={toggleAll}>
              <View style={styles.toggleAllBtn}>
                <Text style={styles.toggleAllText}>
                  {selected.size === receipt.products.length ? 'Odznacz' : 'Zaznacz'} wszystko
                </Text>
              </View>
            </PressableScale>
          </View>

          {/* Product list */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.productList}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionLabel}>
              Wybierz co dodać ({selected.size} z {receipt.products.length})
              {customProducts.length > 0 ? ` + ${customProducts.filter(p => p.name.trim()).length} ręcznych` : ''}
            </Text>

            {groups ? (
              groups.map(([cat, items]) => {
                const meta      = getCategoryMeta(cat);
                const CatIcon   = (LucideIcons as any)[meta.icon];
                const catTotal  = items.reduce((s, { p }) => s + p.finalPrice, 0);
                const catSel    = items.filter(({ i }) => selected.has(i)).length;
                return (
                  <View key={cat}>
                    <View style={styles.groupHeader}>
                      <View style={[styles.groupIconWrap, { backgroundColor: meta.color + '22' }]}>
                        {CatIcon && <CatIcon size={11} color={meta.color} />}
                      </View>
                      <Text style={[styles.groupName, { color: meta.color }]}>{meta.label}</Text>
                      <Text style={styles.groupCount}>{catSel}/{items.length}</Text>
                      <View style={{ flex: 1 }} />
                      <Text style={styles.groupTotal}>{catTotal.toFixed(2)} zł</Text>
                    </View>
                    {items.map(({ p, i }) => (
                      <ProductRow
                        key={i}
                        product={p}
                        category={getCategory(i)}
                        selected={selected.has(i)}
                        onToggle={() => toggleProduct(i)}
                        catPickerOpen={catPickerFor === i}
                        onCategoryPress={() => { setCatPickerFor(catPickerFor === i ? null : i); setTagPickerFor(null); setCustomCatPickerFor(null); }}
                        onCategoryChange={c => changeCategory(i, c)}
                        priceValue={editedPrices[i] !== undefined ? editedPrices[i] : p.finalPrice.toFixed(2)}
                        onPriceChange={v => setEditedPrices(prev => ({ ...prev, [i]: v }))}
                        priceFlag={priceFlagFor(i)}
                        productName={getProductName(i)}
                        onNameChange={v => setEditedNames(prev => ({ ...prev, [i]: v }))}
                        mergeSuggestion={getMergeSuggestion(i)}
                        onMerge={name => { setEditedNames(prev => ({ ...prev, [i]: name })); setDismissedSug(prev => new Set(prev).add(i)); }}
                        onDismissMerge={() => setDismissedSug(prev => new Set(prev).add(i))}
                        productTags={getProductTags(i)}
                        onTagsChange={tags => setEditedTags(prev => ({ ...prev, [i]: tags }))}
                        tagPickerOpen={tagPickerFor === i}
                        onTagPickerPress={() => { setTagPickerFor(tagPickerFor === i ? null : i); setCatPickerFor(null); setCustomCatPickerFor(null); setCustomTagPickerFor(null); }}
                        tagFreq={tagFreq}
                        excluded={!!editedExcluded[i]}
                        onToggleExcluded={() => setEditedExcluded(prev => ({ ...prev, [i]: !prev[i] }))}
                        weighable={isWeighable(i)}
                        weight={getWeightG(i)}
                        quantity={getQuantity(i)}
                        onQuantityChange={v => setEditedQty(prev => ({ ...prev, [i]: v }))}
                        onWeightChange={v => setEditedWeight(prev => ({ ...prev, [i]: v }))}
                        payers={payers}
                        eaters={editedEaters[i]}
                        onEatersChange={e => setEditedEaters(prev => ({ ...prev, [i]: e }))}
                      />
                    ))}
                  </View>
                );
              })
            ) : (
              displayItems.map(({ p, i }) => (
                <ProductRow
                  key={i}
                  product={p}
                  category={getCategory(i)}
                  selected={selected.has(i)}
                  onToggle={() => toggleProduct(i)}
                  catPickerOpen={catPickerFor === i}
                  onCategoryPress={() => { setCatPickerFor(catPickerFor === i ? null : i); setTagPickerFor(null); setCustomCatPickerFor(null); }}
                  onCategoryChange={c => changeCategory(i, c)}
                  priceValue={editedPrices[i] !== undefined ? editedPrices[i] : p.finalPrice.toFixed(2)}
                  onPriceChange={v => setEditedPrices(prev => ({ ...prev, [i]: v }))}
                  priceFlag={priceFlagFor(i)}
                  productName={getProductName(i)}
                  onNameChange={v => setEditedNames(prev => ({ ...prev, [i]: v }))}
                  mergeSuggestion={getMergeSuggestion(i)}
                  onMerge={name => { setEditedNames(prev => ({ ...prev, [i]: name })); setDismissedSug(prev => new Set(prev).add(i)); }}
                  onDismissMerge={() => setDismissedSug(prev => new Set(prev).add(i))}
                  productTags={getProductTags(i)}
                  onTagsChange={tags => setEditedTags(prev => ({ ...prev, [i]: tags }))}
                  tagPickerOpen={tagPickerFor === i}
                  onTagPickerPress={() => { setTagPickerFor(tagPickerFor === i ? null : i); setCatPickerFor(null); setCustomCatPickerFor(null); setCustomTagPickerFor(null); }}
                  tagFreq={tagFreq}
                  excluded={!!editedExcluded[i]}
                  onToggleExcluded={() => setEditedExcluded(prev => ({ ...prev, [i]: !prev[i] }))}
                  weighable={isWeighable(i)}
                  weight={getWeightG(i)}
                  quantity={getQuantity(i)}
                  onQuantityChange={v => setEditedQty(prev => ({ ...prev, [i]: v }))}
                  onWeightChange={v => setEditedWeight(prev => ({ ...prev, [i]: v }))}
                  payers={payers}
                  eaters={editedEaters[i]}
                  onEatersChange={e => setEditedEaters(prev => ({ ...prev, [i]: e }))}
                />
              ))
            )}

            {/* Custom (manually added) products */}
            {customProducts.length > 0 && (
              <Text style={[styles.sectionLabel, { marginTop: spacing[3] }]}>
                Dodane ręcznie ({customProducts.filter(p => p.name.trim()).length})
              </Text>
            )}
            {customProducts.map((cp, idx) => (
              <CustomProductRow
                key={`custom-${idx}`}
                product={cp}
                onRemove={() => removeCustomProduct(idx)}
                onNameChange={v => setCustomProducts(prev => prev.map((p, i) => i === idx ? { ...p, name: v } : p))}
                onPriceChange={v => setCustomProducts(prev => prev.map((p, i) => i === idx ? { ...p, price: v } : p))}
                onQuantityChange={v => setCustomProducts(prev => prev.map((p, i) => i === idx ? { ...p, quantity: v } : p))}
                onCategoryChange={c => {
                  setCustomProducts(prev => prev.map((p, i) => i === idx ? { ...p, category: c } : p));
                  setCustomCatPickerFor(null);
                }}
                catPickerOpen={customCatPickerFor === idx}
                onCategoryPress={() => { setCustomCatPickerFor(customCatPickerFor === idx ? null : idx); setCatPickerFor(null); setTagPickerFor(null); setCustomTagPickerFor(null); }}
                tagPickerOpen={customTagPickerFor === idx}
                onTagPickerPress={() => { setCustomTagPickerFor(customTagPickerFor === idx ? null : idx); setCustomCatPickerFor(null); setCatPickerFor(null); setTagPickerFor(null); }}
                onTagsChange={tags => setCustomProducts(prev => prev.map((p, i) => i === idx ? { ...p, tags } : p))}
                tagFreq={tagFreq}
              />
            ))}

            {/* Add product button */}
            <PressableScale onPress={addCustomProduct} style={styles.addProductBtn}>
              <Plus size={14} color={colors.accent.green} />
              <Text style={styles.addProductBtnText}>Dodaj produkt ręcznie</Text>
            </PressableScale>
          </ScrollView>

          <View style={styles.footer}>
            {/* Kto zapłacił — domyślnie ja; zaznacz inną osobę gdy płacił ktoś inny */}
            <View style={styles.payerRow}>
              {payers.map(p => {
                const active = payer === p;
                return (
                  <PressableScale key={p} onPress={() => { haptic.tap(); setPayer(active ? '' : p); }} style={[styles.payerChip, active && styles.payerChipActive]}>
                    <Text style={[styles.payerChipText, active && styles.payerChipTextActive]}>{p}</Text>
                  </PressableScale>
                );
              })}
              {addingPayer ? (
                <TextInput
                  value={newPayer}
                  onChangeText={setNewPayer}
                  placeholder="Imię…"
                  placeholderTextColor={colors.text.muted}
                  style={styles.payerInput}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={async () => {
                    const name = newPayer.trim();
                    if (name) { const list = await addPayer(name); setPayers(list); setPayer(name); }
                    setNewPayer(''); setAddingPayer(false);
                  }}
                  onBlur={() => { setNewPayer(''); setAddingPayer(false); }}
                />
              ) : (
                <PressableScale onPress={() => setAddingPayer(true)} style={styles.payerAddChip}>
                  <Text style={styles.payerAddText}>+ osoba</Text>
                </PressableScale>
              )}
            </View>
            {/* Sum reconciliation — catches mis-parsed lines (CENA/Total) */}
            {receipt && receipt.total > 0 && (
              <View style={[styles.reconRow, reconOk ? styles.reconOk : styles.reconWarn]}>
                {reconOk
                  ? <LucideIcons.CheckCircle2 size={14} color={colors.accent.green} />
                  : <LucideIcons.AlertTriangle size={14} color="#FBBF24" />}
                <Text style={styles.reconText}>
                  Zaznaczone: <Text style={styles.reconStrong}>{selectedSum.toFixed(2)} zł</Text>
                  {'  ·  '}Paragon: <Text style={styles.reconStrong}>{receipt.total.toFixed(2)} zł</Text>
                  {!reconOk && <Text style={styles.reconDelta}>{'  '}({reconDelta > 0 ? '+' : ''}{reconDelta.toFixed(2)})</Text>}
                </Text>
              </View>
            )}
            {/* Payment method — auto-detected from the receipt, default Karta */}
            <View style={styles.payRow}>
              <Text style={styles.payLabel}>Płatność</Text>
              {(['card', 'cash'] as const).map(m => (
                <PressableScale key={m} onPress={() => { haptic.tap(); setPaymentMethod(m); }} style={[styles.payChip, paymentMethod === m && styles.payChipOn]}>
                  <Text style={[styles.payChipText, paymentMethod === m && styles.payChipTextOn]}>{m === 'card' ? 'Karta' : 'Gotówka'}</Text>
                </PressableScale>
              ))}
            </View>
            <DatePickerField value={dateInput} onChange={setDateInput} placeholder="Data paragonu" />
            <AnimatedButton
              onPress={saveSelected}
              label={saving ? 'Zapisuję...' : `Zapisz paragon (${selected.size + customProducts.filter(p => p.name.trim()).length} poz.)`}
              icon={<Check size={18} color={colors.bg.primary} />}
              size="lg"
              fullWidth
              disabled={saving || (selected.size === 0 && customProducts.filter(p => p.name.trim()).length === 0)}
            />
          </View>
        </>
      )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Category picker ──────────────────────────────────────────────────────────

const ALL_CATS = Object.entries(CATEGORY_META) as [ExpenseCategory, typeof CATEGORY_META[ExpenseCategory]][];

function CategoryPicker({ current, onSelect }: {
  current: ExpenseCategory;
  onSelect: (cat: ExpenseCategory) => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.pickerScroll}
      contentContainerStyle={styles.pickerRow}
    >
      {ALL_CATS.map(([cat, meta]) => {
        const IconComp = (LucideIcons as any)[meta.icon];
        const active   = cat === current;
        return (
          <PressableScale
            key={cat}
            onPress={() => onSelect(cat)}
            style={[styles.pickerItem, active && { borderColor: meta.color, backgroundColor: meta.color + '18' }]}
          >
            {IconComp && <IconComp size={13} color={active ? meta.color : colors.text.muted} />}
            <Text style={[styles.pickerLabel, active && { color: meta.color }]}>{meta.label}</Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

// ─── TagPicker ────────────────────────────────────────────────────────────────

function TagPicker({ activeTags, onToggle, freq = {} }: {
  activeTags: string[];
  onToggle: (tag: string) => void;
  freq?: Record<string, number>;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // Built-in tags + any previously-used custom tags (from tag memory), by frequency.
  const sorted = useMemo(() => {
    const all = new Set<string>([...ITEM_TAGS, ...Object.keys(freq), ...activeTags]);
    return [...all].sort((a, b) => (freq[b] ?? 0) - (freq[a] ?? 0));
  }, [freq, activeTags]);
  const [custom, setCustom] = useState('');
  const addCustom = () => {
    const t = custom.trim().toLowerCase();
    if (t && !activeTags.includes(t)) onToggle(t);
    setCustom('');
  };
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.pickerScroll}
      contentContainerStyle={styles.pickerRow}
      keyboardShouldPersistTaps="handled"
    >
      {sorted.map(tag => {
        const active = activeTags.includes(tag);
        return (
          <PressableScale key={tag} onPress={() => onToggle(tag)}>
            <View style={[styles.tagPickerItem, active && styles.tagPickerItemActive]}>
              <Text style={[styles.tagPickerItemText, active && styles.tagPickerItemTextActive]}>
                {tag}
              </Text>
            </View>
          </PressableScale>
        );
      })}
      <View style={[styles.tagPickerItem, { flexDirection: 'row', alignItems: 'center', gap: 2 }]}>
        <LucideIcons.Plus size={11} color={colors.text.muted} />
        <TextInput
          value={custom}
          onChangeText={setCustom}
          onSubmitEditing={addCustom}
          onBlur={addCustom}
          placeholder="własny"
          placeholderTextColor={colors.text.muted}
          autoCapitalize="none"
          returnKeyType="done"
          style={{ minWidth: 56, fontSize: 11, color: colors.text.primary, padding: 0 }}
        />
      </View>
    </ScrollView>
  );
}

// ─── ProductRow ───────────────────────────────────────────────────────────────

function ProductRow({
  product, category, selected, onToggle,
  catPickerOpen, onCategoryPress, onCategoryChange,
  priceValue, onPriceChange, priceFlag, productName, onNameChange,
  mergeSuggestion, onMerge, onDismissMerge,
  productTags, onTagsChange, tagPickerOpen, onTagPickerPress, tagFreq,
  excluded, onToggleExcluded, weighable, weight, onWeightChange,
  quantity, onQuantityChange,
  payers, eaters, onEatersChange,
}: {
  product: ReceiptProduct;
  category: ExpenseCategory;
  selected: boolean;
  onToggle: () => void;
  catPickerOpen: boolean;
  onCategoryPress: () => void;
  onCategoryChange: (cat: ExpenseCategory) => void;
  priceValue: string;
  onPriceChange: (v: string) => void;
  priceFlag?: PriceFlag;
  productName: string;
  onNameChange: (v: string) => void;
  mergeSuggestion?: string | null;
  onMerge?: (name: string) => void;
  onDismissMerge?: () => void;
  productTags: string[];
  onTagsChange: (tags: string[]) => void;
  tagPickerOpen: boolean;
  onTagPickerPress: () => void;
  tagFreq?: Record<string, number>;
  excluded?: boolean;
  onToggleExcluded?: () => void;
  weighable?: boolean;
  weight?: string;
  onWeightChange?: (v: string) => void;
  quantity?: string;
  onQuantityChange?: (v: string) => void;
  payers?: string[];
  eaters?: string[];
  onEatersChange?: (eaters: string[]) => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const meta    = getCategoryMeta(category);
  const IconComp = (LucideIcons as any)[meta.icon];

  const isDeposit = product.kind === 'deposit';
  return (
    <View style={styles.productWrap}>
      <View style={[
        styles.productRow,
        selected && styles.productRowSelected,
        !selected && styles.productRowInactive,
        product.suspect && !selected && styles.productRowSuspect,
      ]}>
        <PressableScale onPress={onToggle} style={[styles.checkbox, selected && styles.checkboxDone]}>
          {selected && <Check size={12} color={colors.bg.primary} />}
        </PressableScale>

        {/* Category icon */}
        <View style={styles.catIconWrap}>
          {IconComp && <IconComp size={16} color={colors.text.muted} />}
        </View>

        {/* Product info */}
        <View style={styles.productInfo}>
          {product.suspect && !selected && (
            <View style={styles.suspectBadge}>
              <LucideIcons.HelpCircle size={11} color="#FBBF24" />
              <Text style={styles.suspectText}>To produkt? Zaznacz aby dodać (lub popraw nazwę). Zostaw odznaczone = nie produkt — zapamiętam dla tego sklepu.</Text>
            </View>
          )}
          {isDeposit && (
            <View style={styles.depositBadge}>
              <LucideIcons.Recycle size={11} color={colors.text.muted} />
              <Text style={styles.depositText}>kaucja za butelkę</Text>
            </View>
          )}
          <TextInput
            value={productName}
            onChangeText={onNameChange}
            style={styles.productNameInput}
            placeholder={product.name}
            placeholderTextColor={colors.text.muted}
          />
          {mergeSuggestion && (
            <View style={styles.mergeSugRow}>
              <LucideIcons.GitMerge size={11} color="#46B0DE" />
              <Text style={styles.mergeSugText} numberOfLines={1}>To samo co „{mergeSuggestion}"?</Text>
              <PressableScale onPress={() => onMerge?.(mergeSuggestion)} style={styles.mergeSugBtn}>
                <Text style={styles.mergeSugBtnText}>Scal</Text>
              </PressableScale>
              <PressableScale onPress={() => onDismissMerge?.()} style={styles.mergeSugX}>
                <LucideIcons.X size={13} color={colors.text.muted} />
              </PressableScale>
            </View>
          )}
          {priceFlag?.kind === 'high' && (
            <View style={styles.priceWarnRow}>
              <LucideIcons.AlertTriangle size={11} color="#F59E0B" />
              <Text style={styles.priceWarnText} numberOfLines={2}>
                Cena wygląda za wysoka — zwykle ~{priceFlag.typical.toFixed(2)} zł/szt. Sprawdź, czy to nie linia „suma".
              </Text>
            </View>
          )}
          <View style={styles.productMeta}>
            <PressableScale onPress={onCategoryPress}>
              <View style={[
                styles.catChip,
                catPickerOpen && { borderColor: meta.color, backgroundColor: meta.color + '20' },
              ]}>
                <Text style={[styles.catChipText, catPickerOpen && { color: meta.color }]}>
                  {meta.label}
                </Text>
              </View>
            </PressableScale>
            <PressableScale onPress={onTagPickerPress}>
              <View style={[styles.tagEditBtn, tagPickerOpen && styles.tagEditBtnActive]}>
                <Tag size={9} color={tagPickerOpen ? colors.accent.blue : colors.text.muted} />
                <Text style={[styles.tagEditBtnText, tagPickerOpen && { color: colors.accent.blue }]}>
                  {productTags.length > 0 ? (productTags.length === 1 ? '1 tag' : `${productTags.length} tagi`) : 'tagi'}
                </Text>
              </View>
            </PressableScale>
            {!isDeposit && onToggleExcluded && (
              <PressableScale onPress={onToggleExcluded}>
                <View style={[styles.exclBtn, excluded && styles.exclBtnActive]}>
                  <LucideIcons.UserMinus size={9} color={excluded ? '#FBBF24' : colors.text.muted} />
                  <Text style={[styles.exclBtnText, excluded && { color: '#FBBF24' }]}>
                    {excluded ? 'nie moje' : 'moje'}
                  </Text>
                </View>
              </PressableScale>
            )}
            {!isDeposit && onQuantityChange && (
              <View style={styles.weighChip}>
                <TextInput
                  value={quantity}
                  onChangeText={onQuantityChange}
                  keyboardType="decimal-pad"
                  placeholder={String(product.quantity)}
                  placeholderTextColor={colors.text.muted}
                  style={styles.weighInput}
                  selectTextOnFocus
                />
                <Text style={styles.weighUnit}>szt</Text>
              </View>
            )}
            {!isDeposit && weighable && (
              <View style={styles.weighChip}>
                <LucideIcons.Scale size={9} color="#60A5FA" />
                <TextInput
                  value={weight}
                  onChangeText={onWeightChange}
                  keyboardType="decimal-pad"
                  placeholder="250"
                  placeholderTextColor={colors.text.muted}
                  style={styles.weighInput}
                  selectTextOnFocus
                />
                <Text style={styles.weighUnit}>{(parseFloat((quantity ?? '').replace(',', '.')) || product.quantity) > 1 ? 'g/szt' : 'g'}</Text>
              </View>
            )}
            {product.promotion && (
              <View style={styles.promoBadge}>
                <Tag size={9} color={colors.accent.success} />
                <Text style={styles.promoText}>{product.promotion}</Text>
              </View>
            )}
          </View>
          {productTags.length > 0 && (
            <View style={styles.tagRow}>
              {productTags.map(t => (
                <View key={t} style={styles.tagChip}>
                  <Text style={styles.tagChipText}>{t}</Text>
                </View>
              ))}
            </View>
          )}
          {!isDeposit && onEatersChange && payers && payers.length >= 2 && (
            <View style={styles.eaterRow}>
              <Text style={styles.eaterLabel}>kto jadł:</Text>
              {payers.map(p => {
                const on = (eaters ?? []).includes(p);
                return (
                  <PressableScale key={p} onPress={() => {
                    const cur = eaters ?? [];
                    onEatersChange(on ? cur.filter(x => x !== p) : [...cur, p]);
                  }}>
                    <View style={[styles.eaterChip, on && styles.eaterChipOn]}>
                      <Text style={[styles.eaterChipText, on && styles.eaterChipTextOn]}>{p}</Text>
                    </View>
                  </PressableScale>
                );
              })}
              {(eaters ?? []).length === 0 && <Text style={styles.eaterHint}>· wspólnie</Text>}
            </View>
          )}
        </View>

        {/* Editable price */}
        <View style={styles.priceCol}>
          {product.discount != null && product.discount > 0 && (
            <Text style={styles.originalPrice}>
              {(product.finalPrice + product.discount).toFixed(2)} zł
            </Text>
          )}
          <View style={styles.priceInputWrap}>
            <TextInput
              value={priceValue}
              onChangeText={onPriceChange}
              style={styles.priceInput}
              keyboardType="decimal-pad"
              selectTextOnFocus
            />
            <Text style={styles.priceCur}>zł</Text>
          </View>
        </View>
      </View>

      {catPickerOpen && (
        <CategoryPicker current={category} onSelect={onCategoryChange} />
      )}
      {tagPickerOpen && (
        <TagPicker
          activeTags={productTags}
          freq={tagFreq}
          onToggle={tag => {
            const next = productTags.includes(tag)
              ? productTags.filter(t => t !== tag)
              : [...productTags, tag];
            onTagsChange(next);
          }}
        />
      )}
    </View>
  );
}

// ─── CustomProductRow ─────────────────────────────────────────────────────────

function CustomProductRow({
  product, onRemove, onNameChange, onPriceChange, onQuantityChange, onCategoryChange,
  catPickerOpen, onCategoryPress, tagPickerOpen, onTagPickerPress, onTagsChange, tagFreq,
}: {
  product: { name: string; price: string; quantity: string; category: ExpenseCategory; tags: string[] };
  onRemove: () => void;
  onNameChange: (name: string) => void;
  onPriceChange: (price: string) => void;
  onQuantityChange: (qty: string) => void;
  onCategoryChange: (cat: ExpenseCategory) => void;
  catPickerOpen: boolean;
  onCategoryPress: () => void;
  tagPickerOpen: boolean;
  onTagPickerPress: () => void;
  onTagsChange: (tags: string[]) => void;
  tagFreq?: Record<string, number>;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const meta     = getCategoryMeta(product.category);
  const IconComp = (LucideIcons as any)[meta.icon];

  return (
    <View style={styles.productWrap}>
      <View style={[styles.productRow, styles.customRow]}>
        {/* Delete */}
        <PressableScale onPress={onRemove} style={styles.deleteCustomBtn}>
          <Trash2 size={13} color={colors.accent.red} />
        </PressableScale>

        {/* Category icon */}
        <View style={[styles.catIconWrap, { backgroundColor: meta.color + '18' }]}>
          {IconComp && <IconComp size={16} color={meta.color} />}
        </View>

        {/* Name + category chip */}
        <View style={styles.productInfo}>
          <TextInput
            value={product.name}
            onChangeText={onNameChange}
            style={[styles.productNameInput, { color: colors.text.primary }]}
            placeholder="Nazwa produktu..."
            placeholderTextColor={colors.text.muted}
            autoFocus={product.name === ''}
          />
          <View style={styles.productMeta}>
            <PressableScale onPress={onCategoryPress}>
              <View style={[styles.catChip, { borderColor: meta.color + '60', backgroundColor: meta.color + '14' }]}>
                <Text style={[styles.catChipText, { color: meta.color }]}>{meta.label}</Text>
              </View>
            </PressableScale>
            <PressableScale onPress={onTagPickerPress}>
              <View style={[styles.tagEditBtn, tagPickerOpen && styles.tagEditBtnActive]}>
                <Tag size={9} color={tagPickerOpen ? colors.accent.blue : colors.text.muted} />
                <Text style={[styles.tagEditBtnText, tagPickerOpen && { color: colors.accent.blue }]}>
                  {product.tags.length > 0 ? (product.tags.length === 1 ? '1 tag' : `${product.tags.length} tagi`) : 'tagi'}
                </Text>
              </View>
            </PressableScale>
          </View>
          {product.tags.length > 0 && (
            <View style={styles.tagRow}>
              {product.tags.map(t => (
                <View key={t} style={styles.tagChip}>
                  <Text style={styles.tagChipText}>{t}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Qty + price */}
        <View style={styles.customPriceCol}>
          <View style={styles.priceInputWrap}>
            <TextInput
              value={product.price}
              onChangeText={onPriceChange}
              style={styles.priceInput}
              keyboardType="decimal-pad"
              selectTextOnFocus
            />
            <Text style={styles.priceCur}>zł</Text>
          </View>
          <View style={styles.qtyRow}>
            <TextInput
              value={product.quantity}
              onChangeText={onQuantityChange}
              style={styles.qtyInput}
              keyboardType="decimal-pad"
              selectTextOnFocus
              placeholder="1"
              placeholderTextColor={colors.text.muted}
            />
            <Text style={styles.qtySuffix}>szt/kg</Text>
          </View>
        </View>
      </View>

      {catPickerOpen && (
        <CategoryPicker current={product.category} onSelect={onCategoryChange} />
      )}
      {tagPickerOpen && (
        <TagPicker
          activeTags={product.tags}
          freq={tagFreq}
          onToggle={tag => {
            const next = product.tags.includes(tag)
              ? product.tags.filter(t => t !== tag)
              : [...product.tags, tag];
            onTagsChange(next);
          }}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (c: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.secondary },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: c.border.subtle,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: c.bg.card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: c.border.default,
  },
  title: { ...typography.h4, color: c.text.primary },

  attachBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: spacing[4], marginTop: spacing[3],
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    backgroundColor: c.accent.blue + '14', borderRadius: radius.md,
    borderWidth: 1, borderColor: c.accent.blue + '40',
  },
  attachBannerText: { flex: 1, fontSize: 12, fontWeight: '600', color: c.accent.blue, lineHeight: 16 },

  // ── Text paste input ────────────────────────────────────────────────────────
  pasteInput: {
    flex: 1,
    backgroundColor: c.bg.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: c.border.default,
    padding: spacing[4], color: c.text.primary,
    fontSize: 12, lineHeight: 18,
    fontFamily: 'monospace',
  },

  manualBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2],
    paddingVertical: spacing[3], borderRadius: radius.lg,
    borderWidth: 1, borderColor: c.border.default,
    backgroundColor: c.bg.card,
  },
  manualBtnText: { fontSize: 13, fontWeight: '600', color: c.text.secondary },

  // ── Receipt meta ───────────────────────────────────────────────────────────
  receiptMeta: {
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: c.border.subtle, gap: spacing[2],
  },
  storeName: { ...typography.h4, color: c.text.primary },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  discountBadge: {
    backgroundColor: c.accent.success + '22',
    paddingHorizontal: spacing[2], paddingVertical: 3, borderRadius: radius.sm,
  },
  discountText: { ...typography.caption, color: c.accent.success, fontWeight: '600' },
  total: { ...typography.label, color: c.text.primary, fontWeight: '700' },
  mismatchBadge: {
    backgroundColor: c.accent.warning + '18',
    borderRadius: radius.sm,
    paddingHorizontal: spacing[2], paddingVertical: 4,
    borderLeftWidth: 2, borderLeftColor: c.accent.warning,
  },
  mismatchText: { fontSize: 10, color: c.accent.warning, fontWeight: '500', lineHeight: 15 },

  // ── Sort bar ───────────────────────────────────────────────────────────────
  sortBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
    borderBottomWidth: 1, borderBottomColor: c.border.subtle,
  },
  sortPill: {
    paddingHorizontal: spacing[3], paddingVertical: 6,
    borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default,
    backgroundColor: c.bg.card,
  },
  sortPillActive: { backgroundColor: c.text.primary, borderColor: c.text.primary },
  sortText: { fontSize: 11, fontWeight: '600', color: c.text.muted },
  sortTextActive: { color: c.text.inverse },
  toggleAllBtn: {
    paddingHorizontal: spacing[3], paddingVertical: 6,
    borderRadius: radius.full, borderWidth: 1,
    borderColor: c.border.default,
  },
  toggleAllText: { fontSize: 10, fontWeight: '500', color: c.text.muted },

  // ── Product list ───────────────────────────────────────────────────────────
  productList: { padding: spacing[4], gap: spacing[2], paddingBottom: 100 },
  sectionLabel: {
    ...typography.caption, color: c.text.muted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing[1],
  },

  // ── Category group header ──────────────────────────────────────────────────
  groupHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingVertical: spacing[2], paddingHorizontal: spacing[1],
    marginTop: spacing[2],
  },
  groupIconWrap: {
    width: 22, height: 22, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  groupName: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  groupCount: { fontSize: 10, color: c.text.muted, marginLeft: 2 },
  groupTotal: { fontSize: 12, fontWeight: '700', color: c.text.primary },

  // ── Product row ────────────────────────────────────────────────────────────
  productWrap: { marginBottom: spacing[2] },
  productRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    padding: spacing[3], backgroundColor: c.bg.card,
    borderRadius: radius.md, borderWidth: 1, borderColor: c.border.subtle,
  },
  productRowSelected: { borderColor: c.border.focus, backgroundColor: c.border.subtle },
  productRowInactive: { opacity: 0.5 },
  productRowSuspect: { opacity: 0.92, borderColor: 'rgba(251,191,36,0.45)', backgroundColor: 'rgba(251,191,36,0.06)' },
  suspectBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  suspectText: { flex: 1, fontSize: 10, color: '#FBBF24', fontWeight: '600', lineHeight: 13 },
  depositBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  depositText: { fontSize: 10, color: c.text.muted, fontWeight: '600' },
  reconRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingVertical: 8, paddingHorizontal: spacing[3], borderRadius: radius.md, borderWidth: 1,
  },
  reconOk: { backgroundColor: 'rgba(42,198,143,0.08)', borderColor: 'rgba(42,198,143,0.35)' },
  reconWarn: { backgroundColor: 'rgba(251,191,36,0.08)', borderColor: 'rgba(251,191,36,0.4)' },
  reconText: { flex: 1, fontSize: 11.5, color: c.text.secondary },
  reconStrong: { color: c.text.primary, fontWeight: '700' },
  reconDelta: { color: '#FBBF24', fontWeight: '700' },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 2,
    borderColor: c.border.default, alignItems: 'center', justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: c.text.primary, borderColor: c.text.primary },
  catIconWrap: {
    width: 32, height: 32, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.border.subtle,
  },
  productInfo: { flex: 1, gap: 4 },
  productName: { ...typography.bodySmall, color: c.text.primary, fontWeight: '500' },
  productMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' },
  productMetaText: { ...typography.caption, color: c.text.muted },

  catChip: {
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5,
    borderWidth: 1, borderColor: c.border.default,
    backgroundColor: c.border.subtle,
  },
  catChipText: { fontSize: 10, color: c.text.muted, fontWeight: '600' },

  promoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: c.accent.success + '22',
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4,
  },
  promoText: { ...typography.caption, color: c.accent.success, fontWeight: '600', fontSize: 10 },

  priceCol: { alignItems: 'flex-end', gap: 1 },
  originalPrice: { ...typography.caption, color: c.text.muted, textDecorationLine: 'line-through' },
  price: { ...typography.label, fontWeight: '700', color: c.text.primary },
  priceInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  priceInput: {
    fontSize: 13, fontWeight: '700', color: c.text.primary,
    minWidth: 44, textAlign: 'right', paddingVertical: 0,
    borderBottomWidth: 1, borderBottomColor: c.border.subtle,
  },
  priceCur: { fontSize: 11, color: c.text.muted, fontWeight: '500' },

  // ── Category picker ────────────────────────────────────────────────────────
  pickerScroll: {
    backgroundColor: c.bg.elevated,
    borderBottomLeftRadius: radius.md,
    borderBottomRightRadius: radius.md,
    borderWidth: 1, borderTopWidth: 0, borderColor: c.border.default,
  },
  pickerRow: {
    flexDirection: 'row', gap: spacing[2],
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: spacing[3], paddingVertical: 7,
    borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default,
    backgroundColor: c.border.subtle,
  },
  pickerLabel: { fontSize: 11, fontWeight: '600', color: c.text.muted },

  // ── Footer ─────────────────────────────────────────────────────────────────
  footer: { padding: spacing[4], gap: spacing[2], borderTopWidth: 1, borderTopColor: c.border.subtle },
  payerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  payerChip: {
    paddingHorizontal: spacing[3], height: 32, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.elevated,
  },
  payerChipActive: { backgroundColor: c.accent.blue + '20', borderColor: c.accent.blue },
  payerChipText: { fontSize: 13, fontWeight: '600', color: c.text.muted },
  payerChipTextActive: { color: c.accent.blue },
  payerInput: {
    paddingHorizontal: spacing[3], height: 32, minWidth: 90, borderRadius: radius.full,
    borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.elevated,
    fontSize: 13, color: c.text.primary,
  },
  payerAddChip: {
    paddingHorizontal: spacing[3], height: 32, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: c.border.subtle, borderStyle: 'dashed',
  },
  payerAddText: { fontSize: 13, fontWeight: '600', color: c.text.secondary },

  payRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  payLabel: { fontSize: 12, fontWeight: '600', color: c.text.muted, marginRight: spacing[1] },
  payChip: {
    flex: 1, alignItems: 'center', paddingVertical: spacing[2],
    backgroundColor: c.bg.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: c.border.default,
  },
  payChipOn: { backgroundColor: c.accent.blue + '20', borderColor: c.accent.blue },
  payChipText: { fontSize: 13, fontWeight: '700', color: c.text.muted },
  payChipTextOn: { color: c.accent.blue },

  // ── Editable product name ─────────────────────────────────────────────────
  productNameInput: {
    fontSize: 13, fontWeight: '500', color: c.text.primary,
    padding: 0, flex: 1,
  },
  mergeSugRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  mergeSugText: { flex: 1, fontSize: 10.5, color: '#46B0DE', fontWeight: '600' },
  priceWarnRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginTop: 4, backgroundColor: '#F59E0B18', borderRadius: 8, paddingVertical: 5, paddingHorizontal: 7 },
  priceWarnText: { flex: 1, fontSize: 10.5, color: '#F59E0B', fontWeight: '600', lineHeight: 14 },
  mergeSugBtn: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.full, backgroundColor: '#46B0DE22', borderWidth: 1, borderColor: '#46B0DE55' },
  mergeSugBtnText: { fontSize: 10.5, fontWeight: '800', color: '#46B0DE' },
  mergeSugX: { padding: 2 },

  // ── Custom product qty/price column ──────────────────────────────────────
  customPriceCol: { alignItems: 'flex-end', gap: 3 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  qtyInput: {
    fontSize: 10, fontWeight: '600', color: c.text.muted,
    minWidth: 32, textAlign: 'right', paddingVertical: 0,
    borderBottomWidth: 1, borderBottomColor: c.border.subtle,
  },
  qtySuffix: { fontSize: 9, color: c.text.muted },

  // ── Custom product row ────────────────────────────────────────────────────
  customRow: {
    borderColor: c.accent.green + '30',
    backgroundColor: c.accent.green + '06',
  },
  deleteCustomBtn: {
    width: 28, height: 28, borderRadius: radius.sm,
    backgroundColor: c.accent.red + '15', borderWidth: 1, borderColor: c.accent.red + '30',
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Add product button ────────────────────────────────────────────────────
  addProductBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2],
    paddingVertical: spacing[3], borderRadius: radius.md,
    borderWidth: 1, borderColor: c.accent.green + '40', borderStyle: 'dashed',
    backgroundColor: c.accent.green + '08', marginTop: spacing[1],
  },
  addProductBtnText: { fontSize: 13, fontWeight: '600', color: c.accent.green },

  // ── Tag chips & picker ────────────────────────────────────────────────────
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  tagChip: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
    backgroundColor: c.accent.blue + '18',
    borderWidth: 1, borderColor: c.accent.blue + '35',
  },
  tagChipText: { fontSize: 9, fontWeight: '600', color: c.accent.blue },
  tagEditBtn: {
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4,
    borderWidth: 1, borderColor: c.border.default,
    backgroundColor: c.border.subtle,
    flexDirection: 'row', alignItems: 'center', gap: 2,
  },
  tagEditBtnActive: { borderColor: c.accent.blue + '60', backgroundColor: c.accent.blue + '12' },
  tagEditBtnText: { fontSize: 9, color: c.text.muted },
  exclBtn: {
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4,
    borderWidth: 1, borderColor: c.border.default,
    backgroundColor: c.border.subtle,
    flexDirection: 'row', alignItems: 'center', gap: 2,
  },
  exclBtnActive: { borderColor: 'rgba(251,191,36,0.5)', backgroundColor: 'rgba(251,191,36,0.12)' },
  exclBtnText: { fontSize: 9, color: c.text.muted },
  eaterRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginTop: 5 },
  eaterLabel: { fontSize: 9, color: c.text.muted, fontWeight: '600' },
  eaterChip: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.full,
    borderWidth: 1, borderColor: c.border.default, backgroundColor: c.border.subtle,
  },
  eaterChipOn: { borderColor: 'rgba(74,203,168,0.6)', backgroundColor: 'rgba(74,203,168,0.15)' },
  eaterChipText: { fontSize: 10, color: c.text.muted, fontWeight: '600' },
  eaterChipTextOn: { color: '#4ECBA8' },
  eaterHint: { fontSize: 9, color: c.text.muted, fontStyle: 'italic' },
  weighChip: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4,
    borderWidth: 1, borderColor: 'rgba(96,165,250,0.4)', backgroundColor: 'rgba(96,165,250,0.10)',
  },
  weighInput: { minWidth: 22, fontSize: 10, fontWeight: '700', color: '#60A5FA', padding: 0, textAlign: 'center' },
  weighUnit: { fontSize: 9, color: '#60A5FA', fontWeight: '600' },
  tagPickerItem: {
    paddingHorizontal: spacing[3], paddingVertical: 7,
    borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default,
    backgroundColor: c.border.subtle,
  },
  tagPickerItemActive: { borderColor: c.accent.blue, backgroundColor: c.accent.blue + '18' },
  tagPickerItemText: { fontSize: 11, fontWeight: '600', color: c.text.muted },
  tagPickerItemTextActive: { color: c.accent.blue },
});
