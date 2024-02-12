import * as E from 'fp-ts/lib/Either.js'
import { tuple } from 'fp-ts/lib/function.js'

import { ConfigServiceLive } from '../src/ConfigService'
import * as ExportsService from '../src/ExportsService'

function assertRight(e: E.Either<unknown, unknown>): asserts e is E.Right<unknown> {
  if (E.isRight(e)) return
  throw new Error('Expected Right, got Left')
}

describe('ExportsService', () => {
  test.each([
    tuple(
      'Dual "type: module" Single Exports',
      ConfigServiceLive({
        buildMode: { type: 'Single', entrypoint: 'foo.ts' },
      }),
      ExportsService.ExportsServiceLive({
        files: ['foo.ts', 'bar.ts'],
        type: 'module',
      }),
      tuple(
        {
          '.': {
            import: { types: './foo.d.ts', default: './foo.js' },
            require: { types: './foo.d.cts', default: './foo.cjs' },
          },
          './package.json': './package.json',
        },
        './foo.cjs',
        './foo.js',
        './foo.d.cts',
      ),
    ),
    tuple(
      'Dual "type: module" Multi Exports',
      ConfigServiceLive({
        buildMode: {
          type: 'Multi',
          entrypointGlobs: ['./src/foo.*.ts'],
          indexExport: 'foo.ts',
        },
      }),
      ExportsService.ExportsServiceLive({
        files: ['foo.ts', 'foo.a.ts', 'foo.b.ts'],
        type: 'module',
      }),
      tuple(
        {
          '.': {
            import: { types: './foo.d.ts', default: './foo.js' },
            require: { types: './foo.d.cts', default: './foo.cjs' },
          },
          './foo.a': {
            import: { types: './foo.a.d.ts', default: './foo.a.js' },
            require: { types: './foo.a.d.cts', default: './foo.a.cjs' },
          },
          './foo.b': {
            import: { types: './foo.b.d.ts', default: './foo.b.js' },
            require: { types: './foo.b.d.cts', default: './foo.b.cjs' },
          },
          './package.json': './package.json',
        },
        './foo.cjs',
        './foo.js',
        './foo.d.cts',
      ),
    ),
    tuple(
      'Dual "type: common" Single Exports',
      ConfigServiceLive({
        buildMode: { type: 'Single', entrypoint: 'foo.ts' },
      }),
      ExportsService.ExportsServiceLive({
        files: ['foo.ts', 'bar.ts'],
        type: 'commonjs',
      }),
      tuple(
        {
          '.': {
            import: { types: './foo.d.mts', default: './foo.mjs' },
            require: { types: './foo.d.ts', default: './foo.js' },
          },
          './package.json': './package.json',
        },
        './foo.js',
        './foo.mjs',
        './foo.d.ts',
      ),
    ),
    tuple(
      'Dual "type: common" Multi Exports',
      ConfigServiceLive({
        buildMode: {
          type: 'Multi',
          entrypointGlobs: ['./src/foo.*.ts'],
          indexExport: 'foo.ts',
        },
      }),
      ExportsService.ExportsServiceLive({
        files: ['foo.ts', 'foo.a.ts', 'foo.b.ts'],
        type: 'commonjs',
      }),
      tuple(
        {
          '.': {
            import: { types: './foo.d.mts', default: './foo.mjs' },
            require: { types: './foo.d.ts', default: './foo.js' },
          },
          './foo.a': {
            import: { types: './foo.a.d.mts', default: './foo.a.mjs' },
            require: { types: './foo.a.d.ts', default: './foo.a.js' },
          },
          './foo.b': {
            import: { types: './foo.b.d.mts', default: './foo.b.mjs' },
            require: { types: './foo.b.d.ts', default: './foo.b.js' },
          },
          './package.json': './package.json',
        },
        './foo.js',
        './foo.mjs',
        './foo.d.ts',
      ),
    ),
    tuple(
      'CJS "type: module" Single Exports',
      ConfigServiceLive({
        buildMode: { type: 'Single', entrypoint: 'foo.ts' },
        buildType: 'cjs',
      }),
      ExportsService.ExportsServiceLive({
        files: ['foo.ts', 'bar.ts'],
        type: 'module',
      }),
      tuple(
        {
          '.': {
            require: { types: './foo.d.cts', default: './foo.cjs' },
          },
          './package.json': './package.json',
        },
        './foo.cjs',
        undefined,
        './foo.d.cts',
      ),
    ),
    tuple(
      'CJS "type: module" Multi Exports',
      ConfigServiceLive({
        buildMode: {
          type: 'Multi',
          entrypointGlobs: ['./src/foo.*.ts'],
          indexExport: 'foo.ts',
        },
        buildType: 'cjs',
      }),
      ExportsService.ExportsServiceLive({
        files: ['foo.ts', 'foo.a.ts', 'foo.b.ts'],
        type: 'module',
      }),
      tuple(
        {
          '.': {
            require: { types: './foo.d.cts', default: './foo.cjs' },
          },
          './foo.a': {
            require: { types: './foo.a.d.cts', default: './foo.a.cjs' },
          },
          './foo.b': {
            require: { types: './foo.b.d.cts', default: './foo.b.cjs' },
          },
          './package.json': './package.json',
        },
        './foo.cjs',
        undefined,
        './foo.d.cts',
      ),
    ),
    tuple(
      'CJS "type: common" Single Exports',
      ConfigServiceLive({
        buildMode: { type: 'Single', entrypoint: 'foo.ts' },
        buildType: 'cjs',
      }),
      ExportsService.ExportsServiceLive({
        files: ['foo.ts', 'bar.ts'],
        type: 'commonjs',
      }),
      tuple(
        {
          '.': {
            require: { types: './foo.d.ts', default: './foo.js' },
          },
          './package.json': './package.json',
        },
        './foo.js',
        undefined,
        './foo.d.ts',
      ),
    ),
    tuple(
      'CJS "type: common" Multi Exports',
      ConfigServiceLive({
        buildMode: {
          type: 'Multi',
          entrypointGlobs: ['./src/foo.*.ts'],
          indexExport: 'foo.ts',
        },
        buildType: 'cjs',
      }),
      ExportsService.ExportsServiceLive({
        files: ['foo.ts', 'foo.a.ts', 'foo.b.ts'],
        type: 'commonjs',
      }),
      tuple(
        {
          '.': {
            require: { types: './foo.d.ts', default: './foo.js' },
          },
          './foo.a': {
            require: { types: './foo.a.d.ts', default: './foo.a.js' },
          },
          './foo.b': {
            require: { types: './foo.b.d.ts', default: './foo.b.js' },
          },
          './package.json': './package.json',
        },
        './foo.js',
        undefined,
        './foo.d.ts',
      ),
    ),
    tuple(
      'ESM "type: common" Single Exports',
      ConfigServiceLive({
        buildMode: { type: 'Single', entrypoint: 'foo.ts' },
        buildType: 'esm',
      }),
      ExportsService.ExportsServiceLive({
        files: ['foo.ts', 'bar.ts'],
        type: 'commonjs',
      }),
      tuple(
        {
          '.': {
            import: { types: './foo.d.mts', default: './foo.mjs' },
          },
          './package.json': './package.json',
        },
        undefined,
        './foo.mjs',
        './foo.d.mts',
      ),
    ),
    tuple(
      'ESM "type: common" Multi Exports',
      ConfigServiceLive({
        buildMode: {
          type: 'Multi',
          entrypointGlobs: ['./src/foo.*.ts'],
          indexExport: 'foo.ts',
        },
        buildType: 'esm',
      }),
      ExportsService.ExportsServiceLive({
        files: ['foo.ts', 'foo.a.ts', 'foo.b.ts'],
        type: 'commonjs',
      }),
      tuple(
        {
          '.': {
            import: { types: './foo.d.mts', default: './foo.mjs' },
          },
          './foo.a': {
            import: { types: './foo.a.d.mts', default: './foo.a.mjs' },
          },
          './foo.b': {
            import: { types: './foo.b.d.mts', default: './foo.b.mjs' },
          },
          './package.json': './package.json',
        },
        undefined,
        './foo.mjs',
        './foo.d.mts',
      ),
    ),
    tuple(
      'ESM "type: module" Single Exports',
      ConfigServiceLive({
        buildMode: { type: 'Single', entrypoint: 'foo.ts' },
        buildType: 'esm',
      }),
      ExportsService.ExportsServiceLive({
        files: ['foo.ts', 'bar.ts'],
        type: 'module',
      }),
      tuple(
        {
          '.': {
            import: { types: './foo.d.ts', default: './foo.js' },
          },
          './package.json': './package.json',
        },
        undefined,
        './foo.js',
        './foo.d.ts',
      ),
    ),
    tuple(
      'ESM "type: module" Multi Exports',
      ConfigServiceLive({
        buildMode: {
          type: 'Multi',
          entrypointGlobs: ['./src/foo.*.ts'],
          indexExport: 'foo.ts',
        },
        buildType: 'esm',
      }),
      ExportsService.ExportsServiceLive({
        files: ['foo.ts', 'foo.a.ts', 'foo.b.ts'],
        type: 'module',
      }),
      tuple(
        {
          '.': {
            import: { types: './foo.d.ts', default: './foo.js' },
          },
          './foo.a': {
            import: { types: './foo.a.d.ts', default: './foo.a.js' },
          },
          './foo.b': {
            import: { types: './foo.b.d.ts', default: './foo.b.js' },
          },
          './package.json': './package.json',
        },
        undefined,
        './foo.js',
        './foo.d.ts',
      ),
    ),
  ])('%s', async (_, configService, service, expected) => {
    const exportsService = await service(configService)()
    assertRight(exportsService)
    const result = await ExportsService.pkgExports(exportsService.right)()
    assertRight(result)
    expect(result.right).toStrictEqual(expected)
  })
})
