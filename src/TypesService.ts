import { getCompilerOptionsFromTsConfig, RealFileSystemHost } from '@ts-morph/common'
import { type Endomorphism } from 'fp-ts/lib/Endomorphism.js'
import { flow, pipe, tuple } from 'fp-ts/lib/function.js'
import * as O from 'fp-ts/lib/Option.js'
import * as R from 'fp-ts/lib/Reader.js'
import * as RT from 'fp-ts/lib/ReaderTask.js'
import * as RTE from 'fp-ts/lib/ReaderTaskEither.js'
import * as RA from 'fp-ts/lib/ReadonlyArray.js'
import * as RR from 'fp-ts/lib/ReadonlyRecord.js'
import * as Str from 'fp-ts/lib/string.js'
import * as TE from 'fp-ts/lib/TaskEither.js'
import path from 'path'
import { type Diagnostic, Project, ts } from 'ts-morph'

import { config, type ConfigService } from './ConfigService'
import * as Logging from './LoggingService'
import type * as Pkg from './PackageJson'

export class TypesServiceError extends Error {
  override readonly name = 'TypesServiceError'
  constructor(
    readonly context: string,
    readonly error: unknown,
  ) {
    super(context)
  }
}

export class PreEmitDiagnosticError extends TypesServiceError {
  readonly tag = 'PreEmitDiagnosticError'
  constructor(LoggingService: Logging.LoggingService, error: unknown) {
    super('Error gathering pre-emit diagnostics, see console for more details.', error)
    pipe(friendlyErrorMapper(error), displayErrors(error))(LoggingService)()
  }
}

export class TypeEmissionError extends TypesServiceError {
  readonly tag = 'TypeEmissionError'
  constructor(
    LoggingService: Logging.LoggingService,
    error: unknown,
    readonly emissionStep: string,
  ) {
    super('Error emitting types, see console for more details.', error)
    pipe(friendlyErrorMapper(error), displayErrors(error))(LoggingService)()
  }
}

function friendlyErrorMapper(error: unknown): O.Option<string> {
  if (error instanceof Error) {
    if (
      error.message.includes('Paths must either both be absolute or both be relative')
    ) {
      return O.some(
        'There is an issue with TypeScript attempting to combine relative and absolute paths while calculating the location of the \'tsbuildinfo\' file, and, as a result, it throws an unhelpful error.  A workaround for this specific case is to include `"tsBuildInfoFile": ".tsbuildinfo"` in your tsconfig.',
      )
    }
  } else if (Array.isArray(error)) {
    if (
      error.some(
        err =>
          typeof err === 'string' &&
          err.includes('is not listed within the file list of project'),
      )
    ) {
      return O.some(
        'It is possible this is a real error, double check the "includes" field of your tsconfig.  It is also possible this error is because your tsconfig is in a different directory than your root directory.  A possible workaround for this case is to use a tsconfig in the root directory which you can point at using the `dtsConfig` parameter in build-tools.',
      )
    }
  }
  return O.none
}

function displayErrors(
  error: unknown,
): (friendlyError: O.Option<string>) => RT.ReaderTask<Logging.LoggingService, void> {
  return function displayErrorInternal(friendlyError) {
    return pipe(
      friendlyError,
      O.match(
        () =>
          RA.sequence(RT.ApplicativeSeq)([
            Logging.warn(
              'The following error was not a recognized issue of build-tools, please open an issue for it: https://github.com/fp-tx/build-tools/issues/new',
            ),
            Logging.error(error),
          ]),
        friendlyLog =>
          RA.sequence(RT.ApplicativeSeq)([
            Logging.info(
              'Build-tools encountered known errors, see the following logs for the raw error and an attempted explanation.',
            ),
            Logging.warn(friendlyLog),
            Logging.error(error),
          ]),
      ),
      RT.asUnit,
    )
  }
}

class OverwriteDtsHost extends RealFileSystemHost {
  constructor(readonly remap: Endomorphism<string>) {
    super()
  }
  override writeFile(
    this: OverwriteDtsHost,
    filePath: string,
    fileText: string,
  ): Promise<void> {
    const dir = path.dirname(filePath)
    const fileName = path.basename(filePath)
    const remapped = this.remap(fileName)
    if (fileName.endsWith('.d.ts.map')) {
      return super.writeFile(path.join(dir, remapped), this.remap(fileText))
    }
    if (fileName.endsWith('.d.ts')) {
      return super.writeFile(path.join(dir, remapped), fileText)
    }

    return super.writeFile(filePath, fileText)
  }
}

type TypesServiceMethods = {
  readonly emitDts: TE.TaskEither<TypesServiceError, ReadonlyArray<string>>
  readonly emitDmts: TE.TaskEither<TypesServiceError, ReadonlyArray<string>>
  readonly emitDcts: TE.TaskEither<TypesServiceError, ReadonlyArray<string>>
}

const TypesServiceSymbol = Symbol('TypesService')

export class TypesService {
  readonly [TypesServiceSymbol]: TypesServiceMethods
  constructor(fileServiceMethods: TypesServiceMethods) {
    this[TypesServiceSymbol] = fileServiceMethods
  }
}

function mapSourceFile(
  mapNode: Endomorphism<ts.Node>,
): (
  context: ts.TransformationContext,
) => (sourceFile: ts.SourceFile | ts.Bundle) => ts.SourceFile {
  return function mapSourceFile1(context) {
    return function mapSourceFile2(sourceFile) {
      const mapNodeAndChildren = (node: ts.Node): ts.Node => {
        return ts.visitEachChild(mapNode(node), mapNodeAndChildren, context)
      }
      return mapNodeAndChildren(sourceFile) as ts.SourceFile
    }
  }
}

// See: https://github.com/microsoft/TypeScript/blob/a6414052a3eb66e30670f20c6597ee4b74067c73/src/compiler/path.ts#L101C12-L101C41
function isRelativePath(path: string): boolean {
  return /^\.\.?($|[\\/])/.test(path)
}

function isImplicitIndexPath(basename: string): boolean {
  return basename === '..' || basename === '.'
}

export const mapFileAndExtension: Endomorphism<Endomorphism<string>> =
  function mapFileAndExtension1(remapExtenion) {
    return function mapFileAndExtension2(importPath) {
      const basename = path.basename(importPath)
      const indexNormalized = isImplicitIndexPath(basename)
        ? path.join(basename, 'index')
        : basename
      const dirname = path.dirname(importPath)
      const rewrittenPath = path.join(dirname, remapExtenion(indexNormalized))
      return rewrittenPath.startsWith('.') ? rewrittenPath : `./${rewrittenPath}`
    }
  }

function getSourceFile(node: ts.Node): O.Option<string> {
  return pipe(
    node.getSourceFile(),
    O.fromNullable,
    O.orElse(() =>
      O.fromNullable(
        // This isn't made explicit in the types, but Typescript will add an
        // `original` property to nodes when they get `update`d, and their
        // `getSourceFile()` returns undefined. This is a workaround for that.
        (node as ts.Node & { original?: ts.Node }).original?.getSourceFile(),
      ),
    ),
    O.map(_ => _.fileName),
  )
}

export function rewriteRelativeImportSpecifier(
  remapExtension: Endomorphism<string>,
  getModuleReference: (importPath: string, sourceFile: O.Option<string>) => string,
): Endomorphism<ts.Node> {
  return function rewriteRelativeImportSpecifier1(node) {
    // --- Import Declaration ----
    // --------- from ------------
    // import { foo } from './foo'
    // ---------- to -------------
    // import { foo } from './foo.(m|c)js'
    // ---------------------------
    // -- Import Namespace Decl --
    // --------- from ------------
    // import * as foo from './foo'
    // ---------- to -------------
    // import * as foo './foo.(m|c)js'
    // ---------------------------
    // ----- Default Import ------
    // --------- from ------------
    // import Foo from './foo'
    // ---------- to -------------
    // import Foo from './foo.(m|c)js'
    // ---------------------------
    // --- Import Declaration ----
    // --------- from ------------
    // import './foo'
    // ---------- to -------------
    // import './foo.(m|c)js'
    // ---------------------------
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const importPath = node.moduleSpecifier.text

      if (isRelativePath(importPath)) {
        const rewrittenPath = mapFileAndExtension(remapExtension)(
          getModuleReference(importPath, getSourceFile(node)),
        )
        return ts.factory.updateImportDeclaration(
          node,
          node.modifiers,
          node.importClause,
          ts.factory.createStringLiteral(
            rewrittenPath.startsWith('.') ? rewrittenPath : `./${rewrittenPath}`,
          ),
          node.attributes,
        )
      }
    }

    // --- Import Type Node ------
    // --------- from ------------
    // import("./foo")
    // ---------- to -------------
    // import("./foo.(m|c)js")
    // ---------------------------
    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      const importPath = node.argument.literal.text
      if (isRelativePath(importPath)) {
        const rewrittenPath = mapFileAndExtension(remapExtension)(
          getModuleReference(importPath, getSourceFile(node)),
        )
        return ts.factory.updateImportTypeNode(
          node,
          ts.factory.createLiteralTypeNode(
            ts.factory.createStringLiteral(
              rewrittenPath.startsWith('.') ? rewrittenPath : `./${rewrittenPath}`,
            ),
          ),
          node.attributes,
          node.qualifier,
          node.typeArguments,
          node.isTypeOf,
        )
      }
    }

    // --- Module Declaration ----
    // --------- from ------------
    // declare module './foo'
    // ---------- to -------------
    // declare module './foo.(m|c)js'
    // ---------------------------
    if (ts.isModuleDeclaration(node)) {
      const name = node.name.text
      const rewrittenPath = mapFileAndExtension(remapExtension)(
        getModuleReference(name, getSourceFile(node)),
      )
      return ts.factory.updateModuleDeclaration(
        node,
        node.modifiers,
        ts.factory.createStringLiteral(
          rewrittenPath.startsWith('.') ? rewrittenPath : `./${rewrittenPath}`,
        ),
        node.body,
      )
    }
    // ----- Named exports -------
    // --------- from ------------
    // export { foo } from './foo'
    // ---------- to -------------
    // export { foo } from './foo.(m|c)js
    // ---------------------------
    // --- Export Declarations ---
    // --------- from ------------
    // export * from './foo'
    // ---------- to -------------
    // export * from './foo.(m|c)js'
    // ---------------------------
    // ---- Export Namespace -----
    // --------- from ------------
    // export * as foo from './foo'
    // ---------- to -------------
    // export * as foo from './foo.(m|c)js'
    // ---------------------------
    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const importPath = node.moduleSpecifier.text
      if (isRelativePath(importPath)) {
        const rewrittenPath = mapFileAndExtension(remapExtension)(
          getModuleReference(importPath, getSourceFile(node)),
        )
        return ts.factory.updateExportDeclaration(
          node,
          node.modifiers,
          node.isTypeOnly,
          node.exportClause,
          ts.factory.createStringLiteral(
            rewrittenPath.startsWith('.') ? rewrittenPath : `./${rewrittenPath}`,
          ),
          node.attributes,
        )
      }
    }

    return node
  }
}

function sharedConfig(
  host: RealFileSystemHost,
  resolvedCompilerOptions: ts.CompilerOptions,
) {
  return pipe(
    config,
    RTE.flatMapTaskEither(
      TE.tryCatchK(
        async config =>
          new Project({
            skipAddingFilesFromTsConfig: true,
            compilerOptions: {
              ...resolvedCompilerOptions,
              project: path.join(config.basePath, config.dtsConfig),
              emitDeclarationOnly: true,
              sourceMap: true,
              declaration: true,
              declarationMap: true,
              noEmit: false,
              rootDir: config.basePath,
              outDir: path.join(config.basePath, config.outDir),
              moduleResolution: ts.ModuleResolutionKind.Node16,
              module: ts.ModuleKind.Node16,
              target: ts.ScriptTarget.ESNext,
              stripInternal: true,
              ...config.dtsCompilerOverrides,
            },
            fileSystem: host,
          }),
        err => new TypesServiceError('Error creating project', err),
      ),
    ),
  )
}

function formatDiagnostic(
  diagnostic: Diagnostic<ts.Diagnostic>,
  host: ts.FormatDiagnosticsHost,
): string {
  return ts.formatDiagnostics([diagnostic.compilerObject], host)
}

function emitDtsCommon(
  host: RealFileSystemHost,
  rewriteImportSpecifier: Endomorphism<string>,
) {
  return pipe(
    RTE.Do,
    RTE.apSW('config', config),
    // Parse tsconfig
    RTE.bindW('compilerOptions', ({ config }) =>
      pipe(
        getCompilerOptionsFromTsConfig(path.join(config.basePath, config.dtsConfig)),
        RTE.fromPredicate(
          ({ errors }) => errors.length === 0,
          err => new TypesServiceError('Encountered tsconfig diagnostic errors', err),
        ),
        RTE.map(({ options }) => options),
      ),
    ),
    RTE.bindW('project', ({ compilerOptions }) => sharedConfig(host, compilerOptions)),
    RTE.apSW('LoggingService', RTE.ask<Logging.LoggingService>()),
    RTE.flatMapTaskEither(({ LoggingService, config, project }) =>
      pipe(
        TE.Do,
        TE.bind('compilerOptions', () =>
          TE.tryCatch(
            async () => project.getCompilerOptions(),
            err => new TypeEmissionError(LoggingService, err, 'Getting compiler options'),
          ),
        ),
        TE.bind('diagnosticHost', ({ compilerOptions }) =>
          TE.tryCatch(
            async () => ts.createCompilerHost(compilerOptions, true),
            err => new TypeEmissionError(LoggingService, err, 'Creating diagnostic host'),
          ),
        ),
        TE.apS(
          'sourceFiles',
          TE.tryCatch(
            async () =>
              project
                .addSourceFilesAtPaths(
                  config.buildMode.type === 'Single'
                    ? [path.join(config.basePath, config.buildMode.entrypoint)]
                    : config.buildMode.entrypointGlobs,
                )
                .map(sf => sf.getFilePath()),
            err => new TypeEmissionError(LoggingService, err, 'Adding source files'),
          ),
        ),
        TE.apSW(
          'preDiagnostics',
          pipe(
            TE.tryCatch(
              async () => project.getPreEmitDiagnostics(),
              err => new PreEmitDiagnosticError(LoggingService, err),
            ),
            TE.filterOrElse(
              diagnostics => diagnostics.length === 0,
              diagnostics => new PreEmitDiagnosticError(LoggingService, diagnostics),
            ),
          ),
        ),
        TE.bindW('result', ({ compilerOptions }) =>
          TE.tryCatch(
            async () =>
              project.emit({
                emitOnlyDtsFiles: true,
                customTransformers: {
                  afterDeclarations: [
                    mapSourceFile(
                      rewriteRelativeImportSpecifier(
                        rewriteImportSpecifier,
                        getModuleReference(compilerOptions),
                      ),
                    ),
                  ],
                },
              }),
            err => new TypeEmissionError(LoggingService, err, 'Emitting types'),
          ),
        ),
        TE.flatMap(({ result, diagnosticHost, sourceFiles }) =>
          pipe(
            TE.Do,
            TE.apS(
              'diagnostics',
              TE.tryCatch(
                async () => result.getDiagnostics(),
                err => new TypeEmissionError(LoggingService, err, 'Getting diagnostics'),
              ),
            ),
            TE.apS(
              'emitSkipped',
              TE.tryCatch(
                async () => result.getEmitSkipped(),
                err => new TypeEmissionError(LoggingService, err, 'Getting emit skipped'),
              ),
            ),
            TE.filterOrElse(
              ({ emitSkipped }) => !emitSkipped,
              ({ diagnostics }) =>
                new TypesServiceError(
                  'Failed to emit types, encountered TypeScript errors',
                  diagnostics.map(_ => formatDiagnostic(_, diagnosticHost)),
                ),
            ),
            TE.as(sourceFiles),
          ),
        ),
      ),
    ),
  )
}

function getModuleReference(
  compilerOptions: ts.CompilerOptions,
): (importPath: string, sourceFilename: O.Option<string>) => string {
  return function getModuleReference1(importPath, sourceFilename) {
    return pipe(
      O.Do,
      O.apS('sourceFilename', sourceFilename),
      O.bind('resolvedFilename', ({ sourceFilename }) =>
        O.fromNullable(
          ts.resolveModuleName(importPath, sourceFilename, compilerOptions, ts.sys)
            .resolvedModule?.resolvedFileName,
        ),
      ),
      O.map(({ sourceFilename, resolvedFilename }) =>
        path.relative(path.dirname(sourceFilename), resolvedFilename),
      ),
      O.getOrElse(() => importPath),
    )
  }
}

export const rewriteOrAddMjs: Endomorphism<string> = function rewriteOrAddMjs1(fileName) {
  const ext = path.extname(fileName)
  switch (ext) {
    case '':
      return `${fileName}.mjs`
    case '.js':
    case '.jsx':
      return fileName.replace(/\.jsx?$/, '.mjs')
    case '.ts':
    case '.tsx':
      return fileName.replace(/\.tsx?$/, '.mjs')
    default:
      return fileName
  }
}

export const rewriteOrAddCjs: Endomorphism<string> = function rewriteOrAddCjs1(fileName) {
  const ext = path.extname(fileName)
  switch (ext) {
    case '':
      return `${fileName}.cjs`
    case '.js':
    case '.jsx':
      return fileName.replace(/\.jsx?$/, '.cjs')
    case '.ts':
    case '.tsx':
      return fileName.replace(/\.tsx?$/, '.cjs')
    default:
      return fileName
  }
}

export const rewriteOrAddJs: Endomorphism<string> = function rewriteOrAddJs(fileName) {
  const ext = path.extname(fileName)
  switch (ext) {
    case '':
      return `${fileName}.js`
    case '.js':
      return fileName
    case '.jsx':
      return fileName.replace(/\.jsx$/, '.js')
    case '.ts':
    case '.tsx':
      return fileName.replace(/\.tsx?$/, '.js')
    default:
      return fileName
  }
}

function dtsToDmts(dts: string): string {
  return dts.replace(/\.d\.ts/, '.d.mts')
}
function dtsToDcts(dts: string): string {
  return dts.replace(/\.d\.ts/, '.d.cts')
}

const OverwriteDmtsHost = new OverwriteDtsHost(dtsToDmts)
const OverwriteDctsHost = new OverwriteDtsHost(dtsToDcts)
const NoOverwriteHost = new RealFileSystemHost()

// Emits d.mts and d.mts.map files
const emitDmts_: RTE.ReaderTaskEither<
  ConfigService & Logging.LoggingService,
  TypesServiceError,
  ReadonlyArray<string>
> = emitDtsCommon(OverwriteDmtsHost, rewriteOrAddMjs)

// emits d.cts and d.cts.map files
const emitDcts_: RTE.ReaderTaskEither<
  ConfigService & Logging.LoggingService,
  TypesServiceError,
  ReadonlyArray<string>
> = emitDtsCommon(OverwriteDctsHost, rewriteOrAddCjs)

// emits d.ts and d.ts.map files
const emitDts_: RTE.ReaderTaskEither<
  ConfigService & Logging.LoggingService,
  TypesServiceError,
  ReadonlyArray<string>
> = emitDtsCommon(NoOverwriteHost, rewriteOrAddJs)

export const TypesServiceLive: R.Reader<
  ConfigService & Logging.LoggingService,
  TypesService
> = R.asks(
  services =>
    new TypesService({
      emitDts: emitDts_(services),
      emitDmts: emitDmts_(services),
      emitDcts: emitDcts_(services),
    }),
)

export const emitDts: RTE.ReaderTaskEither<
  TypesService,
  TypesServiceError,
  ReadonlyArray<string>
> = pipe(
  RTE.ask<TypesService>(),
  RTE.flatMapTaskEither(service => service[TypesServiceSymbol].emitDts),
)

export const emitDmts: RTE.ReaderTaskEither<
  TypesService,
  TypesServiceError,
  ReadonlyArray<string>
> = pipe(
  RTE.ask<TypesService>(),
  RTE.flatMapTaskEither(service => service[TypesServiceSymbol].emitDmts),
)

export const emitDcts: RTE.ReaderTaskEither<
  TypesService,
  TypesServiceError,
  ReadonlyArray<string>
> = pipe(
  RTE.ask<TypesService>(),
  RTE.flatMapTaskEither(service => service[TypesServiceSymbol].emitDcts),
)

function conditionallyEmitGlobalDts(
  iife: boolean,
):
  | undefined
  | RR.ReadonlyRecord<
      string,
      RTE.ReaderTaskEither<TypesService, TypesServiceError, ReadonlyArray<string>>
    > {
  return iife ? { '.d.ts': emitDts } : undefined
}

function conditionallyEmitGlobalCts(
  iife: boolean,
):
  | undefined
  | RR.ReadonlyRecord<
      string,
      RTE.ReaderTaskEither<TypesService, TypesServiceError, ReadonlyArray<string>>
    > {
  return iife ? { '.d.cts': emitDcts } : undefined
}

export function emitTypes(
  packageJson: Pkg.PackageJson,
): RTE.ReaderTaskEither<
  TypesService & ConfigService,
  TypesServiceError,
  ReadonlyArray<readonly [ext: string, file: string]>
> {
  return pipe(
    config,
    RTE.flatMap(
      flow(
        (
          config,
        ): RR.ReadonlyRecord<
          string,
          RTE.ReaderTaskEither<TypesService, TypesServiceError, ReadonlyArray<string>>
        > => {
          switch (config.buildType) {
            case 'dual':
              switch (packageJson.type) {
                case 'commonjs':
                  return { '.d.ts': emitDts, '.d.mts': emitDmts }
                case 'module':
                  return { '.d.ts': emitDts, '.d.cts': emitDcts }
              }
            // eslint-disable-next-line no-fallthrough
            case 'esm':
              switch (packageJson.type) {
                case 'module':
                  return { '.d.ts': emitDts, ...conditionallyEmitGlobalCts(config.iife) }
                case 'commonjs':
                  return {
                    '.d.mts': emitDmts,
                    ...conditionallyEmitGlobalDts(config.iife),
                  }
              }
            // eslint-disable-next-line no-fallthrough
            case 'cjs':
              switch (packageJson.type) {
                case 'module':
                  return {
                    '.d.cts': emitDcts,
                  }
                case 'commonjs':
                  return { '.d.ts': emitDts }
              }
          }
        },
        RR.sequence(RTE.ApplicativePar),
      ),
    ),
    RTE.map(
      flow(
        RR.collect(Str.Ord)((ext, files) => files.map(file => tuple(ext, file))),
        RA.flatten,
      ),
    ),
  )
}
