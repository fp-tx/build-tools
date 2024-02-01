import { pipe } from 'fp-ts/lib/function.js'
import type * as R from 'fp-ts/lib/Reader.js'
import * as RTE from 'fp-ts/lib/ReaderTaskEither.js'
import { type PackageJson } from 'type-fest'

const ConfigServiceSymbol = Symbol('ConfigService')

interface SingleEntrypoint {
  readonly type: 'Single'
  readonly entrypoint: string
}

interface MultiEntrypoint {
  readonly type: 'Multi'
  readonly entrypointPattern: RegExp
  readonly indexExport?: string
}

export type BuildMode = SingleEntrypoint | MultiEntrypoint

export type ConfigParameters = {
  /**
   * Determines which module types to emit
   *
   * @default 'dual'
   */
  readonly buildType?: 'cjs' | 'esm' | 'dual'

  /**
   * Determines if the package is single or multi entrypoint
   *
   * Note: entrypoint is relative to `basePath` <> `srcDir`
   *
   * @default `{ type: 'Single', entrypoint: 'index.ts' }`
   */
  readonly buildMode?: BuildMode

  /**
   * An option to emit declaration files using TypeScript's compiler.
   *
   * This option will also add a `types` field to the emitted package.json
   */
  readonly emitTypes?: boolean

  /**
   * Include IIFE generation for browser script tags (that don't support module scripts)
   *
   * @default false
   */
  readonly iife?: boolean

  /**
   * The current working directory
   *
   * @default '.'
   */
  readonly basePath?: string

  /**
   * Sets the source directory, path is relative to "basePath"
   *
   * @default 'src'
   */
  readonly srcDir?: string

  /**
   * A list of package.json keys to omit from the copied file in dist
   *
   * @default ['devDependencies', 'scripts', 'lint-staged']
   */
  readonly omittedPackageKeys?: ReadonlyArray<
    (string & {}) | keyof (PackageJson.PackageJsonStandard | PackageJson.PublishConfig)
  >

  /**
   * A list of files to copy into dist, path is relative to "basePath"
   *
   * @default ['README.md', 'LICENSE']
   */
  readonly copyFiles?: ReadonlyArray<string>

  /**
   * The output directory, path is relative to "basePath"
   *
   * @default 'dist'
   */
  readonly outDir?: string
}

export class ConfigService {
  [ConfigServiceSymbol]: Required<ConfigParameters>
  constructor({
    buildType = 'dual',
    omittedPackageKeys = ['devDependencies', 'scripts', 'lint-staged'],
    copyFiles = ['README.md', 'LICENSE'],
    basePath = '.',
    outDir = 'dist',
    iife = false,
    srcDir = 'src',
    buildMode = { type: 'Single', entrypoint: 'index.ts' },
    emitTypes = true,
  }: ConfigParameters) {
    this[ConfigServiceSymbol] = {
      buildType,
      srcDir,
      omittedPackageKeys,
      copyFiles,
      basePath,
      outDir,
      iife,
      buildMode,
      emitTypes,
    }
  }
}

export const ConfigServiceLive: R.Reader<ConfigParameters, ConfigService> = config =>
  new ConfigService(config)

export const config: RTE.ReaderTaskEither<
  ConfigService,
  never,
  ConfigService[typeof ConfigServiceSymbol]
> = pipe(
  RTE.ask<ConfigService>(),
  RTE.map(service => service[ConfigServiceSymbol]),
)
