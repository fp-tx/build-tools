import { makeConfig } from './src'

export default makeConfig({
  buildType: 'cjs',
  getEntrypoints: () => ['index.ts'],
  copyFiles: ['README.md', 'LICENSE'],
  platform: 'node',
})
