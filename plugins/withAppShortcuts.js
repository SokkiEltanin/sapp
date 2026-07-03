// Android App Shortcuts (long-press the launcher icon → quick actions) with NO
// extra native dependency: a static shortcuts.xml whose <intent>s deep-link into
// the app via its `sapp://` scheme (expo-router resolves the route). Adds the
// label strings, writes res/xml/shortcuts.xml, and points the launcher activity
// at it with the android.app.shortcuts meta-data.
const { withAndroidManifest, withStringsXml, withDangerousMod, AndroidConfig } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

// route = path after the scheme (expo-router route), short = launcher chip label,
// long = label shown in the long-press menu.
const SHORTCUTS = [
  { id: 'scan_receipt', route: 'expenses/scan', short: 'Skanuj',  long: 'Skanuj paragon' },
  { id: 'add_expense',  route: 'expenses/add',  short: 'Wydatek', long: 'Dodaj wydatek' },
  { id: 'log_mood',     route: 'mood',          short: 'Nastrój', long: 'Zapisz nastrój' },
];

const strName = (id, which) => `sc_${id}_${which}`;

function withShortcutStrings(config) {
  return withStringsXml(config, (cfg) => {
    const items = [];
    for (const s of SHORTCUTS) {
      items.push({ _: s.short, $: { name: strName(s.id, 'short'), translatable: 'false' } });
      items.push({ _: s.long,  $: { name: strName(s.id, 'long'),  translatable: 'false' } });
    }
    cfg.modResults = AndroidConfig.Strings.setStringItem(items, cfg.modResults);
    return cfg;
  });
}

function buildShortcutsXml(pkg, scheme) {
  const entries = SHORTCUTS.map((s) => `    <shortcut
        android:shortcutId="${s.id}"
        android:enabled="true"
        android:shortcutShortLabel="@string/${strName(s.id, 'short')}"
        android:shortcutLongLabel="@string/${strName(s.id, 'long')}">
        <intent
            android:action="android.intent.action.VIEW"
            android:targetPackage="${pkg}"
            android:data="${scheme}://${s.route}" />
    </shortcut>`).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
${entries}
</shortcuts>
`;
}

function withShortcutsResource(config) {
  return withDangerousMod(config, ['android', async (cfg) => {
    const pkg = (cfg.android && cfg.android.package) || 'com.sokki.sapp';
    const scheme = Array.isArray(cfg.scheme) ? cfg.scheme[0] : (cfg.scheme || 'sapp');
    const dir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'xml');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'shortcuts.xml'), buildShortcutsXml(pkg, scheme), 'utf8');
    return cfg;
  }]);
}

function withShortcutsMeta(config) {
  return withAndroidManifest(config, (cfg) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults);
    if (!Array.isArray(activity['meta-data'])) activity['meta-data'] = [];
    const has = activity['meta-data'].some((m) => m.$ && m.$['android:name'] === 'android.app.shortcuts');
    if (!has) {
      activity['meta-data'].push({
        $: { 'android:name': 'android.app.shortcuts', 'android:resource': '@xml/shortcuts' },
      });
    }
    return cfg;
  });
}

module.exports = function withAppShortcuts(config) {
  config = withShortcutStrings(config);
  config = withShortcutsResource(config);
  config = withShortcutsMeta(config);
  return config;
};
