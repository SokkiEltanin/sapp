import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Pencil, Eye, Rocket, RotateCcw } from 'lucide-react-native';
import PressableScale from '@/components/ui/PressableScale';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ScreenCanvas from '@/components/canvas/ScreenCanvas';
import { useCanvasComponentsStore } from '@/store/canvasComponentsStore';
import { PROJECT_SCREENS } from '@/data/canvasProjectScreens';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, typography, radius } from '@/theme';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';

// Draft/Symulator/Wdrożenie (Faza §398, 2026-10-19) — user, po stanowczej korekcie
// architektury: "miałem mieć jak w FIGMIE odzielne OKNO EDYTORA wybieram tylko dla jakiego
// szablonu wydaję wersje beta, projektuje tam od zera... potem w symulatorze testuje na
// danych prawdziwych a dopiero jak działa WDROŻENIE ROBIĘ i podmieniam aktualny DASHBOARD na
// ten co stworzyłem". Poprzedni model (§390/§396 — Ustawienia włączały edycję NA ŻYWYM
// ekranie) nie dawał żadnej separacji "roboczego" od "produkcyjnego" — ten ekran to
// zastępuje: `EditorProjectsList` (app/settings.tsx) kieruje TUTAJ z parametrem `target`
// (oryginalny `screenKey` ekranu, np. "health"), a cały projekt roboczy żyje pod
// `screenKey = 'draft:' + target` (ten sam namespacing-trik co `popup:<id>`/§391,
// `navbar`/§392 — ZERO zmian w `CanvasItem`/`ScreenCanvas`).
//
// Dwa tryby, JEDNO zamontowane `<ScreenCanvas>` (nie dwa osobne drzewa) — przełącznik zmienia
// TYLKO `viewOnly`, więc lokalny stan `editing` WEWNĄTRZ `ScreenCanvasBase` przeżywa
// przełączanie zakładek (nie resetuje się przy każdym "Symulator → Edytor"). "Edytor" PONOWNIE
// woła `setPendingAutoEdit(draftKey)` przy KAŻDYM wejściu w tę zakładkę (nie tylko przy
// pierwszym montowaniu) — jeśli user wyszedł z edycji przyciskiem "Gotowe" na płótnie, a potem
// wrócił z Symulatora, zakładka "Edytor" i tak ponownie go tam wsadza, zero dodatkowego
// tapnięcia ✏️. "Symulator" to PRAWDZIWE dane za darmo — `viewOnly` już dawno (§391) nie zmienia
// ŹRÓDŁA danych, tylko chowa chrome edycji, więc podgląd tutaj = dokładnie to, co zobaczysz po
// wdrożeniu.
export default function CanvasDraftEditorScreen() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const { target } = useLocalSearchParams<{ target: string }>();
  const screen = PROJECT_SCREENS.find(p => p.key === target);
  const draftKey = `draft:${target}`;
  const items = useCanvasComponentsStore(st => st.items);
  const setPendingAutoEdit = useCanvasComponentsStore(st => st.setPendingAutoEdit);
  const deployDraft = useCanvasComponentsStore(st => st.deployDraft);
  const restoreBackup = useCanvasComponentsStore(st => st.restoreBackup);
  const draftCount = items.filter(i => i.screenKey === draftKey).length;
  // Przycisk "na wszelki wypadek" (§407, user: "na wszelki przycisk restart dashboardu
  // samego graficznego jak przez przypadek wdrożę coś czego nie chciałem") — widoczny TYLKO
  // gdy backup realnie istnieje (user wdrożył już COŚ przynajmniej raz dla tego ekranu),
  // zamiast dawać przycisk który wygląda jak działa, a nic nie robi.
  const hasBackup = items.some(i => i.screenKey === `backup:${target}`);
  const [mode, setMode] = useState<'edit' | 'simulate'>('edit');
  const [confirmDeploy, setConfirmDeploy] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);

  const enterEdit = () => { haptic.tap(); setPendingAutoEdit(draftKey); setMode('edit'); };
  const enterSimulate = () => { haptic.tap(); setMode('simulate'); };

  if (!target) return null; // nawigacja bez parametru `target` — nie powinno się zdarzyć

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <PressableScale onPress={() => router.back()} style={s.backBtn}>
          <ChevronLeft size={22} color={c.text.primary} />
        </PressableScale>
        <Text style={s.headerTitle} numberOfLines={1}>{screen?.label ?? target}</Text>
        {hasBackup ? (
          <PressableScale onPress={() => { haptic.tap(); setConfirmRestore(true); }} style={s.backBtn}>
            <RotateCcw size={18} color={c.text.secondary} />
          </PressableScale>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <View style={s.modeRow}>
        <PressableScale onPress={enterEdit} style={[s.modeBtn, { borderColor: mode === 'edit' ? c.accent.blue : c.border.default, backgroundColor: mode === 'edit' ? c.accent.blue + '18' : c.bg.card }]}>
          <Pencil size={14} color={mode === 'edit' ? c.accent.blue : c.text.muted} />
          <Text style={[s.modeTxt, { color: mode === 'edit' ? c.accent.blue : c.text.muted }]}>Edytor</Text>
        </PressableScale>
        <PressableScale onPress={enterSimulate} style={[s.modeBtn, { borderColor: mode === 'simulate' ? c.accent.blue : c.border.default, backgroundColor: mode === 'simulate' ? c.accent.blue + '18' : c.bg.card }]}>
          <Eye size={14} color={mode === 'simulate' ? c.accent.blue : c.text.muted} />
          <Text style={[s.modeTxt, { color: mode === 'simulate' ? c.accent.blue : c.text.muted }]}>Symulator</Text>
        </PressableScale>
      </View>

      {mode === 'simulate' && (
        <Text style={s.simHint}>
          Podgląd na PRAWDZIWYCH danych — tak będzie wyglądać po wdrożeniu. To tylko podgląd, nic tu nie klikniesz.
        </Text>
      )}

      <ScrollView contentContainerStyle={{ padding: spacing[4], paddingBottom: 100, gap: spacing[3] }} showsVerticalScrollIndicator={false}>
        <ScreenCanvas screenKey={draftKey} title="Twój projekt" viewOnly={mode === 'simulate'} />
      </ScrollView>

      <View style={s.deployWrap}>
        <PressableScale
          onPress={() => {
            if (draftCount === 0) { haptic.warn(); toast.error('Dodaj coś do projektu, zanim wdrożysz.'); return; }
            haptic.tap();
            setConfirmDeploy(true);
          }}
          style={[s.deployBtn, { backgroundColor: c.accent.blue }]}
        >
          <Rocket size={16} color="#fff" />
          <Text style={s.deployTxt}>Wdróż na „{screen?.label ?? target}”</Text>
        </PressableScale>
      </View>

      <ConfirmDialog
        visible={confirmDeploy}
        title="Wdrożyć projekt?"
        message={`To ZASTĄPI aktualną zawartość ekranu „${screen?.label ?? target}” tym, co zbudowałeś tutaj. Poprzednia zawartość zostaje bezpiecznie zachowana jako kopia zapasowa. Ten projekt roboczy NIE zostanie usunięty — możesz go dalej zmieniać i wdrożyć ponownie w każdej chwili.`}
        confirmLabel="Wdróż"
        destructive={false}
        onConfirm={() => { deployDraft(target); setConfirmDeploy(false); haptic.success(); toast.success('Wdrożono!'); }}
        onCancel={() => setConfirmDeploy(false)}
      />

      <ConfirmDialog
        visible={confirmRestore}
        title="Przywrócić poprzednią wersję?"
        message={`To ZASTĄPI aktualną zawartość ekranu „${screen?.label ?? target}” tym, co było tam TUŻ PRZED ostatnim wdrożeniem. Projekt roboczy w edytorze (nad którym teraz pracujesz) NIE zostanie ruszony.`}
        confirmLabel="Przywróć"
        destructive
        onConfirm={() => {
          const ok = restoreBackup(target);
          setConfirmRestore(false);
          haptic.success();
          toast.success(ok ? 'Przywrócono poprzednią wersję' : 'Nie było czego przywracać');
        }}
        onCancel={() => setConfirmRestore(false)}
      />
    </SafeAreaView>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', ...typography.h3, color: c.text.primary },
  modeRow: { flexDirection: 'row', gap: spacing[2], paddingHorizontal: spacing[4] },
  modeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 9, borderRadius: radius.lg, borderWidth: 1,
  },
  modeTxt: { fontSize: 12.5, fontWeight: '700' },
  simHint: { fontSize: 11.5, color: c.text.muted, lineHeight: 16, paddingHorizontal: spacing[4], marginTop: spacing[2] },
  deployWrap: { paddingHorizontal: spacing[4], paddingBottom: spacing[4], paddingTop: spacing[2] },
  deployBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 13, borderRadius: radius.lg,
  },
  deployTxt: { fontSize: 14, fontWeight: '800', color: '#fff' },
}));
