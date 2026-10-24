import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { buildEye, setPosteriorStretch } from './geometry';

const IDS = ['bulbar-conjunctiva', 'palpebral-conjunctiva', 'eyelid-skin', 'orbicularis-oculi', 'levator-palpebrae', 'tarsal-plates', 'meibomian-glands', 'zeis-glands', 'moll-glands'] as const;
const meshes = (group: THREE.Group) => {
  const result: THREE.Mesh[] = [];
  group.traverse(object => { if (object instanceof THREE.Mesh) result.push(object); });
  return result;
};
const points = (mesh: THREE.Mesh) => {
  const position = mesh.geometry.getAttribute('position');
  return Array.from({ length: position.count }, (_, index) => new THREE.Vector3().fromBufferAttribute(position, index).applyMatrix4(mesh.matrixWorld));
};

describe('conjunctiva and eyelids', () => {
  it('builds independently selectable tissues with finite, non-degenerate surfaces and a clear palpebral aperture', () => {
    const eye = buildEye();
    try {
      let count = 0;
      for (const id of IDS) {
        const part = eye.parts.get(id);
        expect(part, id).toBeDefined();
        for (const mesh of meshes(part!.group)) {
          expect(mesh.userData.structureId).toBe(id);
          expect(mesh.userData.adnexal).toBe(true);
          const position = mesh.geometry.getAttribute('position'), index = mesh.geometry.index!;
          count += position.count;
          expect(Array.from(position.array).every(Number.isFinite), id).toBe(true);
          let minimumArea = Infinity;
          const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
          for (let i = 0; i < index.count; i += 3) {
            a.fromBufferAttribute(position, index.getX(i)); b.fromBufferAttribute(position, index.getX(i + 1)); c.fromBufferAttribute(position, index.getX(i + 2));
            minimumArea = Math.min(minimumArea, b.sub(a).cross(c.sub(a)).length());
          }
          expect(minimumArea, `${id}/${mesh.name}`).toBeGreaterThan(1e-12);
        }
      }
      expect(count).toBeLessThan(80000);
      const ray = new THREE.Raycaster(new THREE.Vector3(0, 0, 3), new THREE.Vector3(0, 0, -1));
      for (const id of IDS) expect(ray.intersectObject(eye.parts.get(id)!.group, true), id).toHaveLength(0);
    } finally { eye.dispose(); }
  });

  it('keeps bulbar conjunctiva on anterior sclera without covering cornea and connects it to the palpebral fornices', () => {
    const eye = buildEye();
    try {
      const bulbar = eye.parts.get('bulbar-conjunctiva');
      expect(bulbar).toBeDefined();
      const surface = meshes(bulbar!.group).find(mesh => mesh.name === 'bulbar-surface')!;
      const vertices = points(surface);
      expect(vertices.every(point => point.length() > 1.02)).toBe(true);
      expect(Math.max(...vertices.map(point => point.z))).toBeLessThanOrEqual(0.7101);
      expect(Math.min(...vertices.map(point => Math.hypot(point.x, point.y)))).toBeGreaterThan(0.73);
      const palpebral = eye.parts.get('palpebral-conjunctiva')!;
      const fornix = meshes(palpebral.group).find(mesh => mesh.name === 'conjunctival-fornices')!;
      expect(fornix).toBeDefined();
      const rim = vertices.filter(point => point.z < 0.28);
      const fold = points(fornix);
      expect(rim.every(point => fold.some(other => other.distanceTo(point) < 0.007))).toBe(true);
      expect(Math.min(...fold.map(point => point.length()))).toBeGreaterThanOrEqual(1.02);
      const indices = fornix.geometry.index!;
      let closestFace = Infinity;
      for (let i = 0; i < indices.count; i += 3) {
        const center = fold[indices.getX(i)].clone().add(fold[indices.getX(i + 1)]).add(fold[indices.getX(i + 2)]).divideScalar(3);
        closestFace = Math.min(closestFace, center.length());
      }
      expect(closestFace).toBeGreaterThanOrEqual(1.02);
      for (const name of ['upper-lid', 'lower-lid']) {
        const lid = meshes(palpebral.group).find(mesh => mesh.name === name)!;
        const middle = points(lid).filter(point => Math.abs(point.x) < 1e-5);
        const edgeY = (name === 'upper-lid' ? Math.max : Math.min)(...middle.map(point => point.y));
        const edge = middle.filter(point => Math.abs(point.y - edgeY) < 1e-5);
        expect(edge.length).toBeGreaterThan(0);
        expect(edge.every(point => fold.some(other => other.distanceTo(point) < 0.005)), name).toBe(true);
      }
    } finally { eye.dispose(); }
  });

  it('orders lid layers from conjunctiva to skin, embeds tarsal glands, and keeps levator in the upper eyelid', () => {
    const eye = buildEye();
    try {
      expect(eye.parts.get('eyelid-skin')).toBeDefined();
      const ray = new THREE.Raycaster(new THREE.Vector3(0, 0.68, 3), new THREE.Vector3(0, 0, -1));
      const depth = (id: typeof IDS[number]) => ray.intersectObject(eye.parts.get(id)!.group, true)[0]?.point.z;
      const layers = ['eyelid-skin', 'orbicularis-oculi', 'tarsal-plates', 'palpebral-conjunctiva'] as const;
      for (let i = 0; i < layers.length - 1; i++) expect(depth(layers[i]), layers[i]).toBeGreaterThan(depth(layers[i + 1])!);
      const depths = (id: typeof IDS[number]) => ray.intersectObject(eye.parts.get(id)!.group, true).map(hit => hit.point.z);
      const glandDepth = depths('meibomian-glands'), plateDepth = depths('tarsal-plates');
      expect(glandDepth.length).toBeGreaterThan(0);
      expect(Math.max(...glandDepth)).toBeLessThan(Math.max(...plateDepth));
      expect(Math.min(...glandDepth)).toBeGreaterThan(Math.min(...plateDepth));
      const levator = new THREE.Box3().setFromObject(eye.parts.get('levator-palpebrae')!.group);
      expect(levator.min.y).toBeGreaterThan(0);
      expect(levator.max.y).toBeGreaterThan(1.2);
      expect(levator.min.z).toBeLessThan(-1.3);
      for (const id of ['meibomian-glands', 'zeis-glands', 'moll-glands'] as const) {
        const box = new THREE.Box3().setFromObject(eye.parts.get(id)!.group);
        expect(box.min.y).toBeLessThan(-0.3);
        expect(box.max.y).toBeGreaterThan(0.5);
      }
      expect(meshes(eye.parts.get('eyelid-skin')!.group).some(mesh => mesh.name.includes('lashes'))).toBe(true);
    } finally { eye.dispose(); }
  });

  it('mirrors each tissue, owns independent resources and excludes orbital tissues from posterior stretching', () => {
    const right = buildEye(), left = buildEye({}, 'left');
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    const geometryDisposed = vi.fn(), materialDisposed = vi.fn();
    try {
      for (const id of IDS) {
        expect(right.parts.get(id), id).toBeDefined();
        const a = right.parts.get(id)!, b = left.parts.get(id)!;
        expect(b.anchor.toArray()).toEqual([-a.anchor.x, a.anchor.y, a.anchor.z]);
        const leftMeshes = meshes(b.group);
        meshes(a.group).forEach((mesh, index) => {
          const mirrored = leftMeshes[index];
          expect(mesh.geometry).not.toBe(mirrored.geometry);
          expect(mesh.material).not.toBe(mirrored.material);
          const original = points(mesh), reflected = points(mirrored);
          let error = 0;
          reflected.forEach((point, i) => { error = Math.max(error, point.distanceTo(original[i].clone().multiply(new THREE.Vector3(-1, 1, 1)))); });
          expect(error).toBeLessThan(1e-6);
          geometries.add(mesh.geometry);
          (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => materials.add(material));
        });
      }
      const original = [...geometries].map(geometry => new Float32Array(geometry.getAttribute('position').array));
      setPosteriorStretch(right.root, 1.4);
      [...geometries].forEach((geometry, index) => expect(geometry.getAttribute('position').array).toEqual(original[index]));
      geometries.forEach(geometry => geometry.addEventListener('dispose', geometryDisposed));
      materials.forEach(material => material.addEventListener('dispose', materialDisposed));
    } finally { right.dispose(); left.dispose(); }
    expect(geometryDisposed).toHaveBeenCalledTimes(geometries.size);
    expect(materialDisposed).toHaveBeenCalledTimes(materials.size);
  });
});
