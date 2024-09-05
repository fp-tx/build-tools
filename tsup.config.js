import { makeConfig } from './src/index'

export default makeConfig(
  {
    buildType: 'cjs',
    iife: true,
    buildMode: {
      type: 'Single',
      entrypoint: './src/index.ts',
    },
    copyFiles: ['README.md', 'LICENSE'],
  },
  {
    platform: 'node',
    clean: true,
  },
)
