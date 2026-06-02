// Forces every module's Kotlin compilation to JVM target 17 to match Java 17.
// Fixes: "Inconsistent JVM-target compatibility ... Java (17) and Kotlin (11)"
// triggered by some Expo modules (e.g. expo-dynamic-app-icon) that default to 11.
const { withProjectBuildGradle } = require('@expo/config-plugins');

const SNIPPET = `
// --- injected by withKotlinJvm17: align Kotlin JVM target with Java 17 ---
allprojects {
    afterEvaluate { proj ->
        proj.tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
            kotlinOptions { jvmTarget = "17" }
        }
    }
}
// --- end withKotlinJvm17 ---
`;

module.exports = function withKotlinJvm17(config) {
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') return cfg;
    if (!cfg.modResults.contents.includes('withKotlinJvm17')) {
      cfg.modResults.contents += SNIPPET;
    }
    return cfg;
  });
};
