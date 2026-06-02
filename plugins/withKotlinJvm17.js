// Some Expo modules (e.g. expo-dynamic-app-icon) compile Kotlin to JVM target 11
// while the app uses Java 17. Gradle's strict validation then fails the build:
//   "Inconsistent JVM-target compatibility ... Java (17) and Kotlin (11)".
//
// JVM 11 bytecode runs fine on Android, so the validation is overly strict.
// Setting `kotlin.jvm.target.validation.mode=warning` downgrades the error to a
// warning and lets the build complete. This is the robust, class-resolution-free
// fix (no need to reference KotlinCompile in build.gradle).
const { withGradleProperties } = require('@expo/config-plugins');

const KEY = 'kotlin.jvm.target.validation.mode';

module.exports = function withKotlinJvm17(config) {
  return withGradleProperties(config, (cfg) => {
    const props = cfg.modResults;
    const existing = props.find((p) => p.type === 'property' && p.key === KEY);
    if (existing) {
      existing.value = 'warning';
    } else {
      props.push({ type: 'property', key: KEY, value: 'warning' });
    }
    return cfg;
  });
};
