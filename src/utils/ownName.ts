import AsyncStorage from '@react-native-async-storage/async-storage';

// Własne imię/nazwisko usera (2026-09-13, user: "trzeba dodać kategorie przelew własny
// jak jest do Wiktor Rudziński... to znaczy ze to przelew wewnętrzny do mnie samego i to
// nie zalicza sie do wydatków lub przychodów") — bank push przy przelewie między WŁASNYMI
// kontami (nie do Revolut/oszczędności, po prostu drugie konto na to samo nazwisko) niesie
// `odbiorca: <Imię Nazwisko>` (patrz bankNotification.ts — "Wiktor Rudziński" był realnym
// przykładem z powiadomienia, stąd dokładnie ta nazwa w komentarzu tamtego pliku), bez
// żadnego słowa-klucza typu "Revolut"/"oszczędności" które dotychczasowy `selfTransfer`
// już łapał. Ten moduł: user wpisuje swoje imię+nazwisko RAZ w Ustawieniach, dalej
// `parseBankNotification` porównuje `odbiorca` z tą wartością (normalizowane, patrz
// `normalizeName`) — dokładnie ten sam wzorzec cache'u co `food.ts` (`userNonFood`):
// wczytane raz przy starcie apki, potem czysta, synchroniczna funkcja bez await w gorącej
// ścieżce parsowania powiadomień.
const OWN_NAME_KEY = 'own_name_v1';
let ownName = '';

export function normalizeName(s: string): string {
  const DIACRITICS: Record<string, string> = { ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ż: 'z', ź: 'z' };
  return s.toLowerCase().trim()
    .replace(/[ąćęłńóśżź]/g, c => DIACRITICS[c] ?? c)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function getOwnName(): string {
  return ownName;
}

export async function setOwnName(name: string): Promise<void> {
  ownName = name.trim();
  try { await AsyncStorage.setItem(OWN_NAME_KEY, ownName); } catch {}
}

export async function loadOwnName(): Promise<string> {
  try { ownName = (await AsyncStorage.getItem(OWN_NAME_KEY)) ?? ''; } catch { ownName = ''; }
  return ownName;
}

// Czy `text` (np. pole "odbiorca" z powiadomienia banku) zawiera skonfigurowane własne
// imię+nazwisko? Puste `ownName`/`text` → zawsze false (nic nie skonfigurowane = nic nie
// dopasuj, nie zgaduj). Dopasowanie substring po normalizacji — "Wiktor Rudziński Revolut"
// zawiera znormalizowane "wiktor rudzinski" mimo dodatkowego słowa "Revolut" na końcu.
export function matchesOwnName(text: string): boolean {
  if (!ownName || !text) return false;
  return normalizeName(text).includes(normalizeName(ownName));
}
