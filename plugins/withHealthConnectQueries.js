// Adds the Health Connect provider to <queries> so the app can actually SEE and
// talk to Health Connect on Android 11+ (package visibility). Without this the
// react-native-health-connect plugin leaves <queries> empty, getSdkStatus()
// reports UNAVAILABLE, the app never shows up in Health Connect's app list, and
// initialize()/requestPermission() can crash.
const { withAndroidManifest } = require('@expo/config-plugins');

const HC_PACKAGE = 'com.google.android.apps.healthdata';

module.exports = function withHealthConnectQueries(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    if (!Array.isArray(manifest.queries)) manifest.queries = [];
    if (manifest.queries.length === 0) manifest.queries.push({});
    const q = manifest.queries[0];
    if (!Array.isArray(q.package)) q.package = [];
    const exists = q.package.some((p) => p && p.$ && p.$['android:name'] === HC_PACKAGE);
    if (!exists) q.package.push({ $: { 'android:name': HC_PACKAGE } });
    return cfg;
  });
};
