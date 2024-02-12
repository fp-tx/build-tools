import { flow, pipe } from 'fp-ts/lib/function.js'
import * as RTE from 'fp-ts/lib/ReaderTaskEither.js'
import * as TE from 'fp-ts/lib/TaskEither.js'
import fs from 'fs'
import * as g from 'glob'

const FileServiceSymbol = Symbol('FileService')

export class FileServiceError extends Error {
  override readonly name = 'FileServiceError'
  constructor(readonly Error: Error) {
    super(Error.message)
  }
  static readonly of: (Error: Error) => FileServiceError = Error =>
    new FileServiceError(Error)
}

type FileServiceMethods = {
  readonly readDirectory: (
    path: fs.PathLike,
  ) => TE.TaskEither<FileServiceError, ReadonlyArray<fs.Dirent>>
  readonly getFile: (path: fs.PathLike) => TE.TaskEither<FileServiceError, string>
  readonly writeFile: (
    path: fs.PathLike,
    content: string,
    options?: fs.WriteFileOptions,
  ) => TE.TaskEither<FileServiceError, void>
  readonly copyDirectory: (
    targetPath: string,
    destinationPath: string,
    options?: fs.CopyOptions,
  ) => TE.TaskEither<FileServiceError, void>
  readonly glob: (
    patterns: string | ReadonlyArray<string>,
    options?: g.GlobOptionsWithFileTypesUnset,
  ) => TE.TaskEither<FileServiceError, ReadonlyArray<string>>
}

export class FileService {
  [FileServiceSymbol]: FileServiceMethods
  constructor(fileServiceMethods: FileServiceMethods) {
    this[FileServiceSymbol] = fileServiceMethods
  }
}

const readDirectory_: (
  path: fs.PathLike,
) => TE.TaskEither<FileServiceError, ReadonlyArray<fs.Dirent>> = flow(
  TE.taskify(
    (
      path: fs.PathLike,
      callback: (err: null | Error, files: ReadonlyArray<fs.Dirent>) => void,
    ) => fs.readdir(path, { withFileTypes: true }, callback),
  ),
  TE.mapLeft(FileServiceError.of),
)

const getFile_: (path: fs.PathLike) => TE.TaskEither<FileServiceError, string> = flow(
  TE.taskify((path: fs.PathLike, callback: (err: null | Error, file: string) => void) =>
    fs.readFile(path, { encoding: 'utf-8' }, callback),
  ),
  TE.mapLeft(FileServiceError.of),
)

const writeFile_: (
  path: fs.PathLike,
  content: string,
  options: fs.WriteFileOptions,
) => TE.TaskEither<FileServiceError, void> = flow(
  TE.taskify(
    (
      path: fs.PathLike,
      content: string,
      options: fs.WriteFileOptions,
      callback: (err: null | Error) => void,
    ) => fs.writeFile(path, content, options, callback),
  ),
  TE.mapLeft(FileServiceError.of),
  TE.asUnit,
)

const copyDirectory_: (
  targetDir: string,
  destinationdir: string,
  options: fs.CopyOptions,
) => TE.TaskEither<FileServiceError, void> = flow(
  TE.taskify(
    (
      targetPath: string,
      destinationPath: string,
      options: fs.CopyOptions,
      callback: (err: null | Error) => void,
    ) => fs.cp(targetPath, destinationPath, options, callback),
  ),
  TE.mapLeft(FileServiceError.of),
  TE.asUnit,
)

export const glob_: (
  patterns: string | ReadonlyArray<string>,
  options?: g.GlobOptionsWithFileTypesUnset,
) => TE.TaskEither<FileServiceError, ReadonlyArray<string>> = TE.tryCatchK(
  g.glob as any,
  err => FileServiceError.of(new Error(String(err))),
)

export const FileServiceLive: FileService = new FileService({
  readDirectory: readDirectory_,
  getFile: getFile_,
  glob: glob_,
  writeFile: (path, content, options = 'utf8') => writeFile_(path, content, options),
  copyDirectory: (t, d, o = {}) => copyDirectory_(t, d, o),
})

export const readDirectory: (
  path: fs.PathLike,
) => RTE.ReaderTaskEither<
  FileService,
  FileServiceError,
  ReadonlyArray<fs.Dirent>
> = path =>
  pipe(
    RTE.ask<FileService>(),
    RTE.flatMapTaskEither(service => service[FileServiceSymbol].readDirectory(path)),
  )

export const glob: (
  patterns: string | ReadonlyArray<string>,
  options?: g.GlobOptionsWithFileTypesUnset,
) => RTE.ReaderTaskEither<FileService, FileServiceError, ReadonlyArray<string>> = (
  pattern,
  options,
) =>
  pipe(
    RTE.ask<FileService>(),
    RTE.flatMapTaskEither(service => service[FileServiceSymbol].glob(pattern, options)),
  )

export const getFile: (
  path: fs.PathLike,
) => RTE.ReaderTaskEither<FileService, FileServiceError, string> = path =>
  pipe(
    RTE.ask<FileService>(),
    RTE.flatMapTaskEither(service => service[FileServiceSymbol].getFile(path)),
  )

export const writeFile: (
  path: fs.PathLike,
  content: string,
  options?: fs.WriteFileOptions,
) => RTE.ReaderTaskEither<FileService, FileServiceError, void> = (
  path,
  content,
  options,
) =>
  pipe(
    RTE.ask<FileService>(),
    RTE.flatMapTaskEither(service =>
      service[FileServiceSymbol].writeFile(path, content, options),
    ),
  )

export const copyDirectory: (
  targetPath: string,
  destinationPath: string,
  options?: fs.CopyOptions,
) => RTE.ReaderTaskEither<FileService, FileServiceError, void> = (
  targetPath,
  destinationPath,
  options,
) =>
  pipe(
    RTE.ask<FileService>(),
    RTE.flatMapTaskEither(service =>
      service[FileServiceSymbol].copyDirectory(targetPath, destinationPath, options),
    ),
  )
