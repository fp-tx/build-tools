import { makeConfig } from './src'

export default makeConfig(
  {
    buildType: 'cjs',
    iife: true,
    buildMode: {
      type: 'Single',
      entrypoint: 'index.ts',
    },
    copyFiles: ['README.md', 'LICENSE'],
  },
  {
    platform: 'node',
  },
)
