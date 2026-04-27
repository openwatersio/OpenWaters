// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Use react-native-svg-transformer for .svg files so they can be imported
// as React components: `import FuelIcon from "@/assets/map/svg/marker-fuel.svg"`
config.transformer.babelTransformerPath = require.resolve(
  "react-native-svg-transformer/expo"
);
config.resolver.assetExts = config.resolver.assetExts.filter(
  (ext) => ext !== "svg"
);
config.resolver.sourceExts.push("svg");

// Bundle .md files as assets so they can be loaded at runtime via expo-asset.
config.resolver.assetExts.push("md");

module.exports = config;
