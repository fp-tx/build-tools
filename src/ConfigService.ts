import { pipe } from 'fp-ts/lib/function.js'
import type * as R from 'fp-ts/lib/Reader.js'
import * as RTE from 'fp-ts/lib/ReaderTaskEither.js'
import { type PackageJson } from 'type-fest'
import { type CompilerOptions } from 'typescript'

const ConfigServiceSymbol = Symbol('ConfigService')

interface SingleEntrypoint {
  readonly type: 'Single'
  readonly entrypoint: string
}

interface MultiEntrypoint {
  readonly type: 'Multi'
  /**
   * Uses glob pattern to find entrypoints relative to CWD, see
   * https://www.npmjs.com/package/glob,
   *
   * Note: you must include `./src` in the glob pattern
   *
   * Also note: deep file entrypoints are not currently supported. Each entrypoint this
   * glob resolves to must be a file within `src` or else exports will not resolve.
   */
  readonly entrypointGlobs: ReadonlyArray<string>
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
   * An option to emit declaration and declaration map files using TypeScript's compiler.
   *
   * This option will also add a `types` field to the emitted package.json
   *
   * Additionally, if `buildType` is set to `dual`, this option will emit both `.d.ts`
   * files and either `.d.mts` or `.d.cts` files.
   */
  readonly emitTypes?: boolean

  /**
   * A tsconfig used in `dts` generation. Note: this is relative to `basePath`.
   *
   * Note: outdir, declaration, declarationMap, emitDeclarationOnly are ignored
   */
  readonly dtsConfig?: string

  /**
   * Include IIFE generation for browser script tags (that don't support module scripts)
   *
   * This option is recommended for libraries with a single build-target, i.e. `buildType:
   * 'cjs'` or `buildType: 'esm'`
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

  /**
   * Options that override build-tools type options when compiling TypeScript declaration
   * files.
   *
   * @remarks
   *   **Do not use this option unless you are certain you know what you're doing.**
   *   Build-tools chooses the best options for library development, and overriding these
   *   could cause unpredictable behavior.
   * @default { }
   */
  readonly dtsCompilerOverrides?: Partial<CompilerOptions>

  /**
   * Allows you to specify the package-command entrypoints as TypeScript files that will
   * be re-pointed to their emitted javascript files.
   *
   * @remarks
   *   **Any binary file specified in this key or record must be an entrypoint, an error
   *   will be raised if that file is excluded from the entrypoint globs**
   */
  readonly bin?: string | Record<string, string> | null
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
    dtsConfig = 'tsconfig.json',
    dtsCompilerOverrides = {},
    bin = null,
  }: ConfigParameters) {
    this[ConfigServiceSymbol] = {
      buildType,
      srcDir,
      omittedPackageKeys,
      dtsConfig,
      copyFiles,
      basePath,
      outDir,
      iife,
      buildMode,
      emitTypes,
      dtsCompilerOverrides,
      bin,
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
