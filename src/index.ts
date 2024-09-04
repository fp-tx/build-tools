import { flow, pipe } from 'fp-ts/lib/function.js'
import * as T from 'fp-ts/lib/Task.js'
import * as TE from 'fp-ts/lib/TaskEither.js'
import { type Options } from 'tsup'

import * as Build from './BuildService'
import * as Config from './ConfigService'
import * as File from './FileService'
import * as Log from './LoggingService'
import * as Src from './SourceService'
import * as Types from './TypesService'

const consoleLoggingService = Log.ColorConsoleLoggingServiceLive
const fileService = File.FileServiceLive

export { type Options } from 'tsup'

export type TsupConfig = (overrideOptions: Options) => Promise<Options>

export const makeConfig: (
  config: Config.ConfigParameters,
  extraConfig?: Options,
) => TsupConfig =
  (config, extraConfig = {}) =>
  overrideOptions =>
    pipe(
      TE.of(Config.ConfigServiceLive(config)),
      TE.map(configService => ({
        ...configService,
        ...Types.TypesServiceLive({
          ...configService,
          ...consoleLoggingService,
        }),
      })),
      TE.flatMap(services =>
        Build.BuildServiceLive({
          ...services,
          ...Src.SourceServiceLive({
            ...services,
            ...fileService,
          }),
          ...consoleLoggingService,
          ...fileService,
        }),
      ),
      TE.matchEW(
        err =>
          pipe(
            Log.error(err)(consoleLoggingService),
            T.flatMapIO(() => () => {
              throw err
            }),
          ),
        flow(
          Build.configuration,
          _ => ({
            ..._,
            ...extraConfig,
            ...overrideOptions,
            // Merge plugins
            plugins: [...(_.plugins ?? []), ...(extraConfig.plugins ?? [])],
          }),
          T.of,
        ),
      ),
      t => t(),
    )
