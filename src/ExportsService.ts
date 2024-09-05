import { type Endomorphism } from 'fp-ts/lib/Endomorphism.js'
import { pipe } from 'fp-ts/lib/function.js'
import type * as Ord from 'fp-ts/lib/Ord.js'
import * as RTE from 'fp-ts/lib/ReaderTaskEither.js'
import * as RA from 'fp-ts/lib/ReadonlyArray.js'
import * as RR from 'fp-ts/lib/ReadonlyRecord.js'
import * as Sg from 'fp-ts/lib/Semigroup.js'
import * as Str from 'fp-ts/lib/string.js'
import * as TE from 'fp-ts/lib/TaskEither.js'
import path from 'path'
import { type PackageJson } from 'type-fest'

import * as Config from './ConfigService'

const ExportsServiceSymbol = Symbol('ExportsService')

type Exports = NonNullable<PackageJson['exports']>

export class ExportsService {
  [ExportsServiceSymbol]: readonly [
    exports: Exports | undefined,
    main: string | undefined,
    module: string | undefined,
    types: string | undefined,
  ]
  constructor(
    pkgExports: Exports,
    main?: string | undefined,
    module?: string | undefined,
    types?: string | undefined,
  ) {
    this[ExportsServiceSymbol] = [pkgExports, main, module, types]
  }
  static of: (
    main?: string | undefined,
    module?: string | undefined,
    types?: string | undefined,
  ) => (pkgExports?: Exports) => ExportsService =
    (main, module, types) =>
    (pkgExports = { './package.json': './package.json' }) =>
      new ExportsService(pkgExports, main, module, types)
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
  readonly resolvedIndex: string
}

const isCapitalized = (s: string): boolean => s !== '' && s[0] === s[0].toUpperCase()

const RecordMonoid = RR.getMonoid(Sg.last<NonNullable<PackageJson['exports']>>())

const FilesOrd: Ord.Ord<string> = {
  equals: Str.Eq.equals,
  compare: (x, y) =>
    isCapitalized(x) && isCapitalized(y)
      ? Str.Ord.compare(x, y)
      : isCapitalized(x)
        ? -1
        : isCapitalized(y)
          ? 1
          : Str.Ord.compare(x, y),
}

const stripExtension = (file: string): string => file.replace(/\.[^/.]+$/, '')

function relativize(path: string): string {
  return path.startsWith('.') ? path : './' + path
}

// Paths for emitted build files
// NOTE: the paths here are ./dist if there are no root-entrypoints,
//       and ./dist/src if there are.
function tsToJs(file: string): string {
  return relativize(file.replace(/\.tsx?$/, '.js'))
}
function tsToCjs(file: string): string {
  return relativize(file.replace(/\.tsx?$/, '.cjs'))
}
function tsToGlobal(file: string): string {
  return relativize(file.replace(/\.tsx?$/, '.global.js'))
}
function tsToGlobalCjs(file: string): string {
  return relativize(file.replace(/\.tsx?$/, '.global.cjs'))
}
function tsToMjs(file: string): string {
  return relativize(file.replace(/\.tsx?$/, '.mjs'))
}

// Paths for declaration files,
// NOTE: the paths determined by entrypoints are preserved
function tsToDts(file: string): string {
  return relativize(file.replace(/\.tsx?$/, '.d.ts'))
}
function tsToDmts(file: string): string {
  return relativize(file.replace(/\.tsx?$/, '.d.mts'))
}
function tsToDcts(file: string): string {
  return relativize(file.replace(/\.tsx?$/, '.d.cts'))
}

const exportKey = (normalizedIndex: string, file: string): string => {
  return file === normalizedIndex ? '.' : `./${stripExtension(path.basename(file))}`
}

const Common = pipe(
  RTE.Do,
  RTE.apS('config', Config.config),
  RTE.apSW('deps', RTE.ask<ExportsServiceDeps>()),
)

type TypesExports = {
  readonly types?: string
}

type DefaultExports = {
  readonly default?: {
    readonly default?: string
  } & TypesExports
}

const addDtsExports = (
  config: Required<Config.ConfigParameters>,
  file: string,
): TypesExports => (config.emitTypes ? { types: tsToDts(file) } : {})

const addDmtsExports = (
  config: Required<Config.ConfigParameters>,
  file: string,
): TypesExports => (config.emitTypes ? { types: tsToDmts(file) } : {})

const addDctsExports = (
  config: Required<Config.ConfigParameters>,
  file: string,
): TypesExports => (config.emitTypes ? { types: tsToDcts(file) } : {})

type ToExports = {
  readonly types: (
    config: Required<Config.ConfigParameters>,
    file: string,
  ) => TypesExports
  readonly default: Endomorphism<string>
}

type ExportsConfig = {
  readonly import?: ToExports
  readonly require?: ToExports
  readonly default?: ToExports
}

const addGlobalExportSingle = (
  config: Required<Config.ConfigParameters>,
  singleBuildMode: Exclude<
    Required<Config.ConfigParameters>['buildMode'],
    { type: 'Multi' }
  >,
  { default: d }: ExportsConfig,
): DefaultExports =>
  config.iife
    ? {
        default: {
          ...d?.types(config, singleBuildMode.entrypoint),
          default: d?.default(singleBuildMode.entrypoint),
        },
      }
    : {}

const addGlobalExportMulti = (
  config: Required<Config.ConfigParameters>,
  file: string,
  { default: d }: ExportsConfig,
): DefaultExports =>
  config.iife
    ? {
        default: {
          ...d?.types(config, file),
          default: d?.default(file),
        },
      }
    : {}

const toExportsService = (
  exportsConfig: ExportsConfig,
): RTE.ReaderTaskEither<
  Config.ConfigService & ExportsServiceDeps,
  never,
  ExportsService
> =>
  pipe(
    Common,
    RTE.map(({ config, deps }) => {
      const { import: i, require: r } = exportsConfig
      const buildType = config.buildMode.type
      if (buildType === 'Single') {
        return pipe(
          {
            '.': {
              ...(i === undefined
                ? {}
                : {
                    import: {
                      ...i.types(config, config.buildMode.entrypoint),
                      default: i.default(config.buildMode.entrypoint),
                    },
                  }),
              ...(r === undefined
                ? {}
                : {
                    require: {
                      ...r.types(config, config.buildMode.entrypoint),
                      default: r.default(config.buildMode.entrypoint),
                    },
                  }),
              ...addGlobalExportSingle(config, config.buildMode, exportsConfig),
            },
            './package.json': './package.json',
          },
          ExportsService.of(
            r?.default(config.buildMode.entrypoint),
            i?.default(config.buildMode.entrypoint),
            (r ?? i)?.types(config, config.buildMode.entrypoint)['types'],
          ),
        )
      }
      const normalizedIndex = path.join(
        path.dirname(deps.resolvedIndex),
        path.basename(deps.resolvedIndex),
      )
      return pipe(
        deps.files,
        RA.sort(FilesOrd),
        RA.foldMap(RecordMonoid)(file =>
          RR.singleton(exportKey(normalizedIndex, file), {
            ...(i === undefined
              ? {}
              : {
                  import: {
                    ...i.types(config, file),
                    default: i.default(file),
                  },
                }),
            ...(r === undefined
              ? {}
              : {
                  require: {
                    ...r.types(config, file),
                    default: r.default(file),
                  },
                }),
            ...addGlobalExportMulti(config, file, exportsConfig),
          }),
        ),
        _ => ({ ..._, './package.json': './package.json' }),
        ExportsService.of(
          r?.default(deps.resolvedIndex),
          i?.default(deps.resolvedIndex),
          (r ?? i)?.types(config, deps.resolvedIndex)['types'],
        ),
      )
    }),
  )

const DualTypeModuleExports = toExportsService({
  import: {
    types: addDtsExports,
    default: tsToJs,
  },
  require: {
    types: addDctsExports,
    default: tsToCjs,
  },
  default: {
    types: addDctsExports,
    default: tsToGlobalCjs,
  },
})

const DualTypeCommonExports = toExportsService({
  import: {
    types: addDmtsExports,
    default: tsToMjs,
  },
  require: {
    types: addDtsExports,
    default: tsToJs,
  },
  default: {
    types: addDtsExports,
    default: tsToGlobal,
  },
})

const CjsTypeModuleExports = toExportsService({
  require: {
    types: addDctsExports,
    default: tsToCjs,
  },
  default: {
    types: addDctsExports,
    default: tsToGlobalCjs,
  },
})

const CjsTypeCommonExports = toExportsService({
  require: {
    types: addDtsExports,
    default: tsToJs,
  },
  default: {
    types: addDtsExports,
    default: tsToGlobal,
  },
})

const EsmTypeModuleExports = toExportsService({
  import: {
    types: addDtsExports,
    default: tsToJs,
  },
  default: {
    types: addDctsExports,
    default: tsToGlobalCjs,
  },
})

const EsmTypeCommonExports = toExportsService({
  import: {
    types: addDmtsExports,
    default: tsToMjs,
  },
  default: {
    types: addDtsExports,
    default: tsToGlobal,
  },
})

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
              return type === 'module'
                ? DualTypeModuleExports(deps)
                : DualTypeCommonExports(deps)
            case 'cjs':
              return type === 'module'
                ? CjsTypeModuleExports(deps)
                : CjsTypeCommonExports(deps)
            default:
              return type === 'module'
                ? EsmTypeModuleExports(deps)
                : EsmTypeCommonExports(deps)
          }
        }),
      ),
    ),
  )
