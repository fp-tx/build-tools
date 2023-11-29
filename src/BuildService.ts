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

export const BuildServiceLive: RTE.ReaderTaskEither<
  Log.LoggingService & Files.FileService & ConfigService & Src.SourceService,
  Files.FileServiceError | Pkg.PackageJsonReadError,
  BuildService
> = pipe(
  RTE.Do,
  RTE.apSW('config', config),
  RTE.flatMap(({ config }) =>
    pipe(
      RTE.Do,
      RTE.let('config', () => config),
      RTE.bindW('dirints', ({ config }) =>
        Files.readDirectory(path.join(config.basePath, config.srcDir)),
      ),
      RTE.let('files', ({ dirints }) => config.getEntrypoints(dirints)),
      RTE.let('entrypoints', ({ files }) =>
        pipe(
          files,
          RA.map(entrypoint => path.join(config.basePath, config.srcDir, entrypoint)),
        ),
      ),
      RTE.apS(
        'pkg',
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
              ([exports, main, module]): RR.ReadonlyRecord<string, unknown> => ({
                name,
                version,
                description,
                author,
                license,
                type,
                main,
                module,
                exports,
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
              err instanceof TCE.TranscodeErrors
                ? new Pkg.PackageJsonReadError(err)
                : err,
            ),
          ),
      ),
      RTE.apSW(
        'extraFiles',
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
    ),
  ),
  RTE.bindW('onSuccess', ({ config, packageJson, extraFiles }) =>
    pipe(
      RTE.Do,
      RTE.apSW('fileService', RTE.ask<Files.FileService>()),
      RTE.apSW('loggingService', RTE.ask<Log.LoggingService>()),
      RTE.apSW('srcService', RTE.ask<Src.SourceService>()),
      RTE.map(
        ({ fileService, loggingService, srcService }): T.Task<void> =>
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
            RTE.tap(() => Src.rewriteSourceMaps),
            RTE.tapReaderTask(() =>
              Log.info(
                color.magenta('PCK') + color.whiteBright(' Re-pointed source maps'),
              ),
            ),
            RTE.matchEW(
              err =>
                pipe(
                  Log.error(err),
                  RT.tapIO(() => () => {
                    process.exit(1)
                  }),
                ),
              () =>
                Log.info(color.magenta('PCK') + color.whiteBright(' ⚡️ Pack Success')),
            ),
            rt => rt({ ...loggingService, ...fileService, ...srcService }),
          ),
      ),
    ),
  ),
  RTE.map(
    ({
      config,
      config: { minify, dts, splitting, sourcemap, clean },
      entrypoints,
      onSuccess,
      pkg,
    }) =>
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
          minify,
          dts,
          splitting,
          sourcemap,
          clean,
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
