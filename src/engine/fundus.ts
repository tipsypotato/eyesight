import * as THREE from 'three';

type FundusId = 'macula' | 'fovea' | 'optic-disc' | 'retinal-vessels';
type Ring = [extent: number, radius: number, color: string];
const SURFACE_RADIUS = 0.912;

function surfacePoint(x: number, y: number, radius = SURFACE_RADIUS) {
  return new THREE.Vector3(x, y, -Math.sqrt(radius * radius - x * x - y * y));
}

function material(color: string, vertexColors = false) {
  const result = new THREE.MeshPhysicalMaterial({
    color, vertexColors, roughness: 0.76, metalness: 0,
    clearcoat: 0.02, clearcoatRoughness: 0.7, side: THREE.DoubleSide,
  });
  result.userData.baseOpacity = 1;
  return result;
}

function addMesh(group: THREE.Group, geometry: THREE.BufferGeometry, appearance: THREE.MeshPhysicalMaterial) {
  const mesh = new THREE.Mesh(geometry, appearance);
  mesh.userData.structureId = group.userData.structureId;
  group.add(mesh);
}

function group(id: FundusId) {
  const result = new THREE.Group();
  result.name = id;
  result.userData.structureId = id;
  return result;
}

function patch(center: [number, number], rx: number, ry: number, rings: Ring[]) {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const segments = 64;
  let previousStart = 0, previousCount = 0;
  for (const [extent, radius, hex] of rings) {
    const start = positions.length / 3;
    const count = extent === 0 ? 1 : segments;
    const color = new THREE.Color(hex);
    for (let i = 0; i < count; i++) {
      const angle = i / segments * Math.PI * 2;
      const point = surfacePoint(center[0] + rx * extent * Math.cos(angle), center[1] + ry * extent * Math.sin(angle), radius);
      positions.push(...point.toArray());
      colors.push(color.r, color.g, color.b);
      if (previousCount) {
        const next = (i + 1) % segments;
        if (previousCount === 1) indices.push(previousStart, start + i, start + next);
        else indices.push(previousStart + i, start + i, start + next, previousStart + i, start + next, previousStart + next);
      }
    }
    previousStart = start;
    previousCount = count;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function vesselTree(vein: boolean) {
  const positions: number[] = [], indices: number[] = [];
  const radialSegments = 6;
  const offset = vein ? 0.021 : 0;
  const addBranch = (curve: THREE.SplineCurve, width: number, segments: number) => {
    const start = positions.length / 3;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const point = curve.getPoint(t), tangent = curve.getTangent(t);
      const radius = width * (1 - 0.86 * t);
      for (let j = 0; j <= radialSegments; j++) {
        const angle = j / radialSegments * Math.PI;
        const lateral = radius * Math.cos(angle);
        // Reproject every cross-section vertex: the rounded ribbon follows the retina even between branches.
        const vertex = surfacePoint(point.x - tangent.y * lateral, point.y + tangent.x * lateral, SURFACE_RADIUS - radius * 0.6 * Math.sin(angle));
        positions.push(...vertex.toArray());
        if (i < segments && j < radialSegments) {
          const a = start + i * (radialSegments + 1) + j, b = a + radialSegments + 1;
          indices.push(a, a + 1, b, a + 1, b + 1, b);
        }
      }
    }
  };
  for (const superior of [-1, 1]) for (const temporal of [true, false]) {
    const route = temporal
      ? [[0.30, 0.035], [0.18, superior * 0.19], [-0.07, superior * 0.31], [-0.34, superior * 0.32], [-0.58, superior * 0.23], [-0.69, superior * 0.11]]
      : [[0.30, 0.035], [0.43, superior * 0.15], [0.55, superior * 0.34], [0.60, superior * 0.48], [0.50, superior * 0.61]];
    const curve = new THREE.SplineCurve(route.map(([x, y], index) => new THREE.Vector2(x + (index ? offset : 0), y + (index ? superior * offset : 0))));
    const width = vein ? 0.0069 : 0.0052;
    addBranch(curve, width, 42);
    for (const t of [0.36, 0.64]) {
      const start = curve.getPoint(t);
      const end = temporal
        ? new THREE.Vector2(t < 0.5 ? -0.19 : -0.53, superior * (t < 0.5 ? 0.65 : 0.56))
        : new THREE.Vector2(t < 0.5 ? 0.74 : 0.68, superior * (t < 0.5 ? 0.27 : 0.42));
      end.x += offset * 0.5;
      end.y += superior * offset * 0.5;
      const mid = start.clone().lerp(end, 0.5);
      mid.x += temporal ? 0.025 : 0.015;
      addBranch(new THREE.SplineCurve([start, mid, end]), width * (1 - 0.86 * t) * 0.69, 20);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createFundusDetails() {
  const macula = group('macula'), fovea = group('fovea'), opticDisc = group('optic-disc'), vessels = group('retinal-vessels');
  // shortcut: shallow surface relief preserves the intact retinal shell; histology would require a remodeled shell.
  addMesh(macula, patch([-0.18, -0.025], 0.126, 0.112, [
    [0.23, 0.910, '#9f6358'], [0.32, 0.910, '#a3675b'], [0.46, 0.9103, '#ae6e60'],
    [0.62, 0.9107, '#ba7766'], [0.79, 0.9112, '#c17c69'], [0.92, 0.9117, '#cb836d'], [1, 0.912, '#d1876f'],
  ]), material('#ffffff', true));
  addMesh(fovea, patch([-0.18, -0.025], 0.034, 0.031, [
    [0, 0.913, '#70463f'], [0.20, 0.9129, '#764a42'], [0.40, 0.9125, '#805047'],
    [0.60, 0.9116, '#8d584e'], [0.80, 0.9103, '#975f54'], [1, 0.9099, '#9f6358'],
  ]), material('#ffffff', true));
  addMesh(opticDisc, patch([0.30, 0.035], 0.078, 0.093, [
    [0, 0.9129, '#e8c9b0'], [0.16, 0.9128, '#e6c4a9'], [0.30, 0.9122, '#deb597'],
    [0.48, 0.9104, '#d7a485'], [0.65, 0.9098, '#d6a183'], [0.82, 0.9104, '#d9a58a'],
    [0.94, 0.9113, '#d2a084'], [1, 0.912, '#ca977b'],
  ]), material('#ffffff', true));
  addMesh(vessels, vesselTree(false), material('#a35245'));
  addMesh(vessels, vesselTree(true), material('#713f3b'));
  return { macula, fovea, opticDisc, vessels };
}
