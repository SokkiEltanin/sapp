// Make MainActivity handle multi-window / split-screen resizes itself instead of
// being destroyed & recreated. Expo's default android:configChanges omits
// `smallestScreenSize` (and `density`), so entering/leaving split-screen — which
// changes the smallest width — recreates the Activity; the RN surface can come back
// with a stale (larger) size, pushing content off-screen. Adding these config flags
// makes Android deliver onConfigurationChanged, and React Native re-lays-out cleanly.
const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

const NEEDED = [
  'keyboard', 'keyboardHidden', 'orientation', 'screenSize', 'screenLayout',
  'uiMode', 'smallestScreenSize', 'density',
];

module.exports = function withResizeConfig(config) {
  return withAndroidManifest(config, (cfg) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults);
    activity.$ = activity.$ || {};
    const existing = (activity.$['android:configChanges'] || '').split('|').filter(Boolean);
    const set = new Set(existing);
    for (const n of NEEDED) set.add(n);
    activity.$['android:configChanges'] = Array.from(set).join('|');
    activity.$['android:resizeableActivity'] = 'true';
    return cfg;
  });
};
