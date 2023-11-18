import * as S from 'schemata-ts/index'
import type * as TCE from 'schemata-ts/TranscodeError'
import { deriveTranscoderPar } from 'schemata-ts/TranscoderPar'

export const PackageJsonSchema = S.ParseJsonString(S.UnknownRecord)

export const TranscoderPar = deriveTranscoderPar(PackageJsonSchema)

export class PackageJsonReadError extends Error {
  override readonly name = 'PackageJsonReadError'
  constructor(readonly transcodeErrors: TCE.TranscodeErrors) {
    super(String(transcodeErrors))
  }
}
