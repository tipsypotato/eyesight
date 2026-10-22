import { describe, expect, it } from 'vitest';
import type { PhysiologyKind } from '../anatomy/types';
import { traceOptics, validateOpticsInput } from '../engine/optics';
import { PHYSIOLOGY_LENGTHS, physiologyInput } from './physiology';

describe('deterministic physiology inputs', () => {
  it('varies pupil aperture without changing refraction or the retinal plane', () => {
    const results = Array.from({ length: PHYSIOLOGY_LENGTHS.pupil }, (_, step) => traceOptics(physiologyInput('pupil', step)));
    expect(results[0].pupilRadius).toBeGreaterThan(results[1].pupilRadius);
    expect(results[1].pupilRadius).toBeGreaterThan(results[2].pupilRadius);
    expect(results[3].pupilRadius).toBe(results[1].pupilRadius);
    expect(results[4].pupilRadius).toBe(results[0].pupilRadius);
    for (const result of results) {
      expect(result.focusZ).toBeCloseTo(-1);
      expect(result.retinaZ).toBe(-1);
      expect(result.lensPower).toBe(results[0].lensPower);
      expect(result.corneaPower).toBe(results[0].corneaPower);
    }
  });

  it('refocuses the near object through the existing tracer and returns to relaxed far vision', () => {
    const results = Array.from({ length: PHYSIOLOGY_LENGTHS.accommodation }, (_, step) => traceOptics(physiologyInput('accommodation', step)));
    expect(results[1].focusKind).toBe('virtual');
    expect(results[2].lensPower).toBeGreaterThan(results[1].lensPower);
    expect(results[3].lensPower).toBeGreaterThan(results[2].lensPower);
    expect(results[3].focusZ).toBeCloseTo(-1);
    expect(results[3].retinalSpread!).toBeLessThan(results[1].retinalSpread!);
    expect(results[5].lensPower).toBeLessThan(results[4].lensPower);
    expect(results[6].lensPower).toBeLessThan(results[5].lensPower);
    expect(results[6]).toEqual(results[0]);
  });

  it('emits independent valid input copies for every step including the neural stages', () => {
    for (const kind of ['pupil', 'accommodation', 'signal'] as const) {
      for (let step = 0; step < PHYSIOLOGY_LENGTHS[kind]; step++) expect(() => validateOpticsInput(physiologyInput(kind, step))).not.toThrow();
    }
    const input = physiologyInput('signal', 0); input.axialIncrement = 1;
    expect(physiologyInput('signal', 1)).toEqual({ axialIncrement: 0, objectDistance: 'far', accommodation: 0, pupil: 'medium', externalLens: 'off' });
    expect(physiologyInput('signal', 2)).toEqual(physiologyInput('signal', 1));
  });

  it.each([-1, 0.5, NaN, Infinity, 7])('rejects invalid sequence step %s before emitting invalid optics', step => {
    for (const kind of ['pupil', 'accommodation', 'signal'] as const) expect(() => physiologyInput(kind, step)).toThrow(RangeError);
  });

  it('rejects unknown sequences and a step at each sequence boundary', () => {
    for (const kind of ['pupil', 'accommodation', 'signal'] as const) expect(() => physiologyInput(kind, PHYSIOLOGY_LENGTHS[kind])).toThrow(RangeError);
    for (const kind of ['invalid', '__proto__', null, undefined]) expect(() => physiologyInput(kind as PhysiologyKind, 0)).toThrow(RangeError);
  });
});
