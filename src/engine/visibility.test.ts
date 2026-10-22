import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { STRUCTURE_IDS, type SceneState, type StructureId } from '../anatomy/types';
import { createEyeStore } from '../state/store';
import { buildEye, setPosteriorStretch } from './geometry';
import { visibleSurface } from './visibility';

function setup(visible: StructureId[]) {
  const eye = buildEye();
  const state: SceneState = { ...createEyeStore().getState(), clip: { enabled: false, axis: 'sagittal', offset: 0, keepSide: 'negative' } };
  state.layers = Object.fromEntries(STRUCTURE_IDS.map(id => [id, visible.includes(id) ? 'on' : 'off'])) as SceneState['layers'];
  const camera = new THREE.PerspectiveCamera(38, 1.5, 0.02, 50);
  camera.position.set(0, 0, 4);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const surface = (id: StructureId, scale = 1) => visibleSurface(eye.parts.get(id)!, eye.parts, state, camera, scale);
  return { eye, state, camera, surface };
}

describe('visible anatomy surface', () => {
  it('does not expose internal fundus labels through an intact eye', () => {
    const { eye, camera, surface } = setup([...STRUCTURE_IDS]);
    try {
      expect(surface('fovea')).toBeNull();
      camera.position.set(0, 0, -4);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld(true);
      expect(surface('fovea')).toBeNull();
    } finally { eye.dispose(); }
  });

  it('returns an actual foveal surface when anterior obstructions are removed', () => {
    const { eye, state, surface } = setup(['macula', 'fovea', 'optic-disc', 'retinal-vessels']);
    state.layers.retina = 'ghost';
    try {
      const point = surface('fovea');
      expect(point).not.toBeNull();
      expect(point!.z).toBeLessThan(-0.89);
      expect(point!.distanceTo(eye.parts.get('fovea')!.anchor)).toBeGreaterThan(0.001);
    } finally { eye.dispose(); }
  });

  it('finds a visible optic-disc surface when vessels obscure its center', () => {
    const { eye, camera } = setup([]);
    const store = createEyeStore();
    store.getState().revealStructure('optic-disc');
    try {
      const part = eye.parts.get('optic-disc')!;
      const point = visibleSurface(part, eye.parts, store.getState(), camera);
      expect(point).not.toBeNull();
      const ray = new THREE.Raycaster(camera.position, point!.clone().sub(camera.position).normalize());
      expect(ray.intersectObject(part.group, true).some(hit => hit.point.distanceTo(point!) < 1e-6)).toBe(true);
    } finally { eye.dispose(); }
  });

  it('filters hidden, ghost, isolated-away and fully clipped targets', () => {
    const { eye, state, surface } = setup(['fovea']);
    try {
      for (const layer of ['off', 'ghost'] as const) {
        state.layers.fovea = layer;
        expect(surface('fovea')).toBeNull();
      }
      state.layers.fovea = 'on';
      state.isolateId = 'lens';
      expect(surface('fovea')).toBeNull();
      state.isolateId = null;
      state.clip = { enabled: true, axis: 'coronal', offset: -1, keepSide: 'negative' };
      expect(surface('fovea')).toBeNull();
    } finally { eye.dispose(); }
  });

  it('checks a selectable ghost or hidden target without changing its scene or visibility', () => {
    const { eye, camera } = setup([]);
    const state = createEyeStore().getState();
    const part = eye.parts.get('cornea')!;
    camera.position.set(3.5, 1.4, 3.5);
    camera.lookAt(0, 0, -0.08);
    try {
      const layers = { ...state.layers };
      expect(visibleSurface(part, eye.parts, state, camera)).toBeNull();
      expect(visibleSurface(part, eye.parts, state, camera, 1, true)).not.toBeNull();
      expect(state.layers).toEqual(layers);
      state.layers = { ...state.layers, cornea: 'off' };
      part.group.visible = false;
      expect(visibleSurface(part, eye.parts, state, camera, 1, true)).not.toBeNull();
      expect(state.layers.cornea).toBe('off');
      expect(part.group.visible).toBe(false);
      eye.root.visible = false;
      expect(visibleSurface(part, eye.parts, state, camera, 1, true)).toBeNull();
    } finally { eye.dispose(); }
  });

  it('keeps candidate selection occluded unless isolation follows that target', () => {
    const { eye, state, camera } = setup(['cornea']);
    const part = eye.parts.get('lens')!;
    part.group.visible = false;
    try {
      expect(visibleSurface(part, eye.parts, state, camera, 1, true)).toBeNull();
      state.isolateId = 'cornea';
      expect(visibleSurface(part, eye.parts, state, camera, 1, true)).not.toBeNull();
      expect(state.isolateId).toBe('cornea');
      expect(state.layers.lens).toBe('off');
      expect(part.group.visible).toBe(false);
      state.clip = { enabled: true, axis: 'coronal', offset: -1, keepSide: 'negative' };
      expect(visibleSurface(part, eye.parts, state, camera, 1, true)).toBeNull();
    } finally { eye.dispose(); }
  });

  it('uses real front surface points and respects translucent on tissues as occluders', () => {
    const { eye, state, camera, surface } = setup(['cornea', 'lens']);
    try {
      const point = surface('cornea')!;
      const ray = new THREE.Raycaster(camera.position, point.clone().sub(camera.position).normalize());
      const hits = ray.intersectObject(eye.parts.get('cornea')!.group, true);
      expect(hits.some(hit => hit.point.distanceTo(point) < 1e-6)).toBe(true);
      expect(surface('lens')).toBeNull();
      state.layers.cornea = 'ghost';
      expect(surface('lens')).not.toBeNull();
      eye.parts.get('lens')!.group.visible = false;
      expect(surface('lens')).toBeNull();
    } finally { eye.dispose(); }
  });

  it('keeps the pupil as an opening while filtering clipping, occlusion and the frustum', () => {
    const { eye, state, camera, surface } = setup(['pupil', 'iris']);
    try {
      expect(surface('pupil')).toEqual(eye.parts.get('pupil')!.anchor);
      state.layers.cornea = 'on';
      expect(surface('pupil')).toBeNull();
      state.layers.cornea = 'ghost';
      state.clip = { enabled: true, axis: 'sagittal', offset: -0.1, keepSide: 'negative' };
      expect(surface('pupil')).toBeNull();
      state.clip.enabled = false;
      camera.lookAt(0, 0, 10);
      camera.updateMatrixWorld(true);
      expect(surface('pupil')).toBeNull();
    } finally { eye.dispose(); }
  });

  it('samples a small actual surface when a fine structure has no surface at its anchor', () => {
    const { eye, state, surface } = setup(['zonules']);
    state.isolateId = 'zonules';
    eye.parts.get('zonules')!.anchor.set(0, 0, 0.47);
    try {
      const point = surface('zonules');
      expect(point).not.toBeNull();
      expect(Math.hypot(point!.x, point!.y)).toBeGreaterThan(0.4);
    } finally { eye.dispose(); }
  });

  it('tracks a stretched and exploded posterior surface', () => {
    const { eye, surface } = setup(['fovea']);
    try {
      const before = surface('fovea')!;
      const part = eye.parts.get('fovea')!;
      setPosteriorStretch(eye.root, 1.2);
      part.group.position.copy(part.explode).multiplyScalar(0.5);
      eye.root.updateMatrixWorld(true);
      const after = surface('fovea', 1.2)!;
      expect(after.z).toBeCloseTo(before.z * 1.2 + part.group.position.z, 3);
    } finally { eye.dispose(); }
  });

  it('keeps a static muscle label on the same surface when the globe lengthens', () => {
    const { eye, surface } = setup(['superior-rectus']);
    try {
      const before = surface('superior-rectus');
      expect(before).not.toBeNull();
      setPosteriorStretch(eye.root, 1.4);
      const after = surface('superior-rectus', 1.4);
      expect(after).not.toBeNull();
      expect(after!.distanceTo(before!)).toBeLessThan(1e-8);
    } finally { eye.dispose(); }
  });
});
