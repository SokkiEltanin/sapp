// Czytelny tekstowy raport postępu pupila/walk bossów — do wklejenia w rozmowie z Claude
// przy testowaniu balansu nowej krzywej bossów (2026-08-14, patrz NEXT_STEPS.md). Czysta
// funkcja (state → string), żeby dało się testować bez odpalania całego Zustand store.
import { BOSSES, bossBonuses, atkPower, atkMultiplier, dailyAttempts, BASE_ATK, combatItemSlotsFor } from '@/utils/bosses';
import { COMBAT_ITEMS, CombatItemId } from '@/utils/combatItems';
import { levelFromXp, effectiveCatMaxHp, CAT_BASE_MAX_HP, type BossLogEntry } from '@/store/petStore';
import { gearCombatBonuses, GearSlot, OwnedGear } from '@/utils/gear';
import { ActivePotion } from '@/utils/potions';
import { plPlural } from '@/utils/plural';

export interface ProgressReportInput {
  xp: number;
  coins: number;
  atkStatBonus: number;
  catMaxHpBonus: number;
  ownedItems: string[];
  defeatedBosses: string[];
  ownedCombatItems: Partial<Record<CombatItemId, number>>;
  equippedCombatItems: CombatItemId[];
  raidWon: string[];
  eventWon: string[];
  bossLog: BossLogEntry[];
  resetGeneration?: number;   // 2026-08-17 — patrz komentarz w petStore.ts. Opcjonalne, żeby
  lastResetAt?: string | null; // istniejące wywołania/testy bez tych pól dalej działały.
  equippedGear?: Partial<Record<GearSlot, string>>;   // 2026-08-19 — krok 8, opcjonalne z tego
  ownedGear?: Partial<Record<string, OwnedGear>>;    // samego powodu co pola resetu wyżej.
  activePotion?: ActivePotion | null; // 2026-09-21 — jw., patrz komentarz przy `maxHp` niżej.
}

const KIND_LABEL: Record<BossLogEntry['kind'], string> = {
  campaign: 'kampania', raid: 'raid', event: 'wydarzenie', quest: 'quest', mad: 'MAD', mission: 'misja',
};

// 2026-09-19, user: "zrob potem pełna historie eksportu pupila bo pozniej te bossy stają sie
// tak wiele XP i coinow... wbiłem z 51 lvl na 270" — dotąd `logLimit` (domyślnie 30) po prostu
// UCINAŁ starsze wpisy z raportu, więc przy dużym `bossLog` (setki walk po takim skoku
// poziomów) większość historii była NIEWIDOCZNA w eksporcie, nie tylko skrócona. Teraz nic nie
// znika: najnowsze `detailLimit` wpisów dostają pełny przebieg runda-po-rundzie (jak dotąd,
// potrzebne do oceny "jak trudna była TA konkretna walka"), a WSZYSTKIE starsze trafiają do
// osobnej, zwięzłej sekcji (jedna linia: kiedy/rodzaj/nazwa/poziom/wynik/nagroda) — to
// wystarcza żeby odtworzyć krzywą XP/monet w czasie (dokładnie to czego user chce do analizy
// tego skoku), bez rozdymania eksportu do nieczytelnego/nieudostępnialnego rozmiaru pełnym
// przebiegiem KAŻDEJ z potencjalnie setek walk.
export function buildBossProgressReport(s: ProgressReportInput, detailLimit = 30): string {
  const lvl = levelFromXp(s.xp);
  const equippedGear = s.equippedGear ?? {};
  const ownedGear = s.ownedGear ?? {};
  const gear = gearCombatBonuses(equippedGear, ownedGear);
  const loot = bossBonuses(s.ownedItems);
  const bonuses = { atk: loot.atk + gear.atk, dodge: loot.dodge + gear.dodge, crit: loot.crit + gear.crit, energyMult: loot.energyMult + gear.energyMult };
  const power = atkPower(s.atkStatBonus, lvl.level, bonuses);
  const mult = atkMultiplier(lvl.level, bonuses);
  // Musi wołać TĘ SAMĄ funkcję co realna walka (`effectiveCatMaxHp` w petStore.ts), nie
  // reimplementować wzoru ręcznie — poprzednia wersja (`catMaxHp(...) + gearFlatHp(...)`, bez
  // `Math.round`/`potionFlatHp`) dawała (1) brzydki, nierealny float w eksporcie (np.
  // "6558.331368923098" zamiast zaokrąglonej liczby jak wszędzie indziej w apce) i (2) ZŁĄ
  // wartość gdy user miał aktywną miksturę HP (pomijała `potionFlatHp` całkowicie) — 2026-09-21,
  // wychwycone w eksporcie postępu pupila usera.
  const maxHp = effectiveCatMaxHp(s.catMaxHpBonus, equippedGear, ownedGear, s.activePotion ?? null);
  const attempts = dailyAttempts(bonuses.energyMult);
  const slots = combatItemSlotsFor(lvl.level);

  const lines: string[] = [];
  lines.push(`STAN PUPILA — ${new Date().toLocaleString('pl-PL')}`);
  // Numer rundy testowej (2026-08-17, user: "niech reset pupila tworzy nowy log danych
  // żeby było wiadomo które od czego") — bez tego dwa eksporty po dwóch różnych resetach
  // wyglądają identycznie ("Poziom 1, log pusty"), nie dało się ich odróżnić w rozmowie.
  if (s.resetGeneration != null) {
    const resetInfo = s.lastResetAt ? ` (ostatni reset: ${new Date(s.lastResetAt).toLocaleString('pl-PL')})` : ' (jeszcze bez resetu)';
    lines.push(`Runda testowa: #${s.resetGeneration}${resetInfo}`);
  }
  lines.push('');
  lines.push(`Poziom: ${lvl.level} (${lvl.inLevel}/${lvl.needed} XP w poziomie, ${s.xp} XP total)`);
  lines.push(`Monety: ${s.coins}`);
  lines.push(`ATK: baza ${BASE_ATK} + kupione ${s.atkStatBonus} = ${Math.round(power)} realnej mocy (×${mult.toFixed(2)} mnożnik z poziomu+łupu)`);
  lines.push(`HP kotka: ${maxHp} (baza ${CAT_BASE_MAX_HP} + kupione ${s.catMaxHpBonus})`);
  // 0.1% precyzja (2026-08-26, user: "te statystyki jak atak unik itp musimy pokazywać 0.1
  // dokladnosci") — ta sama zmiana co w pet.tsx, żeby raport zgadzał się z tym co user widzi
  // na ekranie Pupila.
  lines.push(`Próby ataku/dzień: ${attempts}${bonuses.energyMult > 0 ? ` (+${(bonuses.energyMult * 100).toFixed(1)}% z łupu)` : ''}`);
  lines.push(`Sloty na umiejętności bossów: ${slots}`);
  if (bonuses.dodge > 0 || bonuses.crit > 0) {
    lines.push(`Bonusy z łupu bossów: +${(bonuses.dodge * 100).toFixed(1)}% unik, +${(bonuses.crit * 100).toFixed(1)}% kryt`);
  }
  lines.push('');

  const defeatedSet = new Set(s.defeatedBosses);
  const current = BOSSES.find(b => !defeatedSet.has(b.id));
  lines.push(`BOSSOWIE KAMPANII: ${s.defeatedBosses.length}/${BOSSES.length} pokonanych`);
  for (const b of BOSSES) {
    // Status ikony (2026-08-17, po usunięciu progu poziomu z odblokowania kampanii —
    // patrz NEXT_STEPS.md "Odblokowanie kampanii bez progu poziomu") — odblokowanie jest
    // TERAZ czysto sekwencyjne (pokonaj poprzedniego), więc 🔒/Lv-próg nie ma już sensu;
    // jedyne stany to pokonany / aktualny cel / jeszcze nie w kolejce.
    const status = defeatedSet.has(b.id) ? '✓' : current?.id === b.id ? '▶' : '·';
    // Szacunek ciosów potrzebnych PRZY AKTUALNYCH statach gracza (nie zerowej mocy jak
    // sam `b.hp` zakłada w danych) — dokładnie ta liczba, którą ręcznie liczyłem throwaway-
    // symulacjami przy balansowaniu; user (2026-08-17): "zebrać dane pod eksport... oparte
    // na poziomie ulepszenia" — to bezpośrednio to. `guard` (×0.5 dmg gracza) wliczone,
    // wariancja/kryt/dodge pominięte (środek zakresu, nie dokładna symulacja rundy po rundzie).
    const effPower = power * (b.guard ? 0.5 : 1);
    const hitsAtCurrentStats = effPower > 0 ? Math.ceil(b.hp / effPower) : Infinity;
    lines.push(`  ${status} ${b.emoji} ${b.name} — Lv${b.unlockLevel}, ${b.hp} HP${b.guard ? ', guard' : ''}${b.regenPct ? `, regen ${Math.round(b.regenPct * 100)}%` : ''} · ~${hitsAtCurrentStats} ciosów przy Twoich statach`);
  }
  lines.push('');

  lines.push(`RAID: ${s.raidWon.length} tygodni pokonanych`);
  lines.push(`WYDARZENIA: ${s.eventWon.length} pokonanych`);
  lines.push('');

  const ownedCombatIds = (Object.keys(s.ownedCombatItems) as CombatItemId[]).filter(id => s.ownedCombatItems[id]);
  lines.push(`UMIEJĘTNOŚCI BOSSÓW (${ownedCombatIds.length} posiadanych):`);
  if (ownedCombatIds.length === 0) lines.push('  (brak)');
  for (const id of ownedCombatIds) {
    const def = COMBAT_ITEMS[id];
    const itemLevel = s.ownedCombatItems[id];
    const equipped = s.equippedCombatItems.includes(id) ? ' [ZAŁOŻONY]' : '';
    lines.push(`  ${def.name} — poziom ${itemLevel}/${def.maxLevel}${equipped}`);
  }
  lines.push('');

  const sortedLog = [...s.bossLog].sort((a, b) => b.at.localeCompare(a.at));
  const detailed = sortedLog.slice(0, detailLimit);
  const rest = sortedLog.slice(detailLimit);

  lines.push(`LOG WALK — pełna historia (${sortedLog.length} łącznie, szczegóły ostatnich ${detailed.length}):`);
  if (sortedLog.length === 0) lines.push('  (brak zapisanych walk)');
  for (const e of detailed) {
    const when = new Date(e.at).toLocaleString('pl-PL');
    const head = `  ${when} · ${KIND_LABEL[e.kind]} · ${e.name} · Lv${e.level}`;
    // Przebieg walki runda po rundzie (2026-08-17, user: "nie zapisujesz... dokładnie walk z
    // ilością HP w czasie i dmg zadanego mi i którego zadał bossowi") — wpisy sprzed tego
    // fixu nie mają `rounds` (opcjonalne pole), dostają starą, samą linię z nagrodą.
    if (e.rounds && e.rounds.length > 0 && e.bossMaxHp != null && e.catMaxHpAtFight != null) {
      const outcome = e.won ? 'WYGRANA' : e.catFainted ? 'PRZEGRANA (kotek zemdlał)' : 'PRZEGRANA (limit rund)';
      lines.push(`${head} · ${outcome} (${e.rounds.length} ${plPlural(e.rounds.length, 'runda', 'rundy', 'rund')}) · +${e.coins} monet, +${e.xp} XP`);
      lines.push(`      boss HP: ${e.bossMaxHp}→${e.rounds.map(r => r.bhp).join('→')}`);
      lines.push(`      kotek HP: ${e.catMaxHpAtFight}→${e.rounds.map(r => r.chp).join('→')}`);
      lines.push(`      Twój dmg/rundę: ${e.rounds.map(r => r.p).join(',')}`);
      lines.push(`      kontratak/rundę: ${e.rounds.map(r => r.c).join(',')}`);
    } else {
      lines.push(`${head} · +${e.coins} monet, +${e.xp} XP`);
    }
  }

  // Reszta historii — TYLKO skrót (bez rund/HP), żeby "pełna historia" nie znaczyło
  // "pełny przebieg KAŻDEJ z setek walk" (nieczytelne, ryzyko olbrzymiego eksportu) — patrz
  // komentarz przy `detailLimit` wyżej. Wystarcza do odtworzenia krzywej XP/monet w czasie.
  if (rest.length > 0) {
    lines.push('');
    lines.push(`STARSZE WALKI, skrót (${rest.length}):`);
    for (const e of rest) {
      const when = new Date(e.at).toLocaleString('pl-PL');
      const outcome = e.won === undefined ? '' : e.won ? ' · WYGRANA' : e.catFainted ? ' · PRZEGRANA (zemdlał)' : ' · PRZEGRANA (limit rund)';
      lines.push(`  ${when} · ${KIND_LABEL[e.kind]} · ${e.name} · Lv${e.level}${outcome} · +${e.coins} monet, +${e.xp} XP`);
    }
  }

  return lines.join('\n');
}
