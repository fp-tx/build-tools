import { pipe } from 'fp-ts/lib/function.js'
import * as RTE from 'fp-ts/lib/ReaderTaskEither.js'
import * as RA from 'fp-ts/lib/ReadonlyArray.js'
import * as RR from 'fp-ts/lib/ReadonlyRecord.js'
import * as Sg from 'fp-ts/lib/Semigroup.js'
import * as TE from 'fp-ts/lib/TaskEither.js'
import { type PackageJson } from 'type-fest'

import * as Config from './ConfigService'

const ExportsServiceSymbol = Symbol('ExportsService')

type Exports = NonNullable<PackageJson['exports']>

export class ExportsService {
  [ExportsServiceSymbol]: readonly [
    exports: Exports,
    main?: string | undefined,
    module?: string | undefined,
  ]
  constructor(
    pkgExports: Exports,
    main?: string | undefined,
    module?: string | undefined,
  ) {
    this[ExportsServiceSymbol] = [pkgExports, main, module]
  }
  static of: (
    main?: string | undefined,
    module?: string | undefined,
  ) => (pkgExports: Exports) => ExportsService = (main, module) => pkgExports =>
    new ExportsService(pkgExports, main, module)
}

export const pkgExports: RTE.ReaderTaskEither<
  ExportsService,
  never,
  ExportsService[typeof ExportsServiceSymbol]
> = pipe(
  RTE.ask<ExportsService>(),
  RTE.map(service => service[ExportsServiceSymbol]),
)

type ExportsServiceDeps = {
  readonly files: ReadonlyArray<string>
  readonly type: 'module' | 'commonjs'
}

const RecordMonoid = RR.getMonoid(Sg.last<NonNullable<PackageJson['exports']>>())

const stripExtension = (file: string): string => file.replace(/\.[^/.]+$/, '')
const tsToJs = (file: string): string => './' + file.replace(/\.tsx?$/, '.js')
const tsToCjs = (file: string): string => './' + file.replace(/\.tsx?$/, '.cjs')
const tsToGlobal = (file: string): string => './' + file.replace(/\.tsx?$/, '.global.js')
const tsToMjs = (file: string): string => './' + file.replace(/\.tsx?$/, '.mjs')

const exportKey = (file: string): string =>
  file === 'index.ts' ? '.' : `./${stripExtension(file)}`

const Common = pipe(
  RTE.Do,
  RTE.apS('config', Config.config),
  RTE.apSW('deps', RTE.ask<ExportsServiceDeps>()),
)

const DualModuleExports: RTE.ReaderTaskEither<
  ExportsServiceDeps & Config.ConfigService,
  never,
  ExportsService
> = pipe(
  Common,
  RTE.map(({ config, deps }) =>
    pipe(
      deps.files,
      RA.foldMap(RecordMonoid)(file =>
        RR.singleton(exportKey(file), {
          ...(config.iife
            ? { import: tsToJs(file), require: tsToCjs(file), default: tsToGlobal(file) }
            : {
                import: tsToJs(file),
                default: tsToCjs(file),
              }),
        }),
      ),
      ExportsService.of(
        deps.files.includes('index.ts') ? './index.cjs' : undefined,
        deps.files.includes('index.ts') ? './index.js' : undefined,
      ),
    ),
  ),
)

const DualCommonExports: RTE.ReaderTaskEither<
  ExportsServiceDeps & Config.ConfigService,
  never,
  ExportsService
> = pipe(
  Common,
  RTE.map(({ config, deps }) =>
    pipe(
      deps.files,
      RA.foldMap(RecordMonoid)(file =>
        RR.singleton(exportKey(file), {
          ...(config.iife
            ? { import: tsToMjs(file), require: tsToJs(file), default: tsToGlobal(file) }
            : {
                import: tsToMjs(file),
                default: tsToJs(file),
              }),
        }),
      ),
      ExportsService.of(
        deps.files.includes('index.ts') ? './index.js' : undefined,
        deps.files.includes('index.ts') ? './index.mjs' : undefined,
      ),
    ),
  ),
)

const CjsModuleExports: RTE.ReaderTaskEither<
  ExportsServiceDeps & Config.ConfigService,
  never,
  ExportsService
> = pipe(
  Common,
  RTE.map(({ config, deps }) =>
    pipe(
      deps.files,
      RA.foldMap(RecordMonoid)(file =>
        RR.singleton(exportKey(file), {
          ...(config.iife
            ? { require: tsToCjs(file), default: tsToGlobal(file) }
            : {
                default: tsToCjs(file),
              }),
        }),
      ),
      ExportsService.of(deps.files.includes('index.ts') ? './index.cjs' : undefined),
    ),
  ),
)

const CjsCommonExports: RTE.ReaderTaskEither<
  ExportsServiceDeps & Config.ConfigService,
  never,
  ExportsService
> = pipe(
  Common,
  RTE.map(({ config, deps }) =>
    pipe(
      deps.files,
      RA.foldMap(RecordMonoid)(file =>
        RR.singleton(exportKey(file), {
          ...(config.iife
            ? { require: tsToJs(file), default: tsToGlobal(file) }
            : {
                default: tsToJs(file),
              }),
        }),
      ),
      ExportsService.of(deps.files.includes('index.ts') ? './index.js' : undefined),
    ),
  ),
)

const EsmModuleExports: RTE.ReaderTaskEither<
  ExportsServiceDeps & Config.ConfigService,
  never,
  ExportsService
> = pipe(
  Common,
  RTE.map(({ config, deps }) =>
    pipe(
      deps.files,
      RA.foldMap(RecordMonoid)(file =>
        RR.singleton(exportKey(file), {
          ...(config.iife
            ? { import: tsToJs(file), default: tsToGlobal(file) }
            : {
                default: tsToJs(file),
              }),
        }),
      ),
      ExportsService.of(
        undefined,
        deps.files.includes('index.ts') ? './index.js' : undefined,
      ),
    ),
  ),
)

const EsmCommonExports: RTE.ReaderTaskEither<
  ExportsServiceDeps & Config.ConfigService,
  never,
  ExportsService
> = pipe(
  Common,
  RTE.map(({ config, deps }) =>
    pipe(
      deps.files,
      RA.foldMap(RecordMonoid)(file =>
        RR.singleton(exportKey(file), {
          ...(config.iife
            ? { import: tsToMjs(file), default: tsToGlobal(file) }
            : {
                default: tsToMjs(file),
              }),
        }),
      ),
      ExportsService.of(
        undefined,
        deps.files.includes('index.ts') ? './index.mjs' : undefined,
      ),
    ),
  ),
)

export const ExportsServiceLive: (
  deps: ExportsServiceDeps,
) => RTE.ReaderTaskEither<Config.ConfigService, never, ExportsService> = deps =>
  pipe(
    RTE.asks(
      (config: Config.ConfigService): Config.ConfigService & ExportsServiceDeps => ({
        ...config,
        ...deps,
      }),
    ),
    RTE.flatMapTaskEither(deps =>
      pipe(
        TE.Do,
        TE.apS('config', Config.config(deps)),
        TE.let('type', () => deps.type),
        TE.flatMap(({ config, type }) => {
          switch (config.buildType) {
            case 'dual':
              return type === 'module' ? DualModuleExports(deps) : DualCommonExports(deps)
            case 'cjs':
              return type === 'module' ? CjsModuleExports(deps) : CjsCommonExports(deps)
            default:
              return type === 'module' ? EsmModuleExports(deps) : EsmCommonExports(deps)
          }
        }),
      ),
    ),
  )
