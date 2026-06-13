// Two fixes the upstream react-native-health-connect Expo plugin is missing:
//
// 1) <queries> package visibility for the Health Connect provider, so the app can
//    see/talk to Health Connect on Android 11+ (otherwise getSdkStatus reports
//    UNAVAILABLE and the app never shows up in HC's app list).
//
// 2) Initialise the permission launcher. The library's HealthConnectPermissionDelegate
//    has `lateinit var requestPermission` that is ONLY set by setPermissionDelegate(activity),
//    which NOTHING in the library calls. So requestPermission() throws
//    UninitializedPropertyAccessException (the crash). We inject the call into
//    MainActivity.onCreate (registerForActivityResult must run before RESUMED).
const { withAndroidManifest, withMainActivity } = require('@expo/config-plugins');

const HC_PACKAGE = 'com.google.android.apps.healthdata';
const DELEGATE_IMPORT = 'import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate';
const DELEGATE_CALL = 'HealthConnectPermissionDelegate.setPermissionDelegate(this)';

function withQueries(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    if (!Array.isArray(manifest.queries)) manifest.queries = [];
    if (manifest.queries.length === 0) manifest.queries.push({});
    const q = manifest.queries[0];
    if (!Array.isArray(q.package)) q.package = [];
    if (!q.package.some((p) => p && p.$ && p.$['android:name'] === HC_PACKAGE)) {
      q.package.push({ $: { 'android:name': HC_PACKAGE } });
    }
    return cfg;
  });
}

// Android 14+ (where Health Connect is in the system) requires an activity that
// handles VIEW_PERMISSION_USAGE with the HEALTH_PERMISSIONS category, otherwise
// the app never appears in Health Connect's app list and no permission screen
// shows. The library's plugin only adds the old Android-13 rationale action.
function withViewPermissionUsage(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application[0];
    if (!Array.isArray(app['activity-alias'])) app['activity-alias'] = [];
    const exists = app['activity-alias'].some(
      (a) => a && a.$ && a.$['android:name'] === 'ViewPermissionUsageActivity',
    );
    if (!exists) {
      app['activity-alias'].push({
        $: {
          'android:name': 'ViewPermissionUsageActivity',
          'android:exported': 'true',
          'android:targetActivity': '.MainActivity',
          'android:permission': 'android.permission.START_VIEW_PERMISSION_USAGE',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'android.intent.action.VIEW_PERMISSION_USAGE' } }],
            category: [{ $: { 'android:name': 'android.intent.category.HEALTH_PERMISSIONS' } }],
          },
        ],
      });
    }
    return cfg;
  });
}

function withPermissionDelegate(config) {
  return withMainActivity(config, (cfg) => {
    if (cfg.modResults.language !== 'kt') return cfg; // expects Kotlin MainActivity
    let src = cfg.modResults.contents;
    if (!src.includes(DELEGATE_IMPORT)) {
      src = src.replace(/(^package .*$)/m, `$1\n\n${DELEGATE_IMPORT}`);
    }
    if (!src.includes(DELEGATE_CALL)) {
      // Insert right after super.onCreate(...) inside onCreate.
      src = src.replace(/(super\.onCreate\([^)]*\)\s*)/, `$1\n    ${DELEGATE_CALL}\n`);
    }
    cfg.modResults.contents = src;
    return cfg;
  });
}

module.exports = function withHealthConnect(config) {
  return withPermissionDelegate(withViewPermissionUsage(withQueries(config)));
};
