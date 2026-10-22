import type { OpticsInput, OpticsPreset } from '../anatomy/types';

export interface OpticsResult {
  retinaZ: number;
  focusZ: number;
  correctionPower: number;
  rays: { points: [number, number, number][] }[];
  corneaZ: number;
  lensZ: number;
  glassesZ: number;
}

export interface TraceOpticsResult extends Omit<OpticsResult, 'focusZ' | 'rays'> {
  focusZ: number | null;
  focusKind: 'real' | 'virtual' | 'parallel';
  rays: { points: [number, number, number][]; blocked: boolean }[];
  extensions: { points: [number, number, number][] }[];
  retinalIntersections: [number, number, number][];
  validRayCount: number;
  retinalSpread: number | null;
  pupilZ: number;
  pupilRadius: number;
  lensPower: number;
  corneaPower: number;
  objectZ: number | null;
}

export const BASE_PUPIL_RADIUS = 0.215;
const corneaZ = 1.05;
const lensZ = 0.5;
const glassesZ = 1.7;
const pupilZ = 0.666;
const corneaPower = 0.35;
const relaxedLensPower = 1 / (lensZ + 1) - corneaPower / (1 - (corneaZ - lensZ) * corneaPower);
const rayHeights = Array.from({ length: 19 }, (_, index) => (index - 9) * 0.04);

export function opticsInputForPreset(preset: OpticsPreset): OpticsInput {
  return { axialIncrement: preset === 'normal' ? 0 : 1, objectDistance: 'far', accommodation: 0, pupil: 'medium', externalLens: preset === 'corrected' ? 'myopia' : 'off' };
}

export function validateOpticsInput(input: OpticsInput): void {
  if (!input || typeof input !== 'object') throw new Error('Optics input must be an object');
  for (const key of ['axialIncrement', 'accommodation'] as const) {
    if (!Number.isFinite(input[key]) || input[key] < 0 || input[key] > 1) throw new Error(`Invalid optics ${key}`);
  }
  if (!['far', 'mid', 'near'].includes(input.objectDistance)) throw new Error('Invalid optics objectDistance');
  if (!['small', 'medium', 'large'].includes(input.pupil)) throw new Error('Invalid optics pupil');
  if (!['off', 'myopia'].includes(input.externalLens)) throw new Error('Invalid optics externalLens');
}

// shortcut: paraxial thin lenses in normalized units; use measured surfaces and refractive indices for clinical optics.
function traceUnitRay(objectZ: number | null, correctionPower: number, lensPower: number) {
  const incidentSlope = objectZ === null ? 0 : 1 / (objectZ - glassesZ);
  const glassesSlope = incidentSlope - correctionPower;
  const corneaX = 1 + glassesSlope * (glassesZ - corneaZ);
  const corneaSlope = glassesSlope - corneaPower * corneaX;
  const pupilX = corneaX + corneaSlope * (corneaZ - pupilZ);
  const lensX = corneaX + corneaSlope * (corneaZ - lensZ);
  const slope = corneaSlope - lensPower * lensX;
  return { corneaX, pupilX, lensX, slope };
}

const nearWithoutLens = traceUnitRay(2.5, 0, 0);
const accommodationPower = 1 / (lensZ + 1) + nearWithoutLens.slope / nearWithoutLens.lensX - relaxedLensPower;

function traceCore(input: OpticsInput, heights: readonly number[]): TraceOpticsResult {
  validateOpticsInput(input);
  const retinaZ = -1 - 0.22 * input.axialIncrement;
  const objectZ = input.objectDistance === 'far' ? null : input.objectDistance === 'mid' ? 4 : 2.5;
  const lensPower = relaxedLensPower + accommodationPower * input.accommodation;
  const pupilRadius = BASE_PUPIL_RADIUS * { small: 0.7, medium: 1, large: 1.3 }[input.pupil];
  // Spectacles are calibrated for this axis with a distant object and relaxed accommodation.
  const retinalIntercept = (power: number) => {
    const ray = traceUnitRay(null, power, relaxedLensPower);
    return ray.lensX + ray.slope * (lensZ - retinaZ);
  };
  const uncorrectedIntercept = retinalIntercept(0);
  const correctionPower = input.externalLens === 'myopia' && input.axialIncrement > 0
    ? -uncorrectedIntercept / (retinalIntercept(1) - uncorrectedIntercept)
    : 0;
  const ray = traceUnitRay(objectZ, correctionPower, lensPower);
  const focusZ = Math.abs(ray.slope) < 1e-10 ? null : lensZ + ray.lensX / ray.slope;
  const focusKind = focusZ === null ? 'parallel' : focusZ < lensZ ? 'real' : 'virtual';
  const retinalIntersections: TraceOpticsResult['retinalIntersections'] = [];
  const extensions: TraceOpticsResult['extensions'] = [];
  const rays = heights.map((height) => {
    const points: [number, number, number][] = [objectZ === null ? [height, 0, 2.3] : [0, 0, objectZ]];
    if (input.externalLens === 'myopia') points.push([height, 0, glassesZ]);
    const pupilX = height * ray.pupilX;
    points.push([height * ray.corneaX, 0, corneaZ], [pupilX, 0, pupilZ]);
    const blocked = Math.abs(pupilX) > pupilRadius;
    if (!blocked) {
      points.push([height * ray.lensX, 0, lensZ]);
      if (focusKind === 'real' && focusZ !== null && focusZ > retinaZ + 1e-10) points.push([0, 0, focusZ]);
      const intersection: [number, number, number] = [height * (ray.lensX + ray.slope * (lensZ - retinaZ)), 0, retinaZ];
      points.push(intersection);
      retinalIntersections.push(intersection);
      if (focusKind === 'real' && focusZ !== null && focusZ < retinaZ - 1e-10 && height !== 0) extensions.push({ points: [intersection, [0, 0, focusZ]] });
    }
    return { points, blocked };
  });
  const validRayCount = retinalIntersections.length;
  const mean = validRayCount ? retinalIntersections.reduce((sum, point) => sum + point[0], 0) / validRayCount : 0;
  const retinalSpread = validRayCount ? Math.sqrt(retinalIntersections.reduce((sum, point) => sum + (point[0] - mean) ** 2, 0) / validRayCount) : null;
  return { retinaZ, focusZ, focusKind, correctionPower, rays, extensions, retinalIntersections, validRayCount, retinalSpread, corneaZ, lensZ, glassesZ, pupilZ, pupilRadius, lensPower, corneaPower, objectZ };
}

export function traceOptics(input: OpticsInput): TraceOpticsResult {
  return traceCore(input, rayHeights);
}

export function computeOptics(preset: OpticsPreset): OpticsResult {
  const result = traceCore(opticsInputForPreset(preset), [-0.18, -0.09, 0, 0.09, 0.18]);
  const { retinaZ, focusZ, correctionPower, corneaZ, lensZ, glassesZ } = result;
  if (focusZ === null || result.focusKind !== 'real') throw new Error('Optics preset must have a finite real focus');
  const rays = result.rays.map(({ points }) => ({ points }));
  return { retinaZ, focusZ, correctionPower, rays, corneaZ, lensZ, glassesZ };
}
