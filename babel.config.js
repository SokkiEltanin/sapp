module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src',
            '@components': './src/components',
            '@screens': './src/screens',
            '@hooks': './src/hooks',
            '@store': './src/store',
            '@services': './src/services',
            '@utils': './src/utils',
            '@theme': './src/theme',
            '@types': './src/types',
          },
        },
      ],
      // reanimated 4.x with new architecture: plugin not needed
    ],
  };
};
