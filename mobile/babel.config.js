module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated 4 splits worklets into its own package; the babel plugin lives there now.
    plugins: ['react-native-worklets/plugin'],
  };
};
