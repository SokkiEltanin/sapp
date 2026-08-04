import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDocs, limit, query } from 'firebase/firestore';
import { auth, userCol } from '@/services/firebase';
import { ymd, todayISO, localISO } from '@/utils/date';
import { usePetStore } from '@/store/petStore';
import { getLastBackup } from '@/services/backupService';

// Autodiagnostyka uruchamiana z Ustawień → „Self-test aplikacji". Sprawdza rzeczy, które
// psuły się PO CICHU (daty w UTC, pamięć, chmura/backup na planie Spark, hydracja store'ów).
// Każdy test w try/catch → jeden zły nie wywala reszty. Sieć ograniczona timeoutem.

export interface SelfCheck { name: string; ok: boolean; detail: string; }

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

export async function runSelfTest(): Promise<SelfCheck[]> {
  const out: SelfCheck[] = [];

  // 1. Daty lokalne — istota buga „północ to nie północ": kubełki dnia muszą być lokalne.
  try {
    const a = localISO(new Date(2026, 7, 3, 0, 30, 0)).slice(0, 10) === '2026-08-03';
    const b = localISO().slice(0, 10) === todayISO();
    const c = ymd(new Date(2026, 0, 5)) === '2026-01-05';
    const ok = a && b && c;
    out.push({ name: 'Daty lokalne', ok, detail: ok ? 'dzień liczony lokalnie (nie UTC) ✓' : 'UWAGA: dzień może wpadać na wczoraj po północy' });
  } catch (e: any) { out.push({ name: 'Daty lokalne', ok: false, detail: String(e?.message ?? e) }); }

  // 2. Pamięć lokalna — zapis/odczyt/kasowanie próbki.
  try {
    const k = '__selftest_probe__', v = String(Date.now());
    await AsyncStorage.setItem(k, v);
    const got = await AsyncStorage.getItem(k);
    await AsyncStorage.removeItem(k);
    out.push({ name: 'Pamięć lokalna', ok: got === v, detail: got === v ? 'zapis/odczyt działa' : 'zapis/odczyt NIE działa' });
  } catch (e: any) { out.push({ name: 'Pamięć lokalna', ok: false, detail: String(e?.message ?? e) }); }

  // 3. Hydracja portfela pupila (reprezentatywny store).
  try {
    const h = usePetStore.getState()._hydrated;
    out.push({ name: 'Store pupila', ok: !!h, detail: h ? 'wczytany' : 'jeszcze się wczytuje' });
  } catch (e: any) { out.push({ name: 'Store pupila', ok: false, detail: String(e?.message ?? e) }); }

  // 4. Chmura (Firestore) — czy backup w ogóle się łączy (ważne po zjeździe Blaze→Spark).
  try {
    if (!auth.currentUser) {
      out.push({ name: 'Chmura (Firestore)', ok: true, detail: 'niezalogowany — pominięto (dane lokalne działają)' });
    } else {
      await withTimeout(getDocs(query(userCol('expenses'), limit(1))), 6000);
      out.push({ name: 'Chmura (Firestore)', ok: true, detail: 'połączenie OK — plan Spark w zupełności wystarcza' });
    }
  } catch (e: any) {
    out.push({ name: 'Chmura (Firestore)', ok: false, detail: `brak połączenia: ${String(e?.message ?? e)}` });
  }

  // 5. Backup w chmurze — kiedy był ostatni.
  try {
    const last: any = await getLastBackup();
    if (!last) out.push({ name: 'Backup w chmurze', ok: true, detail: 'brak jeszcze — zrób pierwszy backup w Ustawieniach' });
    else {
      const when = last.createdAt ?? last.at ?? last.date ?? last.timestamp;
      out.push({ name: 'Backup w chmurze', ok: true, detail: when ? `ostatni: ${new Date(when).toLocaleString('pl-PL')}` : 'istnieje' });
    }
  } catch (e: any) { out.push({ name: 'Backup w chmurze', ok: false, detail: String(e?.message ?? e) }); }

  return out;
}
