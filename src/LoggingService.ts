import * as C from 'colorette'
import { pipe } from 'fp-ts/lib/function.js'
import * as RT from 'fp-ts/lib/ReaderTask.js'
import * as T from 'fp-ts/lib/Task.js'

const LoggingServiceSymbol = Symbol('LoggingService')

type LoggingServiceMethods = {
  readonly log: (...args: ReadonlyArray<unknown>) => T.Task<void>
  readonly error: (...args: ReadonlyArray<unknown>) => T.Task<void>
  readonly warn: (...args: ReadonlyArray<unknown>) => T.Task<void>
  readonly info: (...args: ReadonlyArray<unknown>) => T.Task<void>
}

export class LoggingService {
  [LoggingServiceSymbol]: LoggingServiceMethods
  constructor(fileServiceMethods: LoggingServiceMethods) {
    this[LoggingServiceSymbol] = fileServiceMethods
  }
}

export const ConsoleLoggingServiceLive: LoggingService = new LoggingService({
  log: (...args) => T.fromIO(() => console.log(...args)),
  error: (...args) => T.fromIO(() => console.error(...args)),
  warn: (...args) => T.fromIO(() => console.warn(...args)),
  info: (...args) => T.fromIO(() => console.info(...args)),
})

const mapIfStrOrNum = (color: C.Color) => (value: unknown) =>
  typeof value === 'string' || typeof value === 'number' ? color(value) : value

export const ColorConsoleLoggingServiceLive: LoggingService = new LoggingService({
  log: (...args) => T.fromIO(() => console.log(...args)),
  error: (...args) => T.fromIO(() => console.error(...args.map(mapIfStrOrNum(C.red)))),
  warn: (...args) => T.fromIO(() => console.warn(...args.map(mapIfStrOrNum(C.yellow)))),
  info: (...args) => T.fromIO(() => console.info(...args.map(mapIfStrOrNum(C.blue)))),
})

export const log = (...args: ReadonlyArray<unknown>) =>
  pipe(
    RT.ask<LoggingService>(),
    RT.flatMapTask((loggingService) => loggingService[LoggingServiceSymbol].log(...args)),
  )

export const error = (...args: ReadonlyArray<unknown>) =>
  pipe(
    RT.ask<LoggingService>(),
    RT.flatMapTask((loggingService) => loggingService[LoggingServiceSymbol].error(...args)),
  )

export const warn = (...args: ReadonlyArray<unknown>) =>
  pipe(
    RT.ask<LoggingService>(),
    RT.flatMapTask((loggingService) => loggingService[LoggingServiceSymbol].warn(...args)),
  )

export const info = (...args: ReadonlyArray<unknown>) =>
  pipe(
    RT.ask<LoggingService>(),
    RT.flatMapTask((loggingService) => loggingService[LoggingServiceSymbol].info(...args)),
  )
