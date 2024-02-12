import * as S from 'schemata-ts/index'
import type * as TCE from 'schemata-ts/TranscodeError'
import { deriveTranscoderPar } from 'schemata-ts/TranscoderPar'

export * from 'schemata-ts/schemables/parser/definition'

export const MapFileSchema = S.ParseJsonString(
  S.Struct(
    {
      sources: S.Array(S.String()),
    },
    S.Unknown,
  ),
)

export type MapFile = S.TypeOf<typeof MapFileSchema>

export const TranscoderPar = deriveTranscoderPar(MapFileSchema)

export class MapFileReadError extends Error {
  override readonly name = 'MapFileReadError'
  constructor(readonly transcodeErrors: TCE.TranscodeErrors) {
    super(String(transcodeErrors))
  }
}
