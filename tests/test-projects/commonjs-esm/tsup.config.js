import { makeConfig } from '@fp-tx/build-tools'

export default makeConfig(
  {
    basePath: '.',
    buildType: 'esm',
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
