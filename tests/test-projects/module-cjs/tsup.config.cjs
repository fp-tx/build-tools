const { makeConfig } = require('@fp-tx/build-tools')

module.exports = makeConfig(
  {
    basePath: '.',
    buildType: 'cjs',
    buildMode: {
      type: 'Single',
      entrypoint: './src/foo.ts',
    },
    srcDir: './src',
    outDir: './dist',
    copyFiles: [],
    iife: true,
  },
  {
    clean: true,
  },
)
