import { pipe } from 'fp-ts/lib/function.js'
import * as R from 'fp-ts/lib/Reader.js'
import * as RTE from 'fp-ts/lib/ReaderTaskEither.js'
import * as TE from 'fp-ts/lib/TaskEither.js'
import path from 'path'
import * as ts from 'typescript'

import { config, type ConfigService } from './ConfigService.js'

export class TypesServiceError extends Error {
  override readonly name = 'TypesServiceError'
}

type ExtraCompilerOptions = Omit<
  ts.CompilerOptions,
  'outDir' | 'declaration' | 'declarationMap' | 'emitDeclarationOnly'
>

type TypesServiceMethods = {
  readonly emitDts: (
    entrypoints: ReadonlyArray<string>,
    compilerOptions: ExtraCompilerOptions,
  ) => TE.TaskEither<TypesServiceError, ReadonlyArray<string>>
}

const TypesServiceSymbol = Symbol('TypesService')

export class TypesService {
  readonly [TypesServiceSymbol]: TypesServiceMethods
  constructor(fileServiceMethods: TypesServiceMethods) {
    this[TypesServiceSymbol] = fileServiceMethods
  }
}

const emitDts_: (
  entrypoints: ReadonlyArray<string>,
  extraCompilerOptions: ExtraCompilerOptions,
) => RTE.ReaderTaskEither<ConfigService, TypesServiceError, ReadonlyArray<string>> = (
  entrypoints,
  extraCompilerOptions,
) =>
  pipe(
    config,
    RTE.flatMapTaskEither(
      TE.tryCatchK(
        async config => {
          const program = ts.createProgram(entrypoints, {
            module: ts.ModuleKind.NodeNext,
            moduleResolution: ts.ModuleResolutionKind.NodeNext,
            ...extraCompilerOptions,
            outDir: path.join(config.basePath, config.outDir),
            declaration: true,
            declarationMap: true,
            emitDeclarationOnly: true,
          })
          const formatDiagnosticsHost: ts.FormatDiagnosticsHost = {
            getCanonicalFileName: path => path,
            getCurrentDirectory: ts.sys.getCurrentDirectory,
            getNewLine: () => ts.sys.newLine,
          }
          return {
            config,
            program,
            formatDiagnosticsHost,
            emit: program.emit(),
          }
        },
        err => new TypesServiceError(typeof err === 'string' ? err : String(err)),
      ),
    ),
    RTE.filterOrElseW(
      ({ emit }) =>
        !emit.emitSkipped &&
        emit.emittedFiles !== undefined &&
        emit.emittedFiles.length > 0,
      ({ program, formatDiagnosticsHost }) =>
        new TypesServiceError(
          ts.formatDiagnostics(ts.getPreEmitDiagnostics(program), formatDiagnosticsHost),
        ),
    ),
    RTE.map(({ emit }) => emit.emittedFiles ?? []),
  )

export const TypesServiceLive: R.Reader<ConfigService, TypesService> = pipe(
  R.ask<ConfigService>(),
  R.map(
    config =>
      new TypesService({
        emitDts: (entrypoints, extraCompilerOptions) =>
          emitDts_(entrypoints, extraCompilerOptions)(config),
      }),
  ),
)

export const emitDts = (
  entrypoints: ReadonlyArray<string>,
  extraCompilerOptions: ExtraCompilerOptions,
): RTE.ReaderTaskEither<TypesService, TypesServiceError, ReadonlyArray<string>> =>
  pipe(
    RTE.ask<TypesService>(),
    RTE.flatMapTaskEither(service =>
      service[TypesServiceSymbol].emitDts(entrypoints, extraCompilerOptions),
    ),
  )
