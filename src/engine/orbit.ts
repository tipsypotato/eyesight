import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ORBITAL_IDS, type StructureId } from '../anatomy/types';
import type { EyePart } from './geometry';

type OrbitalId = typeof ORBITAL_IDS[number];
type Point = [number, number, number];

// shortcut: orbital contours and neurovascular routes are illustrative; use measured assets for surgical planning.
function wall(start: number) {
  const columns = 24, rows = 36, stride = columns + 1, layerSize = stride * (rows + 1);
  const positions: number[] = [], indices: number[] = [];
  for (let side = 0; side < 2; side++) for (let row = 0; row <= rows; row++) {
    const t = row / rows, width = Math.sin(t * Math.PI / 2) ** 0.65;
    for (let column = 0; column <= columns; column++) {
      const angle = start + column / columns * Math.PI / 2;
      const c = Math.cos(angle), s = Math.sin(angle);
      positions.push(0.52 * (1 - t) + (0.36 + 1.28 * width + side * 0.06) * Math.sign(c) * Math.abs(c) ** 0.65,
        (0.34 + 1.22 * width + side * 0.06) * Math.sign(s) * Math.abs(s) ** 0.65, -2.13 + 2.79 * t);
      if (row < rows && column < columns) {
        const a = side * layerSize + row * stride + column, b = a + stride;
        if (side) indices.push(a, a + 1, b, a + 1, b + 1, b);
        else indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const edge = (a: number, b: number) => indices.push(a, b, a + layerSize, b, b + layerSize, a + layerSize);
  for (let column = 0; column < columns; column++) { edge(column, column + 1); edge(rows * stride + column + 1, rows * stride + column); }
  for (let row = 0; row < rows; row++) { edge((row + 1) * stride, row * stride); edge(row * stride + columns, (row + 1) * stride + columns); }
  const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}

function lobule(center: Point, size: Point, angle = 0) {
  return new THREE.SphereGeometry(1, 16, 12).scale(...size).rotateZ(angle).translate(...center);
}

export function createOrbit(colors: Record<StructureId, string>): EyePart[] {
  const parts = new Map<OrbitalId, EyePart>(), materials = new Map<OrbitalId, THREE.MeshPhysicalMaterial>();
  for (const id of ORBITAL_IDS) {
    const group = new THREE.Group();
    group.name = id;
    const opacity = id.includes('fat') ? 0.58 : 1;
    const material = new THREE.MeshPhysicalMaterial({ color: colors[id], roughness: id.includes('vein') || id.includes('artery') ? 0.4 : 0.65,
      clearcoat: 0.06, opacity, transparent: opacity < 1, depthWrite: opacity === 1, side: THREE.DoubleSide });
    material.userData.baseOpacity = opacity;
    materials.set(id, material);
    parts.set(id, { id, group, anchor: new THREE.Vector3(), explode: new THREE.Vector3() });
  }
  const add = (id: OrbitalId, name: string, geometries: THREE.BufferGeometry[]) => {
    const geometry = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries)!;
    if (geometries.length > 1) geometries.forEach(source => source.dispose());
    const mesh = new THREE.Mesh(geometry, materials.get(id)!);
    mesh.name = name;
    parts.get(id)!.group.add(mesh);
  };
  const anchor = (id: OrbitalId, point: Point, spread: Point) => {
    parts.get(id)!.anchor.set(...point);
    parts.get(id)!.explode.set(...spread);
  };
  const tube = (id: OrbitalId, name: string, points: Point[], radius = 0.023) => {
    const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
    add(id, name, [new THREE.TubeGeometry(curve, 40, radius, 10, false)]);
  };

  for (const [id, start, point, spread] of [
    ['orbital-roof', Math.PI / 4, [0.16, 1.47, -0.2], [0, 0.8, -0.1]],
    ['orbital-floor', Math.PI * 5 / 4, [0.16, -1.47, -0.2], [0, -0.8, -0.1]],
    ['medial-orbital-wall', -Math.PI / 4, [1.57, 0, -0.2], [0.8, 0, -0.1]],
    ['lateral-orbital-wall', Math.PI * 3 / 4, [-1.25, 0, -0.2], [-0.8, 0, -0.1]],
  ] as const) {
    add(id, 'orbital-wall', [wall(start)]);
    anchor(id, [...point], [...spread]);
  }

  const inner: THREE.BufferGeometry[] = [], outer: THREE.BufferGeometry[] = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) {
    inner.push(lobule([0.30 + x * 0.16, y * 0.30, -1.48], [0.13, 0.12, 0.21]));
    inner.push(lobule([0.23 + x * 0.25, y * 0.37, -1.25], [0.17, 0.18, 0.20]));
  }
  for (let i = 0; i < 4; i++) {
    const angle = Math.PI / 4 + i * Math.PI / 2;
    outer.push(lobule([Math.cos(angle) * 1.3, Math.sin(angle) * 1.3, -0.28], [0.17, 0.25, 0.37], angle));
    outer.push(lobule([0.20 + Math.cos(angle) * 1.04, Math.sin(angle) * 1.04, -1.0], [0.16, 0.22, 0.29], angle));
  }
  add('intraconal-fat', 'intraconal-lobules', inner);
  add('extraconal-fat', 'extraconal-lobules', outer);
  anchor('intraconal-fat', [-0.02, -0.37, -1.25], [-0.28, -0.25, -0.35]);
  anchor('extraconal-fat', [-0.92, -0.92, -0.28], [-0.45, -0.45, 0.05]);

  const iii: Point = [0.2, -0.22, -1.4];
  tube('oculomotor-nerve', 'oculomotor-trunk', [[0.35, -0.12, -2.07], [0.35, -0.15, -1.7], iii], 0.032);
  tube('oculomotor-nerve', 'to-superior-rectus', [iii, [0.13, 0.15, -1.45], [0.18, 0.50, -1.26], [0.16, 0.77, -1.03]]);
  tube('oculomotor-nerve', 'to-levator', [[0.18, 0.50, -1.26], [0.12, 0.79, -1.15], [0.15, 1.05, -0.9]], 0.018);
  tube('oculomotor-nerve', 'to-medial-rectus', [iii, [0.60, -0.15, -1.20], [0.98, 0, -1]]);
  tube('oculomotor-nerve', 'to-inferior-rectus', [iii, [0.18, -0.50, -1.1], [0.12, -0.9, -0.8]]);
  tube('oculomotor-nerve', 'to-inferior-oblique', [[0.18, -0.50, -1.1], [0.20, -1.09, -0.6], [0.15, -1.24, -0.2], [0.25, -1.18, 0.2]], 0.018);
  anchor('oculomotor-nerve', [0.2, -0.22, -1.4], [0, -0.32, -0.55]);
  tube('trochlear-nerve', 'to-superior-oblique', [[0.35, 0.42, -2.05], [0.40, 0.70, -1.6], [0.70, 0.86, -1.1], [0.9, 0.74, -1.05]], 0.018);
  anchor('trochlear-nerve', [0.70, 0.86, -1.1], [0.15, 0.55, -0.35]);
  tube('abducens-nerve', 'to-lateral-rectus', [[0.16, -0.12, -2.07], [0.10, -0.08, -1.66], [-0.32, -0.04, -1.35], [-0.72, 0, -1]]);
  anchor('abducens-nerve', [-0.32, -0.04, -1.35], [-0.45, 0, -0.35]);

  tube('frontal-nerve', 'frontal-trunk', [[0.28, 0.34, -2.05], [0.20, 0.88, -1.45], [0.04, 1.34, -0.55], [0.10, 1.43, 0.15]], 0.026);
  tube('frontal-nerve', 'supraorbital-branch', [[0.10, 1.43, 0.15], [0.15, 1.44, 0.4], [0.25, 1.43, 0.64]], 0.022);
  tube('frontal-nerve', 'supratrochlear-branch', [[0.10, 1.43, 0.15], [0.42, 1.40, 0.38], [0.70, 1.36, 0.64]], 0.018);
  anchor('frontal-nerve', [0.04, 1.34, -0.55], [0, 0.65, 0.1]);
  tube('lacrimal-nerve', 'lacrimal-course', [[0.20, 0.30, -2.05], [-0.28, 0.64, -1.42], [-0.83, 0.64, -0.77], [-1.14, 0.81, -0.05], [-1.11, 1.01, 0.24]], 0.021);
  anchor('lacrimal-nerve', [-1.14, 0.81, -0.05], [-0.55, 0.3, 0.15]);
  tube('nasociliary-nerve', 'nasociliary-course', [[0.45, 0.18, -2.05], [0.48, 0.22, -1.55], [0.35, 0.27, -1.22], [0.63, 0.35, -0.94], [1.05, 0.35, -0.54], [1.23, 0.45, 0.22], [1.13, 0.55, 0.60]], 0.022);
  tube('nasociliary-nerve', 'sensory-root-to-ganglion', [[0.35, 0.27, -1.22], [0.08, 0.13, -1.26], [-0.03, -0.1, -1.17]], 0.014);
  anchor('nasociliary-nerve', [1.05, 0.35, -0.54], [0.5, 0.15, 0.1]);
  add('ciliary-ganglion', 'ciliary-ganglion-body', [lobule([-0.03, -0.1, -1.17], [0.06, 0.08, 0.045])]);
  tube('ciliary-ganglion', 'short-ciliary-branches', [[-0.03, -0.1, -1.17], [-0.08, -0.13, -1.10], [-0.12, -0.14, -1.04]], 0.014);
  anchor('ciliary-ganglion', [-0.03, -0.1, -1.17], [-0.3, -0.15, -0.5]);

  tube('ophthalmic-artery', 'ophthalmic-trunk', [[0.62, -0.1, -2.10], [0.36, -0.15, -1.62], [0.25, 0.12, -1.40], [0.25, 0.38, -1.16], [0.55, 0.60, -0.93], [0.95, 0.76, -0.62], [1.14, 0.74, 0.12]], 0.033);
  tube('ophthalmic-artery', 'lacrimal-arterial-branch', [[0.25, 0.38, -1.16], [-0.23, 0.60, -1.11], [-0.78, 0.85, -0.48], [-1.0, 1.0, 0.2]], 0.019);
  anchor('ophthalmic-artery', [0.55, 0.60, -0.93], [0.3, 0.35, -0.2]);
  tube('superior-ophthalmic-vein', 'superior-venous-course', [[1.08, 0.94, 0.40], [0.68, 1.11, -0.21], [0.12, 0.90, -0.98], [-0.1, 0.55, -1.49], [0.26, 0.20, -2.07]], 0.043);
  anchor('superior-ophthalmic-vein', [0.68, 1.11, -0.21], [0.1, 0.55, 0.1]);
  tube('inferior-ophthalmic-vein', 'inferior-venous-course', [[1.03, -0.78, 0.26], [0.39, -1.04, -0.58], [0.18, -0.7, -1.26], [0.10, -0.35, -1.87], [0.26, 0.20, -2.07]], 0.034);
  anchor('inferior-ophthalmic-vein', [0.39, -1.04, -0.58], [0.1, -0.55, 0.1]);
  add('lacrimal-gland', 'lacrimal-lobules', [
    lobule([-1.00, 0.99, 0.18], [0.28, 0.17, 0.31], -0.4),
    lobule([-1.10, 0.95, 0.32], [0.19, 0.14, 0.22], -0.4),
    lobule([-0.88, 1.06, 0.23], [0.19, 0.13, 0.22], -0.4),
  ]);
  anchor('lacrimal-gland', [-1.02, 0.99, 0.18], [-0.5, 0.45, 0.3]);

  for (const part of parts.values()) part.group.traverse(object => {
    object.userData.structureId = part.id;
    object.userData.orbital = true;
  });
  return [...parts.values()];
}
