import { STRUCTURE_IDS, type CameraSnapshot, type EyeSide, type StructureId } from '../anatomy/types';

export const DISEASE_IDS = ['cataract', 'glaucoma', 'strabismus', 'amblyopia'] as const;
export type DiseaseId = typeof DISEASE_IDS[number];
export type DiseaseStep = 0 | 1 | 2 | 3;
export const AMBLYOPIA_CASES = ['anisometropia', 'strabismic', 'deprivation'] as const;
export type AmblyopiaCase = typeof AMBLYOPIA_CASES[number];
export type AmblyopiaCaseDraft = { card: 0 | 1 | 2; inputImproved: boolean };
type Chapter = { step: DiseaseStep; camera?: CameraSnapshot | null; selectedEye?: EyeSide; selectedId?: StructureId | null };
export type DiseaseDraft = Chapter & (
  | { id: 'cataract'; contextCamera?: CameraSnapshot | null; opacity: number; view: 'context' | 'lens-detail'; preview: 'test-chart' | 'glare-scene' }
  | { id: 'glaucoma'; scenario: 'normal' | 'outflow-risk' | 'established-damage' | 'normal-tension'; view: 'outflow' | 'nerve'; outflowRelieved: boolean; visualField: 'early' | 'defect'; flowPlaying: boolean }
  | { id: 'strabismus'; alignment: 'normal' | 'esotropia' | 'exotropia' | 'custom'; deviationDeg: number; affectedEye: EyeSide; targetDistance: 'far' | 'near'; visualExplanation: 'alignment-only' | 'adult-diplopia' | 'child-suppression'; showAxes: boolean }
  | { id: 'amblyopia'; causeCase: AmblyopiaCase; caseDrafts: Record<AmblyopiaCase, AmblyopiaCaseDraft> }
);

export function createDiseaseDraft(id: DiseaseId): DiseaseDraft {
  const base = { step: 0 as const, camera: null };
  switch (id) {
    case 'cataract': return { ...base, id, contextCamera: null, opacity: 0.55, view: 'context', preview: 'test-chart' };
    case 'glaucoma': return { ...base, id, scenario: 'outflow-risk', view: 'outflow', outflowRelieved: false, visualField: 'early', flowPlaying: false };
    case 'strabismus': return { ...base, id, alignment: 'normal', deviationDeg: 0, affectedEye: 'right', targetDistance: 'far', visualExplanation: 'alignment-only', showAxes: true };
    case 'amblyopia': return { ...base, id, causeCase: 'anisometropia', caseDrafts: { anisometropia: { card: 0, inputImproved: false }, strabismic: { card: 0, inputImproved: false }, deprivation: { card: 0, inputImproved: false } } };
  }
}
export const createDiseaseDrafts = (): Record<DiseaseId, DiseaseDraft> => Object.fromEntries(DISEASE_IDS.map(id => [id, createDiseaseDraft(id)])) as Record<DiseaseId, DiseaseDraft>;
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const member = <T extends string>(value: unknown, values: readonly T[]): value is T => typeof value === 'string' && values.includes(value as T);
const finite = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
export const isDiseaseId = (value: unknown): value is DiseaseId => member(value, DISEASE_IDS);

// Camera validation is shared with saved workspace scenes; this parser returns only chapter data.
export function parseDiseaseDraft(value: unknown): DiseaseDraft | null {
  if (!record(value) || !isDiseaseId(value.id) || !finite(value.step, 0, 3) || !Number.isInteger(value.step)) return null;
  if (value.selectedEye !== undefined && !member(value.selectedEye, ['right', 'left']) || value.selectedId !== undefined && value.selectedId !== null && !member(value.selectedId, STRUCTURE_IDS)) return null;
  const base = { step: value.step as DiseaseStep,
    ...(member(value.selectedEye, ['right', 'left']) ? { selectedEye: value.selectedEye } : {}),
    ...(value.selectedId === null || member(value.selectedId, STRUCTURE_IDS) ? { selectedId: value.selectedId } : {}),
  };
  switch (value.id) {
    case 'cataract': return finite(value.opacity, 0, 1) && member(value.view, ['context', 'lens-detail']) && member(value.preview, ['test-chart', 'glare-scene'])
      ? { ...base, id: value.id, opacity: value.opacity, view: value.view, preview: value.preview } : null;
    case 'glaucoma': return member(value.scenario, ['normal', 'outflow-risk', 'established-damage', 'normal-tension']) && member(value.view, ['outflow', 'nerve']) && typeof value.outflowRelieved === 'boolean' && member(value.visualField, ['early', 'defect']) && typeof value.flowPlaying === 'boolean'
      ? { ...base, id: value.id, scenario: value.scenario, view: value.view, outflowRelieved: value.outflowRelieved, visualField: value.visualField, flowPlaying: value.flowPlaying } : null;
    case 'strabismus': {
      if (!member(value.alignment, ['normal', 'esotropia', 'exotropia', 'custom']) || !finite(value.deviationDeg, -20, 20) || !member(value.affectedEye, ['right', 'left']) || !member(value.targetDistance, ['far', 'near']) || !member(value.visualExplanation, ['alignment-only', 'adult-diplopia', 'child-suppression']) || typeof value.showAxes !== 'boolean') return null;
      const preset = { normal: 0, esotropia: 10, exotropia: -10 };
      if (value.alignment !== 'custom' && value.deviationDeg !== preset[value.alignment]) return null;
      return { ...base, id: value.id, alignment: value.alignment, deviationDeg: value.deviationDeg, affectedEye: value.affectedEye, targetDistance: value.targetDistance, visualExplanation: value.visualExplanation, showAxes: value.showAxes };
    }
    case 'amblyopia': {
      if (!member(value.causeCase, AMBLYOPIA_CASES) || !record(value.caseDrafts)) return null;
      const caseDrafts = {} as Record<AmblyopiaCase, AmblyopiaCaseDraft>;
      for (const id of AMBLYOPIA_CASES) {
        const draft = value.caseDrafts[id];
        if (!record(draft) || !finite(draft.card, 0, 2) || !Number.isInteger(draft.card) || typeof draft.inputImproved !== 'boolean') return null;
        caseDrafts[id] = { card: draft.card as 0 | 1 | 2, inputImproved: draft.inputImproved };
      }
      return { ...base, id: value.id, causeCase: value.causeCase, caseDrafts };
    }
  }
}
