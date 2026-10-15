import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { X, Minus, Plus, Maximize2, RotateCcw, Check } from 'lucide-react-native';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius, fonts } from '@/theme';
import { haptic } from '@/utils/haptics';
import { usePetStore } from '@/store/petStore';
import { BOSSES } from '@/utils/bosses';
import CampaignMap from '@/components/bosses/CampaignMap';
import { useCampaignMapStyleStore, DEFAULT_CAMPAIGN_MAP_STYLE } from '@/store/campaignMapStyleStore';

// Kreator ekranów — FAZA 6 (2026-10-15, ARCHITECTURE.md §332). Pierwszy ekran kreatora POZA
// dashboardem (user: "nie chce budować samych kafelków tylko wszystko ekrany itp" — ten sam
// mechanizm draft/live + `styleOverride` prop, zastosowany do drugiego obszaru appki zamiast
// tylko do dashboardu). Celowo OSOBNY ekran/plik od `dashboard-tile-creator.tsx`, nie kolejna
// zakładka tam — to inny obszar appki (mapa bossów, nie dashboard), mieszanie ich w jednym
// ekranie zrobiłoby z kreatora dashboardu przypadkowy worek niepowiązanych rzeczy. Wzorzec
// dostępu ten sam co dla kreatora kafelków: Ustawienia → Personalizacja.
//
// `locked`/`lockMessage` na podglądzie (zamiast prawdziwego `onPressCurrent`) — to ekran DO
// stylowania, nie do walki; przypadkowe wejście w walkę z poziomu kreatora byłoby mylące.
export default function CampaignMapCreator() {
  const c = useColors();
  const s = makeS(c);
  const draft = useCampaignMapStyleStore(st => st.draft);
  const setDraft = useCampaignMapStyleStore(st => st.setDraft);
  const publish = useCampaignMapStyleStore(st => st.publish);
  const discardDraft = useCampaignMapStyleStore(st => st.discardDraft);
  const resetDraftToDefault = useCampaignMapStyleStore(st => st.resetDraftToDefault);
  const live = useCampaignMapStyleStore(st => st.live);
  const [fullPreview, setFullPreview] = useState(false);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(live);
  const isDefault = JSON.stringify(draft) !== JSON.stringify(DEFAULT_CAMPAIGN_MAP_STYLE);

  // Prawdziwy postęp kampanii usera — ten sam wzorzec co `app/bosses.tsx`:
  // `current = BOSSES.find(b => !defeatedBosses.includes(b.id))`.
  const defeatedBosses = usePetStore(st => st.defeatedBosses);
  const current = BOSSES.find(b => !defeatedBosses.includes(b.id)) ?? null;

  const doPublish = () => { haptic.success(); publish(); };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => { haptic.tap(); router.back(); }} style={s.closeBtn} hitSlop={10}>
          <X size={18} color={c.text.secondary} />
        </TouchableOpacity>
        <Text style={s.title}>Kreator mapy bossów</Text>
        <TouchableOpacity onPress={doPublish} style={[s.deployBtn, !isDirty && { opacity: 0.4 }]} hitSlop={10} disabled={!isDirty}>
          <Check size={15} color="#fff" />
          <Text style={s.deployTxt}>Wdróż</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.sectionLabel}>Podgląd — prawdziwa mapa i postęp</Text>
        <View style={s.previewWrap}>
          <CampaignMap
            bosses={BOSSES} currentId={current?.id ?? null} onPressCurrent={() => {}}
            styleOverride={draft} locked lockMessage="Podgląd kreatora — walka niedostępna tutaj"
          />
        </View>
        <TouchableOpacity onPress={() => { haptic.tap(); setFullPreview(true); }} style={s.fullBtn}>
          <Maximize2 size={14} color={c.text.secondary} />
          <Text style={s.fullBtnTxt}>Podgląd pełnoekranowy</Text>
        </TouchableOpacity>

        <Text style={s.sectionLabel}>Kształt</Text>
        <View style={s.card}>
          <Stepper label="Rozmiar węzła" value={draft.nodeSize} min={40} max={88} step={4}
            onChange={v => setDraft({ nodeSize: v })} c={c} s={s} />
          <View style={s.divider} />
          <Stepper label="Grubość ścieżki" value={draft.pathWidth} min={3} max={14} step={1}
            onChange={v => setDraft({ pathWidth: v })} c={c} s={s} />
          <View style={s.divider} />
          <Stepper label="Grubość pierścienia" value={draft.ringWidth} min={1} max={6} step={0.5} decimals={1}
            onChange={v => setDraft({ ringWidth: v })} c={c} s={s} />
          <View style={s.divider} />
          <Stepper label="Jasność siatki tła" value={draft.gridOpacity} min={0} max={0.3} step={0.02} decimals={2}
            onChange={v => setDraft({ gridOpacity: v })} c={c} s={s} />
          <View style={s.divider} />
          <Stepper label="Zaokrąglenie popupu" value={draft.popupRadius} min={0} max={28} step={2}
            onChange={v => setDraft({ popupRadius: v })} c={c} s={s} />
        </View>

        <View style={s.actionsRow}>
          <TouchableOpacity onPress={() => { haptic.tap(); discardDraft(); }} style={s.ghostBtn} disabled={!isDirty}>
            <Text style={[s.ghostBtnTxt, !isDirty && { opacity: 0.4 }]}>Cofnij zmiany</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { haptic.tap(); resetDraftToDefault(); }} style={s.ghostBtn} disabled={!isDefault}>
            <RotateCcw size={13} color={c.text.secondary} style={{ opacity: isDefault ? 1 : 0.4 }} />
            <Text style={[s.ghostBtnTxt, !isDefault && { opacity: 0.4 }]}>Domyślne</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.hint}>
          Zmiany widzisz tylko tutaj, dopóki nie klikniesz „Wdróż" — prawdziwa mapa bossów
          dalej wygląda jak dziś. Kolor ścieżki/pierścienia (niebieski kampania / czerwony MAD)
          zostaje — to rozróżnienie ma znaczenie, nie tylko wygląd.
        </Text>
      </ScrollView>

      <Modal visible={fullPreview} animationType="slide" presentationStyle="fullScreen"
        statusBarTranslucent onRequestClose={() => setFullPreview(false)}>
        <SafeAreaView style={[s.fullSafe, { backgroundColor: '#05060A' }]} edges={['top', 'bottom']}>
          <TouchableOpacity onPress={() => { haptic.tap(); setFullPreview(false); }} style={s.fullCloseBtn} hitSlop={10}>
            <X size={18} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <CampaignMap
              bosses={BOSSES} currentId={current?.id ?? null} onPressCurrent={() => {}}
              styleOverride={draft} locked lockMessage="Podgląd kreatora — walka niedostępna tutaj"
            />
          </View>
          <Text style={s.fullHint}>Cofnij (gest/przycisk) albo ✕, żeby wyjść</Text>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function Stepper({ label, value, min, max, step, decimals = 0, onChange, c, s }: {
  label: string; value: number; min: number; max: number; step: number; decimals?: number;
  onChange: (v: number) => void; c: any; s: any;
}) {
  const dec = (delta: number) => {
    haptic.tap();
    const next = Math.min(max, Math.max(min, Math.round((value + delta) * 100) / 100));
    onChange(next);
  };
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <View style={s.stepperRow}>
        <TouchableOpacity onPress={() => dec(-step)} style={s.stepBtn} disabled={value <= min}>
          <Minus size={14} color={value <= min ? c.text.muted : c.text.primary} />
        </TouchableOpacity>
        <Text style={s.stepVal}>{value.toFixed(decimals)}</Text>
        <TouchableOpacity onPress={() => dec(step)} style={s.stepBtn} disabled={value >= max}>
          <Plus size={14} color={value >= max ? c.text.muted : c.text.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
  },
  closeBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg.elevated },
  title: { fontFamily: fonts.label, fontSize: 14, fontWeight: '800', color: c.text.primary },
  deployBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: c.accent.blue,
    borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 8,
  },
  deployTxt: { fontSize: 13, fontWeight: '800', color: '#fff' },

  scroll: { paddingHorizontal: spacing[4], paddingBottom: spacing[6], gap: spacing[2] },
  sectionLabel: {
    fontFamily: fonts.label, fontSize: 11, fontWeight: '800', color: c.text.muted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginTop: spacing[4], marginBottom: spacing[1],
  },
  // Wysokość na sztywno (nie flex:1 jak na prawdziwym ekranie) — tu jesteśmy WEWNĄTRZ
  // przewijanego kreatora, nie na osobnym pełnoekranowym widoku. Pełna wysokość = przycisk
  // "Podgląd pełnoekranowy" niżej.
  previewWrap: { height: 420, borderRadius: radius.lg, overflow: 'hidden' },
  fullBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: spacing[2], paddingVertical: 9, borderRadius: radius.md,
    borderWidth: 1, borderColor: c.border.default,
  },
  fullBtnTxt: { fontSize: 12.5, fontWeight: '700', color: c.text.secondary },

  card: { backgroundColor: c.bg.card, borderRadius: radius.xl, borderWidth: 1, borderColor: c.border.card, padding: spacing[3] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing[2] },
  rowLabel: { fontSize: 13, fontWeight: '600', color: c.text.primary, flex: 1 },
  divider: { height: 1, backgroundColor: c.border.subtle },

  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: c.bg.elevated, alignItems: 'center', justifyContent: 'center' },
  stepVal: { fontSize: 13, fontWeight: '800', color: c.text.primary, minWidth: 34, textAlign: 'center', fontVariant: ['tabular-nums'] },

  actionsRow: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[4] },
  ghostBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: radius.md, backgroundColor: c.bg.elevated },
  ghostBtnTxt: { fontSize: 12.5, fontWeight: '700', color: c.text.secondary },
  hint: { fontSize: 11, color: c.text.muted, textAlign: 'center', marginTop: spacing[3], lineHeight: 15 },

  fullSafe: { flex: 1 },
  fullCloseBtn: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)', marginLeft: spacing[4], marginTop: spacing[2],
  },
  fullHint: { fontSize: 11, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginVertical: spacing[2] },
}));
