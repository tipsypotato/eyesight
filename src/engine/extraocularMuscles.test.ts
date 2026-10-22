import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { EXTRAOCULAR_IDS } from '../anatomy/types';
import { buildEye, setOpticalGeometry, setPosteriorStretch } from './geometry';

const surfaces = (group: THREE.Group) => {
  const result: THREE.Mesh[] = [];
  group.traverse(object => { if (object instanceof THREE.Mesh) result.push(object); });
  return result;
};

const points = (group: THREE.Group) => surfaces(group).flatMap(mesh => {
  const positions = mesh.geometry.getAttribute('position');
  return Array.from({ length: positions.count }, (_, index) => new THREE.Vector3().fromBufferAttribute(positions, index).applyMatrix4(mesh.matrixWorld));
});

describe('extraocular muscles', () => {
  it('keeps all six muscles outside the globe and clear of the corneal aperture', () => {
    const eye = buildEye();
    try {
      for (const id of EXTRAOCULAR_IDS) {
        const part = eye.parts.get(id)!;
        expect(part, id).toBeDefined();
        const vertices = points(part.group);
        expect(vertices.length).toBeGreaterThan(100);
        expect(Math.min(...vertices.map(point => point.length())), id).toBeGreaterThan(1.02);
        expect(vertices.every(point => point.toArray().every(Number.isFinite)), id).toBe(true);
        expect(vertices.filter(point => point.z > 0.7).every(point => Math.hypot(point.x, point.y) > 0.74), id).toBe(true);
        part.group.traverse(object => {
          if (object instanceof THREE.Mesh || object instanceof THREE.Line) expect(object.userData.structureId).toBe(id);
        });
        for (const mesh of surfaces(part.group)) {
          const position = mesh.geometry.getAttribute('position'), index = mesh.geometry.index!;
          let closest = Infinity;
          for (let i = 0; i < index.count; i += 3) {
            const midpoint = new THREE.Vector3();
            for (let corner = 0; corner < 3; corner++) midpoint.add(new THREE.Vector3().fromBufferAttribute(position, index.getX(i + corner)).applyMatrix4(mesh.matrixWorld));
            closest = Math.min(closest, midpoint.multiplyScalar(1 / 3).length());
          }
          expect(closest, id).toBeGreaterThan(1.019);
        }
      }
    } finally { eye.dispose(); }
  });

  it('distinguishes anterior rectus insertions from posterior oblique insertions and the trochlear turn', () => {
    const eye = buildEye();
    try {
      const bounds = (id: typeof EXTRAOCULAR_IDS[number]) => new THREE.Box3().setFromObject(eye.parts.get(id)!.group);
      const recti = ['medial-rectus', 'inferior-rectus', 'lateral-rectus', 'superior-rectus'] as const;
      const front = recti.map(id => bounds(id).max.z);
      expect(front.every(z => z > 0 && z < 0.65)).toBe(true);
      expect(front[0]).toBeGreaterThan(front[1]);
      expect(front[1]).toBeGreaterThan(front[2]);
      expect(front[2]).toBeGreaterThan(front[3]);
      for (const id of recti) expect(bounds(id).min.z).toBeLessThan(-1.6);
      expect(eye.parts.get('medial-rectus')!.anchor.x).toBeGreaterThan(1);
      expect(eye.parts.get('lateral-rectus')!.anchor.x).toBeLessThan(-1);
      expect(eye.parts.get('superior-rectus')!.anchor.y).toBeGreaterThan(1);
      expect(eye.parts.get('inferior-rectus')!.anchor.y).toBeLessThan(-1);
      const superior = points(eye.parts.get('superior-oblique')!.group);
      expect(superior.some(point => point.x > 0.7 && point.y > 0.9 && point.z > 0.5)).toBe(true);
      expect(superior.some(point => point.x < -0.3 && point.y > 0.6 && point.z < -0.35)).toBe(true);
      expect(eye.parts.get('superior-oblique')!.group.getObjectByName('trochlea')).toBeDefined();
      const inferior = points(eye.parts.get('inferior-oblique')!.group);
      expect(inferior.some(point => point.x > 0.7 && point.y < -0.7 && point.z > 0.5)).toBe(true);
      expect(inferior.some(point => point.x < -0.6 && point.z < -0.35)).toBe(true);
      expect(bounds('inferior-oblique').min.y).toBeLessThan(bounds('inferior-rectus').min.y);
    } finally { eye.dispose(); }
  });

  it('mirrors the anatomy while owning separate geometry and materials for each eye', () => {
    const right = buildEye(), left = buildEye({}, 'left');
    try {
      for (const id of EXTRAOCULAR_IDS) {
        const a = right.parts.get(id)!, b = left.parts.get(id)!;
        expect(b.anchor.x).toBe(-a.anchor.x);
        expect(b.anchor.y).toBe(a.anchor.y);
        expect(b.explode.x).toBe(-a.explode.x);
        const rightPoints = points(a.group), leftPoints = points(b.group);
        expect(leftPoints).toHaveLength(rightPoints.length);
        let error = 0;
        leftPoints.forEach((point, index) => { error = Math.max(error, point.distanceTo(rightPoints[index].clone().multiply(new THREE.Vector3(-1, 1, 1)))); });
        expect(error).toBeLessThan(0.000001);
        surfaces(a.group).forEach((mesh, index) => {
          expect(Object.is(mesh.geometry, surfaces(b.group)[index].geometry)).toBe(false);
          expect(Object.is(mesh.material, surfaces(b.group)[index].material)).toBe(false);
        });
      }
    } finally { right.dispose(); left.dispose(); }
  });

  it('does not stretch the static orbital attachments with axial myopia or accommodation and disposes them once', () => {
    const eye = buildEye();
    const objects: (THREE.Mesh | THREE.Line)[] = [];
    for (const id of EXTRAOCULAR_IDS) eye.parts.get(id)!.group.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) objects.push(object);
    });
    const before = objects.map(object => new Float32Array(object.geometry.getAttribute('position').array));
    const geometryDisposed = vi.fn(), materialDisposed = vi.fn();
    const geometries = new Set(objects.map(object => object.geometry));
    const materials = new Set(objects.flatMap(object => Array.isArray(object.material) ? object.material : [object.material]));
    geometries.forEach(geometry => geometry.addEventListener('dispose', geometryDisposed));
    materials.forEach(material => material.addEventListener('dispose', materialDisposed));
    try {
      setPosteriorStretch(eye.root, 1.3);
      setOpticalGeometry(eye.root, { pupilRadius: 0.15, accommodation: 1 });
      objects.forEach((object, index) => expect(object.geometry.getAttribute('position').array).toEqual(before[index]));
      setPosteriorStretch(eye.root, 1);
      objects.forEach((object, index) => expect(object.geometry.getAttribute('position').array).toEqual(before[index]));
    } finally { eye.dispose(); }
    expect(geometryDisposed).toHaveBeenCalledTimes(geometries.size);
    expect(materialDisposed).toHaveBeenCalledTimes(materials.size);
  });
});
