import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { STRUCTURE_IDS } from '../anatomy/types';
import { buildEye, createShellSection, setPosteriorStretch } from './geometry';
import { intersectionSurvives, SectionTool } from './section';

describe('adult right-eye geometry', () => {
  it('builds every structure with finite bounds and nested wall layers', () => {
    const eye = buildEye();
    expect([...eye.parts.keys()].sort()).toEqual([...STRUCTURE_IDS].sort());
    for (const part of eye.parts.values()) {
      const bounds = new THREE.Box3().setFromObject(part.group);
      expect(bounds.isEmpty(), part.id).toBe(false);
      expect([...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite), part.id).toBe(true);
      expect(bounds.getSize(new THREE.Vector3()).length(), part.id).toBeLessThan(4);
    }
    const span = (id: 'sclera' | 'choroid' | 'retina') => new THREE.Box3().setFromObject(eye.parts.get(id)!.group).getSize(new THREE.Vector3()).x;
    expect(span('sclera')).toBeGreaterThan(span('choroid'));
    expect(span('choroid')).toBeGreaterThan(span('retina'));
    eye.dispose();
  });

  it('keeps the iris aperture open and positions anterior and posterior structures correctly', () => {
    const eye = buildEye();
    const bounds = (id: typeof STRUCTURE_IDS[number]) => new THREE.Box3().setFromObject(eye.parts.get(id)!.group);
    expect(bounds('cornea').max.z).toBeGreaterThan(1);
    expect(bounds('lens').max.z).toBeLessThan(bounds('iris').min.z);
    expect(bounds('retina').min.z).toBeLessThan(-0.85);
    expect(eye.parts.get('optic-disc')!.anchor.x).toBeGreaterThan(0);
    expect(eye.parts.get('fovea')!.anchor.x).toBeLessThan(eye.parts.get('optic-disc')!.anchor.x);
    expect(bounds('optic-nerve').max.x).toBeGreaterThan(0.3);
    expect(bounds('optic-nerve').min.z).toBeLessThan(-1.4);
    eye.root.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 0, 2), new THREE.Vector3(0, 0, -1));
    ray.params.Line.threshold = 0.006;
    expect(ray.intersectObject(eye.parts.get('iris')!.group, true)).toHaveLength(0);
    expect(ray.intersectObject(eye.parts.get('pupil')!.group, true).filter(hit => hit.object instanceof THREE.Mesh)).toHaveLength(0);
    eye.dispose();
  });

  it('joins the transparent cornea to both surfaces of the scleral limbus', () => {
    const eye = buildEye();
    const cornea = eye.parts.get('cornea')!.group.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>;
    expect(cornea.material.roughness).toBeLessThan(0.15);
    const positions = cornea.geometry.getAttribute('position');
    const rim = Array.from({ length: positions.count }, (_, i) => i).filter(i => Math.abs(positions.getZ(i) - 0.71) < 0.0001);
    expect(rim.length).toBeGreaterThan(0);
    const radii = rim.map(i => Math.hypot(positions.getX(i), positions.getY(i)));
    expect(Math.max(...radii)).toBeCloseTo(Math.sqrt(1.02 ** 2 - 0.71 ** 2), 4);
    expect(Math.min(...radii)).toBeCloseTo(Math.sqrt(0.967 ** 2 - 0.71 ** 2), 4);
    eye.dispose();
  });

  it('has a flatter anterior lens, a steeper posterior surface, and a contained nucleus', () => {
    const eye = buildEye();
    const lens = eye.parts.get('lens')!.group;
    const capsule = lens.children.find(child => child.name === 'lens-capsule')!;
    const nucleus = lens.children.find(child => child.name === 'lens-nucleus')!;
    expect(capsule).toBeDefined();
    expect(nucleus).toBeDefined();
    const outer = new THREE.Box3().setFromObject(capsule);
    const inner = new THREE.Box3().setFromObject(nucleus);
    expect(0.455 - outer.min.z).toBeGreaterThan(outer.max.z - 0.455);
    expect(outer.containsBox(inner)).toBe(true);
    expect(outer.max.z).toBeLessThan(0.64);
    eye.dispose();
  });

  it('keeps iris detail inside its own layer and disposes owned textures', () => {
    const eye = buildEye();
    const surface = eye.parts.get('iris')!.group.children.find(child => child.name === 'iris-stroma') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>;
    expect(surface).toBeDefined();
    expect(surface.material.map).toBeInstanceOf(THREE.DataTexture);
    expect(surface.material.bumpMap).toBeInstanceOf(THREE.DataTexture);
    const disposed: string[] = [];
    surface.material.map!.addEventListener('dispose', () => disposed.push('color'));
    surface.material.bumpMap!.addEventListener('dispose', () => disposed.push('relief'));
    eye.dispose();
    expect(disposed.sort()).toEqual(['color', 'relief']);
  });

  it('creates shell cross-sections with empty centers at central and offset cuts', () => {
    for (const offset of [0, 0.4]) {
      const geometry = createShellSection(1, 0.94, offset);
      const values = geometry.getAttribute('position');
      expect(values.count).toBeGreaterThan(0);
      for (let i = 0; i < values.count; i++) {
        const radius = Math.hypot(values.getX(i), values.getY(i));
        expect(radius).toBeGreaterThan(Math.sqrt(0.94 ** 2 - offset ** 2) - 0.0001);
        expect(radius).toBeLessThanOrEqual(Math.sqrt(1 - offset ** 2) + 0.0001);
      }
      geometry.dispose();
    }
    expect(createShellSection(1, 0.94, 1.2).getAttribute('position').count).toBe(0);
  });

  it('elongates only the posterior eye for axial myopia and restores anatomy without drift', () => {
    const eye = buildEye();
    const retina = eye.parts.get('retina')!.group;
    const sclera = eye.parts.get('sclera')!.group;
    const initial = new THREE.Box3().setFromObject(retina);
    const front = new THREE.Box3().setFromObject(sclera).max.z;
    setPosteriorStretch(eye.root, 1.3);
    expect(new THREE.Box3().setFromObject(retina).min.z).toBeCloseTo(initial.min.z * 1.3, 5);
    expect(new THREE.Box3().setFromObject(sclera).max.z).toBeCloseTo(front, 5);
    expect(new THREE.Box3().setFromObject(eye.parts.get('cornea')!.group).max.z).toBeCloseTo(1.09, 5);
    setPosteriorStretch(eye.root, 1);
    expect(new THREE.Box3().setFromObject(retina).min.z).toBeCloseTo(initial.min.z, 5);
    eye.dispose();
  });
});

describe('anatomical section planes', () => {
  it('rejects hidden surfaces and the clipped front portion of a section rim during picking', () => {
    const material = new THREE.MeshBasicMaterial();
    material.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.7)];
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.9, 1), material);
    const hit = { object: mesh, point: new THREE.Vector3(0, 0, 0.8), distance: 1 };
    expect(intersectionSurvives(hit)).toBe(false);
    hit.point.z = 0.5;
    expect(intersectionSurvives(hit)).toBe(true);
    const group = new THREE.Group();
    group.add(mesh);
    group.visible = false;
    expect(intersectionSurvives(hit)).toBe(false);
  });

  it('removes the camera-facing half and keeps slider axes stable when orbiting', () => {
    const section = new SectionTool();
    for (const [axis, direction] of [
      ['sagittal', new THREE.Vector3(1, 0, 0)],
      ['axial', new THREE.Vector3(0, 1, 0)],
      ['coronal', new THREE.Vector3(0, 0, 1)],
    ] as const) {
      const camera = new THREE.PerspectiveCamera();
      camera.position.copy(direction).multiplyScalar(4);
      section.update({ enabled: true, axis, offset: 0.2 }, camera);
      expect(section.keeps(direction.clone().multiplyScalar(0.5))).toBe(false);
      expect(section.keeps(direction.clone().multiplyScalar(-0.5))).toBe(true);
      expect(section.plane.distanceToPoint(direction.clone().multiplyScalar(0.2))).toBeCloseTo(0);
      camera.position.negate();
      section.update({ enabled: true, axis, offset: 0.2 }, camera);
      expect(section.keeps(direction.clone().multiplyScalar(0.5))).toBe(true);
      expect(section.plane.distanceToPoint(direction.clone().multiplyScalar(0.2))).toBeCloseTo(0);
    }
  });
});
