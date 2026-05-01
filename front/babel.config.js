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
            '@api': './src/api',
            '@components': './src/components',
            '@hooks': './src/hooks',
            '@context': './src/context',
            '@store': './src/store',
            '@utils': './src/utils',
          },
        },
      ],
    ],
  };
};
