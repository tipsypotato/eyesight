import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createFundusDetails } from './fundus';
import { setPosteriorStretch } from './geometry';

const roots: THREE.Group[] = [];
function build() {
  const details = createFundusDetails();
  const root = new THREE.Group();
  root.add(...Object.values(details));
  roots.push(root);
  return { ...details, root };
}
function meshes(group: THREE.Group) {
  const result: THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>[] = [];
  group.traverse(object => { if (object instanceof THREE.Mesh) result.push(object); });
  return result;
}
afterEach(() => {
  for (const root of roots.splice(0)) for (const mesh of meshes(root)) {
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
});

describe('fundus surface anatomy', () => {
  it('keeps every detail finite and close to the inner posterior retinal surface', () => {
    const { root, ...details } = build();
    for (const [name, group] of Object.entries(details)) {
      expect(meshes(group).length, name).toBeGreaterThan(0);
      const box = new THREE.Box3().setFromObject(group);
      expect([...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite), name).toBe(true);
      expect(box.max.z, name).toBeLessThan(-0.4);
      for (const mesh of meshes(group)) {
        const position = mesh.geometry.getAttribute('position');
        const expectedId = name === 'opticDisc' ? 'optic-disc' : name === 'vessels' ? 'retinal-vessels' : name;
        expect(mesh.userData.structureId).toBe(expectedId);
        expect(mesh.material.userData.baseOpacity).toBeGreaterThan(0);
        for (let i = 0; i < position.count; i++) {
          const radius = Math.hypot(position.getX(i), position.getY(i), position.getZ(i));
          expect(radius).toBeGreaterThan(0.899);
          expect(radius).toBeLessThanOrEqual(0.91401);
        }
      }
    }
    const ray = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, 0, -1));
    expect(ray.intersectObject(root, true)).toHaveLength(0);
  });

  it('places the disc nasally and forms a depressed foveal center inside the temporal macula', () => {
    const { macula, fovea, opticDisc } = build();
    const bounds = (group: THREE.Group) => new THREE.Box3().setFromObject(group);
    expect(bounds(opticDisc).min.x).toBeGreaterThan(0);
    expect(bounds(macula).max.x).toBeLessThan(0);
    expect(bounds(macula).containsBox(bounds(fovea))).toBe(true);
    for (const [group, x, y, rimOffset] of [[fovea, -0.18, -0.025, 0.025], [opticDisc, 0.30, 0.035, 0.045]] as const) {
      expect(meshes(group).length).toBeGreaterThan(0);
      const ray = new THREE.Raycaster();
      const depthAt = (px: number) => {
        ray.set(new THREE.Vector3(), new THREE.Vector3(px, y, -Math.sqrt(0.914 ** 2 - px ** 2 - y ** 2)).normalize());
        return ray.intersectObject(group, true)[0]?.distance;
      };
      expect(depthAt(x)).toBeGreaterThan(depthAt(x + rimOffset)! + 0.001);
    }
  });

  it('emits artery and vein trees from the disc while leaving the foveal zone avascular', () => {
    const { vessels } = build();
    expect(meshes(vessels).length).toBeGreaterThanOrEqual(2);
    for (const mesh of meshes(vessels)) {
      const position = mesh.geometry.getAttribute('position');
      let discDistance = Infinity;
      let temporal = false;
      let superior = false;
      let inferior = false;
      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i), y = position.getY(i);
        discDistance = Math.min(discDistance, Math.hypot(x - 0.30, y - 0.035));
        expect(Math.hypot(x + 0.18, y + 0.025)).toBeGreaterThan(0.085);
        temporal ||= x < -0.4;
        superior ||= y > 0.45;
        inferior ||= y < -0.45;
      }
      expect(discDistance).toBeLessThan(0.035);
      expect(temporal && superior && inferior).toBe(true);
    }
  });

  it('supports posterior stretching and restoration without nested transform drift', () => {
    const { root } = build();
    const allMeshes = meshes(root);
    expect(allMeshes.length).toBeGreaterThan(0);
    const original = allMeshes.map(mesh => new Float32Array(mesh.geometry.getAttribute('position').array));
    root.traverse(object => {
      object.updateMatrix();
      expect(object.matrix.equals(new THREE.Matrix4())).toBe(true);
    });
    setPosteriorStretch(root, 1.3);
    allMeshes.forEach((mesh, index) => {
      const position = mesh.geometry.getAttribute('position');
      for (let i = 0; i < position.count; i++) {
        expect(position.getX(i)).toBe(original[index][i * 3]);
        expect(position.getY(i)).toBe(original[index][i * 3 + 1]);
        expect(position.getZ(i)).toBeCloseTo(original[index][i * 3 + 2] * 1.3, 6);
      }
    });
    setPosteriorStretch(root, 1);
    allMeshes.forEach((mesh, index) => expect(mesh.geometry.getAttribute('position').array).toEqual(original[index]));
  });
});
