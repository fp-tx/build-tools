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
      'Dual Module Single Exports',
      ConfigServiceLive({
        buildMode: { type: 'Single', entrypoint: 'foo.ts' },
      }),
      ExportsService.ExportsServiceLive({
        files: ['foo.ts', 'bar.ts'],
        type: 'module',
      }),
      tuple(undefined, './foo.cjs', './foo.js'),
    ),
    tuple(
      'Dual Module Multi Exports',
      ConfigServiceLive({
        buildMode: {
          type: 'Multi',
          entrypointPattern: /foo\.(.*\.)ts/,
          indexExport: 'foo.ts',
        },
      }),
      ExportsService.ExportsServiceLive({
        files: ['foo.ts', 'foo.a.ts', 'foo.b.ts'],
        type: 'module',
      }),
      tuple(
        {
          './foo': {
            import: './foo.js',
            default: './foo.cjs',
          },
          './foo.a': {
            import: './foo.a.js',
            default: './foo.a.cjs',
          },
          './foo.b': {
            import: './foo.b.js',
            default: './foo.b.cjs',
          },
        },
        './foo.cjs',
        './foo.js',
      ),
    ),
    tuple(
      'Dual Common Single Exports',
      ConfigServiceLive({
        buildMode: { type: 'Single', entrypoint: 'foo.ts' },
      }),
      ExportsService.ExportsServiceLive({
        files: ['foo.ts', 'bar.ts'],
        type: 'commonjs',
      }),
      tuple(undefined, './foo.js', './foo.mjs'),
    ),
    tuple(
      'Dual Common Multi Exports',
      ConfigServiceLive({
        buildMode: {
          type: 'Multi',
          entrypointPattern: /foo\.(.*\.)ts/,
          indexExport: 'foo.ts',
        },
      }),
      ExportsService.ExportsServiceLive({
        files: ['foo.ts', 'foo.a.ts', 'foo.b.ts'],
        type: 'commonjs',
      }),
      tuple(
        {
          './foo': {
            import: './foo.mjs',
            default: './foo.js',
          },
          './foo.a': {
            import: './foo.a.mjs',
            default: './foo.a.js',
          },
          './foo.b': {
            import: './foo.b.mjs',
            default: './foo.b.js',
          },
        },
        './foo.js',
        './foo.mjs',
      ),
    ),
    tuple(
      'CJS Module Single Exports',
      ConfigServiceLive({
        buildMode: { type: 'Single', entrypoint: 'foo.ts' },
        buildType: 'cjs',
      }),
      ExportsService.ExportsServiceLive({
        files: ['foo.ts', 'bar.ts'],
        type: 'module',
      }),
      tuple(undefined, './foo.cjs', undefined),
    ),
    tuple(
      'CJS Module Multi Exports',
      ConfigServiceLive({
        buildMode: {
          type: 'Multi',
          entrypointPattern: /foo\.(.*\.)ts/,
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
          './foo': {
            default: './foo.cjs',
          },
          './foo.a': {
            default: './foo.a.cjs',
          },
          './foo.b': {
            default: './foo.b.cjs',
          },
        },
        './foo.cjs',
        undefined,
      ),
    ),
    tuple(
      'CJS Common Single Exports',
      ConfigServiceLive({
        buildMode: { type: 'Single', entrypoint: 'foo.ts' },
        buildType: 'cjs',
      }),
      ExportsService.ExportsServiceLive({
        files: ['foo.ts', 'bar.ts'],
        type: 'commonjs',
      }),
      tuple(undefined, './foo.js', undefined),
    ),
    tuple(
      'CJS Common Multi Exports',
      ConfigServiceLive({
        buildMode: {
          type: 'Multi',
          entrypointPattern: /foo\.(.*\.)ts/,
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
          './foo': {
            default: './foo.js',
          },
          './foo.a': {
            default: './foo.a.js',
          },
          './foo.b': {
            default: './foo.b.js',
          },
        },
        './foo.js',
        undefined,
      ),
    ),
    tuple(
      'ESM Common Single Exports',
      ConfigServiceLive({
        buildMode: { type: 'Single', entrypoint: 'foo.ts' },
        buildType: 'esm',
      }),
      ExportsService.ExportsServiceLive({
        files: ['foo.ts', 'bar.ts'],
        type: 'commonjs',
      }),
      tuple(undefined, undefined, './foo.mjs'),
    ),
    tuple(
      'ESM Common Multi Exports',
      ConfigServiceLive({
        buildMode: {
          type: 'Multi',
          entrypointPattern: /foo\.(.*\.)ts/,
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
          './foo': {
            default: './foo.mjs',
          },
          './foo.a': {
            default: './foo.a.mjs',
          },
          './foo.b': {
            default: './foo.b.mjs',
          },
        },
        undefined,
        './foo.mjs',
      ),
    ),
    tuple(
      'ESM Module Single Exports',
      ConfigServiceLive({
        buildMode: { type: 'Single', entrypoint: 'foo.ts' },
        buildType: 'esm',
      }),
      ExportsService.ExportsServiceLive({
        files: ['foo.ts', 'bar.ts'],
        type: 'module',
      }),
      tuple(undefined, undefined, './foo.js'),
    ),
    tuple(
      'ESM Module Multi Exports',
      ConfigServiceLive({
        buildMode: {
          type: 'Multi',
          entrypointPattern: /foo\.(.*\.)ts/,
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
          './foo': {
            default: './foo.js',
          },
          './foo.a': {
            default: './foo.a.js',
          },
          './foo.b': {
            default: './foo.b.js',
          },
        },
        undefined,
        './foo.js',
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
