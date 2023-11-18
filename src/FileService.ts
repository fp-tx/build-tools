import { type SystemError } from 'bun'
import { flow, pipe } from 'fp-ts/lib/function.js'
import * as RTE from 'fp-ts/lib/ReaderTaskEither.js'
import * as TE from 'fp-ts/lib/TaskEither.js'
import fs from 'fs'

const FileServiceSymbol = Symbol('FileService')

export class FileServiceError extends Error {
  override readonly name = 'FileServiceError'
  constructor(readonly systemError: SystemError) {
    super(systemError.message)
  }
  static readonly of: (systemError: SystemError) => FileServiceError = (systemError) =>
    new FileServiceError(systemError)
}

type FileServiceMethods = {
  readonly readDirectory: (path: PathLike) => TE.TaskEither<FileServiceError, ReadonlyArray<fs.Dirent>>
  readonly getFile: (path: PathLike) => TE.TaskEither<FileServiceError, string>
  readonly writeFile: (
    path: PathLike,
    content: string,
    options?: fs.WriteFileOptions,
  ) => TE.TaskEither<FileServiceError, void>
}

export class FileService {
  [FileServiceSymbol]: FileServiceMethods
  constructor(fileServiceMethods: FileServiceMethods) {
    this[FileServiceSymbol] = fileServiceMethods
  }
}

const readDirectory_: (path: PathLike) => TE.TaskEither<FileServiceError, ReadonlyArray<fs.Dirent>> = flow(
  TE.taskify((path: PathLike, callback: (err: null | SystemError, files: ReadonlyArray<fs.Dirent>) => void) =>
    fs.readdir(path, { withFileTypes: true }, callback),
  ),
  TE.mapLeft(FileServiceError.of),
)

const getFile_: (path: PathLike) => TE.TaskEither<FileServiceError, string> = flow(
  TE.taskify((path: PathLike, callback: (err: null | SystemError, file: string) => void) =>
    fs.readFile(path, { encoding: 'utf-8' }, callback),
  ),
  TE.mapLeft(FileServiceError.of),
)

const writeFile_: (
  path: PathLike,
  content: string,
  options: fs.WriteFileOptions,
) => TE.TaskEither<FileServiceError, void> = flow(
  TE.taskify(
    (path: PathLike, content: string, options: fs.WriteFileOptions, callback: (err: null | SystemError) => void) =>
      fs.writeFile(path, content, options, callback),
  ),
  TE.mapLeft(FileServiceError.of),
  TE.asUnit,
)

export const FileServiceLive: FileService = new FileService({
  readDirectory: readDirectory_,
  getFile: getFile_,
  writeFile: (path, content, options = 'utf8') => writeFile_(path, content, options),
})

export const readDirectory: (
  path: PathLike,
) => RTE.ReaderTaskEither<FileService, FileServiceError, ReadonlyArray<fs.Dirent>> = (path) =>
  pipe(
    RTE.ask<FileService>(),
    RTE.flatMapTaskEither((service) => service[FileServiceSymbol].readDirectory(path)),
  )

export const getFile: (path: PathLike) => RTE.ReaderTaskEither<FileService, FileServiceError, string> = (path) =>
  pipe(
    RTE.ask<FileService>(),
    RTE.flatMapTaskEither((service) => service[FileServiceSymbol].getFile(path)),
  )

export const writeFile: (
  path: PathLike,
  content: string,
  options?: fs.WriteFileOptions,
) => RTE.ReaderTaskEither<FileService, FileServiceError, void> = (path, content, options) =>
  pipe(
    RTE.ask<FileService>(),
    RTE.flatMapTaskEither((service) => service[FileServiceSymbol].writeFile(path, content, options)),
  )
