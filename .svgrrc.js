// SVGR config for react-native-svg-transformer.
//
// Icon SVGs use white fills so the SDF build pipeline (build-map-icons.sh)
// can extract shapes from the alpha channel. convertColors replaces all
// hardcoded colors with `currentColor` at bundle time so the `color` prop
// on the React component controls the fill at runtime.
module.exports = {
  native: true,
  plugins: ["@svgr/plugin-svgo", "@svgr/plugin-jsx"],
  svgoConfig: {
    plugins: [
      {
        name: "preset-default",
        params: {
          overrides: {
            inlineStyles: { onlyMatchedOnce: false },
            removeViewBox: false,
            removeUnknownsAndDefaults: false,
          },
        },
      },
      {
        name: "convertColors",
        params: {
          currentColor: true,
        },
      },
    ],
  },
};
