import { type Endomorphism } from 'fp-ts/lib/Endomorphism.js'
import { identity, pipe } from 'fp-ts/lib/function.js'
import type * as R from 'fp-ts/lib/Reader.js'
import * as RTE from 'fp-ts/lib/ReaderTaskEither.js'
import type * as RR from 'fp-ts/lib/ReadonlyRecord.js'
import type fs from 'fs'
import { type Options } from 'tsup'

const ConfigServiceSymbol = Symbol('ConfigService')

export type ConfigParameters = {
  /**
   * Determines which module types to emit
   *
   * @default 'dual'
   */
  readonly buildType?: 'cjs' | 'esm' | 'dual'

  /**
   * Splits module types into distinct directories
   *
   * @default true
   */
  readonly legacy?: boolean

  /**
   * The source directory to read from
   *
   * @default 'src'
   */
  readonly srcDir?: string

  /**
   * The current working directory
   *
   * @default "."
   */
  readonly basePath?: string

  /**
   * A function which maps resolved entrypoints in "src" to their respective output paths.
   *
   * Appends result of `getEntrypoints` to `basePath <> srcDir` to get the full path to the entrypoint.
   */
  readonly getEntrypoints: (srcDir: ReadonlyArray<fs.Dirent>) => ReadonlyArray<string>

  /**
   * A function which allows mapping a package.json value to a new value for the purpose of occluding various fields, i.e. "scripts"
   *
   * @default identity
   */
  readonly occludePackage?: Endomorphism<RR.ReadonlyRecord<string, unknown>>

  /**
   * A list of files to copy into dist
   *
   * @default []
   */
  readonly copyFiles?: ReadonlyArray<string>

  /**
   * The output directory
   *
   * @default "dist"
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
  readonly splitChunks?: Options['splitting']

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
}

export class ConfigService {
  [ConfigServiceSymbol]: Required<ConfigParameters>
  constructor({
    buildType = 'dual',
    legacy = true,
    srcDir = 'src',
    occludePackage = identity,
    copyFiles = [],
    basePath = '.',
    outDir = 'dist',
    splitChunks = false,
    minify = false,
    dts = true,
    sourcemap = true,
    ...rest
  }: ConfigParameters) {
    this[ConfigServiceSymbol] = {
      buildType,
      legacy,
      srcDir,
      occludePackage,
      copyFiles,
      basePath,
      outDir,
      splitChunks,
      minify,
      dts,
      sourcemap,
      ...rest,
    }
  }
}

export const ConfigServiceLive: R.Reader<ConfigParameters, ConfigService> = (config) => new ConfigService(config)

export const config: RTE.ReaderTaskEither<ConfigService, never, ConfigService[typeof ConfigServiceSymbol]> = pipe(
  RTE.ask<ConfigService>(),
  RTE.map((service) => service[ConfigServiceSymbol]),
)
