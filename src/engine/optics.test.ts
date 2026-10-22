import { describe, expect, it } from 'vitest';
import { BASE_PUPIL_RADIUS, computeOptics, opticsInputForPreset, traceOptics, validateOpticsInput } from './optics';
import type { OpticsInput, OpticsPreset } from '../anatomy/types';

describe('computeOptics', () => {
  it('converges normal parallel rays on the normal retina', () => {
    const result = computeOptics('normal');
    expect(result.retinaZ).toBe(-1);
    expect(result.focusZ).toBeCloseTo(-1, 12);
    expect(result.correctionPower).toBe(0);
    expect(result.rays.length).toBeGreaterThanOrEqual(5);
    for (const { points } of result.rays) {
      expect(points.at(-1)![0]).toBeCloseTo(0, 12);
      expect(points.at(-1)![2]).toBe(result.retinaZ);
      expect(points[0][0]).toBe(points[1][0]);
    }
  });

  it('crosses before the elongated myopic retina and produces retinal blur', () => {
    const normal = computeOptics('normal');
    const result = computeOptics('myopia');
    expect(result.retinaZ).toBe(-1.22);
    expect(result.focusZ).toBeCloseTo(normal.focusZ, 12);
    expect(result.focusZ).toBeGreaterThan(result.retinaZ);
    expect(result.correctionPower).toBe(0);
    const outer = result.rays.filter(({ points }) => points[0][0] !== 0);
    for (const { points } of outer) {
      expect(points.some(([x, , z]) => Math.abs(x) < 1e-12 && Math.abs(z - result.focusZ) < 1e-12)).toBe(true);
      expect(Math.abs(points.at(-1)![0])).toBeGreaterThan(0.005);
      expect(points.at(-1)![0] * points[0][0]).toBeLessThan(0);
    }
  });

  it('uses a diverging spectacle lens to bring focus to the myopic retina', () => {
    const result = computeOptics('corrected');
    expect(result.retinaZ).toBe(-1.22);
    expect(result.focusZ).toBeCloseTo(result.retinaZ, 12);
    expect(result.correctionPower).toBeLessThan(0);
    for (const { points } of result.rays) {
      expect(points.at(-1)![0]).toBeCloseTo(0, 12);
      const glasses = points.find((point) => point[2] === result.glassesZ)!;
      const cornea = points.find((point) => point[2] === result.corneaZ)!;
      expect(glasses).toBeDefined();
      if (glasses[0] !== 0) expect(Math.abs(cornea[0])).toBeGreaterThan(Math.abs(glasses[0]));
    }
  });

  it.each<OpticsPreset>(['normal', 'myopia', 'corrected'])('traces finite, posterior-going %s rays through the pupil', (preset) => {
    const result = computeOptics(preset);
    expect(Number.isFinite(result.focusZ)).toBe(true);
    expect(Number.isFinite(result.correctionPower)).toBe(true);
    for (const { points } of result.rays) {
      expect(points[0][2]).toBe(2.3);
      expect(Math.abs(points[0][0])).toBeLessThanOrEqual(0.18);
      expect(points.at(-1)![2]).toBe(result.retinaZ);
      expect(points.some((point) => point[2] === result.corneaZ)).toBe(true);
      const lens = points.find((point) => point[2] === result.lensZ)!;
      expect(Math.abs(lens[0])).toBeLessThanOrEqual(0.18);
      for (let i = 0; i < points.length; i += 1) {
        expect(points[i].every(Number.isFinite)).toBe(true);
        expect(points[i][1]).toBe(0);
        if (i > 0) expect(points[i][2]).toBeLessThan(points[i - 1][2]);
      }
      const end = points.at(-1)!;
      const slope = (end[0] - lens[0]) / (end[2] - lens[2]);
      if (lens[0] !== 0) expect(lens[2] - lens[0] / slope).toBeCloseTo(result.focusZ, 12);
    }
  });
});

const baseline: OpticsInput = { axialIncrement: 0, objectDistance: 'far', accommodation: 0, pupil: 'medium', externalLens: 'off' };

describe('traceOptics', () => {
  it.each<OpticsPreset>(['normal', 'myopia', 'corrected'])('preserves the %s preset through the shared core', (preset) => {
    const input = opticsInputForPreset(preset);
    expect(input).toEqual({ ...baseline, axialIncrement: preset === 'normal' ? 0 : 1, externalLens: preset === 'corrected' ? 'myopia' : 'off' });
    const result = traceOptics(input);
    const legacy = computeOptics(preset);
    expect(result.retinaZ).toBe(legacy.retinaZ);
    expect(result.focusZ).toBeCloseTo(legacy.focusZ, 12);
    expect(result.correctionPower).toBeCloseTo(legacy.correctionPower, 12);
    expect(result.focusKind).toBe('real');
    expect(legacy.rays).toHaveLength(5);
  });

  it('moves only the retina when the axis length changes without spectacles', () => {
    const normal = traceOptics(baseline);
    const longer = traceOptics({ ...baseline, axialIncrement: 0.5 });
    expect(longer.retinaZ).toBeCloseTo(-1.11, 12);
    expect(longer.focusZ).toBe(normal.focusZ);
    expect(longer.lensPower).toBe(normal.lensPower);
    expect(longer.corneaPower).toBe(normal.corneaPower);
    expect(longer.retinalSpread).toBeGreaterThan(0);
  });

  it.each([['mid', 4], ['near', 2.5]] as const)('starts every finite %s ray at the same axial object point', (objectDistance, objectZ) => {
    const result = traceOptics({ ...baseline, objectDistance });
    expect(result.objectZ).toBe(objectZ);
    for (const { points } of result.rays) {
      expect(points[0]).toEqual([0, 0, objectZ]);
      expect(points[1][2]).toBe(result.corneaZ);
    }
    expect(result.retinalSpread).toBeGreaterThan(0);
  });

  it('uses accommodation to refocus the near object without moving the retina or cornea', () => {
    const relaxed = traceOptics({ ...baseline, objectDistance: 'near' });
    const accommodated = traceOptics({ ...baseline, objectDistance: 'near', accommodation: 1 });
    expect(accommodated.focusKind).toBe('real');
    expect(accommodated.focusZ).toBeCloseTo(-1, 12);
    expect(accommodated.retinalSpread).toBeCloseTo(0, 12);
    expect(accommodated.lensPower).toBeGreaterThan(relaxed.lensPower);
    expect(accommodated.retinaZ).toBe(relaxed.retinaZ);
    expect(accommodated.corneaPower).toBe(relaxed.corneaPower);
  });

  it('clips peripheral rays at the pupil and measures only the retinal samples that pass', () => {
    const small = traceOptics({ ...baseline, axialIncrement: 1, pupil: 'small' });
    const large = traceOptics({ ...baseline, axialIncrement: 1, pupil: 'large' });
    expect(small.pupilRadius).toBeCloseTo(BASE_PUPIL_RADIUS * 0.7, 12);
    expect(large.pupilRadius).toBeCloseTo(BASE_PUPIL_RADIUS * 1.3, 12);
    expect(small.validRayCount).toBeLessThan(large.validRayCount);
    expect(small.retinalSpread).toBeLessThan(large.retinalSpread!);
    expect(small.focusZ).toBe(large.focusZ);
    expect(small.lensPower).toBe(large.lensPower);
    expect(small.corneaPower).toBe(large.corneaPower);
    expect(small.rays.some((ray) => ray.blocked)).toBe(true);
    for (const result of [small, large]) {
      expect(result.retinalIntersections).toHaveLength(result.validRayCount);
      expect(result.validRayCount).toBe(result.rays.filter((ray) => !ray.blocked).length);
      for (const { points, blocked } of result.rays) {
        const pupil = points.find((point) => point[2] === result.pupilZ)!;
        expect(pupil).toBeDefined();
        if (blocked) {
          expect(Math.abs(pupil[0])).toBeGreaterThan(result.pupilRadius);
          expect(points.at(-1)).toBe(pupil);
        } else {
          expect(Math.abs(pupil[0])).toBeLessThanOrEqual(result.pupilRadius);
          expect(points.at(-1)![2]).toBe(result.retinaZ);
          expect(result.retinalIntersections).toContainEqual(points.at(-1));
        }
      }
      const mean = result.retinalIntersections.reduce((sum, point) => sum + point[0], 0) / result.validRayCount;
      const rms = Math.sqrt(result.retinalIntersections.reduce((sum, point) => sum + (point[0] - mean) ** 2, 0) / result.validRayCount);
      expect(result.retinalSpread).toBeCloseTo(rms, 12);
    }
  });

  it('keeps the far-relaxed spectacle correction fixed when object distance or accommodation changes', () => {
    const far = traceOptics({ ...baseline, axialIncrement: 1, externalLens: 'myopia' });
    const near = traceOptics({ ...baseline, axialIncrement: 1, externalLens: 'myopia', objectDistance: 'near', accommodation: 0.5 });
    expect(far.correctionPower).toBeLessThan(0);
    expect(near.correctionPower).toBe(far.correctionPower);
    expect(near.focusZ).not.toBeCloseTo(near.retinaZ, 6);
    expect(traceOptics({ ...baseline, externalLens: 'myopia' }).correctionPower).toBe(0);
  });

  it.each(['far', 'mid', 'near'] as const)('shows distinct pupil apertures in the sampled %s bundle', (objectDistance) => {
    const counts = (['small', 'medium', 'large'] as const).map((pupil) => traceOptics({ ...baseline, objectDistance, pupil }).validRayCount);
    expect(counts[0]).toBeLessThan(counts[1]);
    expect(counts[1]).toBeLessThan(counts[2]);
  });

  it('separates real focus behind the retina into dashed extension geometry', () => {
    const result = traceOptics({ ...baseline, objectDistance: 'mid' });
    expect(result.focusKind).toBe('real');
    expect(result.focusZ).toBeLessThan(result.retinaZ);
    expect(result.extensions.length).toBeGreaterThan(0);
    for (const { points, blocked } of result.rays) {
      expect(points.at(-1)![2]).toBe(blocked ? result.pupilZ : result.retinaZ);
      expect(points.every((point) => point[2] >= result.retinaZ)).toBe(true);
    }
    for (const { points } of result.extensions) {
      expect(points[0][2]).toBe(result.retinaZ);
      expect(points.at(-1)).toEqual([0, 0, result.focusZ]);
    }
  });

  it('represents virtual and parallel bundles without drawing a false real focal point', () => {
    const virtual = traceOptics({ ...baseline, objectDistance: 'near' });
    const parallel = traceOptics({ ...baseline, objectDistance: 'near', accommodation: 0.073595625 });
    expect(virtual.focusKind).toBe('virtual');
    expect(virtual.focusZ).toBeGreaterThan(virtual.lensZ);
    expect(virtual.extensions).toEqual([]);
    expect(parallel.focusKind).toBe('parallel');
    expect(parallel.focusZ).toBeNull();
    expect(parallel.extensions).toEqual([]);
    for (const result of [virtual, parallel]) {
      expect(result.rays.flatMap((ray) => ray.points.flat()).every(Number.isFinite)).toBe(true);
      expect(Number.isFinite(result.retinalSpread)).toBe(true);
    }
  });

  it('keeps all allowed boundary combinations finite and includes a valid axial sample', () => {
    for (const axialIncrement of [0, 1]) for (const objectDistance of ['far', 'mid', 'near'] as const)
      for (const accommodation of [0, 1]) for (const pupil of ['small', 'medium', 'large'] as const)
        for (const externalLens of ['off', 'myopia'] as const) {
          const result = traceOptics({ axialIncrement, objectDistance, accommodation, pupil, externalLens });
          expect(result.validRayCount).toBeGreaterThan(0);
          expect(result.focusZ === null || Number.isFinite(result.focusZ)).toBe(true);
          expect(Number.isFinite(result.correctionPower)).toBe(true);
          expect(Number.isFinite(result.retinalSpread)).toBe(true);
          expect([...result.rays, ...result.extensions].flatMap((ray) => ray.points.flat()).every(Number.isFinite)).toBe(true);
        }
  });
});

describe('validateOpticsInput', () => {
  it.each([
    null, {}, { ...baseline, axialIncrement: NaN }, { ...baseline, axialIncrement: Infinity },
    { ...baseline, axialIncrement: -0.1 }, { ...baseline, axialIncrement: 1.1 },
    { ...baseline, accommodation: NaN }, { ...baseline, accommodation: -0.1 }, { ...baseline, accommodation: 1.1 },
    { ...baseline, objectDistance: 'closer' }, { ...baseline, pupil: 'zero' }, { ...baseline, externalLens: true },
  ])('rejects malformed optical input %# at the tracing boundary', (value) => {
    expect(() => validateOpticsInput(value as OpticsInput)).toThrow();
    expect(() => traceOptics(value as OpticsInput)).toThrow();
  });

  it('accepts the valid baseline', () => {
    expect(() => validateOpticsInput(baseline)).not.toThrow();
  });
});
