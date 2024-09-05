const { makeConfig } = require('@fp-tx/build-tools')

module.exports = makeConfig(
  {
    basePath: '.',
    buildType: 'dual',
    buildMode: {
      type: 'Multi',
      entrypointGlobs: ['./foo.bar.ts', './src/foo.foo.ts'],
      indexExport: './src/foo.foo.ts',
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
