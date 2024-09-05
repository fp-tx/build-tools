import { makeConfig } from '@fp-tx/build-tools'

export default makeConfig(
  {
    basePath: '.',
    buildType: 'dual',
    buildMode: {
      type: 'Single',
      entrypoint: './src/foo.ts',
    },
    srcDir: './src',
    outDir: './dist',
    copyFiles: [],
  },
  {
    clean: true,
  },
)
