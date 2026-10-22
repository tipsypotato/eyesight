import type { OpticsInput, PhysiologyKind } from '../anatomy/types';
import { opticsInputForPreset } from '../engine/optics';

export const PHYSIOLOGY_LENGTHS = { pupil: 5, accommodation: 7, signal: 3 } as const;

export function physiologyInput(kind: PhysiologyKind, step: number): OpticsInput {
  if (!Object.hasOwn(PHYSIOLOGY_LENGTHS, kind) || !Number.isInteger(step) || step < 0 || step >= PHYSIOLOGY_LENGTHS[kind]) throw new RangeError('Invalid physiology step');
  const input = opticsInputForPreset('normal');
  if (kind === 'pupil') input.pupil = (['large', 'medium', 'small', 'medium', 'large'] as const)[step];
  if (kind === 'accommodation') {
    input.objectDistance = step >= 1 && step <= 3 ? 'near' : 'far';
    input.accommodation = [0, 0, 0.5, 1, 1, 0.5, 0][step];
  }
  return input;
}
