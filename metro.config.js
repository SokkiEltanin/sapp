// Expo default Metro config + jawnie włączony require.context (auto-rejestr customowych
// startupów z assets/startups/ — patrz src/utils/customStartups.ts). SDK 54 zwykle ma to
// domyślnie, ale ustawiamy wprost, żeby build był deterministyczny.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.transformer = config.transformer || {};
config.transformer.unstable_allowRequireContext = true;

module.exports = config;
