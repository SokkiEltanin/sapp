import { useMemo, useState } from 'react';
import { Modal, View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Check } from 'lucide-react-native';
import PressableScale from '@/components/ui/PressableScale';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import CatArt from '@/components/pet/CatArt';
import StartupPreview from '@/components/pet/StartupPreview';
import { usePetStore } from '@/store/petStore';
import { SHOP_COLORS, STRIPES, TIER_META, CosmeticTier } from '@/utils/petShop';
import { STARTUPS, startupById, ANIM_LABEL, Startup } from '@/utils/petStartups';
import { paletteById } from '@/utils/catPalettes';
import { spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';

const WHISKERS_COST = 55;
const LEGSTRIPES_COST = 65;
const EYE_COST = 50;
const EYE_COLORS: { id: string; name: string; hex: string }[] = [
  { id: 'default', name: 'Domyślne',    hex: '' },
  { id: 'green',   name: 'Zielone',     hex: '#2E8B57' },
  { id: 'amber',   name: 'Bursztyn',    hex: '#B5791F' },
  { id: 'blue',    name: 'Niebieskie',  hex: '#2F6BB0' },
  { id: 'copper',  name: 'Miedziane',   hex: '#9E4E2C' },
  { id: 'gold',    name: 'Złote',       hex: '#B8901F' },
  { id: 'teal',    name: 'Turkusowe',   hex: '#2E9E9E' },
  { id: 'hazel',   name: 'Piwne',       hex: '#8A6B3B' },
  { id: 'ice',     name: 'Lodowe',      hex: '#6FA8C7' },
  { id: 'hetero1', name: 'Hetero z-n',  hex: '#2E8B57|#2F6BB0' },
  { id: 'hetero2', name: 'Hetero b-z',  hex: '#B5791F|#2E8B57' },
  { id: 'hetero3', name: 'Hetero z-b',  hex: '#2E8B57|#B5791F' },
  { id: 'hetero4', name: 'Hetero n-m',  hex: '#2F6BB0|#9E4E2C' },
];
const NOSE_COST = 40;
const NOSE_COLORS: { id: string; name: string; hex: string }[] = [
  { id: 'default', name: 'Domyślny', hex: '' },
  { id: 'pink',    name: 'Różowy',   hex: '#E39AA6' },
  { id: 'brick',   name: 'Ceglasty', hex: '#B5674E' },
  { id: 'coal',    name: 'Węglowy',  hex: '#2E2E36' },
  { id: 'mauve',   name: 'Wrzosowy', hex: '#C58BA0' },
];
const TIER_ORDER: CosmeticTier[] = ['basic', 'rare', 'epic'];

// Modal imienia + kosmetyki kotka (2026-08-19) — user pierwotnie chciał "klik w kotka"
// jako wejście do kupna kolorów, potem sam to odrzucił: "nie przecież kliknięciem głaskam
// kotka... lepiej dać przy edycji imienia". Wchłania sekcje Kolory+Dodatki z pet-shop.tsx.
// Startupy (kosmetyk EKRANU ŁADOWANIA apki) DOŁĄCZYŁY tutaj (2026-09-02, user: "przenieś
// z rynku pupila startupy [tu], gdzie ma edycję nazwy i kolory") — pierwotnie (2026-08-19)
// świadomie zostały w sklepie jako "nie kotek", ale user po czasie chciał całą kosmetykę w
// jednym miejscu; wybór/zakup w `pet-shop.tsx` USUNIĘTY, `grantStartup` (nagroda ze
// skrzynki) tam zostaje. Ten sam komponent obsługuje DWA tryby: `mode="edit"` (tap w imię
// na /pet, X zamyka bez zapisu jeśli nic nie zmienione) i `mode="onboarding"` (pierwsze
// uruchomienie — brak X, wymaga niepustego imienia żeby przycisk "Gotowe" zadziałał, patrz
// onboarded w petStore).
export default function PetCustomizeModal({ visible, onClose, mode = 'edit' }: {
  visible: boolean; onClose: () => void; mode?: 'edit' | 'onboarding';
}) {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const {
    name, coins, ownedItems, catColor, catStripes, catEyeColor, catNoseColor, catWhiskers, catLegStripes,
    setName, buyColor, buyStripes, buyEyeColor, buyNoseColor, buyWhiskers, buyLegStripes, setOnboarded,
    equippedStartup, buyStartup,
  } = usePetStore();

  const [draft, setDraft] = useState(name);
  const [pvColor, setPvColor] = useState<string | null>(null);
  const [pvStripes, setPvStripes] = useState<boolean | null>(null);
  const [pvEye, setPvEye] = useState<string | null>(null);
  const [pvNose, setPvNose] = useState<string | null>(null);
  const [pvWhiskers, setPvWhiskers] = useState<boolean | null>(null);
  const [pvLeg, setPvLeg] = useState<boolean | null>(null);
  const [previewStartupId, setPreviewStartupId] = useState<string | null>(null);

  const [pendingBuy, setPendingBuy] = useState<{ name: string; cost: number; onYes: () => void } | null>(null);
  const confirmBuy = (nm: string, cost: number, onYes: () => void) => setPendingBuy({ name: nm, cost, onYes });

  const onColor = (id: string, cost: number, nm: string) => {
    haptic.tap();
    setPvColor(id);
    const had = ownedItems.includes(id) || cost === 0;
    if (had) { if (buyColor(id, cost)) { setPvColor(null); haptic.success(); toast.success(`${nm} — założone`); } return; }
    if (coins < cost) { haptic.error(); toast.error(`Za mało monet — potrzeba ${cost}`); return; }
    confirmBuy(nm, cost, () => { if (buyColor(id, cost)) { setPvColor(null); haptic.success(); toast.success(`Kupione: ${nm}`); } });
  };
  const onStripes = () => {
    haptic.tap();
    const owned = ownedItems.includes('stripes');
    setPvStripes(owned ? !catStripes : true);
    if (owned) { buyStripes(STRIPES.cost); setPvStripes(null); haptic.success(); return; }
    if (coins < STRIPES.cost) { haptic.error(); toast.error(`Za mało monet — potrzeba ${STRIPES.cost}`); return; }
    confirmBuy(STRIPES.name, STRIPES.cost, () => { if (buyStripes(STRIPES.cost)) { setPvStripes(null); haptic.success(); } });
  };
  const onEye = (id: string, hex: string, cost: number, nm: string) => {
    haptic.tap();
    setPvEye(hex);
    const had = ownedItems.includes(`eye:${id}`) || cost === 0;
    if (had) { if (buyEyeColor(id, hex, cost)) { setPvEye(null); haptic.success(); toast.success(`Oczy: ${nm}`); } return; }
    if (coins < cost) { haptic.error(); toast.error(`Za mało monet — potrzeba ${cost}`); return; }
    confirmBuy(`Oczy: ${nm}`, cost, () => { if (buyEyeColor(id, hex, cost)) { setPvEye(null); haptic.success(); toast.success(`Kupione: oczy ${nm}`); } });
  };
  const onNose = (id: string, hex: string, cost: number, nm: string) => {
    haptic.tap();
    setPvNose(hex);
    const had = ownedItems.includes(`nose:${id}`) || cost === 0;
    if (had) { if (buyNoseColor(id, hex, cost)) { setPvNose(null); haptic.success(); toast.success(`Nosek: ${nm}`); } return; }
    if (coins < cost) { haptic.error(); toast.error(`Za mało monet — potrzeba ${cost}`); return; }
    confirmBuy(`Nosek: ${nm}`, cost, () => { if (buyNoseColor(id, hex, cost)) { setPvNose(null); haptic.success(); toast.success(`Kupione: nosek ${nm}`); } });
  };
  const onToggleExtra = (key: string, cost: number, nm: string, cur: boolean, setPv: (v: boolean | null) => void, buy: (cst: number) => boolean) => {
    haptic.tap();
    const owned = ownedItems.includes(key);
    setPv(owned ? !cur : true);
    if (owned) { buy(cost); setPv(null); haptic.success(); return; }
    if (coins < cost) { haptic.error(); toast.error(`Za mało monet — potrzeba ${cost}`); return; }
    confirmBuy(nm, cost, () => { if (buy(cost)) { setPv(null); haptic.success(); } });
  };
  const extraRow = (key: string, nm: string, desc: string, on: boolean, cost: number, onPress: () => void) => (
    <PressableScale onPress={onPress} key={key}>
      <View style={[s.boxRow, on && { borderColor: '#4DA8FF', backgroundColor: '#4DA8FF1E' }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.cellName}>{nm}</Text>
          <Text style={s.cellState}>
            {ownedItems.includes(key) ? (on ? '● włączone — stuknij, aby wyłączyć' : '○ wyłączone — stuknij, aby włączyć') : desc}
          </Text>
        </View>
        {ownedItems.includes(key)
          ? <Check size={18} color="#4DA8FF" />
          : <View style={s.buyPill}><Text style={s.buyPillTxt}>{cost} 🪙</Text></View>}
      </View>
    </PressableScale>
  );

  const shownColorId = pvColor ?? catColor;
  const worn = paletteById(shownColorId);
  const shownStripes = pvStripes ?? catStripes;
  const shownEye = pvEye ?? catEyeColor;
  const shownNose = pvNose ?? catNoseColor;
  const shownWhiskers = pvWhiskers ?? catWhiskers;
  const shownLeg = pvLeg ?? catLegStripes;

  const renderColorCell = (sc: typeof SHOP_COLORS[number]) => {
    const owned = ownedItems.includes(sc.id) || sc.cost === 0;
    const on = catColor === sc.id;
    const tier = TIER_META[sc.tier];
    return (
      <PressableScale key={sc.id} onPress={() => onColor(sc.id, sc.cost, sc.name)}>
        <View style={[s.cell, on && { borderColor: tier.color, backgroundColor: tier.color + '1E' }]}>
          <View style={[s.swatch, { backgroundColor: sc.palette.coat, borderColor: sc.palette.ear }]}>
            {on && <Check size={18} color={sc.palette.ink} />}
          </View>
          <Text style={s.cellName} numberOfLines={1}>{sc.name}</Text>
          {owned
            ? <Text style={[s.cellState, { color: on ? tier.color : c.text.muted }]}>{on ? 'założone' : 'kupione'}</Text>
            : <Text style={s.costTxt}>{sc.cost} 🪙</Text>}
        </View>
      </PressableScale>
    );
  };
  const renderEyeCell = (ec: typeof EYE_COLORS[number]) => {
    const owned = ec.hex === '' || ownedItems.includes(`eye:${ec.id}`);
    const on = catEyeColor === ec.hex;
    const hetero = ec.hex.includes('|');
    const [hl, hr] = hetero ? ec.hex.split('|') : [ec.hex || '#2A2B36', ec.hex || '#2A2B36'];
    return (
      <PressableScale key={ec.id} onPress={() => onEye(ec.id, ec.hex, ec.hex === '' ? 0 : EYE_COST, ec.name)}>
        <View style={[s.eyeCell, on && { borderColor: '#4DA8FF', backgroundColor: '#4DA8FF1E' }]}>
          <View style={[s.eyeDot, { backgroundColor: hl, overflow: 'hidden' }]}>
            {hetero && <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '50%', backgroundColor: hr }} />}
            {on && <Check size={12} color="#fff" />}
          </View>
          <Text style={s.eyeName} numberOfLines={1}>{ec.name}</Text>
          {!owned
            ? <Text style={s.costTxt}>{EYE_COST} 🪙</Text>
            : <Text style={[s.cellState, { color: on ? '#4DA8FF' : c.text.muted }]}>{on ? 'na oczach' : 'masz'}</Text>}
        </View>
      </PressableScale>
    );
  };
  const renderNoseCell = (nc: typeof NOSE_COLORS[number]) => {
    const owned = nc.hex === '' || ownedItems.includes(`nose:${nc.id}`);
    const on = catNoseColor === nc.hex;
    return (
      <PressableScale key={nc.id} onPress={() => onNose(nc.id, nc.hex, nc.hex === '' ? 0 : NOSE_COST, nc.name)}>
        <View style={[s.eyeCell, on && { borderColor: '#4DA8FF', backgroundColor: '#4DA8FF1E' }]}>
          <View style={[s.eyeDot, { backgroundColor: nc.hex || '#2A2B36' }]}>{on && <Check size={12} color="#fff" />}</View>
          <Text style={s.eyeName} numberOfLines={1}>{nc.name}</Text>
          {!owned
            ? <Text style={s.costTxt}>{NOSE_COST} 🪙</Text>
            : <Text style={[s.cellState, { color: on ? '#4DA8FF' : c.text.muted }]}>{on ? 'na nosku' : 'masz'}</Text>}
        </View>
      </PressableScale>
    );
  };

  // Startup (kosmetyk ekranu ładowania): kup+ustaw, albo tylko ustaw jeśli już masz.
  // Przeniesione tu z pet-shop.tsx (2026-09-02) — ten sam wzorzec kup/ustaw co reszta
  // kosmetyki w tym modalu (kolor/oczy/nosek), tylko klucz posiadania ma prefiks `startup:`.
  const onStartup = (su: Startup) => {
    haptic.tap();
    setPreviewStartupId(su.id);
    const had = ownedItems.includes(`startup:${su.id}`) || su.cost === 0;
    if (had) { if (buyStartup(su.id, su.cost)) { haptic.success(); toast.success(`${su.name} — ustawione`); } return; }
    if (coins < su.cost) { haptic.error(); toast.error(`Za mało monet — potrzeba ${su.cost}`); return; }
    confirmBuy(su.name, su.cost, () => { if (buyStartup(su.id, su.cost)) { haptic.success(); toast.success(`Kupione: ${su.name}`); } });
  };
  const renderStartupCell = (su: Startup) => {
    const owned = ownedItems.includes(`startup:${su.id}`) || su.cost === 0;
    const on = equippedStartup === su.id;
    const tier = TIER_META[su.tier];
    return (
      <PressableScale key={su.id} onPress={() => onStartup(su)}>
        <View style={[s.cell, on && { borderColor: tier.color, backgroundColor: tier.color + '1E' }]}>
          <View style={[s.startupSwatch, { borderColor: su.ink + '55' }]}>
            {su.anim === 'custom' && su.asset
              ? <Image source={su.asset} style={{ width: 60, height: 34 }} resizeMode="contain" fadeDuration={0} />
              : <Text style={[s.startupSwatchMark, { color: su.ink }]}>Sapp</Text>}
          </View>
          <Text style={s.cellName} numberOfLines={1}>{su.name}</Text>
          <Text style={s.animTag}>{ANIM_LABEL[su.anim]}{su.glow ? ' · glow' : ''}</Text>
          {owned
            ? <Text style={[s.cellState, { color: on ? tier.color : c.text.muted }]}>{on ? 'ustawiony' : 'kupiony'}</Text>
            : <Text style={s.costTxt}>{su.cost} 🪙</Text>}
        </View>
      </PressableScale>
    );
  };

  const onDone = () => {
    const trimmed = draft.trim();
    if (mode === 'onboarding' && !trimmed) { haptic.error(); toast.error('Nadaj imię pupilowi'); return; }
    setName(trimmed || name);
    if (mode === 'onboarding') setOnboarded();
    haptic.success();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={mode === 'edit' ? onClose : undefined}>
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.head}>
          {mode === 'edit' ? (
            <TouchableOpacity onPress={onClose} hitSlop={10}><X size={22} color={c.text.primary} /></TouchableOpacity>
          ) : <View style={{ width: 22 }} />}
          <Text style={s.title}>{mode === 'onboarding' ? 'Witaj! Nazwij pupila' : 'Edytuj pupila'}</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={s.preview}>
            <CatArt size={168} expression="happy" palette={worn} stripes={shownStripes}
              eyeColor={shownEye} noseColor={shownNose} whiskers={shownWhiskers} legStripes={shownLeg} affection={90} />
          </View>

          <TextInput
            value={draft} onChangeText={setDraft} style={s.nameInput} maxLength={16}
            placeholder="Imię pupila" placeholderTextColor={c.text.muted}
          />

          <View style={s.section}>
            <Text style={s.subSection}>Kolor futra</Text>
            <View style={s.grid}>{SHOP_COLORS.map(renderColorCell)}</View>
          </View>

          <View style={s.section}>
            <Text style={s.subSection}>Kolor oczu</Text>
            <View style={s.grid}>{EYE_COLORS.map(renderEyeCell)}</View>
          </View>

          <View style={s.section}>
            <Text style={s.subSection}>Kolor noska</Text>
            <View style={s.grid}>{NOSE_COLORS.map(renderNoseCell)}</View>
          </View>

          <View style={[s.section, { gap: spacing[2] }]}>
            <Text style={s.subSection}>Dodatki</Text>
            {extraRow('stripes', STRIPES.name, 'paski na ogonie', catStripes, STRIPES.cost, onStripes)}
            {extraRow('whiskers', 'Wąsy', 'cienkie wąsy od pyszczka', catWhiskers, WHISKERS_COST,
              () => onToggleExtra('whiskers', WHISKERS_COST, 'Wąsy', catWhiskers, setPvWhiskers, buyWhiskers))}
            {extraRow('legstripes', 'Pręgi na łapkach', 'poziome pręgi na łapkach', catLegStripes, LEGSTRIPES_COST,
              () => onToggleExtra('legstripes', LEGSTRIPES_COST, 'Pręgi na łapkach', catLegStripes, setPvLeg, buyLegStripes))}
          </View>

          <View style={s.section}>
            <Text style={s.subSection}>Startup (ekran ładowania)</Text>
            <Text style={s.startupHint}>Zmienia ekran ładowania apki. Zobaczysz przy następnym starcie.</Text>
            {(() => {
              const shown = startupById(previewStartupId ?? equippedStartup);
              const isPreview = !!previewStartupId && previewStartupId !== equippedStartup;
              return (
                <View style={{ gap: 5, marginBottom: spacing[2] }}>
                  <StartupPreview startup={shown} height={92} fontSize={30} />
                  <Text style={s.startupPreviewCap}>{isPreview ? 'podgląd' : 'teraz'}: {shown.name} · {ANIM_LABEL[shown.anim]}</Text>
                </View>
              );
            })()}
            {TIER_ORDER.map(tier => {
              const items = STARTUPS.filter(x => x.tier === tier);
              if (!items.length) return null;
              return (
                <View key={tier} style={{ gap: spacing[2], marginBottom: spacing[2] }}>
                  <View style={s.tierHead}>
                    <View style={[s.tierDot, { backgroundColor: TIER_META[tier].color }]} />
                    <Text style={[s.subSection, { color: TIER_META[tier].color }]}>{TIER_META[tier].label}</Text>
                  </View>
                  <View style={s.grid}>{items.map(renderStartupCell)}</View>
                </View>
              );
            })}
          </View>
        </ScrollView>

        <View style={s.footer}>
          <PressableScale onPress={onDone}>
            <View style={s.doneBtn}><Text style={s.doneBtnTxt}>{mode === 'onboarding' ? 'Gotowe' : 'Zapisz'}</Text></View>
          </PressableScale>
        </View>

        <ConfirmDialog
          visible={!!pendingBuy}
          title="Potwierdź zakup"
          message={pendingBuy ? `${pendingBuy.name} — ${pendingBuy.cost} monet` : ''}
          confirmLabel="Kup"
          cancelLabel="Anuluj"
          destructive={false}
          onConfirm={() => { pendingBuy?.onYes(); setPendingBuy(null); }}
          onCancel={() => setPendingBuy(null)}
        />
      </SafeAreaView>
    </Modal>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  title: { ...typography.h3, color: c.text.primary },
  scroll: { paddingHorizontal: spacing[4], paddingBottom: spacing[6], gap: spacing[2] },
  preview: { alignItems: 'center', paddingVertical: spacing[2] },
  nameInput: { fontSize: 18, fontWeight: '800', color: c.text.primary, textAlign: 'center', borderBottomWidth: 2, borderBottomColor: c.accent.blue, paddingVertical: 6, marginBottom: spacing[2] },
  section: { marginTop: spacing[3] },
  subSection: { fontSize: 12, fontWeight: '800', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing[2] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  cell: { width: 92, alignItems: 'center', gap: 5, padding: spacing[2], borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.card },
  eyeCell: { width: 88, alignItems: 'center', gap: 5, padding: spacing[2], borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.card },
  eyeDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.22)' },
  eyeName: { fontSize: 11, fontWeight: '700', color: c.text.primary },
  swatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  cellName: { fontSize: 12, fontWeight: '700', color: c.text.primary },
  cellState: { fontSize: 10, color: c.text.muted },
  costTxt: { fontSize: 11, fontWeight: '800', color: '#FBBF24' },
  boxRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[3], borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.card },
  buyPill: { backgroundColor: '#FBBF2418', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#FBBF2440' },
  buyPillTxt: { fontSize: 12, fontWeight: '800', color: '#FBBF24' },
  // startupy (kosmetyka ekranu ładowania, przeniesione z pet-shop.tsx 2026-09-02)
  startupHint: { fontSize: 11, color: c.text.secondary, lineHeight: 15, marginBottom: spacing[2] },
  startupPreviewCap: { fontSize: 11, color: c.text.secondary, fontWeight: '700', textAlign: 'center' },
  startupSwatch: { width: 74, height: 40, borderRadius: 8, borderWidth: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  startupSwatchMark: { fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  animTag: { fontSize: 9, color: c.text.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  tierHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tierDot: { width: 8, height: 8, borderRadius: 4 },
  footer: { padding: spacing[4] },
  doneBtn: { backgroundColor: '#2AC68F', borderRadius: radius.lg, paddingVertical: 14, alignItems: 'center' },
  doneBtnTxt: { fontSize: 15, fontWeight: '900', color: '#07160F' },
}));
