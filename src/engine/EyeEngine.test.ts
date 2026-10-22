import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createEyeStore } from '../state/store';
import { EyeEngine } from './EyeEngine';
import type { CameraSnapshot } from '../anatomy/types';
import { buildEye } from './geometry';
import { SectionTool } from './section';
import { Animator } from './animator';
import { CameraRig } from './camera';
import { opticsInputForPreset, traceOptics, type TraceOpticsResult } from './optics';

class EngineElementStub extends EventTarget {
  style: Record<string, string> = {};
  classList = { add() {} };
  clientWidth = 480; clientHeight = 600;
  parentElement: EngineElementStub | null = null;
  children: EngineElementStub[] = [];
  get ownerDocument() { return document; }
  getRootNode() { return document; }
  append(...children: EngineElementStub[]) { children.forEach(child => this.appendChild(child)); }
  appendChild(child: EngineElementStub) { child.parentElement = this; this.children.push(child); }
  setAttribute() {} remove() {} querySelectorAll() { return []; }
  getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight, right: this.clientWidth, bottom: this.clientHeight }; }
  setPointerCapture() {} hasPointerCapture() { return false; } releasePointerCapture() {}
}

vi.mock('three', async importOriginal => ({
  ...await importOriginal<typeof import('three')>(),
  WebGLRenderer: class {
    domElement = new EngineElementStub();
    setPixelRatio() {} setSize() {} dispose() {} forceContextLoss() {} render() {}
  },
}));

it('reapplies the current viewport after restoring a mode saved before a resize', () => {
  const eye = buildEye(), store = createEyeStore(), document = new EventTarget();
  const canvas = Object.assign(new EventTarget(), { style: {}, setAttribute: vi.fn(), clientWidth: 390, clientHeight: 300,
    ownerDocument: document, getRootNode: () => document });
  const camera = new THREE.PerspectiveCamera(38, 1.5, 0.02, 50); camera.position.set(3, 2, 5);
  const rig = new CameraRig(camera, canvas as unknown as HTMLElement, new Animator());
  rig.setViewport(600, 400, { x: 0, y: 80, width: 600, height: 320 });
  const oldCamera = rig.capture();
  const host = { getBoundingClientRect: () => ({ top: 0, bottom: 300 }), parentElement: { querySelectorAll: () => [] } };
  const engine = Object.assign(Object.create(EyeEngine.prototype), {
    eye, state: store.getState(), camera, rig, canvas, host, width: 390, height: 300,
    labels: new Map(), caps: new Map(), section: new SectionTool(), rays: new THREE.Group(), neural: new THREE.Group(), pointerDown: new THREE.Vector2(),
    posteriorScale: 1, setView: vi.fn(), invalidate: vi.fn(),
  }) as EyeEngine;
  const measure = () => (engine as unknown as { measureViewport(): void }).measureViewport();
  try {
    store.getState().setMode('optics', oldCamera); engine.setState(store.getState()); measure();
    expect(camera.aspect).toBeCloseTo(1.3);
    store.getState().setMode('explore'); engine.setState(store.getState()); measure();
    expect(camera.aspect).toBeCloseTo(1.3);
    camera.updateMatrixWorld();
    const center = rig.controls.target.clone().project(camera);
    expect(center.x).toBeCloseTo(0); expect(center.y).toBeCloseTo(0);
  } finally { rig.controls.dispose(); eye.dispose(); }
});

it('keeps the iris ring readable when focusing in a sagittal section', () => {
  const eye = buildEye(), store = createEyeStore();
  store.getState().select('iris', true);
  const document = new EventTarget();
  const canvas = Object.assign(new EventTarget(), { style: {}, clientWidth: 600, clientHeight: 400,
    ownerDocument: document, getRootNode: () => document });
  const camera = new THREE.PerspectiveCamera(38, 1.5, 0.02, 50);
  camera.position.set(3, 2, 5);
  const animator = new Animator(); animator.reducedMotion = true;
  const rig = new CameraRig(camera, canvas as unknown as HTMLElement, animator);
  const engine = Object.assign(Object.create(EyeEngine.prototype), { eye, state: store.getState(), camera, rig, posteriorScale: 1, invalidate: vi.fn() }) as EyeEngine;
  try {
    engine.focus('iris'); camera.updateMatrixWorld();
    const a = new THREE.Vector3(-0.6, 0, 0.67).project(camera), b = new THREE.Vector3(0.6, 0, 0.67).project(camera);
    expect(Math.abs(a.x - b.x)).toBeGreaterThan(0.15);
  } finally { rig.controls.dispose(); eye.dispose(); }
});

it('fits the real foveal surface at a readable size and does not focus an unanswered quiz', () => {
  const eye = buildEye();
  const store = createEyeStore();
  store.getState().revealStructure('fovea');
  const document = new EventTarget();
  const canvas = Object.assign(new EventTarget(), { style: {}, clientWidth: 600, clientHeight: 400,
    ownerDocument: document, getRootNode: () => document, setPointerCapture: () => {}, releasePointerCapture: () => {} });
  const camera = new THREE.PerspectiveCamera(38, 1.5, 0.02, 50);
  camera.position.set(3, 2, 5);
  const animator = new Animator();
  animator.reducedMotion = true;
  const rig = new CameraRig(camera, canvas as unknown as HTMLElement, animator);
  const engine = Object.assign(Object.create(EyeEngine.prototype), {
    eye, state: store.getState(), camera, rig, posteriorScale: 1, invalidate: vi.fn(),
  }) as EyeEngine;
  try {
    eye.root.updateMatrixWorld(true);
    engine.focus('fovea');
    rig.controls.update(); camera.updateMatrixWorld();
    const bounds = new THREE.Box3().setFromObject(eye.parts.get('fovea')!.group);
    const center = bounds.getCenter(new THREE.Vector3());
    const left = new THREE.Vector3(bounds.min.x, center.y, center.z).project(camera);
    const right = new THREE.Vector3(bounds.max.x, center.y, center.z).project(camera);
    const fraction = Math.abs(right.x - left.x) * 600 / 2 / 400;
    expect(fraction).toBeGreaterThanOrEqual(0.20);
    expect(fraction).toBeLessThanOrEqual(0.35);
    expect(rig.controls.target.distanceTo(center)).toBeLessThan(1e-7);
    expect(camera.position.z).toBeGreaterThan(bounds.max.z + 0.15);
    const saved = rig.capture();
    Object.assign(engine, { state: { ...store.getState(), mode: 'quiz', quizRevealed: false } });
    engine.focus('lens');
    expect(rig.capture()).toEqual(saved);
  } finally { rig.controls.dispose(); eye.dispose(); }
});

it('cancels a pending focus when a different structure is selected', () => {
  const eye = buildEye();
  const store = createEyeStore();
  const document = new EventTarget();
  const canvas = Object.assign(new EventTarget(), {
    style: {}, clientWidth: 600, clientHeight: 400, setAttribute: vi.fn(),
    ownerDocument: document, getRootNode: () => document,
    setPointerCapture: () => {}, releasePointerCapture: () => {},
  });
  const camera = new THREE.PerspectiveCamera(38, 1.5, 0.02, 50);
  camera.position.set(3, 2, 5);
  const animator = new Animator();
  const rig = new CameraRig(camera, canvas as unknown as HTMLElement, animator);
  const engine = Object.assign(Object.create(EyeEngine.prototype), {
    eye, state: store.getState(), canvas, rig, camera, animator,
    labels: new Map(), caps: new Map(), section: new SectionTool(), rays: new THREE.Group(), neural: new THREE.Group(),
    pointerDown: new THREE.Vector2(), posteriorScale: 1, invalidate: vi.fn(),
  }) as EyeEngine;
  const unsubscribe = store.subscribe(state => engine.setState(state));
  try {
    store.getState().select('optic-nerve');
    engine.focus('optic-nerve');
    animator.tick(0.1);
    const interrupted = rig.capture();
    store.getState().select('cornea');
    animator.tick(2);
    rig.controls.update();
    expect(store.getState().selectedId).toBe('cornea');
    expect(camera.position.distanceTo(new THREE.Vector3(...interrupted.position))).toBeLessThan(1e-10);
    expect(rig.controls.target.distanceTo(new THREE.Vector3(...interrupted.target))).toBeLessThan(1e-10);
    expect(animator.active).toBe(false);
  } finally {
    unsubscribe(); rig.controls.dispose(); eye.dispose();
  }
});

it('restores a mode camera and removes optical stretching without rebuilding the eye', () => {
  const eye = buildEye();
  const store = createEyeStore();
  const rig = { cancel: vi.fn(), restore: vi.fn(), capture: vi.fn() };
  const rays = new THREE.Group();
  const engine = Object.assign(Object.create(EyeEngine.prototype), {
    eye, state: store.getState(), canvas: { setAttribute: vi.fn(), style: {} },
    labels: new Map(), caps: new Map(), section: new SectionTool(), rays, neural: new THREE.Group(), rig,
    pointerDown: new THREE.Vector2(10, 20), posteriorScale: 1, setView: vi.fn(), invalidate: vi.fn(),
  }) as EyeEngine;
  const savedCamera = { position: [2, 3, 4], target: [0, 0.1, -0.3], zoom: 1.2 } as const;
  const retina = eye.parts.get('retina')!.group.children[0] as THREE.Mesh;
  const bounds = () => new THREE.Box3().setFromObject(retina);
  const normalZ = bounds().min.z;
  try {
    store.getState().setMode('optics', { position: [...savedCamera.position], target: [...savedCamera.target], zoom: savedCamera.zoom });
    store.getState().setOptics('myopia');
    engine.setState(store.getState());
    expect(bounds().min.z).toBeLessThan(normalZ - 0.1);
    expect(rays.visible).toBe(true);
    store.getState().setMode('explore');
    engine.setState(store.getState());
    expect(bounds().min.z).toBeCloseTo(normalZ);
    expect(rays.visible).toBe(false);
    expect(rig.restore).toHaveBeenCalledWith(savedCamera);
    expect(rig.cancel).toHaveBeenCalled();
    const calls = rig.restore.mock.calls.length;
    store.getState().setLanguage('en');
    engine.setState(store.getState());
    expect(rig.restore).toHaveBeenCalledTimes(calls);
    expect(eye.parts.get('retina')!.group.children[0]).toBe(retina);
  } finally {
    eye.dispose();
  }
});

it('restores internal tissue materials when the closed eye is exploded or cut', () => {
  const eye = buildEye();
  const store = createEyeStore();
  eye.root.traverse(object => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if ('color' in material) material.userData.baseColor = material.color.clone();
      }
    }
  });
  // Exercise actual material updates without a browser-only WebGL renderer or camera animation.
  const engine = Object.assign(Object.create(EyeEngine.prototype), {
    eye, state: store.getState(), canvas: { setAttribute: vi.fn(), style: {} },
    labels: new Map(), caps: new Map(), section: new SectionTool(), rays: new THREE.Group(), neural: new THREE.Group(),
    posteriorScale: 1, setView: vi.fn(), invalidate: vi.fn(),
  }) as EyeEngine;
  const lens = eye.parts.get('lens')!.group.getObjectByName('lens-capsule') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>;
  const retina = eye.parts.get('retina')!.group.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>;
  const baseColor = retina.material.color.clone();
  const baseOpacity = lens.material.userData.baseOpacity as number;
  try {
    store.getState().setClip({ enabled: false });
    engine.setState(store.getState());
    expect(retina.material.color.r).toBeLessThan(baseColor.r * 0.1);
    expect(lens.material.opacity).toBeLessThan(baseOpacity);

    store.getState().setExplode(0.6);
    engine.setState(store.getState());
    expect(retina.material.color).toEqual(baseColor);
    expect(lens.material.opacity).toBe(baseOpacity);

    store.getState().setExplode(0);
    engine.setState(store.getState());
    expect(retina.material.color.r).toBeCloseTo(baseColor.r * 0.018);
    store.getState().setClip({ enabled: true });
    engine.setState(store.getState());
    expect(retina.material.color).toEqual(baseColor);
    expect(lens.material.opacity).toBe(baseOpacity);
  } finally {
    eye.dispose();
  }
});

function pointerFixture() {
  const raycaster = new THREE.Raycaster(); raycaster.params.Line.threshold = 0.008;
  const eye = buildEye(), store = createEyeStore();
  const camera = new THREE.PerspectiveCamera(38, 1.5, 0.02, 50);
  camera.position.set(0, 0, 4); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  eye.root.traverse(object => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if ('color' in material) material.userData.baseColor = material.color.clone();
      }
    }
  });
  const engine = Object.assign(Object.create(EyeEngine.prototype), {
    eye, state: store.getState(), camera, canvas: { style: {}, setAttribute: vi.fn(), getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 400 }) },
    rig: { cancel: vi.fn(), controls: { enabled: true } }, labels: new Map(), caps: new Map(), section: new SectionTool(), rays: new THREE.Group(), neural: new THREE.Group(),
    pointer: new THREE.Vector2(), pointerDown: new THREE.Vector2(Infinity, Infinity), raycaster,
    pointerPosition: null, pointerActive: false, hoveredId: null, posteriorScale: 1, setView: vi.fn(), invalidate: vi.fn(),
  }) as EyeEngine;
  const internal = engine as unknown as {
    pointerPosition: THREE.Vector2 | null; pointerActive: boolean; hoveredId: string | null;
    updateHover: () => void; updateSections: () => void;
  };
  const sync = () => { engine.setState(store.getState()); internal.updateSections(); internal.updateHover(); };
  const pointAt = (point: THREE.Vector3) => {
    const projected = point.clone().project(camera);
    internal.pointerPosition = new THREE.Vector2((projected.x + 1) * 300, (1 - projected.y) * 200);
    internal.updateHover();
  };
  return { eye, store, engine, internal, camera, sync, pointAt };
}

it('updates optical input immediately and restores anterior and posterior geometry when the optical view closes', () => {
  const { eye, store, engine, sync } = pointerFixture();
  const geometry = (id: 'iris' | 'lens' | 'retina') => (eye.parts.get(id)!.group.children[0] as THREE.Mesh).geometry.getAttribute('position');
  const snapshot = () => ['iris', 'lens', 'retina'].map(id => Array.from(geometry(id as 'iris' | 'lens' | 'retina').array));
  const initial = snapshot();
  try {
    store.setState({ mode: 'optics' }); sync();
    const normal = snapshot();
    store.setState({ opticsInput: { ...opticsInputForPreset('myopia'), pupil: 'small', accommodation: 1 } }); sync();
    const adjusted = snapshot();
    expect(adjusted[0]).not.toEqual(normal[0]);
    expect(adjusted[1]).not.toEqual(normal[1]);
    expect(adjusted[2]).not.toEqual(normal[2]);
    store.setState({ lang: 'en' }); sync();
    expect(snapshot()).toEqual(adjusted);
    store.setState({ mode: 'explore', showOptics: false }); sync();
    expect(snapshot()).toEqual(initial);
    store.setState({ showOptics: true }); sync();
    expect(snapshot()).toEqual(adjusted);
    store.setState({ showOptics: false }); sync();
    expect(snapshot()).toEqual(initial);
    expect((engine as unknown as { rays: THREE.Group }).rays.visible).toBe(false);
  } finally { eye.dispose(); }
});

it('picks only inside the current open pupil instead of using the old fixed aperture', () => {
  const { eye, store, internal, sync, pointAt } = pointerFixture();
  try {
    store.setState(s => ({ mode: 'optics', clip: { ...s.clip, enabled: false },
      layers: Object.fromEntries(Object.keys(s.layers).map(id => [id, id === 'pupil' ? 'on' : 'off'])) as typeof s.layers }));
    for (const [pupil, point, expected] of [
      ['large', 0.24, 'pupil'], ['small', 0.20, null], ['small', 0.10, 'pupil'], ['medium', 0.20, 'pupil'],
    ] as const) {
      store.setState({ opticsInput: { ...opticsInputForPreset('normal'), pupil } }); sync();
      pointAt(new THREE.Vector3(point, 0, 0.677));
      expect(internal.hoveredId).toBe(expected);
    }
  } finally { eye.dispose(); }
});

it('draws shared optical paths, clipped rays and visible retinal intersections without solid light behind the retina', () => {
  const { eye, store, engine, sync } = pointerFixture();
  const rays = (engine as unknown as { rays: THREE.Group }).rays;
  try {
    for (const objectDistance of ['far', 'mid', 'near'] as const) {
      const input = { ...opticsInputForPreset('normal'), pupil: 'small' as const, objectDistance };
      store.setState({ mode: 'optics', opticsInput: input }); sync();
      const result = traceOptics(input);
      const lines = rays.children.filter(child => child.name === 'optical-ray') as THREE.Line[];
      expect(lines).toHaveLength(result.rays.length);
      const blocked = lines[result.rays.findIndex(ray => ray.blocked)] as THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
      const transmitted = lines[result.rays.findIndex(ray => !ray.blocked)] as THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
      expect(blocked.material.color.equals(transmitted.material.color)).toBe(false);
      lines.forEach((line, i) => {
        const position = line.geometry.getAttribute('position');
        expect(position.getZ(position.count - 1)).toBeCloseTo(result.rays[i].blocked ? result.pupilZ : result.retinaZ, 6);
        expect(Array.from(position.array).every(Number.isFinite)).toBe(true);
        for (let j = 0; j < position.count; j++) expect(position.getZ(j)).toBeGreaterThanOrEqual(result.retinaZ - 1e-6);
      });
      const intersections = rays.children.filter(child => child.name === 'retinal-intersection');
      expect(intersections).toHaveLength(result.validRayCount);
      intersections.forEach((point, i) => {
        expect(point.position.toArray()).toEqual([result.retinalIntersections[i][1], result.retinalIntersections[i][0], result.retinaZ]);
      });
      const extensions = rays.children.filter(child => child.name === 'optical-extension') as THREE.Line[];
      expect(extensions).toHaveLength(result.extensions.length);
      if (objectDistance === 'mid') expect(extensions.length).toBeGreaterThan(0);
      for (const line of extensions) {
        expect(line.material).toBeInstanceOf(THREE.LineDashedMaterial);
        const position = line.geometry.getAttribute('position');
        expect(position.getZ(position.count - 1)).toBeGreaterThanOrEqual(result.retinaZ - 0.550001);
      }
    }
  } finally { eye.dispose(); }
});

it('restores the optical workspace after visiting tour presets without leaving its geometry in the tour', () => {
  const { eye, store, sync } = pointerFixture();
  const shape = () => ['iris', 'lens', 'retina'].map(id => Array.from((eye.parts.get(id as 'iris')!.group.children[0] as THREE.Mesh).geometry.getAttribute('position').array));
  try {
    store.getState().setMode('optics');
    store.getState().setOpticsExperiment('free');
    store.getState().setOpticsInput({ axialIncrement: 0.6, accommodation: 0.8, pupil: 'large' }); sync();
    const saved = shape();
    store.getState().startLesson('myopia'); store.getState().goToStep(1); sync();
    expect(eye.parts.get('pupil')!.group.userData.hitRadius).toBe(0.215);
    expect(shape()).not.toEqual(saved);
    store.getState().setMode('optics'); sync();
    expect(shape()).toEqual(saved);
    store.getState().setMode('tour'); sync();
    expect(eye.parts.get('pupil')!.group.userData.hitRadius).toBe(0.215);
  } finally { eye.dispose(); }
});

it('fits the full optical teaching range on square and narrow stages without moving the camera during parameter edits', () => {
  const { eye, store, engine, camera, sync } = pointerFixture();
  const document = new EventTarget();
  const canvas = Object.assign(new EventTarget(), { style: {}, setAttribute() {}, clientWidth: 390, clientHeight: 390,
    ownerDocument: document, getRootNode: () => document });
  const animator = new Animator(); animator.reducedMotion = true;
  const rig = new CameraRig(camera, canvas as unknown as HTMLElement, animator);
  Object.assign(engine, { canvas, rig, setView: EyeEngine.prototype.setView });
  try {
    store.setState({ mode: 'optics', opticsInput: opticsInputForPreset('myopia') }); sync();
    const bounds = new THREE.Box3().setFromObject(eye.root);
    const samples = [new THREE.Vector3(0, 0, 4), new THREE.Vector3(0, 0, 2.5), new THREE.Vector3(0, 0, -1.77)];
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) samples.push(new THREE.Vector3(x, y, z));
    for (const [width, height, area] of [
      [600, 600, { x: 0, y: 0, width: 600, height: 600 }],
      [390, 390, { x: 8, y: 110, width: 374, height: 240 }],
      [390, 228, { x: 8, y: 40, width: 240, height: 176 }],
    ] as const) {
      rig.setViewport(width, height, area);
      for (const view of ['side', 'oblique', 'front', 'back'] as const) {
        store.setState({ view }); sync(); engine.resetCamera(); rig.controls.update(); camera.updateMatrixWorld(true);
        for (const sample of samples) {
          const point = sample.clone().project(camera);
          const px = (point.x + 1) * width / 2, py = (1 - point.y) * height / 2;
          expect(px, `${view} ${width}×${height}`).toBeGreaterThan(area.x);
          expect(px, `${view} ${width}×${height}`).toBeLessThan(area.x + area.width);
          expect(py, `${view} ${width}×${height}`).toBeGreaterThan(area.y);
          expect(py, `${view} ${width}×${height}`).toBeLessThan(area.y + area.height);
        }
      }
    }
    rig.orbit(0.2, 0.1);
    const pose = rig.capture();
    store.setState({ opticsInput: { ...store.getState().opticsInput, objectDistance: 'mid' } }); sync();
    expect(rig.capture()).toEqual(pose);
  } finally { rig.controls.dispose(); eye.dispose(); }
});

it('shows an external lens only when the shared trace produces a nonzero correction', () => {
  const { eye, store, engine, sync } = pointerFixture();
  const rays = (engine as unknown as { rays: THREE.Group }).rays;
  const lensCount = () => rays.children.filter(child => child instanceof THREE.Mesh && child.geometry instanceof THREE.TorusGeometry).length;
  try {
    store.setState({ mode: 'optics', opticsInput: { ...opticsInputForPreset('normal'), externalLens: 'myopia' } }); sync();
    expect(lensCount()).toBe(0);
    store.setState({ opticsInput: opticsInputForPreset('corrected') }); sync();
    expect(lensCount()).toBe(1);
    store.setState({ opticsInput: opticsInputForPreset('myopia') }); sync();
    expect(lensCount()).toBe(0);
  } finally { eye.dispose(); }
});

it('omits non-real or out-of-view focus markers and releases old ray resources on updates', () => {
  const { eye, store, engine, sync } = pointerFixture();
  const internal = engine as unknown as { rays: THREE.Group; updateRays(result: TraceOpticsResult): void };
  try {
    store.setState({ mode: 'optics' }); sync();
    const initial = internal.rays.children.find(child => child.name === 'optical-ray') as THREE.Line;
    const disposed = vi.fn(); initial.geometry.addEventListener('dispose', disposed);
    const normal = traceOptics(opticsInputForPreset('normal'));
    for (const [focusKind, focusZ] of [['parallel', null], ['virtual', 3], ['real', -1e8]] as const) {
      internal.updateRays({ ...normal, focusKind, focusZ });
      expect(internal.rays.getObjectByName('optical-focus')).toBeUndefined();
      internal.rays.traverse(object => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) expect(Array.from(object.geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true);
      });
    }
    expect(disposed).toHaveBeenCalledOnce();
    internal.updateRays({ ...normal, rays: [], extensions: [], retinalIntersections: [], validRayCount: 0, retinalSpread: null, focusKind: 'parallel', focusZ: null });
    expect(internal.rays.children.filter(child => child.name === 'retinal-intersection')).toHaveLength(0);
  } finally { eye.dispose(); }
});

it.each(['fovea', 'lens'] as const)('keeps the real %s visible when a corner compass and panel change the usable rectangle', id => {
  const { eye, store, engine, camera, sync } = pointerFixture();
  let width = 390, height = 228, overlaysVisible = true;
  const rect = (left: number, top: number, boxWidth: number, boxHeight: number) => ({ left, top, width: boxWidth, height: boxHeight, right: left + boxWidth, bottom: top + boxHeight });
  const compass = { getBoundingClientRect: () => rect(width - 116, 26, 120, 95) };
  const overlays = [
    { getBoundingClientRect: () => rect(28, 40, 170, 18) },
    { getBoundingClientRect: () => rect(10, height - 5, width, 16) },
    compass,
  ];
  const document = new EventTarget();
  const canvas = Object.assign(new EventTarget(), { style: {}, setAttribute() {}, clientWidth: width, clientHeight: height,
    ownerDocument: document, getRootNode: () => document, getBoundingClientRect: () => rect(10, 20, width, height) });
  const host = { getBoundingClientRect: () => rect(10, 20, width, height), parentElement: { querySelectorAll: () => overlaysVisible ? overlays : [] } };
  const animator = new Animator(); animator.reducedMotion = true;
  const rig = new CameraRig(camera, canvas as unknown as HTMLElement, animator);
  Object.assign(engine, { canvas, host, rig, compass, width, height });
  const internal = engine as unknown as { measureViewport(): void; usableRect: { x: number; y: number; width: number; height: number } };
  const assertVisible = () => {
    camera.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(eye.parts.get(id)!.group), usable = internal.usableRect;
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      const point = new THREE.Vector3(x, y, z).project(camera);
      const px = (point.x + 1) * width / 2, py = (1 - point.y) * height / 2;
      expect(px).toBeGreaterThan(usable.x); expect(px).toBeLessThan(usable.x + usable.width);
      expect(py).toBeGreaterThan(usable.y); expect(py).toBeLessThan(usable.y + usable.height);
    }
  };
  try {
    store.getState().select(id, true); store.getState().toggleIsolate(); sync();
    internal.measureViewport();
    expect(internal.usableRect).toEqual({ x: 8, y: 46, width: 248, height: 149 });
    engine.focus(id); assertVisible();
    const target = rig.controls.target.clone(), direction = camera.position.clone().sub(target).normalize();
    width = 320; height = 420; Object.assign(engine, { width, height });
    internal.measureViewport(); assertVisible();
    expect(internal.usableRect).toEqual({ x: 8, y: 109, width: 304, height: 278 });
    expect(rig.controls.target.distanceTo(target)).toBeLessThan(1e-10);
    expect(camera.position.clone().sub(target).normalize().dot(direction)).toBeCloseTo(1);
    overlaysVisible = false; internal.measureViewport(); assertVisible();
    expect(camera.view?.offsetX ?? 0).toBeCloseTo(0);
    expect(camera.view?.offsetY ?? 0).toBeCloseTo(0);
  } finally { rig.controls.dispose(); eye.dispose(); }
});

it('makes a selected tissue clearly distinct and restores its original appearance on deselection', () => {
  const { eye, store, engine, sync } = pointerFixture();
  const mesh = eye.parts.get('iris')!.group.getObjectByName('iris-stroma') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>;
  const base = mesh.material.color.clone(), texture = mesh.material.map;
  try {
    store.getState().select('iris', true); sync();
    const color = mesh.material.color;
    expect(Math.hypot(color.r - base.r, color.g - base.g, color.b - base.b)).toBeGreaterThan(0.25);
    expect(mesh.material.emissiveIntensity).toBeGreaterThan(0.2);
    expect(mesh.material.map).toBe(texture);
    store.getState().select('lens', true); sync();
    expect(mesh.material.color).toEqual(base);
    expect(mesh.material.emissiveIntensity).toBe(0);
    expect(engine.canvas.style.cursor).toBe('grab');
  } finally { eye.dispose(); }
});

it('drags a section frame through the shared clip state and releases camera controls on cancellation', () => {
  const { eye, store, engine, camera, sync } = pointerFixture();
  camera.position.z = 6; camera.updateMatrixWorld();
  const capture = new Set<number>(), gestures: string[] = [];
  Object.assign(engine.canvas, {
    setPointerCapture: (id: number) => capture.add(id), hasPointerCapture: (id: number) => capture.has(id),
    releasePointerCapture: (id: number) => capture.delete(id),
  });
  Object.assign(engine, { sectionCallbacks: {
    begin: () => gestures.push('begin'),
    change: (offset: number) => { store.getState().setClip({ offset }); sync(); },
    end: () => gestures.push('end'),
  } });
  const internal = engine as unknown as {
    beginSectionDrag(event: PointerEvent): boolean; moveSectionDrag(event: PointerEvent): boolean;
    endSectionDrag(event?: PointerEvent): boolean; rig: CameraRig;
  };
  const eventAt = (x: number, id = 7) => {
    const point = new THREE.Vector3(x, 1.24, 1.24).project(camera);
    return { pointerId: id, button: 0, clientX: (point.x + 1) * 300, clientY: (1 - point.y) * 200,
      preventDefault() {}, stopImmediatePropagation() {} } as PointerEvent;
  };
  try {
    sync();
    expect(internal.beginSectionDrag(eventAt(0))).toBe(true);
    expect(capture.has(7)).toBe(true);
    expect(internal.rig.controls.enabled).toBe(false);
    expect(internal.moveSectionDrag(eventAt(0.4, 8))).toBe(false);
    expect(store.getState().clip.offset).toBe(0);
    expect(internal.moveSectionDrag(eventAt(0.4))).toBe(true);
    expect(store.getState().clip.offset).toBeCloseTo(0.4);
    internal.moveSectionDrag(eventAt(0.6));
    expect(gestures).toEqual(['begin']);
    expect(internal.endSectionDrag()).toBe(true);
    expect(internal.endSectionDrag()).toBe(false);
    expect(internal.rig.controls.enabled).toBe(true);
    expect(capture.size).toBe(0);
    expect(gestures).toEqual(['begin', 'end']);
    expect(store.getState().clip.offset).toBeCloseTo(0.6);
  } finally { eye.dispose(); }
});

it('ends a captured section gesture when leaving its scene and hides the guide in quizzes', () => {
  const { eye, store, engine, camera, sync } = pointerFixture();
  const ended: boolean[] = [];
  Object.assign(engine.canvas, { setPointerCapture() {}, hasPointerCapture: () => true, releasePointerCapture() {} });
  Object.assign(engine, { sectionCallbacks: { begin() {}, change() {}, end: () => ended.push(true) } });
  const internal = engine as unknown as { section: SectionTool; beginSectionDrag(event: PointerEvent): boolean; rig: CameraRig };
  const point = new THREE.Vector3(0, 1.24, 0).project(camera);
  const event = { pointerId: 2, button: 0, clientX: (point.x + 1) * 300, clientY: (1 - point.y) * 200,
    preventDefault() {}, stopImmediatePropagation() {} } as PointerEvent;
  try {
    sync();
    expect(internal.section.guide.visible).toBe(true);
    expect(internal.beginSectionDrag(event)).toBe(true);
    store.getState().setMode('quiz'); sync();
    expect(ended).toEqual([true]);
    expect(internal.rig.controls.enabled).toBe(true);
    expect(internal.section.guide.visible).toBe(false);
    expect(internal.beginSectionDrag(event)).toBe(false);
  } finally { eye.dispose(); }
});

it('shows chambers as boundaries and restores tissue appearance and positions after combined operations', () => {
  const { eye, store, sync } = pointerFixture();
  const snapshot = () => [...eye.parts.values()].map(part => ({
    id: part.id, position: part.group.position.toArray(),
    materials: part.group.children.filter(object => object instanceof THREE.Mesh).map(object => {
      const material = (object as THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>).material;
      return { color: material.color.toArray(), opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite };
    }),
  }));
  try {
    store.setState({ presetId: 'chambers' }); sync();
    for (const id of ['anterior-chamber', 'posterior-chamber', 'vitreous'] as const) {
      const part = eye.parts.get(id)!;
      const mesh = part.group.children.find(child => child instanceof THREE.Mesh) as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
      const boundary = part.group.children.find(child => child instanceof THREE.LineSegments) as THREE.LineSegments;
      expect(mesh.material.opacity).toBe(0);
      expect(boundary?.geometry.getAttribute('position').count).toBeGreaterThan(6);
    }
    store.setState({ presetId: 'wall-cut' }); sync();
    const before = snapshot();
    store.getState().setExplode(0.7); store.getState().select('lens', true); store.getState().toggleIsolate(); sync();
    store.getState().setClip({ enabled: false }); sync();
    store.getState().toggleIsolate(); store.getState().setExplode(0); store.getState().setClip({ enabled: true });
    store.setState({ selectedId: null, presetId: 'wall-cut' }); sync();
    expect(snapshot()).toEqual(before);
  } finally { eye.dispose(); }
});

it('recognizes the visible chamber boundary as a selectable surface', () => {
  const { eye, store, engine, camera, sync } = pointerFixture();
  try {
    store.getState().select('anterior-chamber', true); store.getState().toggleIsolate();
    camera.position.set(4, 0, 0.8); camera.lookAt(0, 0, 0.8); camera.updateMatrixWorld();
    sync();
    expect(engine.isStructureVisible('anterior-chamber')).toBe(true);
  } finally { eye.dispose(); }
});

it('offers hover feedback only for selectable surfaces and preserves the selected appearance on pointer leave', () => {
  const { eye, store, engine, internal, sync, pointAt } = pointerFixture();
  const mesh = eye.parts.get('iris')!.group.getObjectByName('iris-stroma') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>;
  try {
    store.setState(s => ({ layers: Object.fromEntries(Object.keys(s.layers).map(id => [id, id === 'iris' ? 'on' : 'off'])) as typeof s.layers }));
    store.getState().setClip({ enabled: false }); sync();
    pointAt(new THREE.Vector3(0.4, 0, 0.666));
    expect(engine.canvas.style.cursor).toBe('pointer');
    expect(internal.hoveredId).toBe('iris');
    expect(store.getState().selectedId).toBeNull();
    const hoverIntensity = mesh.material.emissiveIntensity;
    expect(hoverIntensity).toBeGreaterThan(0);
    store.getState().select('iris', true); sync();
    expect(mesh.material.emissiveIntensity).toBeGreaterThan(hoverIntensity);
    const selected = mesh.material.color.clone();
    internal.pointerPosition = null; internal.updateHover();
    expect(engine.canvas.style.cursor).toBe('grab');
    expect(mesh.material.color).toEqual(selected);
    for (const layer of ['ghost', 'off'] as const) {
      store.setState(s => ({ layers: { ...s.layers, iris: layer } })); sync(); pointAt(new THREE.Vector3(0.4, 0, 0.666));
      expect(engine.canvas.style.cursor).toBe('grab');
      expect(internal.hoveredId).toBeNull();
      expect(mesh.material.emissiveIntensity).toBe(0);
    }
    store.setState(s => ({ layers: { ...s.layers, iris: 'on' } }));
    store.getState().setClip({ enabled: true, axis: 'coronal', offset: -1 }); sync();
    expect(engine.canvas.style.cursor).toBe('grab');
    expect(internal.hoveredId).toBeNull();
  } finally { eye.dispose(); }
});

it('clears hover during dragging, camera changes and quizzes without changing quiz answers', () => {
  const { eye, store, engine, internal, camera, sync, pointAt } = pointerFixture();
  try {
    store.getState().select('iris', true); store.getState().toggleIsolate(); store.getState().setClip({ enabled: false }); sync();
    pointAt(new THREE.Vector3(0.4, 0, 0.666));
    expect(engine.canvas.style.cursor).toBe('pointer');
    internal.pointerActive = true; internal.updateHover();
    expect(engine.canvas.style.cursor).toBe('grabbing');
    expect(internal.hoveredId).toBeNull();
    internal.pointerActive = false; camera.lookAt(0, 0, 10); camera.updateMatrixWorld(); internal.updateHover();
    expect(engine.canvas.style.cursor).toBe('grab');
    store.getState().setMode('quiz'); sync();
    camera.lookAt(0, 0, 0); camera.updateMatrixWorld(); pointAt(new THREE.Vector3(0.4, 0, 0.666));
    expect(engine.canvas.style.cursor).toBe('grab');
    expect(internal.hoveredId).toBeNull();
    expect(store.getState().quizRevealed).toBe(false);
  } finally { eye.dispose(); }
});


function comparisonFixture(width = 480, height = 600) {
  const fixture = pointerFixture();
  const document = new EventTarget();
  const canvas = Object.assign(new EventTarget(), { style: {}, setAttribute() {}, clientWidth: width, clientHeight: height,
    ownerDocument: document, getRootNode: () => document, setPointerCapture() {}, releasePointerCapture() {} });
  const animator = new Animator(); animator.reducedMotion = true;
  const rig = new CameraRig(fixture.camera, canvas as unknown as HTMLElement, animator);
  const usableRect = { x: 8, y: 30, width: width - 16, height: height - 38 };
  rig.setViewport(width, height, usableRect);
  Object.assign(fixture.engine, { canvas, rig, animator, width, height, usableRect });
  const internal = fixture.engine as unknown as { notifyCamera(): void; neural: THREE.Group; rays: THREE.Group };
  const notify = () => internal.notifyCamera?.();
  rig.controls.addEventListener('change', notify);
  return { ...fixture, rig, animator, internal, notify, cleanup: () => { rig.controls.dispose(); fixture.eye.dispose(); } };
}

it('synchronizes comparison target, direction and relative zoom without recursive notifications across different viewports', () => {
  const current = comparisonFixture(480, 600), reference = comparisonFixture(390, 400);
  const updates: CameraSnapshot[] = [], echoes: CameraSnapshot[] = [];
  try {
    expect(typeof current.engine.setCameraListener).toBe('function');
    current.engine.setCameraListener(snapshot => { updates.push(snapshot); reference.engine.syncCamera(snapshot); });
    reference.engine.setCameraListener(snapshot => { echoes.push(snapshot); current.engine.syncCamera(snapshot); });
    current.rig.focus(new THREE.Vector3(0.2, -0.1, -0.3), 0.5);
    current.rig.controls.update(); current.notify();
    current.engine.zoom(-0.25); current.rig.controls.update(); current.notify();
    const currentPose = current.engine.captureCamera(), referencePose = reference.engine.captureCamera();
    expect(updates.length).toBeGreaterThan(0);
    expect(echoes).toHaveLength(0);
    expect(referencePose.target).toEqual(currentPose.target);
    expect(referencePose.zoom).toBe(currentPose.zoom);
    expect(reference.camera.aspect).toBeCloseTo(390 / 400);
    const direction = current.camera.position.clone().sub(current.rig.controls.target).normalize();
    expect(reference.camera.position.clone().sub(reference.rig.controls.target).normalize().dot(direction)).toBeCloseTo(1);
    expect(reference.camera.position.distanceTo(reference.rig.controls.target) / reference.rig.distanceFor(1))
      .toBeCloseTo(current.camera.position.distanceTo(current.rig.controls.target) / current.rig.distanceFor(1));
    const count = updates.length;
    current.notify(); reference.notify();
    expect(updates).toHaveLength(count); expect(echoes).toHaveLength(0);
    current.engine.setCameraListener(null);
    current.rig.orbit(0.1, 0); current.rig.controls.update(); current.notify();
    expect(updates).toHaveLength(count);
  } finally { current.cleanup(); reference.cleanup(); }
});

it('keeps camera and optical ray resources stable while stepping through paused signal conversion', () => {
  const { eye, store, engine, rig, animator, internal, sync, cleanup } = comparisonFixture();
  try {
    store.setState({ mode: 'optics', opticsInput: opticsInputForPreset('normal') }); sync();
    rig.focus(new THREE.Vector3(0, 0, -0.2), 1); rig.orbit(0.2, 0.1);
    const pose = engine.captureCamera();
    const opticalRay = internal.rays.getObjectByName('optical-ray');
    for (const step of [0, 1, 2]) {
      store.setState({ physiology: { kind: 'signal', step, playing: false, returnInput: store.getState().opticsInput, returnExperiment: 'baseline', returnPreset: 'normal', returnShowOptics: false } }); sync();
      expect(engine.captureCamera()).toEqual(pose);
      expect(animator.active).toBe(false);
      expect(internal.rays.getObjectByName('optical-ray')).toBe(opticalRay);
      expect(internal.neural.getObjectByName('retinal-conversion') !== undefined).toBe(step >= 1);
      expect(internal.neural.getObjectByName('optic-nerve-signal') !== undefined).toBe(step === 2);
    }
    const conversion = internal.neural.getObjectByName('retinal-conversion') as THREE.Mesh;
    expect(conversion.geometry).toBeInstanceOf(THREE.OctahedronGeometry);
    const neural = internal.neural.getObjectByName('optic-nerve-signal') as THREE.Line<THREE.BufferGeometry, THREE.LineDashedMaterial>;
    expect(neural.material).toBeInstanceOf(THREE.LineDashedMaterial);
    expect(neural.material.color.equals((opticalRay as THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>).material.color)).toBe(false);
    const position = neural.geometry.getAttribute('position');
    expect(position.getZ(position.count - 1)).toBeCloseTo(-1.62 / 0.914, 6);
    const disc = internal.neural.getObjectByName('optic-disc-signal')!;
    expect(disc.position.x).toBeCloseTo(eye.parts.get('optic-disc')!.anchor.x);
    for (const child of internal.rays.children.filter(child => child.name === 'optical-ray') as THREE.Line[]) {
      const vertices = child.geometry.getAttribute('position');
      for (let i = 0; i < vertices.count; i++) expect(vertices.getZ(i)).toBeGreaterThanOrEqual(-1.000001);
    }
  } finally { cleanup(); }
});

it('follows stretched and transformed anatomy and releases signal resources on replay, mode exit and reset', () => {
  const { eye, store, engine, internal, sync, cleanup } = comparisonFixture();
  try {
    eye.root.position.set(0.4, -0.2, 0.1); eye.root.rotation.y = 0.25;
    store.setState({ mode: 'optics', opticsInput: opticsInputForPreset('myopia'), explode: 0.3,
      physiology: { kind: 'signal', step: 2, playing: false, returnInput: opticsInputForPreset('normal'), returnExperiment: 'baseline', returnPreset: 'normal', returnShowOptics: false } }); sync();
    const path = internal.neural.getObjectByName('optic-nerve-signal') as THREE.Line;
    expect(path).toBeDefined();
    const expectedExit = eye.parts.get('optic-nerve')!.group.localToWorld(new THREE.Vector3(0.61, 0.065, -1.62 * 1.22 / 0.914));
    const vertices = path.geometry.getAttribute('position');
    expect(new THREE.Vector3().fromBufferAttribute(vertices, vertices.count - 1).distanceTo(expectedExit)).toBeLessThan(1e-6);
    const geometryDisposed = vi.fn(), materialDisposed = vi.fn();
    path.geometry.addEventListener('dispose', geometryDisposed);
    (path.material as THREE.Material).addEventListener('dispose', materialDisposed);
    store.setState({ lang: 'en' }); sync();
    expect(internal.neural.getObjectByName('optic-nerve-signal')).toBe(path);
    expect(geometryDisposed).not.toHaveBeenCalled();
    store.setState({ physiology: { ...store.getState().physiology!, step: 0 } }); sync();
    expect(internal.neural.children).toHaveLength(0);
    expect(geometryDisposed).toHaveBeenCalledOnce(); expect(materialDisposed).toHaveBeenCalledOnce();
    store.setState({ physiology: { ...store.getState().physiology!, step: 2 } }); sync();
    expect(internal.neural.children.length).toBeGreaterThan(0);
    store.setState({ mode: 'explore', physiology: null }); sync();
    expect(internal.neural.children).toHaveLength(0);
    expect(internal.rays.visible).toBe(false);
  } finally { cleanup(); }
});


it('synchronizes real engine focus and orbit frames, settles when paused and unsubscribes on disposal', () => {
  const frames = new Map<number, FrameRequestCallback>(); let sequence = 0, time = 0;
  const documentStub = Object.assign(new EventTarget(), { createElement: () => new EngineElementStub(), createElementNS: () => new EngineElementStub() });
  const media = Object.assign(new EventTarget(), { matches: false });
  vi.stubGlobal('document', documentStub);
  vi.stubGlobal('window', Object.assign(new EventTarget(), { devicePixelRatio: 1, matchMedia: () => media }));
  vi.stubGlobal('getComputedStyle', () => ({ position: 'relative' }));
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++sequence, callback); return sequence; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  const instances: EyeEngine[] = [];
  const flush = () => {
    let count = 0;
    while (frames.size && count++ < 180) {
      const callbacks = [...frames.values()]; frames.clear(); time += 16;
      callbacks.forEach(callback => callback(time));
    }
    expect(frames.size, 'paused engines must not keep scheduling comparison frames').toBe(0);
  };
  try {
    const store = createEyeStore(); store.getState().setMode('optics'); store.getState().setPhysiology('signal');
    for (let i = 0; i < 2; i++) {
      const host = new EngineElementStub(); host.parentElement = new EngineElementStub();
      const engine = new EyeEngine(host as unknown as HTMLElement, () => {});
      Object.assign(engine, { renderLabels() {} });
      engine.setState(store.getState()); instances.push(engine);
    }
    const [current, reference] = instances; flush();
    const changes: CameraSnapshot[] = [], echoes: CameraSnapshot[] = [];
    current.setCameraListener(snapshot => { changes.push(snapshot); reference.syncCamera(snapshot); });
    reference.setCameraListener(snapshot => { echoes.push(snapshot); current.syncCamera(snapshot); });
    current.focus('lens'); flush();
    expect(changes.length).toBeGreaterThan(1);
    expect(echoes).toHaveLength(0);
    const a = current.captureCamera(), b = reference.captureCamera();
    a.position.forEach((value, index) => expect(b.position[index]).toBeCloseTo(value, 8));
    a.target.forEach((value, index) => expect(b.target[index]).toBeCloseTo(value, 8));
    const before = changes.length;
    current.canvas.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key: 'ArrowRight' })); flush();
    expect(changes.length).toBeGreaterThan(before);
    expect(echoes).toHaveLength(0);
    store.setState({ physiology: { ...store.getState().physiology!, step: 2 } }); current.setState(store.getState()); flush();
    const internal = current as unknown as { neural: THREE.Group; rig: CameraRig };
    const path = internal.neural.getObjectByName('optic-nerve-signal') as THREE.Line;
    const disposed = vi.fn(); path.geometry.addEventListener('dispose', disposed);
    current.dispose();
    expect(disposed).toHaveBeenCalledOnce();
    const last = changes.length;
    internal.rig.controls.dispatchEvent({ type: 'change' });
    current.syncCamera(b); flush();
    expect(changes).toHaveLength(last);
  } finally { instances.forEach(engine => engine.dispose()); vi.unstubAllGlobals(); }
});
