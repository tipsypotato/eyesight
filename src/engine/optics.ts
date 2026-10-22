import type { OpticsPreset } from '../anatomy/types';

export interface OpticsResult {
  retinaZ: number;
  focusZ: number;
  correctionPower: number;
  rays: { points: [number, number, number][] }[];
  corneaZ: number;
  lensZ: number;
  glassesZ: number;
}

const corneaZ = 1.05;
const lensZ = 0.5;
const glassesZ = 1.7;
const corneaPower = 0.35;
const lensPower = 1 / (lensZ + 1) - corneaPower / (1 - (corneaZ - lensZ) * corneaPower);

// shortcut: paraxial thin lenses in normalized units; use measured surfaces and refractive indices for clinical optics.
function traceUnitRay(correctionPower: number) {
  const corneaX = 1 - correctionPower * (glassesZ - corneaZ);
  const corneaSlope = -correctionPower - corneaPower * corneaX;
  const lensX = corneaX + corneaSlope * (corneaZ - lensZ);
  const slope = corneaSlope - lensPower * lensX;
  return { corneaX, lensX, slope };
}

export function computeOptics(preset: OpticsPreset): OpticsResult {
  const retinaZ = preset === 'normal' ? -1 : -1.22;
  const retinalIntercept = (power: number) => {
    const ray = traceUnitRay(power);
    return ray.lensX + ray.slope * (lensZ - retinaZ);
  };
  const uncorrectedIntercept = retinalIntercept(0);
  const correctionPower = preset === 'corrected'
    ? -uncorrectedIntercept / (retinalIntercept(1) - uncorrectedIntercept)
    : 0;
  const ray = traceUnitRay(correctionPower);
  const focusZ = lensZ + ray.lensX / ray.slope;
  const rays = [-0.18, -0.09, 0, 0.09, 0.18].map((height) => {
    const points: [number, number, number][] = [[height, 0, 2.3]];
    if (preset === 'corrected') points.push([height, 0, glassesZ]);
    points.push([height * ray.corneaX, 0, corneaZ], [height * ray.lensX, 0, lensZ]);
    if (focusZ > retinaZ + 1e-10 && focusZ < lensZ) points.push([0, 0, focusZ]);
    points.push([height * (ray.lensX + ray.slope * (lensZ - retinaZ)), 0, retinaZ]);
    return { points };
  });
  return { retinaZ, focusZ, correctionPower, rays, corneaZ, lensZ, glassesZ };
}
