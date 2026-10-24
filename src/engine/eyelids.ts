import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ADNEXAL_IDS, type StructureId } from '../anatomy/types';
import type { EyePart } from './geometry';

type AdnexalId = typeof ADNEXAL_IDS[number];
const RADIUS = 1.034;
const LIMBUS = Math.acos(0.707 / RADIUS);
const FORNIX = 1.3;

// shortcut: layer thicknesses and gland spacing emphasize visibility; use measured assets for surgical anatomy.
function lidPoint(angle: number, v: number, depth = 0) {
  const upper = Math.sin(angle) >= 0;
  const x = (1.12 + 0.18 * v) * Math.cos(angle);
  const y = 0.015 + 0.035 * Math.cos(angle) + THREE.MathUtils.lerp(upper ? 0.55 : 0.44, upper ? 1.12 : 1.02, v) * Math.sin(angle);
  const radius = Math.hypot(x, y);
  const sclera = Math.sqrt(Math.max(0.05, 1.03 ** 2 - radius ** 2));
  const cornea = radius < 0.733 ? 1.09 - 0.65 * radius ** 2 : 0;
  return new THREE.Vector3(x, y, Math.max(sclera, cornea) + depth);
}

function spherePoint(angle: number, meridian: number) {
  return new THREE.Vector3(RADIUS * Math.sin(meridian) * Math.cos(angle), RADIUS * Math.sin(meridian) * Math.sin(angle), RADIUS * Math.cos(meridian));
}

function surface(point: (u: number, v: number) => THREE.Vector3, columns = 64, rows = 10, thickness = 0) {
  const positions: number[] = [], indices: number[] = [];
  const stride = columns + 1, layerSize = stride * (rows + 1);
  for (let side = 0; side < (thickness ? 2 : 1); side++) {
    for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
      const p = point(column / columns, row / rows);
      p.z += side === 0 ? thickness / 2 : -thickness / 2;
      positions.push(...p.toArray());
      if (row < rows && column < columns) {
        const a = side * layerSize + row * stride + column, b = a + stride;
        if (side) indices.push(a, a + 1, b, a + 1, b + 1, b);
        else indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  if (thickness) {
    const edge = (a: number, b: number) => indices.push(a, b, a + layerSize, b, b + layerSize, a + layerSize);
    for (let column = 0; column < columns; column++) { edge(column + 1, column); edge(rows * stride + column, rows * stride + column + 1); }
    for (let row = 0; row < rows; row++) { edge(row * stride, (row + 1) * stride); edge((row + 1) * stride + columns, row * stride + columns); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function tube(points: THREE.Vector3[], radius: number, segments = 16) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segments, radius, 8, false);
}
function bead(point: THREE.Vector3, size: [number, number, number]) {
  return new THREE.SphereGeometry(1, 8, 6).scale(...size).translate(point.x, point.y, point.z);
}

export function createEyeAdnexa(colors: Record<StructureId, string>): EyePart[] {
  const parts = new Map<AdnexalId, EyePart>();
  const materials = new Map<AdnexalId, THREE.MeshPhysicalMaterial>();
  for (const id of ADNEXAL_IDS) {
    const group = new THREE.Group();
    group.name = id;
    const opacity = id === 'bulbar-conjunctiva' ? 0.4 : 1;
    const material = new THREE.MeshPhysicalMaterial({ color: colors[id], roughness: id.includes('conjunctiva') ? 0.24 : 0.65, clearcoat: id.includes('conjunctiva') ? 0.45 : 0.04, opacity, transparent: opacity < 1, depthWrite: opacity === 1, side: THREE.DoubleSide });
    material.userData.baseOpacity = opacity;
    materials.set(id, material);
    parts.set(id, { id, group, anchor: new THREE.Vector3(), explode: new THREE.Vector3() });
  }
  const add = (id: AdnexalId, name: string, geometries: THREE.BufferGeometry[], material = materials.get(id)!) => {
    geometries.forEach(geometry => geometry.deleteAttribute('uv'));
    const geometry = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries)!;
    if (geometries.length > 1) geometries.forEach(source => source.dispose());
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    parts.get(id)!.group.add(mesh);
  };
  const anchor = (id: AdnexalId, point: THREE.Vector3, spread: [number, number, number]) => {
    parts.get(id)!.anchor.copy(point);
    parts.get(id)!.explode.set(...spread);
  };

  add('bulbar-conjunctiva', 'bulbar-surface', [surface((u, v) => spherePoint(u * Math.PI * 2, THREE.MathUtils.lerp(LIMBUS, FORNIX, v)), 96, 14)]);
  anchor('bulbar-conjunctiva', spherePoint(0.35, 1.05), [0.15, 0, 0.18]);
  add('palpebral-conjunctiva', 'conjunctival-fornices', [surface((u, v) => {
    const angle = u * Math.PI * 2;
    const point = spherePoint(angle, FORNIX).lerp(lidPoint(angle, 1, 0.012), v);
    point.z -= 0.12 * Math.sin(v * Math.PI);
    if (point.length() < RADIUS) point.setLength(RADIUS);
    return point;
  }, 96, 10)]);

  for (const [upper, start] of [[true, 0], [false, Math.PI]] as const) {
    const name = upper ? 'upper' : 'lower';
    for (const [id, depth, thickness, extent] of [
      ['palpebral-conjunctiva', 0.012, 0.008, 1],
      ['tarsal-plates', 0.049, 0.05, upper ? 0.57 : 0.37],
      ['orbicularis-oculi', 0.107, 0.042, 0.98],
      ['eyelid-skin', 0.157, 0.03, 1],
    ] as const) {
      add(id, `${name}-lid`, [surface((u, v) => lidPoint(start + u * Math.PI, v * extent, depth), 64, 12, thickness)]);
    }
    const fibers: THREE.BufferGeometry[] = [], glands: THREE.BufferGeometry[] = [], zeis: THREE.BufferGeometry[] = [], moll: THREE.BufferGeometry[] = [], lashes: THREE.BufferGeometry[] = [];
    for (const v of [0.12, 0.3, 0.5, 0.72, 0.9]) fibers.push(tube(Array.from({ length: 33 }, (_, i) => lidPoint(start + (0.025 + i / 32 * 0.95) * Math.PI, v, 0.13)), 0.003, 40));
    const fiberMaterial = materials.get('orbicularis-oculi')!.clone();
    fiberMaterial.color.set('#e0a093');
    add('orbicularis-oculi', `${name}-circular-fibers`, fibers, fiberMaterial);

    for (let i = 0; i < 19; i++) {
      const angle = start + (0.12 + i / 18 * 0.76) * Math.PI;
      const extent = upper ? 0.48 : 0.28;
      glands.push(tube(Array.from({ length: 7 }, (_, j) => lidPoint(angle, 0.015 + j / 6 * extent, 0.05)), 0.008, 14));
      for (let j = 1; j <= (upper ? 5 : 3); j++) for (const direction of [-1, 1]) {
        const point = lidPoint(angle + direction * 0.014, j / (upper ? 6 : 4) * extent, 0.05);
        glands.push(bead(point, [0.018, 0.024, 0.014]));
      }
      const follicle = lidPoint(angle, 0.015, 0.16);
      const lashEnd = follicle.clone().add(new THREE.Vector3(Math.cos(angle) * 0.04, (upper ? 1 : -1) * (upper ? 0.07 : 0.045), upper ? 0.19 : 0.13));
      lashes.push(tube([follicle, follicle.clone().lerp(lashEnd, 0.55).add(new THREE.Vector3(0, upper ? -0.025 : 0.025, 0.02)), lashEnd], 0.004, 9));
      for (const direction of [-1, 1]) zeis.push(bead(lidPoint(angle + direction * 0.012, 0.035, 0.136), [0.016, 0.02, 0.014]));
      const coil = lidPoint(angle + 0.025, 0.07, 0.126);
      moll.push(tube(Array.from({ length: 21 }, (_, j) => coil.clone().add(new THREE.Vector3(0.014 * Math.cos(j / 20 * Math.PI * 4), (j / 20 - 0.5) * 0.045, 0.009 * Math.sin(j / 20 * Math.PI * 4)))), 0.005, 22));
    }
    add('meibomian-glands', `${name}-ducts-and-acini`, glands);
    add('zeis-glands', `${name}-sebaceous-lobules`, zeis);
    add('moll-glands', `${name}-coiled-glands`, moll);
    const lashMaterial = materials.get('eyelid-skin')!.clone();
    lashMaterial.color.set('#49342b');
    add('eyelid-skin', `${name}-lashes`, lashes, lashMaterial);
  }
  anchor('palpebral-conjunctiva', lidPoint(Math.PI / 2, 0.3, 0.012), [0, 0.28, 0.29]);
  anchor('tarsal-plates', lidPoint(Math.PI / 2, 0.3, 0.049), [0, 0.4, 0.55]);
  anchor('orbicularis-oculi', lidPoint(Math.PI / 2, 0.4, 0.107), [0, 0.48, 0.83]);
  anchor('eyelid-skin', lidPoint(Math.PI / 2, 0.42, 0.157), [0, 0.56, 1.1]);
  anchor('meibomian-glands', lidPoint(Math.PI / 2, 0.25, 0.05), [0, 0.36, 0.65]);
  anchor('zeis-glands', lidPoint(Math.PI / 2, 0.035, 0.136), [-0.18, -0.15, 1.05]);
  anchor('moll-glands', lidPoint(Math.PI / 2, 0.07, 0.126), [0.18, -0.22, 0.95]);

  const levatorPath = new THREE.CatmullRomCurve3([new THREE.Vector3(0.32, 0.70, -1.65), new THREE.Vector3(0.16, 1.10, -0.85), new THREE.Vector3(0, 1.27, -0.1), new THREE.Vector3(0, 1.22, 0.32)]);
  add('levator-palpebrae', 'levator-muscle', [surface((u, v) => {
    const point = levatorPath.getPoint(v);
    point.x += (u - 0.5) * (0.13 + 0.24 * Math.sin(v * Math.PI / 2));
    return point;
  }, 12, 40, 0.04)]);
  const tendon = materials.get('levator-palpebrae')!.clone();
  tendon.color.set('#e8d7bb');
  add('levator-palpebrae', 'levator-aponeurosis', [surface((u, v) => {
    const top = new THREE.Vector3((u - 0.5) * 0.37, 1.22, 0.32);
    const attachment = lidPoint((0.23 + u * 0.54) * Math.PI, 0.43, 0.079);
    return top.lerp(attachment, v);
  }, 40, 12, 0.012)], tendon);
  anchor('levator-palpebrae', new THREE.Vector3(0, 1.25, -0.12), [0, 0.65, 0.12]);

  for (const part of parts.values()) part.group.traverse(object => {
    object.userData.structureId = part.id;
    object.userData.adnexal = true;
  });
  return [...parts.values()];
}
