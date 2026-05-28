module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated 4 moved its babel transform into the worklets package.
    // Must be listed LAST.
    plugins: ['react-native-worklets/plugin'],
  };
};
