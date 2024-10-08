const { makeConfig } = require('@fp-tx/build-tools')

module.exports = makeConfig(
  {
    basePath: '.',
    buildType: 'dual',
    buildMode: {
      type: 'Single',
      entrypoint: './src/foo.foo.ts',
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
