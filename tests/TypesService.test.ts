import * as Types from '../src/TypesService'

const t = <A, B>(a: A, b: B): readonly [A, B] => [a, b]

describe('relative import remapping', () => {
  describe.each([
    t('js', Types.rewriteOrAddJs),
    t('mjs', Types.rewriteOrAddMjs),
    t('cjs', Types.rewriteOrAddCjs),
  ])('%s', (ext, rewrite) => {
    it('works with same-dir relative extensionless paths', () => {
      expect(Types.mapFileAndExtension(rewrite)('./Foo')).toBe(`./Foo.${ext}`)
    })
    it('works with same-dir relative path with extension', () => {
      expect(Types.mapFileAndExtension(rewrite)('./Foo.js')).toBe(`./Foo.${ext}`)
    })
    it('works with deep directory relative extensionless path', () => {
      expect(Types.mapFileAndExtension(rewrite)('../../../lib/foo/Foo')).toBe(
        `../../../lib/foo/Foo.${ext}`,
      )
    })
    it('works with deep directory relative path with extension', () => {
      expect(Types.mapFileAndExtension(rewrite)('../../../lib/foo/Foo.js')).toBe(
        `../../../lib/foo/Foo.${ext}`,
      )
    })
  })
})
