import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createEyeStore } from '../state/store';
import { EyeEngine } from './EyeEngine';
import { buildEye } from './geometry';
import { SectionTool } from './section';

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
    labels: new Map(), section: new SectionTool(), rays: new THREE.Group(),
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
