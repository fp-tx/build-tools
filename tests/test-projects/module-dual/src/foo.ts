import { bar } from './bar.js'

/**
 * What is it? Who knows!
 *
 * @remarks
 *   I have nothing to say
 */
export const Foo = bar === 'foo' ? 'bar' : 'foo'

export type Bar = typeof bar
