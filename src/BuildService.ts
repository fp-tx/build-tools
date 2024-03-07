import * as color from 'colorette'
import { esbuildPluginFilePathExtensions } from 'esbuild-plugin-file-path-extensions'
import * as E from 'fp-ts/lib/Either.js'
import { pipe, tuple } from 'fp-ts/lib/function.js'
import type * as R from 'fp-ts/lib/Reader.js'
import * as RT from 'fp-ts/lib/ReaderTask.js'
import * as RTE from 'fp-ts/lib/ReaderTaskEither.js'
import * as RA from 'fp-ts/lib/ReadonlyArray.js'
import * as RR from 'fp-ts/lib/ReadonlyRecord.js'
import type * as T from 'fp-ts/lib/Task.js'
import path from 'path'
import * as TCE from 'schemata-ts/TranscodeError'
import * as TC from 'schemata-ts/Transcoder'
import { type Options } from 'tsup'

import { config, type ConfigService } from './ConfigService'
import * as Exports from './ExportsService'
import * as Files from './FileService'
import * as Log from './LoggingService'
import * as Pkg from './PackageJson'
import * as Src from './SourceService'
import * as Types from './TypesService'

const BuildServiceSymbol = Symbol('BuildService')

type BuildServiceMethods = {
  readonly configuration: Options
}

export class BuildService {
  [BuildServiceSymbol]: BuildServiceMethods
  constructor(buildServiceMethods: BuildServiceMethods) {
    this[BuildServiceSymbol] = buildServiceMethods
  }
}

// Adapted from https://github.com/egoist/tsup/blob/83c7c7f3131ca6d46aaad4de3111c2fd5e5b5c21/src/utils.ts#L140
const outExtension: Options['outExtension'] = ({ format, pkgType }) => {
  const isModule = pkgType === 'module'

  if (isModule && format === 'cjs') {
    return {
      js: '.cjs',
      dts: '.d.cts',
    }
  }
  if (!isModule && format === 'esm') {
    return {
      js: '.mjs',
      dts: '.d.mts',
    }
  }
  if (isModule && format === 'iife') {
    return {
      js: '.global.cjs',
    }
  }
  if (!isModule && format === 'iife') {
    return {
      js: '.global.js',
    }
  }
  return {
    js: '.js',
    dts: '.d.ts',
  }
}

export const BuildServiceLive: RTE.ReaderTaskEither<
  ConfigService &
    Log.LoggingService &
    Files.FileService &
    Src.SourceService &
    Types.TypesService,
  Files.FileServiceError | Pkg.PackageJsonReadError | Types.TypesServiceError,
  BuildService
> = pipe(
  RTE.Do,
  RTE.apSW('config', config),
  RTE.bindW('entrypoints', ({ config }) =>
    config.buildMode.type === 'Single'
      ? RTE.right(
          RA.of(path.join(config.basePath, config.srcDir, config.buildMode.entrypoint)),
        )
      : Files.glob(config.buildMode.entrypointGlobs),
  ),
  RTE.let('files', ({ entrypoints }) =>
    pipe(
      entrypoints,
      RA.map(p => path.basename(p)),
    ),
  ),
  RTE.bindW('pkg', ({ config }) =>
    pipe(
      Files.getFile(path.join(config.basePath, 'package.json')),
      RTE.flatMapTaskEither(Pkg.TranscoderPar.decode),
      RTE.mapLeft(err =>
        err instanceof TCE.TranscodeErrors ? new Pkg.PackageJsonReadError(err) : err,
      ),
    ),
  ),
  RTE.bindW(
    'packageJson',
    ({
      files,
      config,
      pkg: {
        name,
        version,
        description,
        author,
        license,
        type,
        main: _,
        module: __,
        exports: ___,
        ...rest
      },
    }) =>
      pipe(
        RTE.ask<ConfigService>(),
        RTE.flatMapTaskEither(Exports.ExportsServiceLive({ files, type })),
        RTE.flatMapTaskEither(Exports.pkgExports),
        RTE.map(
          ([exports, main, module, types]): RR.ReadonlyRecord<string, unknown> => ({
            name,
            version,
            description,
            author,
            license,
            type,
            main,
            module,
            exports,
            types,
            ...pipe(
              rest,
              RR.filterWithIndex(key => !config.omittedPackageKeys.includes(key)),
            ),
          }),
        ),
        RTE.flatMapEither(occludedPackage =>
          E.tryCatch(
            () => JSON.stringify(occludedPackage, null, 2),
            err =>
              TC.transcodeErrors(
                TC.serializationError('Package JSON', err, occludedPackage),
              ),
          ),
        ),
        RTE.mapLeft(err =>
          err instanceof TCE.TranscodeErrors ? new Pkg.PackageJsonReadError(err) : err,
        ),
      ),
  ),
  RTE.bindW('extraFiles', ({ config }) =>
    pipe(
      config.copyFiles,
      RTE.traverseArray(file =>
        pipe(
          Files.getFile(path.join(config.basePath, file)),
          RTE.map(fileContents => tuple(file, fileContents)),
        ),
      ),
      RTE.map(RR.fromEntries),
    ),
  ),
  RTE.bindW('onSuccess', ({ config, packageJson, pkg, extraFiles }) =>
    pipe(
      RTE.Do,
      RTE.apSW('configService', RTE.ask<ConfigService>()),
      RTE.apSW('fileService', RTE.ask<Files.FileService>()),
      RTE.apSW('loggingService', RTE.ask<Log.LoggingService>()),
      RTE.apSW('srcService', RTE.ask<Src.SourceService>()),
      RTE.apSW('typesService', RTE.ask<Types.TypesService>()),
      RTE.map(
        ({
          fileService,
          loggingService,
          srcService,
          typesService,
          configService,
        }): T.Task<void> =>
          pipe(
            RTE.Do,
            RTE.tapReaderTask(() =>
              Log.info(color.magenta('PCK') + color.whiteBright(' Pack Start')),
            ),
            RTE.tap(() =>
              Files.writeFile(
                path.join(config.basePath, config.outDir, 'package.json'),
                packageJson,
              ),
            ),
            RTE.tapReaderTask(() =>
              Log.info(color.magenta('PCK') + color.whiteBright(' Copied Package JSON')),
            ),
            RTE.tapReaderTask(() =>
              pipe(
                RR.toEntries(extraFiles),
                RA.wilt(RT.ApplicativePar)(([file, contents]) =>
                  pipe(
                    Files.writeFile(
                      path.join(config.basePath, config.outDir, file),
                      contents,
                    ),
                    RTE.map(() => file),
                  ),
                ),
                RT.chainFirstW(({ left, right }) =>
                  pipe(
                    RT.Do,
                    RT.tap(() =>
                      left.length > 0
                        ? Log.warn(`PCK Failed to copy ${left.length} files:`, ...left)
                        : RT.of(void 0),
                    ),
                    RT.tap(() =>
                      right.length > 0
                        ? Log.info(
                            color.magenta('PCK') +
                              color.whiteBright(` Copied ${right.length} extra files:`),
                            ...right.map(color.blue),
                          )
                        : RT.of(void 0),
                    ),
                  ),
                ),
              ),
            ),
            RTE.tap(() =>
              Files.copyDirectory(
                config.srcDir,
                path.join(config.outDir, config.srcDir),
                { recursive: true },
              ),
            ),
            RTE.tapReaderTask(() =>
              Log.info(color.magenta('PCK') + color.whiteBright(' Copied source files')),
            ),
            RTE.tap(() =>
              config.emitTypes
                ? pipe(
                    RTE.Do,
                    RTE.tapReaderTask(() =>
                      Log.info(
                        color.blueBright('DTS') +
                          color.whiteBright(' Emitting declaration files'),
                      ),
                    ),
                    RTE.flatMap(() => Types.emitTypes(pkg)),
                    RTE.flatMap(
                      RTE.traverseArray(
                        RTE.fromReaderTaskK(([ext, file]) =>
                          Log.info(
                            color.greenBright(
                              ext === '.d.mts' ? 'MTS' : ext === '.d.cts' ? 'CTS' : 'DTS',
                            ) + color.whiteBright(` Emitted ${ext} for ${file}`),
                          ),
                        ),
                      ),
                    ),
                  )
                : RTE.right(void 0),
            ),
            RTE.tap(() => Src.rewriteSourceMaps),
            RTE.tapReaderTask(() =>
              Log.info(
                color.magenta('PCK') + color.whiteBright(' Re-pointed source maps'),
              ),
            ),
            RTE.matchEW(
              err =>
                pipe(
                  Log.error('Failed to build', err),
                  RT.tapIO(() => () => {
                    process.exit(1)
                  }),
                ),
              () =>
                Log.info(color.magenta('PCK') + color.whiteBright(' ⚡️ Pack Success')),
            ),
            rt =>
              rt({
                ...loggingService,
                ...fileService,
                ...srcService,
                ...typesService,
                ...configService,
              }),
          ),
      ),
    ),
  ),
  RTE.map(
    ({ config, entrypoints, onSuccess, pkg }) =>
      new BuildService({
        configuration: {
          entry: RA.toArray(entrypoints),
          outDir: config.outDir,
          format: [
            ...(config.buildType === 'dual'
              ? ['cjs' as const, 'esm' as const]
              : [config.buildType]),
            ...(config.iife ? ['iife' as const] : []),
          ] satisfies Options['format'],
          onSuccess,
          outExtension,
          plugins: [
            esbuildPluginFilePathExtensions({
              cjsExtension: pkg.type === 'module' ? '.cjs' : '.js',
              esmExtension: pkg.type === 'commonjs' ? '.mjs' : '.js',
            }),
          ],
        },
      }),
  ),
)

export const configuration: R.Reader<
  BuildService,
  BuildServiceMethods['configuration']
> = service => service[BuildServiceSymbol].configuration
