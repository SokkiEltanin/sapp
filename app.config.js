// Dynamic Expo config. Auto-discovers app-icon variants: drop a file named
// `assets/logo_<name>.png` and it is registered as a selectable launcher icon
// at build time — no manual config editing needed. The list is also exposed via
// `extra.appIcons` so the in-app picker (Settings) builds itself from it.
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const assetsDir = path.join(__dirname, 'assets');
  const iconConfig = {};
  const appIcons = [];

  try {
    for (const file of fs.readdirSync(assetsDir)) {
      const m = file.match(/^logo_(.+)\.png$/i);
      if (!m) continue;
      const name = m[1].toLowerCase();
      iconConfig[name] = { image: `./assets/${file}`, prerendered: true };
      appIcons.push(name);
    }
  } catch (e) {
    // assets dir missing → no alternate icons, app still builds
  }

  const plugins = [...(config.plugins || [])];
  // NOTE: the Kotlin JVM-target validation is relaxed in CI via a gradle.properties
  // line (see .github/workflows/build.yml). We intentionally do NOT use a
  // withGradleProperties plugin here — rewriting gradle.properties at prebuild can
  // drop the trailing newline and corrupt the keystore props appended afterwards.
  if (appIcons.length > 0) {
    plugins.push(['expo-dynamic-app-icon', iconConfig]);
  }

  return {
    ...config,
    plugins,
    extra: {
      ...(config.extra || {}),
      appIcons, // e.g. ["basic","blue","green","orange","pink"]
    },
  };
};
