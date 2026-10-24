import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createEyeStore, eyeStore } from '../state/store';
import App, { Viewport } from './App';

type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void };
const hooks = vi.hoisted(() => ({ slots: [] as Slot[], cursor: 0, pending: [] as (() => void)[], dirty: false }));
vi.mock('react', async original => ({
  ...await original<typeof import('react')>(),
  useId: () => `test-id-${hooks.cursor++}`,
  useRef: (initial: unknown) => {
    const slot = hooks.slots[hooks.cursor++] ??= {};
    return slot.value ??= { current: initial };
  },
  useState: (initial: unknown) => {
    const index = hooks.cursor++;
    const slot = hooks.slots[index] ??= { value: typeof initial === 'function' ? initial() : initial };
    return [slot.value, (next: unknown) => {
      const value = typeof next === 'function' ? next(slot.value) : next;
      if (!Object.is(slot.value, value)) { slot.value = value; hooks.dirty = true; }
    }];
  },
  useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => {
    const slot = hooks.slots[hooks.cursor++] ??= {};
    if (!deps || !slot.deps || deps.length !== slot.deps.length || deps.some((value, index) => !Object.is(value, slot.deps![index]))) {
      slot.deps = deps;
      hooks.pending.push(() => { slot.cleanup?.(); slot.cleanup = effect() || undefined; });
    }
  },
}));
vi.mock('zustand', () => ({
  useStore: (store: typeof eyeStore, selector?: (state: ReturnType<typeof eyeStore.getState>) => unknown) => selector ? selector(store.getState()) : store.getState(),
}));

type Element = ReactElement<Record<string, unknown>>;
const host = () => ({ focus: vi.fn(), scrollIntoView: vi.fn(), querySelector: () => null });
let store: ReturnType<typeof createEyeStore>, nodes: Element[], frames: FrameRequestCallback[];
let narrow: boolean, mediaListeners: Set<() => void>;
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elements(node.props.children as ReactNode)];
}
function render() {
  let attempts = 0;
  do {
    hooks.cursor = 0; hooks.pending = []; hooks.dirty = false;
    nodes = elements(App());
    for (const node of nodes) {
      const ref = node.props.ref as { current: ReturnType<typeof host> | null } | undefined;
      if (typeof node.type === 'string' && ref && !ref.current) ref.current = host();
    }
    hooks.pending.forEach(effect => effect());
  } while (hooks.dirty && ++attempts < 10);
  expect(hooks.dirty).toBe(false);
  frames.splice(0).forEach(frame => frame(0));
}
function find(predicate: (node: Element) => boolean) {
  const node = nodes.find(predicate); expect(node).toBeDefined(); return node!;
}
const viewport = () => find(node => node.type === Viewport);
const toggle = () => find(node => node.props['aria-describedby'] === 'model-touch-hint');
const scene = () => find(node => node.type === 'section' && String(node.props.className).startsWith('scene-column'));
const click = (node: Element) => { (node.props.onClick as () => void)(); render(); };
const resize = (value: boolean) => { narrow = value; mediaListeners.forEach(listener => listener()); render(); };
const size = (value: 'half' | 'full') => { (find(node => typeof node.props.onSize === 'function').props.onSize as (size: string) => void)(value); render(); };

function presetMenu() {
  resize(false);
  const component = find(node => typeof node.type === 'function' && node.type.name === 'SceneControls');
  hooks.pending = [];
  const controls = elements((component.type as (props: Record<string, unknown>) => ReactNode)(component.props));
  hooks.pending.forEach(effect => effect());
  const details = controls.find(node => node.type === 'details' && node.props.className === 'preset-picker')!;
  const summary = { focus: vi.fn() };
  const picker = { open: true, querySelector: vi.fn((selector: string) => selector === 'summary' ? summary : null) };
  (details.props.ref as { current: typeof picker }).current = picker;
  return { controls, details, picker, summary };
}

beforeEach(() => {
  hooks.slots = []; hooks.cursor = 0; hooks.pending = []; hooks.dirty = false;
  frames = []; narrow = true; mediaListeners = new Set(); store = createEyeStore();
  vi.spyOn(eyeStore, 'getState').mockImplementation(store.getState);
  vi.stubGlobal('window', {
    setTimeout, clearTimeout, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    matchMedia: (query: string) => ({
      get matches() { return query === '(width < 900px)' && narrow; },
      addEventListener: (_event: string, listener: () => void) => { if (query === '(width < 900px)') mediaListeners.add(listener); },
      removeEventListener: (_event: string, listener: () => void) => mediaListeners.delete(listener),
    }),
  });
  vi.stubGlobal('document', { documentElement: {}, addEventListener: vi.fn(), removeEventListener: vi.fn(), querySelector: () => null });
  vi.stubGlobal('requestAnimationFrame', (frame: FrameRequestCallback) => frames.push(frame));
  render();
});
afterEach(() => { hooks.slots.forEach(slot => slot.cleanup?.()); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('requires an explicit opt-in, preserves it across language changes, and exits without replacing the viewport', () => {
  const engine = viewport().props.engine;
  expect(viewport().props.interactionEnabled).toBe(false);
  expect(toggle().props['aria-pressed']).toBe(false);
  click(toggle());
  expect(viewport().props.interactionEnabled).toBe(true);
  expect(toggle().props['aria-pressed']).toBe(true);
  click(find(node => node.type === 'button' && node.props.lang === 'en'));
  expect(toggle().props.children).toBe('Exit model controls');
  expect(viewport().props.interactionEnabled).toBe(true);
  click(toggle());
  expect(viewport().props.interactionEnabled).toBe(false);
  expect(viewport().props.engine).toBe(engine);
});

it('returns to browsing when the workspace, disease chapter, or responsive breakpoint changes', () => {
  click(toggle());
  click(find(node => node.type === 'button' && node.props.children === '常见眼病'));
  expect(viewport().props.interactionEnabled).toBe(false);
  click(toggle()); store.getState().openDisease('glaucoma'); render();
  expect(viewport().props.interactionEnabled).toBe(false);
  click(toggle()); resize(false);
  expect(viewport().props.interactionEnabled).toBe(true);
  expect(nodes.some(node => node.props['aria-describedby'] === 'model-touch-hint')).toBe(false);
  resize(true);
  expect(viewport().props.interactionEnabled).toBe(false);
  expect(toggle().props['aria-pressed']).toBe(false);
});

it('keeps the model mounted while focusing on content and restores model access in browsing mode', () => {
  const engine = viewport().props.engine;
  const section = (scene().props.ref as { current: ReturnType<typeof host> }).current;
  const button = (toggle().props.ref as { current: ReturnType<typeof host> }).current;
  click(toggle()); size('full');
  expect(scene().props.hidden).toBe(true);
  expect(viewport().props.engine).toBe(engine);
  expect(viewport().props.interactionEnabled).toBe(false);
  size('half');
  expect(scene().props.hidden).toBe(false);
  expect(viewport().props.engine).toBe(engine);
  expect(viewport().props.interactionEnabled).toBe(false);
  expect(button.focus).toHaveBeenCalledWith({ preventScroll: true });
  expect(section.scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
});

it('applies an exploration preset, closes the picker and restores focus to its summary', () => {
  const { controls, picker, summary } = presetMenu();
  expect(store.getState().layers['orbital-roof']).toBe('off');
  const orbit = controls.find(node => node.type === 'button' && node.key === 'orbit')!;
  (orbit.props.onClick as () => void)();
  expect(store.getState().presetId).toBe('orbit');
  expect(store.getState().layers['orbital-roof']).toBe('ghost');
  expect(store.getState().layers['oculomotor-nerve']).toBe('on');
  expect(store.getState().undoCount).toBe(1);
  expect(picker.open).toBe(false);
  expect(summary.focus).toHaveBeenCalledWith({ preventScroll: true });
});

it('dismisses an open preset picker with Escape without changing the observation', () => {
  const { details, picker, summary } = presetMenu();
  const state = store.getState(), preventDefault = vi.fn();
  const keyDown = details.props.onKeyDown as (event: { key: string; currentTarget: typeof picker; preventDefault: () => void }) => void;
  keyDown({ key: 'ArrowDown', currentTarget: picker, preventDefault });
  expect(picker.open).toBe(true);
  expect(preventDefault).not.toHaveBeenCalled();
  keyDown({ key: 'Escape', currentTarget: picker, preventDefault });
  expect(picker.open).toBe(false);
  expect(store.getState()).toBe(state);
  expect(summary.focus).toHaveBeenCalledWith({ preventScroll: true });
  keyDown({ key: 'Escape', currentTarget: picker, preventDefault });
  expect(preventDefault).toHaveBeenCalledTimes(1);
  expect(summary.focus).toHaveBeenCalledTimes(1);
});
