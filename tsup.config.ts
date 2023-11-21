import * as RR from 'fp-ts/lib/ReadonlyRecord.js'

import { makeConfig } from './src'

const omittedPackageKeys = ['scripts', 'devDependencies']

export default makeConfig({
  getEntrypoints: () => ['index.ts'],
  occludePackage: RR.filterWithIndex(k => !omittedPackageKeys.includes(k)),
  copyFiles: ['README.md', 'LICENSE'],
  platform: 'node',
})
