import { exec } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'

import { pipe } from 'fp-ts/lib/function'
import * as RA from 'fp-ts/lib/ReadonlyArray'

// import { makeConfig } from '../src'

describe('test projects', () => {
  test.each(
    pipe(
      RA.Do,
      RA.apS('packageType', ['commonjs', 'module']),
      RA.apS('outputFormats', ['cjs', 'esm', 'dual']),
      RA.map(({ packageType, outputFormats }) => `${packageType}-${outputFormats}`),
      RA.concat([
        // ------------------------------------------------
        // Used to test import remapping from an index file
        // ------------------------------------------------
        'index-ref',
        // ------------------------------------------------
        // Used to test JSX libs
        // ------------------------------------------------
        'jsx',
        // ------------------------------------------------
        // Used to test multi-entrypoint hybrid based dual libs
        // ------------------------------------------------
        'multi-hybrid-dual',
        // ------------------------------------------------
        // Used to test multi-entrypoint root based dual libs
        // ------------------------------------------------
        'multi-root-dual',
        // ------------------------------------------------
        // Used to test single-entrypoint src based dual libs
        // ------------------------------------------------
        'single-src-dual',
      ]),
    ),
  )(
    `%s`,
    async project => {
      await promisify(exec)('npm install', {
        cwd: path.join(__dirname, 'test-projects', project),
      })

      await promisify(exec)('npx tsup', {
        cwd: path.join(__dirname, 'test-projects', project),
      })

      await new Promise<void>((resolve, reject) => {
        const attw = exec('npx attw --pack .', {
          cwd: path.join(__dirname, 'test-projects', project, 'dist'),
        })
        attw.stdout?.on('data', data => console.log(data))
        attw.on('close', code => {
          if (code === 0) resolve()
          else reject('attw failed')
        })
      })
    },
    20000,
  )
})
