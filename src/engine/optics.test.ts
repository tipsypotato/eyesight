import { describe, expect, it } from 'vitest';
import { computeOptics } from './optics';
import type { OpticsPreset } from '../anatomy/types';

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
