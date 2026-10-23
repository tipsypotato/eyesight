import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { CameraSnapshot, SceneState } from '../anatomy/types';
import type { EyeEngine } from '../engine/EyeEngine';
import { eyeStore } from '../state/store';
import { loadEyeEngine } from '../startup';
import { Viewport } from './App';

const hooks = vi.hoisted(() => ({
  effects: [] as (() => void | (() => void))[],
  host: {} as HTMLElement,
}));

vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useRef: (initial: unknown) => ({ current: initial === null ? hooks.host : initial }),
  useEffect: (effect: () => void | (() => void)) => { hooks.effects.push(effect); },
  useState: (initial: unknown) => [initial, () => {}],
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
  camera: CameraSnapshot = { position: [3, 2, 5], target: [0, 0, 0], zoom: 1 };
  cameraListener: ((camera: CameraSnapshot) => void) | null = null;
  ready: ((error?: unknown) => void) | undefined;
  constructor(_host: HTMLElement, _select: unknown, _locate: unknown, _section: unknown, ready?: (error?: unknown) => void) {
    this.ready = ready;
    EngineStub.instances.push(this);
  }
  setState(state: SceneState) {
    if (EngineStub.stateFailure) throw EngineStub.stateFailure;
    this.states.push(state);
  }
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
  hooks.effects = [];
  Viewport(props);
  const effects = hooks.effects.map(effect => effect()).filter((cleanup): cleanup is () => void => typeof cleanup === 'function');
  let mounted = true;
  const unmount = () => { if (mounted) { mounted = false; effects.reverse().forEach(cleanup => cleanup()); } };
  cleanups.push(unmount);
  return unmount;
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
