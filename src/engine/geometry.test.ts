import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ORBITAL_IDS, STRUCTURE_IDS } from '../anatomy/types';
import { buildEye, createShellSection, setOpticalGeometry, setPosteriorStretch } from './geometry';
import { intersectionSurvives, SectionTool } from './section';

describe('adult right-eye geometry', () => {
  it('builds every structure with finite bounds and nested wall layers', () => {
    const eye = buildEye();
    expect([...eye.parts.keys()].sort()).toEqual([...STRUCTURE_IDS].sort());
    for (const part of eye.parts.values()) {
      const bounds = new THREE.Box3().setFromObject(part.group);
      expect(bounds.isEmpty(), part.id).toBe(false);
      expect([...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite), part.id).toBe(true);
      if (ORBITAL_IDS.some(id => id === part.id)) {
        expect([...bounds.min.toArray(), ...bounds.max.toArray()].every(value => Math.abs(value) < 2.5), part.id).toBe(true);
      } else expect(bounds.getSize(new THREE.Vector3()).length(), part.id).toBeLessThan(4);
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

  it('uses a smooth, circular optic nerve while preserving its curved route and distal closure', () => {
    const eye = buildEye();
    try {
      const nerve = eye.parts.get('optic-nerve')!.group;
      const trunk = nerve.children.find(object => object instanceof THREE.Mesh && object.geometry instanceof THREE.TubeGeometry) as THREE.Mesh<THREE.TubeGeometry>;
      const { path, radius, radialSegments, tubularSegments } = trunk.geometry.parameters;
      expect(path.getPoint(0).toArray()).toEqual([0.31, 0.035, -0.87]);
      expect(path.getPoint(1).distanceTo(new THREE.Vector3(0.56, 0.065, -2.13))).toBeLessThan(1e-10);
      expect(radius).toBe(0.105);
      const positions = trunk.geometry.getAttribute('position');
      let largestChord = 0;
      for (const ring of [0, Math.floor(tubularSegments / 2), tubularSegments]) {
        const center = path.getPointAt(ring / tubularSegments);
        for (let sector = 0; sector < radialSegments; sector++) {
          const a = new THREE.Vector3().fromBufferAttribute(positions, ring * (radialSegments + 1) + sector);
          const b = new THREE.Vector3().fromBufferAttribute(positions, ring * (radialSegments + 1) + sector + 1);
          expect(a.distanceTo(center)).toBeCloseTo(0.105, 6);
          largestChord = Math.max(largestChord, a.distanceTo(b));
        }
      }
      expect(largestChord).toBeLessThan(0.015);
      const end = path.getPoint(1), tangent = path.getTangent(1);
      const ray = new THREE.Raycaster(end.clone().addScaledVector(tangent, 0.2), tangent.clone().negate());
      expect(ray.intersectObject(nerve, true).some(hit => hit.distance < 0.21)).toBe(true);
    } finally { eye.dispose(); }
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

  it.each(['right', 'left'] as const)('keeps fine anterior surfaces pickable and clipped in two batched %s-eye meshes', side => {
    const eye = buildEye({}, side), sign = side === 'left' ? -1 : 1;
    const released: string[] = [];
    try {
      for (const [id, x, y, triangles] of [['ciliary-body', 0.666, 0, 6912], ['zonules', 0.51, 0.0055, 1920]] as const) {
        const group = eye.parts.get(id)!.group;
        const meshes = group.children as THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>[];
        expect(meshes.reduce((count, mesh) => count + mesh.geometry.index!.count / 3, 0)).toBe(triangles);
        group.position.set(0.2, -0.1, 0.4);
        eye.root.updateMatrixWorld(true);
        const ray = new THREE.Raycaster(new THREE.Vector3(sign * x + 0.2, y - 0.1, 2), new THREE.Vector3(0, 0, -1));
        const hits = ray.intersectObject(group, true);
        expect(hits.length, id).toBeGreaterThan(0);
        expect(hits.every(hit => hit.object.userData.structureId === id && hit.object.userData.eyeSide === side)).toBe(true);
        expect(hits.some(intersectionSurvives)).toBe(true);
        for (const mesh of meshes) mesh.material.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.7)];
        expect(hits.some(intersectionSurvives)).toBe(false);
        for (const mesh of meshes) mesh.material.clippingPlanes = [];
        group.visible = false;
        expect(hits.some(intersectionSurvives)).toBe(false);
        group.visible = true;
        expect(meshes, id).toHaveLength(1);
        meshes[0].geometry.addEventListener('dispose', () => released.push(`${id}:geometry`));
        meshes[0].material.addEventListener('dispose', () => released.push(`${id}:material`));
      }
    } finally { eye.dispose(); }
    expect(released.sort()).toEqual(['ciliary-body:geometry', 'ciliary-body:material', 'zonules:geometry', 'zonules:material']);
  });

  it('preserves mirrored anterior bounds and reversible accommodation after batching', () => {
    const right = buildEye(), left = buildEye({}, 'left');
    try {
      for (const id of ['ciliary-body', 'zonules'] as const) {
        const a = new THREE.Box3().setFromObject(right.parts.get(id)!.group, true);
        const b = new THREE.Box3().setFromObject(left.parts.get(id)!.group, true);
        expect(a.min.x).toBeCloseTo(-b.max.x, 6);
        expect(a.max.x).toBeCloseTo(-b.min.x, 6);
        expect(a.min.y).toBeCloseTo(b.min.y, 6);
        expect(a.max.z).toBeCloseTo(b.max.z, 6);
      }
      const originals = ['ciliary-body', 'zonules'].map(id => {
        const meshes = left.root.getObjectByName(id)!.children as THREE.Mesh[];
        return meshes.map(mesh => new Float32Array(mesh.geometry.getAttribute('position').array));
      });
      setOpticalGeometry(left.root, { pupilRadius: 0.215, accommodation: 1 });
      const ciliary = new THREE.Box3().setFromObject(left.parts.get('ciliary-body')!.group);
      expect(ciliary.max.x).toBeCloseTo(0.736 * 0.94, 5);
      setOpticalGeometry(left.root, { pupilRadius: 0.215, accommodation: 0 });
      for (const [index, id] of ['ciliary-body', 'zonules'].entries()) {
        const meshes = left.root.getObjectByName(id)!.children as THREE.Mesh[];
        expect(meshes.every((mesh, i) => mesh.geometry.getAttribute('position').array.every((value, j) => value === originals[index][i][j]))).toBe(true);
      }
    } finally { right.dispose(); left.dispose(); }
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

  it('changes the real iris aperture while retaining its outer attachment and matching the pupil boundary', () => {
    const eye = buildEye();
    const iris = eye.parts.get('iris')!.group;
    const meshes = iris.children as THREE.Mesh[];
    const originals = meshes.map(mesh => new Float32Array(mesh.geometry.getAttribute('position').array));
    try {
      for (const radius of [0.1505, 0.2795, 0.215]) {
        setOpticalGeometry(eye.root, { pupilRadius: radius, accommodation: 0 });
        for (const [meshIndex, mesh] of meshes.entries()) {
          const position = mesh.geometry.getAttribute('position');
          let inner = Infinity;
          for (let i = 0; i < position.count; i++) {
            inner = Math.min(inner, Math.hypot(position.getX(i), position.getY(i)));
            const original = originals[meshIndex];
            if (Math.hypot(original[i * 3], original[i * 3 + 1]) >= 0.6299) {
              expect(position.getX(i)).toBeCloseTo(original[i * 3], 6);
              expect(position.getY(i)).toBeCloseTo(original[i * 3 + 1], 6);
              expect(position.getZ(i)).toBe(original[i * 3 + 2]);
            }
          }
          expect(inner).toBeCloseTo(radius, 5);
          expect(mesh.scale.toArray()).toEqual([1, 1, 1]);
        }
        const pupil = eye.parts.get('pupil')!.group;
        const boundary = (pupil.children[0] as THREE.Line).geometry.getAttribute('position');
        expect(Math.hypot(boundary.getX(0), boundary.getY(0))).toBeCloseTo(radius, 6);
        expect(pupil.userData.hitRadius).toBe(radius);
        eye.root.updateMatrixWorld(true);
        const ray = new THREE.Raycaster(new THREE.Vector3(0.18, 0, 2), new THREE.Vector3(0, 0, -1));
        expect(ray.intersectObject(iris, true).length > 0).toBe(radius < 0.18);
      }
    } finally { eye.dispose(); }
  });

  it('accommodates the actual lens, ciliary ring and zonules reversibly without changing cornea or axial length', () => {
    const eye = buildEye();
    const ids = ['iris', 'pupil', 'lens', 'ciliary-body', 'zonules', 'cornea', 'retina'] as const;
    const snapshot = () => ids.map(id => eye.parts.get(id)!.group.children.map(object =>
      Array.from((object as THREE.Mesh).geometry.getAttribute('position').array)));
    const initial = snapshot();
    const bounds = (id: typeof ids[number]) => new THREE.Box3().setFromObject(eye.parts.get(id)!.group);
    const lens = bounds('lens'), ciliary = bounds('ciliary-body'), retina = bounds('retina'), cornea = bounds('cornea');
    try {
      setOpticalGeometry(eye.root, { pupilRadius: 0.1505, accommodation: 1 });
      expect(bounds('lens').getSize(new THREE.Vector3()).z).toBeGreaterThan(lens.getSize(new THREE.Vector3()).z);
      expect(bounds('lens').getSize(new THREE.Vector3()).x).toBeLessThan(lens.getSize(new THREE.Vector3()).x);
      expect(bounds('ciliary-body').getSize(new THREE.Vector3()).x).toBeLessThan(ciliary.getSize(new THREE.Vector3()).x);
      expect(snapshot()[4]).not.toEqual(initial[4]);
      expect(bounds('retina')).toEqual(retina);
      expect(bounds('cornea')).toEqual(cornea);
      const accommodated = snapshot().slice(0, 5);
      setPosteriorStretch(eye.root, 1.3);
      expect(snapshot().slice(0, 5)).toEqual(accommodated);
      setOpticalGeometry(eye.root, { pupilRadius: 0.2795, accommodation: 0.4 });
      expect(bounds('retina').min.z).toBeCloseTo(retina.min.z * 1.3, 5);
      setPosteriorStretch(eye.root, 1);
      setOpticalGeometry(eye.root, { pupilRadius: 0.215, accommodation: 0 });
      expect(snapshot()).toEqual(initial);
      setPosteriorStretch(eye.root, 1.2);
      setOpticalGeometry(eye.root, { pupilRadius: 0.2795, accommodation: 1 });
      setOpticalGeometry(eye.root, { pupilRadius: 0.215, accommodation: 0 });
      setPosteriorStretch(eye.root, 1);
      expect(snapshot()).toEqual(initial);
    } finally { eye.dispose(); }
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

  it('keeps the explicitly retained half and slider axes stable when orbiting', () => {
    const section = new SectionTool();
    for (const [axis, direction] of [
      ['sagittal', new THREE.Vector3(1, 0, 0)],
      ['axial', new THREE.Vector3(0, 1, 0)],
      ['coronal', new THREE.Vector3(0, 0, 1)],
    ] as const) {
      const camera = new THREE.PerspectiveCamera();
      camera.position.copy(direction).multiplyScalar(4);
      section.update({ enabled: true, axis, offset: 0.2, keepSide: 'negative' }, camera);
      expect(section.keeps(direction.clone().multiplyScalar(0.5))).toBe(false);
      expect(section.keeps(direction.clone().multiplyScalar(-0.5))).toBe(true);
      expect(section.plane.distanceToPoint(direction.clone().multiplyScalar(0.2))).toBeCloseTo(0);
      camera.position.negate();
      section.update({ enabled: true, axis, offset: 0.2, keepSide: 'negative' }, camera);
      expect(section.keeps(direction.clone().multiplyScalar(0.5))).toBe(false);
      expect(section.plane.distanceToPoint(direction.clone().multiplyScalar(0.2))).toBeCloseTo(0);
    }
  });
});
