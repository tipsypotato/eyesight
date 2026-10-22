import * as THREE from 'three';
import { EXTRAOCULAR_IDS, type StructureId } from '../anatomy/types';
import type { EyePart } from './geometry';

type Point = [number, number, number];
type Band = { points: Point[]; width: number; tendon: number };
type Muscle = { anchor: Point; spread: Point; bands: Band[] };

// shortcut: orbital courses and attachments are illustrative; measured anatomy is needed for muscle mechanics.
const MUSCLES: Record<typeof EXTRAOCULAR_IDS[number], Muscle> = {
  'superior-rectus': {
    anchor: [0.02, 1.15, -0.23], spread: [0, 0.48, -0.12],
    bands: [{ width: 0.23, tendon: 0.76, points: [[0.45, 0.18, -1.75], [0.31, 0.55, -1.35], [0.10, 0.98, -0.8], [0.02, 1.15, -0.23], [0, 1.10, 0.02], [0, 1.016, 0.2]] }],
  },
  'inferior-rectus': {
    anchor: [0.015, -1.10, -0.18], spread: [0, -0.48, -0.12],
    bands: [{ width: 0.22, tendon: 0.81, points: [[0.45, -0.13, -1.75], [0.30, -0.55, -1.37], [0.10, -0.95, -0.75], [0.015, -1.10, -0.18], [0, -1.06, 0.10], [0, -0.978, 0.34]] }],
  },
  'medial-rectus': {
    anchor: [1.12, 0, -0.05], spread: [0.48, 0, -0.12],
    bands: [{ width: 0.23, tendon: 0.87, points: [[0.61, 0.04, -1.75], [0.90, 0.02, -1.3], [1.10, 0, -0.65], [1.12, 0, -0.05], [1.06, 0, 0.2], [0.947, 0, 0.42]] }],
  },
  'lateral-rectus': {
    anchor: [-1.11, 0, -0.15], spread: [-0.48, 0, -0.12],
    bands: [{ width: 0.21, tendon: 0.77, points: [[0.29, 0.04, -1.75], [-0.35, 0.02, -1.34], [-0.91, 0, -0.78], [-1.11, 0, -0.15], [-1.07, 0, 0.12], [-1.00, 0, 0.27]] }],
  },
  'superior-oblique': {
    anchor: [1.02, 0.95, -0.15], spread: [0.22, 0.50, 0.10],
    bands: [
      { width: 0.115, tendon: 0.81, points: [[0.69, 0.32, -1.73], [0.90, 0.74, -1.05], [1.05, 0.97, -0.25], [0.96, 1.02, 0.34], [0.93, 1.03, 0.56]] },
      { width: 0.16, tendon: 0, points: [[0.93, 1.03, 0.56], [0.88, 1.05, 0.66], [0.64, 1.06, 0.48], [0.20, 1.045, 0.06], [-0.20, 1.015, -0.20], [-0.45, 0.80, -0.48]] },
    ],
  },
  'inferior-oblique': {
    anchor: [-0.35, -1.10, -0.18], spread: [-0.2, -0.50, 0.10],
    bands: [{ width: 0.15, tendon: 0.96, points: [[0.84, -0.80, 0.70], [0.65, -1.02, 0.48], [0.25, -1.18, 0.20], [-0.10, -1.19, -0.05], [-0.58, -0.94, -0.28], [-0.75, -0.44, -0.56]] }],
  },
};

function bandGeometry({ points, width, tendon }: Band, color: string) {
  const path = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
  const steps = 88, sides = 24;
  const vertices: number[] = [], colors: number[] = [], indices: number[] = [], fibers: number[] = [];
  const muscleColor = new THREE.Color(color), tendonColor = new THREE.Color('#e6d6b7');
  const ring = (t: number, angle: number, lift = 0) => {
    const center = path.getPointAt(t), tangent = path.getTangentAt(t);
    const normal = center.clone().addScaledVector(tangent, -center.dot(tangent)).normalize();
    const across = new THREE.Vector3().crossVectors(tangent, normal).normalize();
    const transition = tendon === 0 ? 1 : THREE.MathUtils.smoothstep(t, tendon, Math.min(1, tendon + 0.09));
    const halfWidth = tendon === 0 ? THREE.MathUtils.lerp(0.042, width, THREE.MathUtils.smoothstep(t, 0.2, 1))
      : width * (0.35 + 0.65 * THREE.MathUtils.smoothstep(t, 0, 0.38));
    const thickness = THREE.MathUtils.lerp(0.024 + 0.025 * Math.sin(t * Math.PI), 0.008, transition);
    const point = center.addScaledVector(across, Math.cos(angle) * halfWidth)
      .addScaledVector(normal, Math.sin(angle) * (thickness + lift));
    // Keep the thin tendon in contact with the sclera without cutting through its curved surface.
    if (point.length() < 1.026 + lift) point.setLength(1.026 + lift);
    return { point, transition };
  };
  for (let row = 0; row <= steps; row++) {
    const t = row / steps;
    for (let side = 0; side <= sides; side++) {
      const angle = side / sides * Math.PI * 2;
      const { point, transition } = ring(t, angle);
      vertices.push(...point.toArray());
      const shade = muscleColor.clone().lerp(tendonColor, transition);
      shade.multiplyScalar(0.95 + 0.04 * Math.cos(angle * 10 + 0.3 * Math.sin(t * 15)));
      colors.push(shade.r, shade.g, shade.b);
      if (row < steps && side < sides) {
        const a = row * (sides + 1) + side, b = a + sides + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  for (const row of [0, steps]) {
    const start = row * (sides + 1);
    for (let side = 1; side < sides - 1; side++) {
      if (row === 0) indices.push(start, start + side + 1, start + side);
      else indices.push(start, start + side, start + side + 1);
    }
  }
  for (let fiber = 1; fiber <= 11; fiber++) {
    const angle = Math.acos(-0.9 + fiber / 12 * 1.8);
    for (let row = 1; row < steps - 1; row++) {
      fibers.push(...ring(row / steps, angle, 0.002).point.toArray(), ...ring((row + 1) / steps, angle, 0.002).point.toArray());
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const fiberGeometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(fibers, 3));
  return { geometry, fiberGeometry };
}

export function createExtraocularMuscles(colors: Record<StructureId, string>): EyePart[] {
  return EXTRAOCULAR_IDS.map(id => {
    const definition = MUSCLES[id];
    const group = new THREE.Group();
    group.name = id;
    group.userData.structureId = id;
    const material = new THREE.MeshPhysicalMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.62, clearcoat: 0.08, side: THREE.DoubleSide });
    const fiberMaterial = new THREE.LineBasicMaterial({ color: '#f3c5b2', transparent: true, opacity: 0.24, depthWrite: false });
    fiberMaterial.userData.baseOpacity = 0.24;
    for (const [index, band] of definition.bands.entries()) {
      const { geometry, fiberGeometry } = bandGeometry(band, colors[id]);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = band.tendon === 0 ? 'reflected-tendon' : 'muscle-belly';
      const fibers = new THREE.LineSegments(fiberGeometry, fiberMaterial);
      fibers.name = `longitudinal-fibers-${index}`;
      group.add(mesh, fibers);
    }
    if (id === 'superior-oblique') {
      const trochlea = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.022, 10, 32), new THREE.MeshPhysicalMaterial({ color: '#d7c5a4', roughness: 0.68 }));
      trochlea.name = 'trochlea';
      trochlea.position.set(0.93, 1.03, 0.56);
      trochlea.scale.y = 0.85;
      group.add(trochlea);
    }
    group.traverse(object => {
      object.userData.structureId = id;
      object.userData.extraocular = true;
    });
    return { id, group, anchor: new THREE.Vector3(...definition.anchor), explode: new THREE.Vector3(...definition.spread) };
  });
}
