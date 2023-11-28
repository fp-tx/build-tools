import { flow, pipe } from 'fp-ts/lib/function.js'
import * as O from 'fp-ts/lib/Option.js'
import type * as R from 'fp-ts/lib/Reader.js'
import * as RTE from 'fp-ts/lib/ReaderTaskEither.js'
import * as RA from 'fp-ts/lib/ReadonlyArray.js'
import type fs from 'fs'
import { type Options } from 'tsup'
import { type PackageJson } from 'type-fest'

const ConfigServiceSymbol = Symbol('ConfigService')

export type ConfigParameters = {
  /**
   * Determines which module types to emit
   *
   * @default 'dual'
   */
  readonly buildType?: 'cjs' | 'esm' | 'dual'

  /**
   * Include IIFE generation for browser script tags (that don't support module scripts)
   *
   * @default false
   */
  readonly iife?: boolean

  /**
   * The source directory to read from
   *
   * @default 'src'
   */
  readonly srcDir?: string

  /**
   * The current working directory
   *
   * @default '.'
   */
  readonly basePath?: string

  /**
   * A function which maps resolved entrypoints in "src" to their respective output paths.
   *
   * Appends result of `getEntrypoints` to `basePath <> srcDir` to get the full path to
   * the entrypoint.
   *
   * @example
   *   // default behavior
   *   RA.filterMap(
   *     flow(
   *       O.fromPredicate(dirInt => dirInt.isFile()),
   *       O.map(dirInt => dirInt.name),
   *       O.filter(name => name.endsWith('.ts') || name.endsWith('.tsx')),
   *       O.filter(name => !name.endsWith('.d.ts')),
   *       O.filter(
   *         name =>
   *           !name.includes('spec') &&
   *           !name.includes('test') &&
   *           !name.includes('internal'),
   *       ),
   *     ),
   *   )
   */
  readonly getEntrypoints?: (srcDir: ReadonlyArray<fs.Dirent>) => ReadonlyArray<string>

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

  /**
   * If the output should be minified
   *
   * @default false
   */
  readonly minify?: Options['minify']

  /**
   * If the output should have split chunks
   *
   * @default false
   */
  readonly splitting?: Options['splitting']

  /**
   * Whether to emit sourcemaps
   *
   * @default true
   */
  readonly sourcemap?: Options['sourcemap']

  /**
   * Whether to emit declaration files
   *
   * @default true
   */
  readonly dts?: Options['dts']

  /**
   * Whether to emit experimental declaration files
   *
   * @default false
   */
  readonly experimentalDts?: Options['experimentalDts']

  /**
   * Whether to cleanup dist before building
   *
   * @default true
   */
  readonly clean?: Options['clean']

  /**
   * Target platform
   *
   * @default 'neutral'
   */
  readonly platform?: Options['platform']
}

const defaultGetEntrypoints: NonNullable<ConfigParameters['getEntrypoints']> =
  RA.filterMap(
    flow(
      O.fromPredicate(dirInt => dirInt.isFile()),
      O.map(dirInt => dirInt.name),
      O.filter(name => name.endsWith('.ts') || name.endsWith('.tsx')),
      O.filter(name => !name.endsWith('.d.ts')),
      O.filter(
        name =>
          !name.includes('spec') && !name.includes('test') && !name.includes('internal'),
      ),
    ),
  )

export class ConfigService {
  [ConfigServiceSymbol]: Required<ConfigParameters>
  constructor({
    buildType = 'dual',
    srcDir = 'src',
    omittedPackageKeys = ['devDependencies', 'scripts', 'lint-staged'],
    copyFiles = ['README.md', 'LICENSE'],
    basePath = '.',
    outDir = 'dist',
    splitting = false,
    minify = false,
    dts = true,
    sourcemap = true,
    iife = false,
    clean: cleanup = true,
    platform = 'neutral',
    experimentalDts = false,
    getEntrypoints = defaultGetEntrypoints,
  }: ConfigParameters) {
    this[ConfigServiceSymbol] = {
      buildType,
      srcDir,
      omittedPackageKeys,
      copyFiles,
      basePath,
      outDir,
      splitting,
      minify,
      dts,
      platform,
      sourcemap,
      iife,
      experimentalDts,
      getEntrypoints,
      clean: cleanup,
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
