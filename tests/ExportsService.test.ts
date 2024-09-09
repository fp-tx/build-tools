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
      '`bin` field resolution',
      ConfigServiceLive({
        buildMode: { type: 'Single', entrypoint: 'foo.ts' },
        bin: {
          foo: './foo.ts',
          bar: './bar.ts',
        },
      }),
      ExportsService.ExportsServiceLive({
        files: ['foo.ts', 'bar.ts'],
        type: 'module',
        resolvedIndex: 'foo.ts',
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
        {
          foo: './foo.js',
          bar: './bar.js',
        },
      ),
    ),
    tuple(
      'Dual "type: module" Single Exports',
      ConfigServiceLive({
        buildMode: { type: 'Single', entrypoint: 'foo.ts' },
      }),
      ExportsService.ExportsServiceLive({
        files: ['foo.ts', 'bar.ts'],
        type: 'module',
        resolvedIndex: 'foo.ts',
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
        undefined,
      ),
    ),
    tuple(
      'Dual "type: module" Multi Exports',
      ConfigServiceLive({
        buildMode: {
          type: 'Multi',
          entrypointGlobs: ['./src/foo.*.ts'],
          indexExport: './src/foo.ts',
        },
      }),
      ExportsService.ExportsServiceLive({
        files: ['src/foo.ts', 'src/foo.a.ts', 'src/foo.b.ts'],
        type: 'module',
        resolvedIndex: 'src/foo.ts',
      }),
      tuple(
        {
          '.': {
            import: { types: './src/foo.d.ts', default: './src/foo.js' },
            require: { types: './src/foo.d.cts', default: './src/foo.cjs' },
          },
          './foo.a': {
            import: { types: './src/foo.a.d.ts', default: './src/foo.a.js' },
            require: { types: './src/foo.a.d.cts', default: './src/foo.a.cjs' },
          },
          './foo.b': {
            import: { types: './src/foo.b.d.ts', default: './src/foo.b.js' },
            require: { types: './src/foo.b.d.cts', default: './src/foo.b.cjs' },
          },
          './package.json': './package.json',
        },
        './src/foo.cjs',
        './src/foo.js',
        './src/foo.d.cts',
        undefined,
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
        resolvedIndex: 'foo.ts',
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
        undefined,
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
        files: ['src/foo.ts', 'src/foo.a.ts', 'src/foo.b.ts'],
        type: 'commonjs',
        resolvedIndex: 'src/foo.ts',
      }),
      tuple(
        {
          '.': {
            import: { types: './src/foo.d.mts', default: './src/foo.mjs' },
            require: { types: './src/foo.d.ts', default: './src/foo.js' },
          },
          './foo.a': {
            import: { types: './src/foo.a.d.mts', default: './src/foo.a.mjs' },
            require: { types: './src/foo.a.d.ts', default: './src/foo.a.js' },
          },
          './foo.b': {
            import: { types: './src/foo.b.d.mts', default: './src/foo.b.mjs' },
            require: { types: './src/foo.b.d.ts', default: './src/foo.b.js' },
          },
          './package.json': './package.json',
        },
        './src/foo.js',
        './src/foo.mjs',
        './src/foo.d.ts',
        undefined,
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
        resolvedIndex: 'foo.ts',
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
        undefined,
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
        files: ['src/foo.ts', 'src/foo.a.ts', 'src/foo.b.ts'],
        type: 'module',
        resolvedIndex: 'src/foo.ts',
      }),
      tuple(
        {
          '.': {
            require: { types: './src/foo.d.cts', default: './src/foo.cjs' },
          },
          './foo.a': {
            require: { types: './src/foo.a.d.cts', default: './src/foo.a.cjs' },
          },
          './foo.b': {
            require: { types: './src/foo.b.d.cts', default: './src/foo.b.cjs' },
          },
          './package.json': './package.json',
        },
        './src/foo.cjs',
        undefined,
        './src/foo.d.cts',
        undefined,
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
        resolvedIndex: 'foo.ts',
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
        undefined,
      ),
    ),
    tuple(
      'CJS "type: common" Multi Exports',
      ConfigServiceLive({
        buildMode: {
          type: 'Multi',
          entrypointGlobs: ['./src/foo.*.ts'],
          indexExport: 'src/foo.ts',
        },
        buildType: 'cjs',
      }),
      ExportsService.ExportsServiceLive({
        files: ['src/foo.ts', 'src/foo.a.ts', 'src/foo.b.ts'],
        type: 'commonjs',
        resolvedIndex: 'src/foo.ts',
      }),
      tuple(
        {
          '.': {
            require: { types: './src/foo.d.ts', default: './src/foo.js' },
          },
          './foo.a': {
            require: { types: './src/foo.a.d.ts', default: './src/foo.a.js' },
          },
          './foo.b': {
            require: { types: './src/foo.b.d.ts', default: './src/foo.b.js' },
          },
          './package.json': './package.json',
        },
        './src/foo.js',
        undefined,
        './src/foo.d.ts',
        undefined,
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
        resolvedIndex: 'foo.ts',
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
        undefined,
      ),
    ),
    tuple(
      'ESM "type: common" Multi Exports',
      ConfigServiceLive({
        buildMode: {
          type: 'Multi',
          entrypointGlobs: ['./src/foo.*.ts'],
          indexExport: 'src/foo.ts',
        },
        buildType: 'esm',
      }),
      ExportsService.ExportsServiceLive({
        files: ['src/foo.ts', 'src/foo.a.ts', 'src/foo.b.ts'],
        type: 'commonjs',
        resolvedIndex: 'src/foo.ts',
      }),
      tuple(
        {
          '.': {
            import: { types: './src/foo.d.mts', default: './src/foo.mjs' },
          },
          './foo.a': {
            import: { types: './src/foo.a.d.mts', default: './src/foo.a.mjs' },
          },
          './foo.b': {
            import: { types: './src/foo.b.d.mts', default: './src/foo.b.mjs' },
          },
          './package.json': './package.json',
        },
        undefined,
        './src/foo.mjs',
        './src/foo.d.mts',
        undefined,
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
        resolvedIndex: 'foo.ts',
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
        undefined,
      ),
    ),
    tuple(
      'ESM "type: module" Multi Exports',
      ConfigServiceLive({
        buildMode: {
          type: 'Multi',
          entrypointGlobs: ['./src/foo.*.ts'],
          indexExport: 'src/foo.ts',
        },
        buildType: 'esm',
      }),
      ExportsService.ExportsServiceLive({
        files: ['src/foo.ts', 'src/foo.a.ts', 'src/foo.b.ts'],
        type: 'module',
        resolvedIndex: 'src/foo.ts',
      }),
      tuple(
        {
          '.': {
            import: { types: './src/foo.d.ts', default: './src/foo.js' },
          },
          './foo.a': {
            import: { types: './src/foo.a.d.ts', default: './src/foo.a.js' },
          },
          './foo.b': {
            import: { types: './src/foo.b.d.ts', default: './src/foo.b.js' },
          },
          './package.json': './package.json',
        },
        undefined,
        './src/foo.js',
        './src/foo.d.ts',
        undefined,
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
