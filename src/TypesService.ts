import { RealFileSystemHost } from '@ts-morph/common'
import { type Endomorphism } from 'fp-ts/lib/Endomorphism.js'
import { flow, pipe, tuple } from 'fp-ts/lib/function.js'
import * as R from 'fp-ts/lib/Reader.js'
import * as RTE from 'fp-ts/lib/ReaderTaskEither.js'
import * as RA from 'fp-ts/lib/ReadonlyArray.js'
import * as RR from 'fp-ts/lib/ReadonlyRecord.js'
import * as Str from 'fp-ts/lib/string.js'
import * as TE from 'fp-ts/lib/TaskEither.js'
import path from 'path'
import { type Diagnostic, Project, ts } from 'ts-morph'

import { config, type ConfigService } from './ConfigService'
import type * as Pkg from './PackageJson'

export class TypesServiceError extends Error {
  override readonly name = 'TypesServiceError'
  constructor(
    readonly context: string,
    readonly error: unknown,
  ) {
    super(`TypesServiceError: ${context} ${JSON.stringify(error)}`)
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

const mapSourceFile =
  (mapNode: Endomorphism<ts.Node>) =>
  (context: ts.TransformationContext) =>
  (sourceFile: ts.SourceFile | ts.Bundle): ts.SourceFile => {
    const mapNodeAndChildren = (node: ts.Node): ts.Node => {
      return ts.visitEachChild(mapNode(node), mapNodeAndChildren, context)
    }
    return mapNodeAndChildren(sourceFile) as ts.SourceFile
  }

// See: https://github.com/microsoft/TypeScript/blob/a6414052a3eb66e30670f20c6597ee4b74067c73/src/compiler/path.ts#L101C12-L101C41
const isRelativePath = (path: string): boolean => /^\.\.?($|[\\/])/.test(path)

export const mapFileAndExtension: Endomorphism<Endomorphism<string>> =
  remapExtenion => importPath => {
    const fileNameWithExtension = path.basename(importPath)
    const dirname = path.dirname(importPath)
    const rewrittenPath = path.join(dirname, remapExtenion(fileNameWithExtension))
    return rewrittenPath.startsWith('.') ? rewrittenPath : `./${rewrittenPath}`
  }

export const rewriteRelativeImportSpecifier: (
  remapExtension: Endomorphism<string>,
) => Endomorphism<ts.Node> = remapExtension => node => {
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
      const rewrittenPath = mapFileAndExtension(remapExtension)(importPath)
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
      const rewrittenPath = mapFileAndExtension(remapExtension)(importPath)
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
    const rewrittenPath = mapFileAndExtension(remapExtension)(name)
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
      const rewrittenPath = mapFileAndExtension(remapExtension)(importPath)
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

const sharedConfig = (host: RealFileSystemHost) =>
  pipe(
    config,
    RTE.flatMapTaskEither(
      TE.tryCatchK(
        async config =>
          new Project({
            skipAddingFilesFromTsConfig: true,
            compilerOptions: {
              project: path.join(config.basePath, config.dtsConfig),
              emitDeclarationOnly: true,
              sourceMap: true,
              declaration: true,
              declarationMap: true,
              noEmit: false,
              outDir: path.join(config.basePath, config.outDir),
              moduleResolution: ts.ModuleResolutionKind.Node16,
              module: ts.ModuleKind.Node16,
              target: ts.ScriptTarget.ESNext,
            },
            fileSystem: host,
          }),
        err => new TypesServiceError('Error creating project', err),
      ),
    ),
  )

const formatDiagnostic = (
  diagnostic: Diagnostic<ts.Diagnostic>,
  host: ts.FormatDiagnosticsHost,
): string => ts.formatDiagnostics([diagnostic.compilerObject], host)

const emitDtsCommon = (
  host: RealFileSystemHost,
  rewriteImportSpecifier: Endomorphism<string>,
) =>
  pipe(
    RTE.Do,
    RTE.apSW('config', config),
    RTE.apSW('project', sharedConfig(host)),
    RTE.flatMapTaskEither(
      TE.tryCatchK(
        async ({ config, project }) => {
          const compilerOptions = project.getCompilerOptions()
          const diagnosticsHost = ts.createCompilerHost(compilerOptions, true)
          const sourceFiles = project
            .addSourceFilesAtPaths(
              config.buildMode.type === 'Single'
                ? [path.join(config.basePath, config.srcDir, config.buildMode.entrypoint)]
                : config.buildMode.entrypointGlobs,
            )
            .map(sf => sf.getFilePath())
          const prediagnostics = project.getPreEmitDiagnostics()
          if (prediagnostics.length > 0) {
            return {
              files: sourceFiles,
              emitSkipped: true,
              diagnostics: prediagnostics,
              diagnosticsHost,
            }
          }
          const result = await project.emit({
            emitOnlyDtsFiles: true,
            customTransformers: {
              afterDeclarations: [
                mapSourceFile(rewriteRelativeImportSpecifier(rewriteImportSpecifier)),
              ],
            },
          })
          return {
            files: sourceFiles,
            emitSkipped: result.getEmitSkipped(),
            diagnostics: result.getDiagnostics(),
            diagnosticsHost,
          }
        },
        err => new TypesServiceError('Error emitting d.ts files', err),
      ),
    ),
    RTE.filterOrElseW(
      ({ emitSkipped }) => !emitSkipped,
      ({ diagnostics, diagnosticsHost }) =>
        new TypesServiceError(
          'Encountered TypeScript build errors',
          diagnostics.map(_ => formatDiagnostic(_, diagnosticsHost)),
        ),
    ),
    RTE.map(({ files }) => files),
  )

export const rewriteOrAddMjs: Endomorphism<string> = fileName => {
  const ext = path.extname(fileName)
  switch (ext) {
    case '':
      return `${fileName}.mjs`
    case '.js':
      return fileName.replace(/\.js$/, '.mjs')
    default:
      return fileName
  }
}

export const rewriteOrAddCjs: Endomorphism<string> = fileName => {
  const ext = path.extname(fileName)
  switch (ext) {
    case '':
      return `${fileName}.cjs`
    case '.js':
      return fileName.replace(/\.js$/, '.cjs')
    default:
      return fileName
  }
}

export const rewriteOrAddJs: Endomorphism<string> = fileName => {
  const ext = path.extname(fileName)
  switch (ext) {
    case '':
      return `${fileName}.js`
    case '.js':
      return fileName
    default:
      return fileName
  }
}

const dtsToDmts = (dts: string): string => dts.replace(/\.d\.ts/, '.d.mts')
const dtsToDcts = (dts: string): string => dts.replace(/\.d\.ts/, '.d.cts')

const OverwriteDmtsHost = new OverwriteDtsHost(dtsToDmts)
const OverwriteDctsHost = new OverwriteDtsHost(dtsToDcts)
const NoOverwriteHost = new RealFileSystemHost()

// Emits d.mts and d.mts.map files
const emitDmts_: RTE.ReaderTaskEither<
  ConfigService,
  TypesServiceError,
  ReadonlyArray<string>
> = emitDtsCommon(OverwriteDmtsHost, rewriteOrAddMjs)

// emits d.cts and d.cts.map files
const emitDcts_: RTE.ReaderTaskEither<
  ConfigService,
  TypesServiceError,
  ReadonlyArray<string>
> = emitDtsCommon(OverwriteDctsHost, rewriteOrAddCjs)

// emits d.ts and d.ts.map files
const emitDts_: RTE.ReaderTaskEither<
  ConfigService,
  TypesServiceError,
  ReadonlyArray<string>
> = emitDtsCommon(NoOverwriteHost, rewriteOrAddJs)

export const TypesServiceLive: R.Reader<ConfigService, TypesService> = R.asks(
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

export const emitTypes = (
  packageJson: Pkg.PackageJson,
): RTE.ReaderTaskEither<
  TypesService & ConfigService,
  TypesServiceError,
  ReadonlyArray<readonly [ext: string, file: string]>
> =>
  pipe(
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
                  return { '.d.ts': emitDts }
                case 'commonjs':
                  return { '.d.cts': emitDcts }
              }
            // eslint-disable-next-line no-fallthrough
            case 'cjs':
              switch (packageJson.type) {
                case 'module':
                  return { '.d.mts': emitDmts }
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
