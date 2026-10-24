import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FLAT_LAYOUT_START, type StructureId } from '../anatomy/types';
import { createExplosionLayout } from './explosion-layout';
import { buildEye } from './geometry';

function translatedBounds(bounds: ReadonlyMap<StructureId, THREE.Box3>, explode: number) {
  const layout = createExplosionLayout(bounds, explode);
  return new Map([...bounds].map(([id, box]) => [id, box.clone().translate(layout.get(id)!)]));
}

describe('flat anatomical layout', () => {
  it('separates every actual structure in the front plane without changing its dimensions', () => {
    const eye = buildEye();
    try {
      const bounds = new Map([...eye.parts].map(([id, part]) => [id, new THREE.Box3().setFromObject(part.group)]));
      const originals = new Map([...bounds].map(([id, box]) => [id, box.clone()]));
      for (const explode of [FLAT_LAYOUT_START, 0.8, 1]) {
        const placed = translatedBounds(bounds, explode);
        const boxes = [...placed.values()];
        const total = new THREE.Box3();
        for (const [id, box] of placed) {
          total.union(box);
          expect(box.getSize(new THREE.Vector3()).distanceTo(bounds.get(id)!.getSize(new THREE.Vector3())), id).toBeLessThan(1e-10);
          expect(box.getCenter(new THREE.Vector3()).z, id).toBeCloseTo(0, 10);
          expect([...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite), id).toBe(true);
        }
        expect(total.getCenter(new THREE.Vector3()).x).toBeCloseTo(0, 10);
        expect(total.getCenter(new THREE.Vector3()).y).toBeCloseTo(0, 10);
        for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) {
          const horizontalGap = Math.max(boxes[a].min.x - boxes[b].max.x, boxes[b].min.x - boxes[a].max.x);
          const verticalGap = Math.max(boxes[a].min.y - boxes[b].max.y, boxes[b].min.y - boxes[a].max.y);
          expect(Math.max(horizontalGap, verticalGap)).toBeGreaterThanOrEqual(0.2 - 1e-10);
        }
        for (const aspect of [1.5, 320 / 600]) {
          const camera = new THREE.PerspectiveCamera(38, aspect, 0.01, 500);
          const sphere = total.getBoundingSphere(new THREE.Sphere());
          const tangent = Math.tan(THREE.MathUtils.degToRad(38) / 2);
          const distance = sphere.radius / Math.sin(Math.atan(tangent * Math.min(1, aspect))) * 1.08;
          camera.position.copy(new THREE.Vector3(0, 0.015, 1).normalize().multiplyScalar(distance).add(sphere.center));
          camera.lookAt(sphere.center); camera.updateMatrixWorld();
          const projected = boxes.map(box => {
            const rectangle = new THREE.Box2();
            for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
              const point = new THREE.Vector3(x, y, z).project(camera);
              rectangle.expandByPoint(new THREE.Vector2(point.x, point.y));
            }
            return rectangle;
          });
          for (let a = 0; a < projected.length; a++) for (let b = a + 1; b < projected.length; b++) expect(projected[a].intersectsBox(projected[b]), `${aspect}/${explode}/${[...bounds.keys()][a]}/${[...bounds.keys()][b]}`).toBe(false);
        }
      }
      for (const [id, box] of bounds) expect(box.equals(originals.get(id)!)).toBe(true);
    } finally { eye.dispose(); }
  });

  it('keeps row and column order while increasing gaps between planar structures from 0.2 to 0.8', () => {
    const bounds = new Map<StructureId, THREE.Box3>(['cornea', 'iris', 'lens', 'sclera'].map(id => [id as StructureId, new THREE.Box3(new THREE.Vector3(-1, -1, 0.5), new THREE.Vector3(1, 1, 0.5))]));
    const compact = translatedBounds(bounds, FLAT_LAYOUT_START);
    const expanded = translatedBounds(bounds, 1);
    const centers = (boxes: Map<StructureId, THREE.Box3>) => [...boxes.values()].map(box => box.getCenter(new THREE.Vector3()));
    const initialCenters = centers(compact), finalCenters = centers(expanded);
    for (let a = 0; a < initialCenters.length; a++) for (let b = a + 1; b < initialCenters.length; b++) {
      expect(Math.sign(finalCenters[a].x - finalCenters[b].x)).toBe(Math.sign(initialCenters[a].x - initialCenters[b].x));
      expect(Math.sign(finalCenters[a].y - finalCenters[b].y)).toBe(Math.sign(initialCenters[a].y - initialCenters[b].y));
    }
    const adjacentGap = (boxes: Map<StructureId, THREE.Box3>) => boxes.get('iris')!.min.x - boxes.get('cornea')!.max.x;
    expect(adjacentGap(compact)).toBeCloseTo(0.2, 10);
    expect(adjacentGap(expanded)).toBeCloseTo(0.8, 10);
  });

  it('only lays out provided structures and centers an isolated structure', () => {
    expect(createExplosionLayout(new Map(), 1).size).toBe(0);
    const bounds = new Map<StructureId, THREE.Box3>([['moll-glands', new THREE.Box3(new THREE.Vector3(-0.3, 0.4, 1), new THREE.Vector3(0.5, 0.6, 1.2))]]);
    const layout = createExplosionLayout(bounds, 0.9);
    expect([...layout.keys()]).toEqual(['moll-glands']);
    expect(bounds.get('moll-glands')!.clone().translate(layout.get('moll-glands')!).getCenter(new THREE.Vector3()).length()).toBeLessThan(1e-10);
  });
});
