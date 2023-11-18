import { flow, pipe, tuple } from 'fp-ts/lib/function.js'
import type * as R from 'fp-ts/lib/Reader.js'
import * as RT from 'fp-ts/lib/ReaderTask.js'
import * as RTE from 'fp-ts/lib/ReaderTaskEither.js'
import * as RA from 'fp-ts/lib/ReadonlyArray.js'
import * as RR from 'fp-ts/lib/ReadonlyRecord.js'
import type * as T from 'fp-ts/lib/Task.js'
import path from 'path'
import * as TCE from 'schemata-ts/TranscodeError'
import { match } from 'ts-pattern'
import { type Options } from 'tsup'

import { config, type ConfigService } from './ConfigService'
import { type FileService, type FileServiceError, getFile, readDirectory, writeFile } from './FileService'
import * as Log from './LoggingService'
import * as Pkg from './PackageJson'

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
  Log.LoggingService & FileService & ConfigService,
  FileServiceError | Pkg.PackageJsonReadError,
  BuildService
> = pipe(
  RTE.Do,
  RTE.apS('config', config),
  RTE.flatMap(({ config }) =>
    pipe(
      RTE.Do,
      RTE.let('config', () => config),
      RTE.apS(
        'entrypoints',
        pipe(
          readDirectory(path.join(config.basePath, config.srcDir)),
          RTE.map(
            flow(
              config.getEntrypoints,
              RA.map((entrypoint) => path.join(config.basePath, config.srcDir, entrypoint)),
            ),
          ),
        ),
      ),
      RTE.apS(
        'packageJson',
        pipe(
          getFile(path.join(config.basePath, 'package.json')),
          RTE.flatMapTaskEither(Pkg.TranscoderPar.decode),
          RTE.map(config.occludePackage),
          RTE.flatMapTaskEither(Pkg.TranscoderPar.encode),
          RTE.mapLeft((err) => (err instanceof TCE.TranscodeErrors ? new Pkg.PackageJsonReadError(err) : err)),
        ),
      ),
      RTE.apSW(
        'extraFiles',
        pipe(
          config.copyFiles,
          RTE.traverseArray((file) =>
            pipe(
              getFile(path.join(config.basePath, file)),
              RTE.map((fileContents) => tuple(file, fileContents)),
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
      RTE.apS('fileService', RTE.ask<FileService>()),
      RTE.apSW('loggingService', RTE.ask<Log.LoggingService>()),
      RTE.map(
        ({ fileService, loggingService }): T.Task<void> =>
          pipe(
            RTE.Do,
            RTE.tapReaderTask(() => Log.info('Writing package.json...')),
            RTE.tap(() => writeFile(path.join(config.basePath, config.outDir, 'package.json'), packageJson)),
            RTE.tapReaderTask(() => Log.info('Writing entrypoints...')),
            RTE.tapReaderTask(() =>
              pipe(
                RR.toEntries(extraFiles),
                RA.wilt(RT.ApplicativePar)(([file, contents]) =>
                  pipe(
                    writeFile(path.join(config.basePath, config.outDir, file), contents),
                    RTE.map(() => file),
                  ),
                ),
                RT.chainFirstW(({ left, right }) =>
                  pipe(
                    RT.Do,
                    RT.tap(() =>
                      left.length > 0 ? Log.warn(`Failed to write ${left.length} files:`, ...left) : RT.of(void 0),
                    ),
                    RT.tap(() =>
                      right.length > 0
                        ? Log.info(`Successfully wrote ${right.length} files:`, ...right)
                        : RT.of(void 0),
                    ),
                  ),
                ),
              ),
            ),
            RTE.matchEW(
              (err) =>
                pipe(
                  Log.error(err),
                  RT.tapIO(() => () => {
                    process.exit(1)
                  }),
                ),
              () => RT.of(void 0),
            ),
            (rt) => rt({ ...loggingService, ...fileService }),
          ),
      ),
    ),
  ),
  RTE.map(
    ({ config, entrypoints, onSuccess }) =>
      new BuildService({
        configuration: {
          entry: RA.toArray(entrypoints),
          outDir: config.outDir,
          format: match(config.buildType)
            .with('cjs', (): Options['format'] => ['cjs', 'iife'])
            .with('esm', (): Options['format'] => ['esm', 'iife'])
            .with('dual', (): Options['format'] => ['cjs', 'esm', 'iife'])
            .exhaustive(),
          onSuccess,
          legacyOutput: config.legacy,
          minify: config.minify,
          dts: config.dts,
          splitting: config.splitChunks,
          sourcemap: config.sourcemap,
        },
      }),
  ),
)

export const configuration: R.Reader<BuildService, BuildServiceMethods['configuration']> = (service) =>
  service[BuildServiceSymbol].configuration
