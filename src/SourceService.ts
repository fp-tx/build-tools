import * as E from 'fp-ts/lib/Either.js'
import { pipe } from 'fp-ts/lib/function.js'
import * as R from 'fp-ts/lib/Reader.js'
import * as RTE from 'fp-ts/lib/ReaderTaskEither.js'
import type * as RR from 'fp-ts/lib/ReadonlyRecord.js'
import * as TE from 'fp-ts/lib/TaskEither.js'
import { glob, type GlobOptionsWithFileTypesUnset } from 'glob'
import path from 'path'
import type * as TCE from 'schemata-ts/TranscodeError'
import * as TC from 'schemata-ts/Transcoder'

import * as Config from './ConfigService'
import * as File from './FileService'
import * as MapFiles from './MapFiles'

const SourceServiceSymbol = Symbol('SourceService')

type SourceServiceMethods = {
  readonly rewriteSourceMaps: TE.TaskEither<
    File.FileServiceError | TCE.TranscodeErrors,
    void
  >
}

export class SourceService {
  [SourceServiceSymbol]: SourceServiceMethods
  constructor(SourceServiceMethods: SourceServiceMethods) {
    this[SourceServiceSymbol] = SourceServiceMethods
  }
}

const flattenBy1Regex = (srcDir: string) => new RegExp(`(.*)../${srcDir}(.*)`, 'gm')

const rewriteSource: (srcDir: string, file: string) => (source: string) => string =
  (srcDir, file) => source => {
    const directory = path.dirname(file)
    const flattenedBy1 = `${source}`.replace(flattenBy1Regex(srcDir), `$1${srcDir}$2`)
    const adjusted = path.posix.relative(
      directory,
      path.posix.join(directory, flattenedBy1),
    )
    return adjusted.startsWith('.') ? adjusted : './' + adjusted
  }

const getGlob: (
  pattern: string,
  options: GlobOptionsWithFileTypesUnset,
) => TE.TaskEither<File.FileServiceError, ReadonlyArray<string>> = pipe(
  TE.tryCatchK(
    (pattern: string, options: GlobOptionsWithFileTypesUnset) => glob(pattern, options),
    err => File.FileServiceError.of(err instanceof Error ? err : new Error(String(err))),
  ),
)

export const SourceServiceLive: R.Reader<
  File.FileService & Config.ConfigService,
  SourceService
> = R.asks(
  (deps: File.FileService & Config.ConfigService) =>
    new SourceService({
      rewriteSourceMaps: pipe(
        RTE.fromTaskEither(Config.config(deps)),
        RTE.bindTo('config'),
        RTE.bind('files', ({ config }) =>
          RTE.fromTaskEither(
            getGlob(`${config.outDir}/**/*.map`, {
              cwd: config.basePath,
            }),
          ),
        ),
        RTE.flatMap(({ config, files }) =>
          pipe(
            files,
            RTE.traverseArray(file =>
              pipe(
                File.getFile(file),
                RTE.flatMapTaskEither(MapFiles.TranscoderPar.decode),
                RTE.map(
                  ({ sources, ...rest }): RR.ReadonlyRecord<string, unknown> => ({
                    ...rest,
                    sources: sources.map(rewriteSource(config.srcDir, file)),
                  }),
                ),
                RTE.flatMapEither(sourceMap =>
                  E.tryCatch(
                    () => JSON.stringify(sourceMap, null, 2),
                    err =>
                      TC.transcodeErrors(
                        TC.serializationError('Source Map', err, sourceMap),
                      ),
                  ),
                ),
                RTE.flatMap(sourceMap => File.writeFile(file, sourceMap)),
              ),
            ),
          ),
        ),
        RTE.asUnit,
        rte => rte(deps),
      ),
    }),
)

export const rewriteSourceMaps: RTE.ReaderTaskEither<
  SourceService,
  File.FileServiceError | TCE.TranscodeErrors,
  void
> = pipe(
  RTE.ask<SourceService>(),
  RTE.flatMapTaskEither(service => service[SourceServiceSymbol].rewriteSourceMaps),
)
