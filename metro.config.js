// https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite s'appuie sur wa-sqlite côté web, livré en WebAssembly. Sans cette extension,
// la construction web échoue sur « Unable to resolve ./wa-sqlite/wa-sqlite.wasm ».
config.resolver.assetExts.push('wasm');

module.exports = config;
