/**
 * The smallest thing that lets a screen be tested.
 *
 * Until now nothing in this app had ever been rendered in a test: the whole
 * suite was services and utilities, so the panic button, the chat thread and
 * the sign-in form — the three places where being wrong hurts most — were
 * covered by nothing at all. Every screen defect in the audit was a render
 * defect, and a render defect is invisible to a type check.
 *
 * There is no @testing-library/react-native in this package and adding one is
 * a dependency decision for the whole app, not for one test file. react-test-
 * renderer is already here (jest-expo depends on it), and for the questions
 * worth asking — is this switch drawn at all, does this bubble sit on the
 * right, does this text appear — walking the rendered tree answers them
 * directly. The helpers below are that walk, written once so a screen test
 * reads as the question it is asking.
 */

import React from 'react';
import TestRenderer, { type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

/**
 * Renders a screen and lets every already-resolved promise settle before
 * handing it back.
 *
 * Screens load in a useEffect, so a render with no flush shows only the
 * loading state and a test written against it proves nothing. `act` with an
 * async callback runs the effects and drains the microtask queue, which is
 * enough for a mocked api whose promises are already resolved.
 */
export async function renderScreen(element: React.ReactElement): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;
  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(element);
  });
  await settle();
  mounted.push(renderer);
  return renderer;
}

/**
 * Lets pending promises resolve and re-renders, for a tap that fetches.
 *
 * The timeout is not decoration: a FlatList schedules its first batch of cells
 * on a zero-delay timer, so without letting one turn of the event loop pass
 * that update lands after the test has finished and React complains that it
 * was not wrapped in act.
 */
export async function settle(): Promise<void> {
  await TestRenderer.act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const mounted: ReactTestRenderer[] = [];

/**
 * Unmounts every screen this file rendered. A test file calls it from
 * afterEach: a screen left mounted keeps its list timers running into the next
 * test, where the update it makes belongs to nobody.
 */
export function unmountScreens(): void {
  while (mounted.length) {
    const renderer = mounted.pop();
    TestRenderer.act(() => {
      renderer?.unmount();
    });
  }
}

/**
 * Every string the screen is actually showing, joined with newlines.
 *
 * Read from the host <Text> elements rather than from props, so a string that
 * is computed, conditional or buried three components down is found the same
 * way a member's eye would find it.
 */
export function visibleText(renderer: ReactTestRenderer): string {
  const lines: string[] = [];
  const walk = (node: unknown): void => {
    if (node === null || node === undefined || node === false || node === true) return;
    if (typeof node === 'string') {
      const text = node.trim();
      if (text) lines.push(text);
      return;
    }
    if (typeof node === 'number') {
      lines.push(String(node));
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const children = (node as { children?: unknown }).children;
    if (children) walk(children);
  };
  walk(renderer.toJSON());
  return lines.join('\n');
}

/** True when the screen shows this text anywhere, ignoring case. */
export function shows(renderer: ReactTestRenderer, text: string): boolean {
  return visibleText(renderer).toLowerCase().includes(text.toLowerCase());
}

/** Every instance of a component type, by the name it is declared with. */
export function findAllByName(renderer: ReactTestRenderer, name: string): ReactTestInstance[] {
  return renderer.root.findAll(
    (node) => {
      const type = node.type as unknown;
      if (typeof type === 'string') return type === name;
      if (typeof type === 'function') return (type as { displayName?: string; name?: string }).displayName === name || (type as { name?: string }).name === name;
      if (type && typeof type === 'object') return (type as { displayName?: string }).displayName === name;
      return false;
    },
    { deep: 'all' }
  );
}

/** The first element whose accessibilityLabel is exactly this, or null. */
export function byLabel(renderer: ReactTestRenderer, label: string): ReactTestInstance | null {
  const matches = renderer.root.findAll((node) => node.props?.accessibilityLabel === label, { deep: 'all' });
  return matches[0] ?? null;
}

/** Every string rendered underneath one element, joined with spaces. */
export function textUnder(instance: ReactTestInstance): string {
  const parts: string[] = [];
  const walk = (node: ReactTestInstance | string): void => {
    if (typeof node === 'string') {
      const text = node.trim();
      if (text) parts.push(text);
      return;
    }
    node.children?.forEach(walk);
  };
  walk(instance);
  return parts.join(' ');
}

/**
 * The pressable whose own label contains this text.
 *
 * Buttons on these screens are a TouchableOpacity wrapping a Text, and the
 * touchable is what a member's finger lands on. Matching on the text and then
 * taking the innermost pressable that contains it finds the button without the
 * test having to know how the screen is nested — which is what a test of what
 * she sees should be free of.
 */
export function pressableWithText(renderer: ReactTestRenderer, text: string): ReactTestInstance | null {
  const needle = text.toLowerCase();
  const pressables = renderer.root.findAll((node) => typeof node.props?.onPress === 'function', { deep: 'all' });
  const matches = pressables.filter((node) => textUnder(node).toLowerCase().includes(needle));
  return matches.length ? matches[matches.length - 1] : null;
}

/** Fires a press on an element, flushing whatever it starts. */
export async function press(instance: ReactTestInstance): Promise<void> {
  await TestRenderer.act(async () => {
    instance.props.onPress?.();
    await Promise.resolve();
  });
}

/** Flattens a style prop — arrays, nested arrays, undefined — into one object. */
export function flatStyle(style: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const walk = (value: unknown): void => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (typeof value === 'object') Object.assign(out, value);
  };
  walk(style);
  return out;
}
