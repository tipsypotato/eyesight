import * as THREE from 'three';
import type { StructureId } from '../anatomy/types';
import { createIrisTextures } from './irisTexture';
import { createFundusDetails } from './fundus';

export interface EyePart {
  id: StructureId;
  group: THREE.Group;
  anchor: THREE.Vector3;
  explode: THREE.Vector3;
  shell?: { outer: number; inner: number; front: number };
}

const COLORS: Record<StructureId, string> = {
  cornea: '#a7dfe4', sclera: '#ebe3ce', iris: '#46847d', pupil: '#334c50',
  'ciliary-body': '#b86b61', zonules: '#e9dab2', lens: '#f6d98b',
  'anterior-chamber': '#8ed9e2', 'posterior-chamber': '#a1dbe0', vitreous: '#95cdd5',
  choroid: '#96564e', retina: '#e9ac76', macula: '#c79436', fovea: '#a14a32',
  'optic-disc': '#f4d79f', 'optic-nerve': '#d9b477', 'retinal-vessels': '#c14f48',
};

const profile = (points: [number, number][]) => {
  const geometry = new THREE.LatheGeometry(points.map(([r, z]) => new THREE.Vector2(r, z)), 96);
  geometry.rotateX(Math.PI / 2);
  return geometry;
};

function shell(outer: number, inner: number, front: number) {
  const points: [number, number][] = [];
  for (const [radius, reverse] of [[outer, false], [inner, true]] as const) {
    const start = Math.acos(front / radius);
    for (let i = 0; i <= 56; i++) {
      const t = reverse ? 1 - i / 56 : i / 56;
      const angle = start + (Math.PI - start) * t;
      points.push([Math.sin(angle) * radius, Math.cos(angle) * radius]);
    }
  }
  points.push(points[0]);
  return profile(points);
}

function truncatedSphere(radius: number, front: number) {
  const points: [number, number][] = [[0, front]];
  const start = Math.acos(front / radius);
  for (let i = 0; i <= 48; i++) {
    const angle = start + (Math.PI - start) * i / 48;
    points.push([Math.sin(angle) * radius, Math.cos(angle) * radius]);
  }
  return profile(points);
}

function cornealShell() {
  const outerRim = Math.sqrt(1.02 ** 2 - 0.71 ** 2);
  const innerRim = Math.sqrt(0.967 ** 2 - 0.71 ** 2);
  const conic = -0.24;
  const sag = 0.38;
  const curvature = (outerRim ** 2 + (1 + conic) * sag ** 2) / (2 * sag);
  const points: [number, number][] = [];
  for (const inner of [false, true]) {
    for (let i = 0; i <= 64; i++) {
      const t = inner ? 1 - i / 64 : i / 64;
      const r = outerRim * t;
      const z = 1.09 - r * r / (curvature * (1 + Math.sqrt(1 - (1 + conic) * r * r / curvature ** 2)));
      points.push([inner ? innerRim * t : r, z - (inner ? 0.035 * (1 - t * t) : 0)]);
    }
  }
  points.push(points[0]);
  return profile(points);
}

function lensSurface(radius: number, anterior: number, posterior: number) {
  const points: [number, number][] = [];
  for (let i = 0; i <= 80; i++) {
    const angle = i / 80 * Math.PI;
    points.push([radius * Math.sin(angle), 0.455 + (angle < Math.PI / 2 ? anterior : posterior) * Math.cos(angle)]);
  }
  return profile(points);
}

function irisSurface() {
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  const sectors = 192, rings = 40;
  for (let j = 0; j <= rings; j++) {
    const t = j / rings;
    const radius = 0.215 + t * 0.435;
    for (let i = 0; i <= sectors; i++) {
      const angle = i / sectors * Math.PI * 2;
      const collarDistance = (t - 0.28 - 0.018 * Math.sin(angle * 11)) / 0.07;
      const collar = 0.010 * Math.exp(-collarDistance * collarDistance);
      const folds = 0.0012 * Math.sin(angle * 83 + t * 11) * Math.sin(t * Math.PI);
      const z = 0.669 + collar + folds + 0.002 * Math.sin(t * Math.PI);
      positions.push(radius * Math.cos(angle), radius * Math.sin(angle), z);
      uv.push(i / sectors, t);
      if (i < sectors && j < rings) {
        const a = j * (sectors + 1) + i, c = a + sectors + 1;
        indices.push(a, c, a + 1, a + 1, c, c + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** A real annulus at the intersection of a clipping plane and a hollow wall. */
export function createShellSection(outer: number, inner: number, offset: number): THREE.BufferGeometry {
  if (Math.abs(offset) >= outer) {
    return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([], 3));
  }
  return new THREE.RingGeometry(Math.sqrt(Math.max(0, inner * inner - offset * offset)), Math.sqrt(outer * outer - offset * offset), 96);
}

/** Extend the posterior hemisphere while preserving the cornea, lens and limbus. */
export function setPosteriorStretch(root: THREE.Group, factor: number) {
  const vertex = new THREE.Vector3();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.Line) || object.userData.cap) return;
    const geometry = object.geometry;
    const position = geometry.getAttribute('position');
    if (!geometry.userData.originalPositions) geometry.userData.originalPositions = new Float32Array(position.array);
    const original = geometry.userData.originalPositions as Float32Array;
    object.updateMatrix();
    const inverse = object.matrix.clone().invert();
    for (let i = 0; i < position.count; i++) {
      vertex.fromArray(original, i * 3).applyMatrix4(object.matrix);
      if (vertex.z < 0) vertex.z *= factor;
      vertex.applyMatrix4(inverse);
      position.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    position.needsUpdate = true;
    if (geometry.getAttribute('normal')) geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  });
}

/** Procedural adult right eye. +X nasal, +Y superior, +Z anterior; dimensions are schematic. */
export function buildEye(colors: Partial<Record<StructureId, string>> = {}) {
  const root = new THREE.Group();
  const parts = new Map<StructureId, EyePart>();
  const materials = new Map<StructureId, THREE.MeshPhysicalMaterial>();

  const part = (id: StructureId, anchor: [number, number, number], spread: [number, number, number], opacity = 1) => {
    const group = new THREE.Group();
    group.name = id;
    group.userData.structureId = id;
    root.add(group);
    const item: EyePart = { id, group, anchor: new THREE.Vector3(...anchor), explode: new THREE.Vector3(...spread) };
    parts.set(id, item);
    const material = new THREE.MeshPhysicalMaterial({
      color: colors[id] ?? COLORS[id], roughness: 0.58, metalness: 0, side: THREE.DoubleSide,
      transparent: opacity < 1, opacity, depthWrite: opacity >= 0.99,
      clearcoat: id === 'cornea' || id === 'lens' ? 0.6 : 0.06,
      clearcoatRoughness: 0.24,
    });
    material.userData.baseOpacity = opacity;
    materials.set(id, material);
    return item;
  };
  const mesh = (id: StructureId, geometry: THREE.BufferGeometry, position: [number, number, number] = [0, 0, 0], scale?: [number, number, number]) => {
    const object = new THREE.Mesh(geometry, materials.get(id)!);
    object.position.set(...position);
    if (scale) object.scale.set(...scale);
    object.userData.structureId = id;
    parts.get(id)!.group.add(object);
    return object;
  };
  const tube = (id: StructureId, points: THREE.Vector3[], radius: number, color?: string) => {
    const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 30, radius, 6, false);
    const object = mesh(id, geometry);
    if (color) {
      object.material = object.material.clone();
      object.material.color.set(color);
    }
    return object;
  };

  for (const [id, outer, inner, front, anchor, spread] of [
    ['sclera', 1.02, 0.967, 0.71, [-0.73, 0.50, 0.02], [-0.12, 0.12, 0]],
    ['choroid', 0.962, 0.939, 0.68, [-0.67, 0.47, -0.43], [-0.04, 0.05, -0.12]],
    ['retina', 0.934, 0.914, 0.57, [-0.56, 0.32, -0.66], [0, 0, -0.25]],
  ] as const) {
    const item = part(id, [...anchor], [...spread]);
    item.shell = { outer, inner, front };
    const wall = mesh(id, shell(outer, inner, front));
    if (id === 'retina') {
      const position = wall.geometry.getAttribute('position');
      const base = new THREE.Color('#d1876f');
      const color = new THREE.Color();
      const values: number[] = [];
      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
        const mottling = Math.sin(x * 71 + Math.sin(y * 37)) * Math.sin(z * 59 - y * 43);
        color.copy(base).multiplyScalar(0.96 + 0.024 * mottling + 0.035 * y);
        values.push(color.r, color.g, color.b);
      }
      wall.geometry.setAttribute('color', new THREE.Float32BufferAttribute(values, 3));
      wall.material.color.set('#ffffff');
      wall.material.vertexColors = true;
      wall.material.roughness = 0.69;
      wall.material.clearcoat = 0.12;
    }
  }

  part('cornea', [-0.29, 0.18, 1.02], [0, 0, 1.05], 0.18);
  const cornea = mesh('cornea', cornealShell());
  cornea.name = 'corneal-shell';
  // shortcut: alpha transparency keeps sections readable; calibrated refraction needs measured optical materials.
  cornea.material.color.set('#e5efea');
  cornea.material.roughness = 0.055;
  cornea.material.clearcoat = 1;
  cornea.material.clearcoatRoughness = 0.04;
  cornea.material.ior = 1.376;

  part('iris', [-0.41, 0.19, 0.66], [0, 0, 0.66]);
  const irisBody = mesh('iris', profile([[0.215, 0.646], [0.63, 0.646], [0.655, 0.659], [0.65, 0.666], [0.215, 0.666], [0.215, 0.646]]));
  irisBody.material.color.set('#30251e');
  irisBody.material.roughness = 0.78;
  const textures = createIrisTextures();
  const iris = mesh('iris', irisSurface());
  iris.name = 'iris-stroma';
  iris.material = irisBody.material.clone();
  iris.material.color.set('#ffffff');
  iris.material.map = textures.color;
  iris.material.bumpMap = textures.relief;
  iris.material.bumpScale = 0.007;
  iris.material.roughness = 0.72;

  part('pupil', [0, 0, 0.677], [0, 0, 0.66]);
  // The pupil is an aperture: only its boundary is drawn; hit testing uses the open circle.
  const pupilPoints = Array.from({ length: 96 }, (_, i) => new THREE.Vector3(0.214 * Math.cos(i / 96 * Math.PI * 2), 0.214 * Math.sin(i / 96 * Math.PI * 2), 0.678));
  const pupilMaterial = new THREE.LineBasicMaterial({ color: '#253f3b', transparent: true, opacity: 0.8 });
  pupilMaterial.userData.baseOpacity = 0.8;
  parts.get('pupil')!.group.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pupilPoints), pupilMaterial));

  part('lens', [-0.17, -0.12, 0.46], [0, 0, 0.35], 0.27);
  const capsule = mesh('lens', lensSurface(0.435, 0.145, 0.185));
  capsule.name = 'lens-capsule';
  capsule.material.color.set('#e4ead8');
  capsule.material.roughness = 0.10;
  capsule.material.clearcoat = 1;
  capsule.material.clearcoatRoughness = 0.07;
  capsule.material.ior = 1.40;
  const nucleus = mesh('lens', lensSurface(0.31, 0.095, 0.125));
  nucleus.name = 'lens-nucleus';
  nucleus.material = capsule.material.clone();
  nucleus.material.color.set('#e7d7a6');
  nucleus.material.opacity = 0.36;
  nucleus.material.userData.baseOpacity = 0.36;
  nucleus.material.roughness = 0.25;

  part('ciliary-body', [-0.60, 0.13, 0.48], [0, 0, 0.25]);
  mesh('ciliary-body', new THREE.TorusGeometry(0.666, 0.070, 16, 96), [0, 0, 0.48]);
  for (let i = 0; i < 48; i++) {
    const angle = i * Math.PI * 2 / 48;
    const fold = mesh('ciliary-body', new THREE.SphereGeometry(1, 8, 6), [0.609 * Math.cos(angle), 0.609 * Math.sin(angle), 0.493], [0.065, 0.019, 0.044]);
    fold.rotation.z = angle;
  }

  part('zonules', [-0.50, -0.18, 0.47], [0, 0, 0.28]);
  for (let i = 0; i < 48; i++) {
    const angle = i * Math.PI * 2 / 48;
    for (const side of [-1, 1]) {
      const start = new THREE.Vector3(0.607 * Math.cos(angle), 0.607 * Math.sin(angle), 0.49);
      const end = new THREE.Vector3(0.423 * Math.cos(angle + side * 0.025), 0.423 * Math.sin(angle + side * 0.025), 0.455 + side * 0.04);
      const object = mesh('zonules', new THREE.CylinderGeometry(0.0027, 0.0027, start.distanceTo(end), 5), start.clone().add(end).multiplyScalar(0.5).toArray());
      object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
    }
  }

  part('anterior-chamber', [-0.22, -0.31, 0.82], [0, 0, 0.84], 0.07);
  mesh('anterior-chamber', new THREE.SphereGeometry(1, 48, 24), [0, 0, 0.815], [0.605, 0.605, 0.12]);
  part('posterior-chamber', [-0.49, 0.24, 0.62], [0, 0, 0.50], 0.13);
  mesh('posterior-chamber', profile([[0.245, 0.625], [0.59, 0.603], [0.615, 0.64], [0.245, 0.64], [0.245, 0.625]]));
  part('vitreous', [-0.34, -0.32, -0.28], [0, -0.16, -0.10], 0.055);
  mesh('vitreous', truncatedSphere(0.900, 0.275));

  const fundusZ = (x: number, y: number) => -Math.sqrt(Math.max(0.05, 0.906 ** 2 - x * x - y * y));
  const fundus = createFundusDetails();
  for (const [id, x, y, group] of [
    ['macula', -0.18, -0.025, fundus.macula],
    ['fovea', -0.18, -0.025, fundus.fovea],
    ['optic-disc', 0.30, 0.035, fundus.opticDisc],
    ['retinal-vessels', -0.41, 0.37, fundus.vessels],
  ] as const) {
    const item = part(id, [x, y, fundusZ(x, y)], [0, 0, -0.25]);
    item.group.add(group);
  }

  part('optic-nerve', [0.44, 0.03, -1.23], [0.10, 0, -0.40]);
  const nervePoints = [new THREE.Vector3(0.31, 0.035, -0.87), new THREE.Vector3(0.38, 0.03, -1.10), new THREE.Vector3(0.51, 0.045, -1.37), new THREE.Vector3(0.61, 0.065, -1.62)];
  tube('optic-nerve', nervePoints, 0.105);
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI * 2 / 8;
    tube('optic-nerve', nervePoints.map(p => p.clone().add(new THREE.Vector3(Math.cos(angle) * 0.088, Math.sin(angle) * 0.088, 0))), 0.008, '#eed4a0');
  }


  root.updateMatrixWorld(true);
  return {
    root, parts,
    dispose() {
      const geometries = new Set<THREE.BufferGeometry>();
      const ownedMaterials = new Set<THREE.Material>(materials.values());
      root.traverse(object => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          geometries.add(object.geometry);
          (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => ownedMaterials.add(material));
        }
      });
      geometries.forEach(geometry => geometry.dispose());
      const textures = new Set<THREE.Texture>();
      ownedMaterials.forEach(material => {
        if (material instanceof THREE.MeshPhysicalMaterial) {
          if (material.map) textures.add(material.map);
          if (material.bumpMap) textures.add(material.bumpMap);
        }
      });
      textures.forEach(texture => texture.dispose());
      ownedMaterials.forEach(material => material.dispose());
    },
  };
}
