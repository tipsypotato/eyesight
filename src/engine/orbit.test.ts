import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { EXTRAOCULAR_IDS, ORBITAL_IDS } from '../anatomy/types';
import { buildEye, setPosteriorStretch } from './geometry';

const meshes = (group: THREE.Group) => {
  const result: THREE.Mesh[] = [];
  group.traverse(object => { if (object instanceof THREE.Mesh) result.push(object); });
  return result;
};
const points = (mesh: THREE.Mesh) => {
  const position = mesh.geometry.getAttribute('position');
  return Array.from({ length: position.count }, (_, index) => new THREE.Vector3().fromBufferAttribute(position, index).applyMatrix4(mesh.matrixWorld));
};

describe('orbital walls and contents', () => {
  it('forms a continuous rounded socket with a contoured, thicker anterior rim', () => {
    const eye = buildEye();
    try {
      const walls = ['medial-orbital-wall', 'orbital-roof', 'lateral-orbital-wall', 'orbital-floor'] as const;
      const rims: THREE.Vector3[] = [];
      for (let part = 0; part < walls.length; part++) {
        const geometry = meshes(eye.parts.get(walls[part])!.group)[0].geometry;
        const vertices = points(meshes(eye.parts.get(walls[part])!.group)[0]);
        const normal = geometry.getAttribute('normal');
        const next = meshes(eye.parts.get(walls[(part + 1) % walls.length])!.group)[0].geometry;
        const stride = 25, rows = 36, layerSize = stride * (rows + 1);
        const edges = new Map<string, number>(), index = geometry.index!;
        for (let i = 0; i < index.count; i += 3) {
          const face = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
          for (let edge = 0; edge < 3; edge++) {
            const a = face[edge], b = face[(edge + 1) % 3], key = `${Math.min(a, b)}:${Math.max(a, b)}`;
            edges.set(key, (edges.get(key) ?? 0) + 1);
          }
        }
        expect([...edges.values()].every(count => count === 2), `${walls[part]} remains closed when isolated`).toBe(true);
        for (let side = 0; side < 2; side++) for (let row = 2; row < rows - 1; row++) {
          const a = side * layerSize + row * stride + stride - 1, b = side * layerSize + row * stride;
          expect(vertices[a].distanceTo(new THREE.Vector3().fromBufferAttribute(next.getAttribute('position'), b))).toBeLessThan(1e-6);
          expect(new THREE.Vector3().fromBufferAttribute(normal, a).dot(new THREE.Vector3().fromBufferAttribute(next.getAttribute('normal'), b))).toBeGreaterThan(0.999);
        }
        for (let ring = layerSize * 2; ring < vertices.length; ring += stride) {
          expect(vertices[ring + stride - 1].distanceTo(new THREE.Vector3().fromBufferAttribute(next.getAttribute('position'), ring))).toBeLessThan(1e-6);
          expect(new THREE.Vector3().fromBufferAttribute(normal, ring + stride - 1).dot(new THREE.Vector3().fromBufferAttribute(next.getAttribute('normal'), ring))).toBeGreaterThan(0.999);
        }
        const middle = Math.floor(stride / 2), front = rows * stride + middle, back = 2 * stride + middle;
        expect(vertices[front + layerSize].distanceTo(vertices[front])).toBeGreaterThan(vertices[back + layerSize].distanceTo(vertices[back]) + 0.08);
        rims.push(...vertices.slice(rows * stride, layerSize));
      }
      expect(Math.max(...rims.map(point => point.z)) - Math.min(...rims.map(point => point.z))).toBeGreaterThan(0.15);
    } finally { eye.dispose(); }
  });

  it('builds finite selectable orbital surfaces clear of the globe and the anterior aperture', () => {
    const eye = buildEye();
    try {
      let count = 0;
      for (const id of ORBITAL_IDS) {
        const part = eye.parts.get(id);
        expect(part, id).toBeDefined();
        for (const mesh of meshes(part!.group)) {
          expect(mesh.userData.structureId).toBe(id);
          expect(mesh.userData.orbital).toBe(true);
          const vertices = points(mesh), index = mesh.geometry.index!;
          count += vertices.length;
          expect(vertices.every(point => point.toArray().every(Number.isFinite)), id).toBe(true);
          let minimumArea = Infinity, nearest = Infinity;
          for (let i = 0; i < index.count; i += 3) {
            const a = vertices[index.getX(i)], b = vertices[index.getX(i + 1)], c = vertices[index.getX(i + 2)];
            minimumArea = Math.min(minimumArea, b.clone().sub(a).cross(c.clone().sub(a)).length());
            nearest = Math.min(nearest, a.length(), b.length(), c.length(), a.clone().add(b).add(c).divideScalar(3).length());
          }
          expect(minimumArea, `${id}/${mesh.name}`).toBeGreaterThan(1e-12);
          expect(nearest, `${id}/${mesh.name}`).toBeGreaterThan(1.02);
        }
      }
      expect(count).toBeLessThan(50000);
      const bounds = new THREE.Box3().setFromObject(eye.root);
      expect([...bounds.min.toArray(), ...bounds.max.toArray()].every(value => Math.abs(value) < 2.5)).toBe(true);
      const walls = ORBITAL_IDS.slice(0, 4).map(id => eye.parts.get(id)!.group);
      const ray = new THREE.Raycaster(new THREE.Vector3(0, 0, 3), new THREE.Vector3(0, 0, -1), 0, 2.5);
      expect(ray.intersectObjects(walls, true)).toHaveLength(0);
      const apex = new THREE.Raycaster(new THREE.Vector3(0.52, 0, -3), new THREE.Vector3(0, 0, 1), 0, 1);
      expect(apex.intersectObjects(walls, true)).toHaveLength(0);
      for (const group of walls) {
        const bounds = new THREE.Box3().setFromObject(group);
        expect(bounds.min.z).toBeLessThan(-2);
        expect(bounds.max.z).toBeGreaterThan(0.5);
        const geometry = meshes(group)[0].geometry, position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal');
        const inner = 18 * 25 + 12, outer = inner + 25 * 37;
        const direction = new THREE.Vector3().fromBufferAttribute(position, outer).sub(new THREE.Vector3().fromBufferAttribute(position, inner));
        expect(new THREE.Vector3().fromBufferAttribute(normal, outer).dot(direction)).toBeGreaterThan(0);
        expect(new THREE.Vector3().fromBufferAttribute(normal, inner).dot(direction)).toBeLessThan(0);
      }
    } finally { eye.dispose(); }
  });

  it('encloses existing muscles and orbital soft tissue within four walls', () => {
    const eye = buildEye();
    try {
      const walls = ORBITAL_IDS.slice(0, 4).map(id => eye.parts.get(id)!.group);
      for (const id of [...EXTRAOCULAR_IDS, 'levator-palpebrae', 'optic-nerve', ...ORBITAL_IDS.slice(4)] as const) {
        const vertices = meshes(eye.parts.get(id)!.group).flatMap(points);
        const step = ORBITAL_IDS.some(orbital => orbital === id) ? 1 : 23;
        for (let i = 0; i < vertices.length; i += step) {
          const point = vertices[i];
          if (point.z < -2.13 || point.z > 0.66) continue;
          const center = new THREE.Vector3(0.52 * (0.66 - point.z) / 2.79, 0, point.z);
          const direction = point.clone().sub(center);
          const length = direction.length();
          const hit = new THREE.Raycaster(center, direction.normalize()).intersectObjects(walls, true)[0];
          expect(hit, `${id} at ${point.toArray()}`).toBeDefined();
          expect(hit!.distance, `${id} at ${point.toArray()}`).toBeGreaterThan(length - 0.002);
        }
      }
      const nerve = eye.parts.get('optic-nerve')!.group.getObjectByName('optic-nerve-trunk') as THREE.Mesh<THREE.TubeGeometry>;
      const exit = nerve.geometry.parameters.path.getPoint(1);
      expect(exit.z).toBeCloseTo(new THREE.Box3().setFromObject(walls[0]).min.z, 5);
      const axis = new THREE.Vector3(0.52, 0, exit.z);
      const direction = exit.clone().sub(axis);
      const wallHit = new THREE.Raycaster(axis, direction.clone().normalize()).intersectObjects(walls, true)[0];
      expect(wallHit.distance).toBeGreaterThan(direction.length() + nerve.geometry.parameters.radius);
    } finally { eye.dispose(); }
  }, 15000);

  it('separates intraconal and extraconal fat, and places the lacrimal gland superotemporally', () => {
    const eye = buildEye();
    try {
      const inner = meshes(eye.parts.get('intraconal-fat')!.group).flatMap(points);
      const outer = meshes(eye.parts.get('extraconal-fat')!.group).flatMap(points);
      const radial = (vertices: THREE.Vector3[]) => vertices.reduce((sum, p) => sum + Math.hypot(p.x - 0.3, p.y), 0) / vertices.length;
      expect(radial(inner)).toBeLessThan(0.6);
      expect(radial(outer)).toBeGreaterThan(1);
      expect(Math.max(...inner.map(p => p.z))).toBeLessThan(-1.02);
      const gland = new THREE.Box3().setFromObject(eye.parts.get('lacrimal-gland')!.group);
      expect(gland.max.x).toBeLessThan(-0.6);
      expect(gland.min.y).toBeGreaterThan(0.7);
      const ganglion = eye.parts.get('ciliary-ganglion')!.anchor;
      expect(ganglion.x).toBeLessThan(eye.parts.get('optic-nerve')!.anchor.x);
      expect(ganglion.z).toBeLessThan(-1);
      const nerve = eye.parts.get('optic-nerve')!.group.getObjectByName('optic-nerve-trunk') as THREE.Mesh<THREE.TubeGeometry>;
      const nervePath = nerve.geometry.parameters.path.getSpacedPoints(256);
      for (const id of ['intraconal-fat', 'ophthalmic-artery'] as const) {
        const vertices = meshes(eye.parts.get(id)!.group).flatMap(points);
        let nearest = Infinity;
        for (const point of vertices) for (const center of nervePath) nearest = Math.min(nearest, point.distanceTo(center));
        expect(nearest, id).toBeGreaterThan(nerve.geometry.parameters.radius + 0.003);
      }
    } finally { eye.dispose(); }
  });

  it('routes motor nerves to their muscles and keeps three V1 branches distinct', () => {
    const eye = buildEye();
    try {
      for (const [id, branch, target] of [
        ['oculomotor-nerve', 'to-superior-rectus', 'superior-rectus'],
        ['oculomotor-nerve', 'to-medial-rectus', 'medial-rectus'],
        ['oculomotor-nerve', 'to-inferior-rectus', 'inferior-rectus'],
        ['oculomotor-nerve', 'to-inferior-oblique', 'inferior-oblique'],
        ['oculomotor-nerve', 'to-levator', 'levator-palpebrae'],
        ['trochlear-nerve', 'to-superior-oblique', 'superior-oblique'],
        ['abducens-nerve', 'to-lateral-rectus', 'lateral-rectus'],
      ] as const) {
        const mesh = eye.parts.get(id)!.group.getObjectByName(branch) as THREE.Mesh<THREE.TubeGeometry>;
        expect(mesh, branch).toBeDefined();
        const end = mesh.geometry.parameters.path.getPoint(1);
        const tissue = meshes(eye.parts.get(target)!.group).flatMap(points);
        expect(Math.min(...tissue.map(point => point.distanceTo(end))), branch).toBeLessThan(0.11);
      }
      expect(eye.parts.get('frontal-nerve')!.anchor.y).toBeGreaterThan(1.3);
      expect(eye.parts.get('lacrimal-nerve')!.anchor.x).toBeLessThan(-0.9);
      expect(eye.parts.get('nasociliary-nerve')!.anchor.x).toBeGreaterThan(0.9);
      expect(eye.parts.get('ophthalmic-artery')!.anchor.y).toBeGreaterThan(0);
      expect(eye.parts.get('inferior-ophthalmic-vein')!.anchor.y).toBeLessThan(0);
    } finally { eye.dispose(); }
  });

  it('mirrors independent resources, excludes orbital anatomy from axial stretching, and disposes each resource once', () => {
    const right = buildEye(), left = buildEye({}, 'left');
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    const geometryDisposed = vi.fn(), materialDisposed = vi.fn();
    try {
      for (const id of ORBITAL_IDS) {
        const a = right.parts.get(id)!, b = left.parts.get(id)!;
        expect(b.anchor.toArray()).toEqual([-a.anchor.x, a.anchor.y, a.anchor.z]);
        const mirrored = meshes(b.group);
        meshes(a.group).forEach((mesh, index) => {
          expect(mesh.geometry).not.toBe(mirrored[index].geometry);
          expect(mesh.material).not.toBe(mirrored[index].material);
          const before = points(mesh), after = points(mirrored[index]);
          let error = 0;
          after.forEach((point, i) => { error = Math.max(error, point.distanceTo(before[i].clone().multiply(new THREE.Vector3(-1, 1, 1)))); });
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
