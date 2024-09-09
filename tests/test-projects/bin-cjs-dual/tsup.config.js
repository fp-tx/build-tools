import { makeConfig } from '@fp-tx/build-tools'

export default makeConfig(
  {
    basePath: '.',
    buildType: 'dual',
    buildMode: {
      type: 'Multi',
      entrypointGlobs: ['./foo.ts', './baz.ts'],
    },
    srcDir: './src',
    outDir: './dist',
    copyFiles: [],
    iife: true,
    bin: {
      foo: './foo.ts',
      baz: './baz.ts',
    },
  },
  {
    clean: true,
  },
)
