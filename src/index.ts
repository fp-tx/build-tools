import { flow, pipe } from 'fp-ts/lib/function.js'
import * as T from 'fp-ts/lib/Task.js'
import * as TE from 'fp-ts/lib/TaskEither.js'
import { type Options } from 'tsup'

import * as Build from './BuildService'
import * as Config from './ConfigService'
import * as File from './FileService'
import * as Log from './LoggingService'
import * as Src from './SourceService'

const consoleLoggingService = Log.ColorConsoleLoggingServiceLive
const fileService = File.FileServiceLive

type TsupConfig = (overrideOptions: Options) => Promise<Options>

export const makeConfig: (
  config: Config.ConfigParameters,
  extraConfig?: Options,
) => TsupConfig =
  (config, extraConfig = {}) =>
  overrideOptions =>
    pipe(
      TE.of(Config.ConfigServiceLive(config)),
      TE.flatMap(configService =>
        Build.BuildServiceLive({
          ...Config.ConfigServiceLive(config),
          ...Src.SourceServiceLive({
            ...configService,
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
          _ => ({ ..._, ...extraConfig, ...overrideOptions }),
          T.of,
        ),
      ),
      t => t(),
    )
