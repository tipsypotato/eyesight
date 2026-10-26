import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { CameraSnapshot, SceneState } from '../anatomy/types';
import type { EyeEngine } from '../engine/EyeEngine';
import { eyeStore } from '../state/store';
import { loadEyeEngine } from '../startup';
import { Viewport } from './App';

const hooks = vi.hoisted(() => ({
  current: null as null | {
    refs: { current: unknown }[]; refIndex: number; effectIndex: number;
    effects: { deps?: readonly unknown[]; cleanup?: () => void }[];
    pending: (() => void)[]; states: unknown[]; stateIndex: number; stateUpdates: number;
  },
  host: {} as HTMLElement,
}));

vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useRef: (initial: unknown) => {
    const current = hooks.current!;
    return current.refs[current.refIndex++] ??= { current: initial === null ? hooks.host : initial };
  },
  useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => {
    const current = hooks.current!, index = current.effectIndex++, previous = current.effects[index];
    if (!previous || !deps || !previous.deps || deps.length !== previous.deps.length || deps.some((value, i) => !Object.is(value, previous.deps![i]))) {
      current.pending.push(() => {
        previous?.cleanup?.();
        const cleanup = effect();
        current.effects[index] = { deps: deps?.slice(), cleanup: typeof cleanup === 'function' ? cleanup : undefined };
      });
    }
  },
  useState: (initial: unknown) => {
    const current = hooks.current!, index = current.stateIndex++;
    if (!(index in current.states)) current.states[index] = initial;
    return [current.states[index], (value: unknown) => { current.states[index] = value; current.stateUpdates++; }];
  },
}));
vi.mock('zustand', () => ({
  useStore: (store: typeof eyeStore, selector?: (state: ReturnType<typeof eyeStore.getState>) => unknown) => selector ? selector(store.getState()) : store.getState(),
}));
vi.mock('../startup', async importOriginal => ({
  ...await importOriginal<typeof import('../startup')>(),
  loadEyeEngine: vi.fn(),
}));

class ElementStub {
  textContent = ''; value = 0; lang = ''; removed = false;
  attributes = new Map<string, string>();
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  removeAttribute(name: string) { this.attributes.delete(name); }
  remove() { this.removed = true; }
}

class EngineStub {
  static instances: EngineStub[] = [];
  static stateFailure: Error | undefined;
  states: SceneState[] = [];
  disposed = false;
  interactionEnabled = true;
  camera: CameraSnapshot = { position: [3, 2, 5], target: [0, 0, 0], zoom: 1 };
  cameraListener: ((camera: CameraSnapshot) => void) | null = null;
  ready: ((error?: unknown) => void) | undefined;
  skullStatus: ((status: 'loading' | 'upgrading' | 'preview' | 'ready' | 'error') => void) | undefined;
  constructor(_host: HTMLElement, _select: unknown, _locate: unknown, _section: unknown, ready?: (error?: unknown) => void, skullStatus?: (status: 'loading' | 'upgrading' | 'preview' | 'ready' | 'error') => void) {
    this.ready = ready; this.skullStatus = skullStatus;
    EngineStub.instances.push(this);
  }
  setState(state: SceneState) {
    if (EngineStub.stateFailure) throw EngineStub.stateFailure;
    this.states.push(state);
  }
  setInteractionEnabled(enabled: boolean) { this.interactionEnabled = enabled; }
  captureCamera() { return structuredClone(this.camera); }
  syncCamera(camera: CameraSnapshot) { this.camera = structuredClone(camera); }
  setCameraListener(listener: (camera: CameraSnapshot) => void) { this.cameraListener = listener; }
  dispose() { this.disposed = true; this.ready = undefined; this.cameraListener = null; }
}

const engineModule = { EyeEngine: EngineStub } as unknown as Awaited<ReturnType<typeof loadEyeEngine>>;
const initialState = eyeStore.getState();
let elements: Record<string, ElementStub>, frames: FrameRequestCallback[], cleanups: (() => void)[];
const engineRef = () => ({ current: null as EyeEngine | null });
const settle = () => new Promise<void>(resolve => setTimeout(resolve, 0));
function deferredEngine() {
  let resolve!: (module: typeof engineModule) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<typeof engineModule>((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve: () => resolve(engineModule), reject };
}
function mount(props: Parameters<typeof Viewport>[0]) {
  const current: NonNullable<typeof hooks.current> = { refs: [], effects: [], pending: [], refIndex: 0, effectIndex: 0, states: [], stateIndex: 0, stateUpdates: 0 };
  let tree: ReturnType<typeof Viewport>;
  const rerender = (next: Parameters<typeof Viewport>[0]) => {
    current.refIndex = 0; current.effectIndex = 0; current.stateIndex = 0; current.pending = [];
    hooks.current = current;
    try { tree = Viewport(next); } finally { hooks.current = null; }
    current.pending.forEach(effect => effect());
  };
  rerender(props);
  let mounted = true;
  const unmount = () => { if (mounted) { mounted = false; [...current.effects].reverse().forEach(effect => effect.cleanup?.()); } };
  cleanups.push(unmount);
  return Object.assign(unmount, { rerender, html: () => renderToStaticMarkup(tree), stateUpdates: () => current.stateUpdates });
}
async function paint() {
  expect(frames).toHaveLength(1);
  frames.shift()!(0);
  frames.shift()!(16);
  await settle();
}

beforeEach(() => {
  eyeStore.setState(initialState, true);
  EngineStub.instances = []; EngineStub.stateFailure = undefined;
  frames = []; cleanups = [];
  vi.mocked(loadEyeEngine).mockReset();
  elements = Object.fromEntries(['startup-screen', 'startup-title', 'startup-status', 'startup-progress', 'startup-count', 'startup-retry', 'root'].map(id => [id, new ElementStub()]));
  elements.root.setAttribute('inert', ''); elements.root.setAttribute('aria-busy', 'true');
  vi.stubGlobal('document', { getElementById: (id: string) => elements[id]?.removed ? null : elements[id] });
  vi.stubGlobal('window', { clearTimeout, setTimeout });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; });
});
afterEach(() => { cleanups.reverse().forEach(cleanup => cleanup()); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it.each([
  { narrow: true, interactionEnabled: undefined, expected: false },
  { narrow: true, interactionEnabled: true, expected: true },
  { narrow: false, interactionEnabled: undefined, expected: true },
])('applies the current gesture mode before a late engine starts: $narrow/$interactionEnabled', async ({ narrow, interactionEnabled, expected }) => {
  const engine = engineRef();
  vi.mocked(loadEyeEngine).mockResolvedValue(engineModule);
  mount({ engine, peer: engineRef(), narrow, interactionEnabled });
  await settle(); await paint();
  expect(EngineStub.instances[0].interactionEnabled).toBe(expected);
  eyeStore.getState().setMode('optics');
  expect(EngineStub.instances[0].interactionEnabled).toBe(expected);
});

it('uses the latest interaction mode when it changes while the engine import is pending', async () => {
  const pending = deferredEngine(), engine = engineRef(), peer = engineRef();
  vi.mocked(loadEyeEngine).mockReturnValue(pending.promise);
  const viewport = mount({ engine, peer, narrow: true, interactionEnabled: false });
  viewport.rerender({ engine, peer, narrow: true, interactionEnabled: true });
  pending.resolve(); await settle(); await paint();
  expect(EngineStub.instances).toHaveLength(1);
  expect(engine.current).toBe(EngineStub.instances[0]);
  expect(EngineStub.instances[0].interactionEnabled).toBe(true);
  expect(loadEyeEngine).toHaveBeenCalledOnce();
});

it('updates interaction mode on the same loaded engine without reapplying its scene or moving its camera', async () => {
  const engine = engineRef(), peer = engineRef();
  vi.mocked(loadEyeEngine).mockResolvedValue(engineModule);
  const viewport = mount({ engine, peer, narrow: true, interactionEnabled: false });
  await settle(); await paint();
  const instance = EngineStub.instances[0], states = [...instance.states];
  instance.camera = { position: [5, 1, 2], target: [0.2, 0, 0], zoom: 1.4 };
  const camera = structuredClone(instance.camera);
  for (const interactionEnabled of [true, false]) {
    viewport.rerender({ engine, peer, narrow: true, interactionEnabled });
    expect(instance.interactionEnabled).toBe(interactionEnabled);
    expect(engine.current).toBe(instance);
    expect(instance.states).toEqual(states);
    expect(instance.camera).toEqual(camera);
    expect(instance.disposed).toBe(false);
  }
  expect(EngineStub.instances).toHaveLength(1);
  expect(loadEyeEngine).toHaveBeenCalledOnce();
  viewport();
  expect(instance.disposed).toBe(true);
  expect(engine.current).toBeNull();
});

it('does not construct a model when its import resolves after the viewport unmounts', async () => {
  const pending = deferredEngine(), engine = engineRef();
  vi.mocked(loadEyeEngine).mockReturnValue(pending.promise);
  const unmount = mount({ engine, peer: engineRef() });
  unmount(); pending.resolve(); await settle();
  expect(EngineStub.instances).toHaveLength(0);
  expect(frames).toHaveLength(0);
  expect(engine.current).toBeNull();
});

it('does not construct a model after unmounting during the paint opportunity', async () => {
  const engine = engineRef();
  vi.mocked(loadEyeEngine).mockResolvedValue(engineModule);
  const unmount = mount({ engine, peer: engineRef() });
  await settle(); unmount(); await paint();
  expect(EngineStub.instances).toHaveLength(0);
  expect(engine.current).toBeNull();
});

it('handles an import rejection and releases the initial screen instead of trapping the app', async () => {
  const pending = deferredEngine(), engine = engineRef(), failure = new Error('Engine chunk unavailable');
  const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(loadEyeEngine).mockReturnValue(pending.promise);
  mount({ engine, peer: engineRef() });
  pending.reject(failure); await settle();
  expect(errorLog).toHaveBeenCalledExactlyOnceWith('3D initialization failed', failure);
  expect(elements['startup-screen'].removed).toBe(true);
  expect(elements.root.attributes.has('inert')).toBe(false);
  expect(elements.root.attributes.has('aria-busy')).toBe(false);
  expect(engine.current).toBeNull();
  expect(EngineStub.instances).toHaveLength(0);
});

it('disposes a constructed engine when applying the initial scene fails', async () => {
  const engine = engineRef(), failure = new Error('Scene initialization failed');
  EngineStub.stateFailure = failure;
  const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(loadEyeEngine).mockResolvedValue(engineModule);
  mount({ engine, peer: engineRef() });
  await settle(); await paint();
  expect(errorLog).toHaveBeenCalledExactlyOnceWith('3D initialization failed', failure);
  expect(EngineStub.instances).toHaveLength(1);
  expect(EngineStub.instances[0].disposed).toBe(true);
  expect(engine.current).toBeNull();
  expect(elements['startup-screen'].removed).toBe(true);
  EngineStub.stateFailure = undefined;
  eyeStore.getState().setLabels(true);
  expect(EngineStub.instances[0].states).toHaveLength(0);
});

it('unsubscribes and releases the model when the first frame fails', async () => {
  const engine = engineRef(), failure = new Error('First frame failed');
  const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(loadEyeEngine).mockResolvedValue(engineModule);
  mount({ engine, peer: engineRef() });
  await settle(); await paint();
  const instance = EngineStub.instances[0];
  instance.ready?.(failure);
  expect(errorLog).toHaveBeenCalledExactlyOnceWith('3D initialization failed', failure);
  expect(instance.disposed).toBe(true);
  expect(engine.current).toBeNull();
  expect(elements['startup-screen'].removed).toBe(true);
  const count = instance.states.length;
  eyeStore.getState().setLabels(true);
  expect(instance.states).toHaveLength(count);
});

it('synchronizes a late reference viewport and stops applying store updates after cleanup', async () => {
  eyeStore.getState().setMode('optics'); eyeStore.getState().saveComparison();
  const main = engineRef(), reference = engineRef(), late = deferredEngine();
  vi.mocked(loadEyeEngine).mockResolvedValueOnce(engineModule).mockReturnValueOnce(late.promise);
  const unmountMain = mount({ engine: main, peer: reference });
  await settle(); await paint();
  const current = EngineStub.instances[0];
  expect(main.current).toBe(current);
  expect(elements['startup-screen'].removed).toBe(false);
  current.ready?.();
  expect(elements['startup-screen'].removed).toBe(true);
  const unmountReference = mount({ engine: reference, peer: main, reference: true });
  current.camera = { position: [5, 1, 2], target: [0.2, 0, 0], zoom: 1.4 };
  eyeStore.getState().setOpticsExperiment('free');
  eyeStore.getState().setOpticsInput({ pupil: 'small' });
  late.resolve(); await settle(); await paint();
  const comparison = EngineStub.instances[1];
  expect(reference.current).toBe(comparison);
  expect(comparison.camera).toEqual(current.camera);
  expect(comparison.states.at(-1)?.opticsInput).toEqual(eyeStore.getState().comparison!.input);
  expect(current.states.at(-1)?.opticsInput.pupil).toBe('small');
  eyeStore.getState().setLabels(true);
  expect(current.states.at(-1)?.labels).toBe(true);
  expect(comparison.states.at(-1)?.labels).toBe(true);
  unmountReference(); unmountMain();
  const counts = EngineStub.instances.map(instance => instance.states.length);
  eyeStore.getState().setLabels(false);
  expect(EngineStub.instances.map(instance => instance.states.length)).toEqual(counts);
  expect(EngineStub.instances.every(instance => instance.disposed)).toBe(true);
  expect(main.current).toBeNull(); expect(reference.current).toBeNull();
});


it.each(['zh', 'en'] as const)('keeps optional skull loading and failure separate from startup in %s', async lang => {
  eyeStore.getState().setLanguage(lang);
  const props = { engine: engineRef(), peer: engineRef() };
  vi.mocked(loadEyeEngine).mockResolvedValue(engineModule);
  const viewport = mount(props);
  await settle(); await paint();
  const instance = EngineStub.instances[0];
  instance.ready?.(); viewport.rerender(props);
  expect(elements['startup-screen'].removed).toBe(true);
  expect(viewport.html()).toContain('aria-busy="false"');
  expect(viewport.html()).toContain(lang === 'zh' ? '正在加载头骨参照' : 'Loading skull reference');
  instance.skullStatus?.('upgrading'); viewport.rerender(props);
  expect(viewport.html()).toContain(lang === 'zh' ? '头骨细节加载中' : 'Loading skull detail');
  expect(viewport.html()).toContain('aria-busy="false"');
  instance.skullStatus?.('preview'); viewport.rerender(props);
  expect(viewport.html()).toContain(lang === 'zh' ? '已显示简化头骨' : 'Simplified skull shown');
  instance.skullStatus?.('error'); viewport.rerender(props);
  expect(viewport.html()).toContain(lang === 'zh' ? '眼球仍可正常操作' : 'eye controls remain usable');
  expect(viewport.html()).not.toContain('role="alert"');
  expect(instance.disposed).toBe(false);
  eyeStore.getState().setClip({ enabled: true }); viewport.rerender(props);
  expect(viewport.html()).not.toContain('class="skull-status"');
  eyeStore.getState().setClip({ enabled: false });
  instance.skullStatus?.('ready'); viewport.rerender(props);
  expect(viewport.html()).not.toContain('class="skull-status"');
  instance.skullStatus?.('loading'); viewport.rerender(props);
  expect(viewport.html()).toContain('class="skull-status"');
  eyeStore.getState().setShowSkull(false); viewport.rerender(props);
  expect(viewport.html()).not.toContain('class="skull-status"');
  viewport();
  const updates = viewport.stateUpdates();
  instance.skullStatus?.('error');
  expect(viewport.stateUpdates()).toBe(updates);
});
