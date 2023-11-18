import { flow, pipe } from 'fp-ts/lib/function.js'
import * as T from 'fp-ts/lib/Task.js'
import * as TE from 'fp-ts/lib/TaskEither.js'
import { type Options } from 'tsup'

import * as Build from './BuildService'
import * as Config from './ConfigService'
import * as File from './FileService'
import * as Log from './LoggingService'

export * as Build from './BuildService'
export * as Config from './ConfigService'
export * as File from './FileService'
export * as Log from './LoggingService'

const consoleLoggingService = Log.ColorConsoleLoggingServiceLive
const fileService = File.FileServiceLive

type TsupConfig = (overrideOptions: Options) => Promise<Options>

export const makeConfig: (config: Config.ConfigParameters, extraConfig?: Options) => TsupConfig =
  (config, extraConfig = {}) =>
  (overrideOptions) =>
    pipe(
      Build.BuildServiceLive({ ...Config.ConfigServiceLive(config), ...consoleLoggingService, ...fileService }),
      TE.matchEW(
        (err) =>
          pipe(
            Log.error(err)(consoleLoggingService),
            T.flatMapIO(() => () => {
              throw err
            }),
          ),
        flow(Build.configuration, (_) => ({ ..._, ...extraConfig, ...overrideOptions }), T.of),
      ),
      (t) => t(),
    )
