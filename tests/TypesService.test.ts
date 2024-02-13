import { printNode, ts } from 'ts-morph'

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
    describe('node remapping', () => {
      it('rewrites named import declarations', () => {
        const testNode = ts.factory.createImportDeclaration(
          undefined,
          ts.factory.createImportClause(
            false,
            undefined,
            ts.factory.createNamedImports([
              ts.factory.createImportSpecifier(
                true,
                undefined,
                ts.factory.createIdentifier('foo'),
              ),
            ]),
          ),
          ts.factory.createStringLiteral('./foo'),
        )
        const transformed = Types.rewriteRelativeImportSpecifier(rewrite)(testNode)
        const result = printNode(transformed)
        expect(result).toBe(`import { type foo } from "./foo.${ext}";`)
      })
      it('rewrites namepsace import declarations', () => {
        const testNode = ts.factory.createImportDeclaration(
          undefined,
          ts.factory.createImportClause(
            false,
            undefined,
            ts.factory.createNamespaceImport(ts.factory.createIdentifier('foo')),
          ),
          ts.factory.createStringLiteral('./foo'),
        )
        const transformed = Types.rewriteRelativeImportSpecifier(rewrite)(testNode)
        const result = printNode(transformed)
        expect(result).toBe(`import * as foo from "./foo.${ext}";`)
      })
      it('rewrites default import declarations', () => {
        const testNode = ts.factory.createImportDeclaration(
          undefined,
          ts.factory.createImportClause(
            false,
            ts.factory.createIdentifier('foo'),
            undefined,
          ),
          ts.factory.createStringLiteral('./foo'),
        )
        const transformed = Types.rewriteRelativeImportSpecifier(rewrite)(testNode)
        const result = printNode(transformed)
        expect(result).toBe(`import foo from "./foo.${ext}";`)
      })
      it('rewrites effectful import declarations', () => {
        const testNode = ts.factory.createImportDeclaration(
          undefined,
          undefined,
          ts.factory.createStringLiteral('./foo'),
        )
        const transformed = Types.rewriteRelativeImportSpecifier(rewrite)(testNode)
        const result = printNode(transformed)
        expect(result).toBe(`import "./foo.${ext}";`)
      })
      it('rewrites import types', () => {
        const testNode = ts.factory.createImportTypeNode(
          ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral('./foo')),
          undefined,
          undefined,
          undefined,
        )
        const transformed = Types.rewriteRelativeImportSpecifier(rewrite)(testNode)
        const result = printNode(transformed)
        expect(result).toBe(`import("./foo.${ext}")`)
      })
      it('rewrites module declaration names', () => {
        const testNode = ts.factory.createModuleDeclaration(
          [ts.factory.createModifier(ts.SyntaxKind.DeclareKeyword)],
          ts.factory.createIdentifier('./foo'),
          ts.factory.createModuleBlock([]),
        )
        const transformed = Types.rewriteRelativeImportSpecifier(rewrite)(testNode)
        const result = printNode(transformed)
        expect(result).toBe(`declare module "./foo.${ext}" { }`)
      })
      it('rewrites export declarations', () => {
        const testNode = ts.factory.createExportDeclaration(
          [],
          true,
          undefined,
          ts.factory.createStringLiteral('./foo'),
        )
        const transformed = Types.rewriteRelativeImportSpecifier(rewrite)(testNode)
        const result = printNode(transformed)
        expect(result).toBe(`export type * from "./foo.${ext}";`)
      })
      it('rewrites export namespace declarations', () => {
        const testNode = ts.factory.createExportDeclaration(
          [],
          false,
          ts.factory.createNamespaceExport(ts.factory.createIdentifier('foo')),
          ts.factory.createStringLiteral('./foo'),
        )
        const transformed = Types.rewriteRelativeImportSpecifier(rewrite)(testNode)
        const result = printNode(transformed)
        expect(result).toBe(`export * as foo from "./foo.${ext}";`)
      })
      it('rewrites export assignment', () => {
        const testNode = ts.factory.createExportDeclaration(
          [],
          false,
          ts.factory.createNamedExports([
            ts.factory.createExportSpecifier(true, 'foo', 'foo2'),
          ]),
          ts.factory.createStringLiteral('./foo'),
        )
        const transformed = Types.rewriteRelativeImportSpecifier(rewrite)(testNode)
        const result = printNode(transformed)
        expect(result).toBe(`export { type foo as foo2 } from "./foo.${ext}";`)
      })
    })
  })
})
