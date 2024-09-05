const { makeConfig } = require('@fp-tx/build-tools')

module.exports = makeConfig(
  {
    basePath: '.',
    buildType: 'dual',
    buildMode: {
      type: 'Multi',
      entrypointGlobs: ['./src/foo.*.ts'],
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
