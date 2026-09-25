/**
 * Types for react-test-renderer, which ships none of its own.
 *
 * The package is already installed — jest-expo depends on it — and it is what
 * the screen tests under src/screens/__tests__ render with, because there is
 * no @testing-library/react-native in this app and adding one is a dependency
 * decision for the whole package rather than for a test file. TypeScript is
 * strict here, so the alternative to this file is an `any` cast in every test,
 * and a test that cannot be type-checked is a test that quietly rots.
 *
 * Only the surface those tests use is declared. @types/react-test-renderer
 * would be the better answer the next time this package's dependencies are
 * touched; until then this is the whole of it, written out rather than
 * silenced.
 */
declare module 'react-test-renderer' {
  import type { ReactElement } from 'react';

  export interface ReactTestInstance {
    instance: unknown;
    type: unknown;
    props: Record<string, any>;
    parent: ReactTestInstance | null;
    children: Array<ReactTestInstance | string>;
    find(predicate: (node: ReactTestInstance) => boolean): ReactTestInstance;
    findAll(predicate: (node: ReactTestInstance) => boolean, options?: { deep?: boolean | 'all' }): ReactTestInstance[];
    findByType(type: unknown): ReactTestInstance;
    findAllByType(type: unknown, options?: { deep?: boolean | 'all' }): ReactTestInstance[];
    findByProps(props: Record<string, unknown>): ReactTestInstance;
    findAllByProps(props: Record<string, unknown>, options?: { deep?: boolean | 'all' }): ReactTestInstance[];
  }

  export interface ReactTestRendererJSON {
    type: string;
    props: Record<string, unknown>;
    children: Array<ReactTestRendererJSON | string> | null;
  }

  export interface ReactTestRenderer {
    root: ReactTestInstance;
    toJSON(): ReactTestRendererJSON | ReactTestRendererJSON[] | null;
    toTree(): unknown;
    update(element: ReactElement): void;
    unmount(): void;
  }

  export interface TestRendererOptions {
    createNodeMock?: (element: ReactElement) => unknown;
  }

  export function create(element: ReactElement, options?: TestRendererOptions): ReactTestRenderer;

  /**
   * Synchronous when the callback is, asynchronous when it returns a promise —
   * which is the form the screen tests use, because a screen loads in an
   * effect and nothing is on screen until that has settled.
   */
  export function act(callback: () => void): void;
  export function act(callback: () => Promise<void>): Promise<void>;

  const TestRenderer: {
    create: typeof create;
    act: typeof act;
  };
  export default TestRenderer;
}
