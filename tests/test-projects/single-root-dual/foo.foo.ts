import { bar } from './src/foo.bar.js'

/**
 * What is it? Who knows!
 *
 * @remarks
 *   I have nothing to say
 */
export const Foo = bar.baz === 'baz' ? 'bar' : 'foo'

export type Bar = typeof bar
