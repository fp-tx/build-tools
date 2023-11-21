import * as S from 'schemata-ts'
import type * as TCE from 'schemata-ts/TranscodeError'
import { deriveTranscoderPar } from 'schemata-ts/TranscoderPar'

export const PackageJsonSchema = S.ParseJsonString(
  S.Struct(
    {
      name: S.String(),
      version: S.String(),
      description: S.Optional(S.String()),
      license: S.Optional(S.String()),
      author: S.Optional(S.String()),
      main: S.Unknown,
      module: S.Unknown,
      exports: S.Unknown,
      type: S.Optional(S.Literal('module', 'commonjs'), 'commonjs'),
    },
    S.Unknown,
  ),
)

export type PackageJson = S.TypeOf<typeof PackageJsonSchema>

export const TranscoderPar = deriveTranscoderPar(PackageJsonSchema)

export class PackageJsonReadError extends Error {
  override readonly name = 'PackageJsonReadError'
  constructor(readonly transcodeErrors: TCE.TranscodeErrors) {
    super(String(transcodeErrors))
  }
}
