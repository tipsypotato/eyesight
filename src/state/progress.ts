import { LESSONS } from '../anatomy/data';
import { ADNEXAL_IDS, EXTRAOCULAR_IDS, SCENE_PRESETS, STRUCTURE_IDS, type CameraSnapshot, type Mode, type OpticsInput, type PhysiologyState, type SceneState } from '../anatomy/types';
import { CONTENT_VERSION } from '../content/questions';
import { validateOpticsInput } from '../engine/optics';
import { PHYSIOLOGY_LENGTHS, physiologyInput } from '../modes/physiology';
import { isSupportedContentVersion, restoreSession, type PracticeSession } from '../modes/quiz';
import { TOUR_TASKS, type TaskProgress } from '../modes/tourTasks';
import { isDiseaseId, parseDiseaseDraft, type DiseaseDraft, type DiseaseId } from '../modes/disease';

export const PROGRESS_KEY = 'eyesight.progress.v2';
export type PersistedDraft = Pick<SceneState, 'selectedId' | 'layers' | 'isolateId' | 'clip' | 'presetId' | 'explode' | 'labels' | 'view' | 'opticsPreset' | 'opticsInput' | 'opticsExperiment' | 'comparison' | 'physiology' | 'showOptics' | 'camera'> & {
  isolationLayers: SceneState['layers'] | null; lessonId: string | null; step: number; selectedEye?: SceneState['selectedEye']; quizSessionId?: string;
};
export type SavedProgress = {
  schemaVersion: 2; contentVersion: string; mode: Mode;
  drafts: Partial<Record<Mode, PersistedDraft>>;
  lessonPositions: Record<string, number>; tourTasks: Record<string, TaskProgress>;
  sessions: Record<string, PracticeSession>; activeSessions: Record<string, string>; activeQuizId: string | null;
  diseaseDrafts?: Partial<Record<DiseaseId, DiseaseDraft>>; activeDiseaseId?: DiseaseId | null; diseaseReturnMode?: Mode;
};

const modes = ['explore', 'optics', 'tour', 'quiz', 'disease'] as const;
const experiments = ['baseline', 'free', 'axialIncrement', 'objectDistance', 'accommodation', 'pupil', 'externalLens'] as const;
const presets = ['normal', 'myopia', 'corrected'] as const;
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const member = <T extends string>(value: unknown, values: readonly T[]): value is T => typeof value === 'string' && values.includes(value as T);
const finite = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const integer = (value: unknown, min: number, max: number): value is number => finite(value, min, max) && Number.isInteger(value);
const structureOrNull = (value: unknown): value is SceneState['selectedId'] => value === null || member(value, STRUCTURE_IDS);

function layers(value: unknown): SceneState['layers'] | null {
  const added = ['iridocorneal-angle', 'trabecular-meshwork', ...EXTRAOCULAR_IDS, ...ADNEXAL_IDS];
  if (!record(value) || !STRUCTURE_IDS.every(id => member(value[id], ['on', 'ghost', 'off']) || added.includes(id) && value[id] === undefined)) return null;
  return Object.fromEntries(STRUCTURE_IDS.map(id => [id, value[id] ?? ([...EXTRAOCULAR_IDS, ...ADNEXAL_IDS].some(part => part === id) ? 'off' : 'on')])) as SceneState['layers'];
}

function optics(value: unknown): OpticsInput | null {
  if (!record(value)) return null;
  try { validateOpticsInput(value as OpticsInput); } catch { return null; }
  const { axialIncrement, objectDistance, accommodation, pupil, externalLens } = value as OpticsInput;
  return { axialIncrement, objectDistance, accommodation, pupil, externalLens };
}

function parseCamera(value: unknown): CameraSnapshot | null {
  const vector = (item: unknown): item is [number, number, number] => Array.isArray(item) && item.length === 3 && item.every(n => finite(n, -1e6, 1e6));
  if (!record(value) || !vector(value.position) || !vector(value.target) || !finite(value.zoom, 1e-6, 1e6)
    || Math.hypot(...value.position.map((n, i) => n - (value.target as number[])[i])) < 1e-8) return null;
  const result: CameraSnapshot = { position: [...value.position], target: [...value.target], zoom: value.zoom };
  if (value.viewport !== undefined) {
    const v = value.viewport;
    if (!record(v) || !finite(v.aspect, 1e-6, 1e6) || !Array.isArray(v.usableFraction) || v.usableFraction.length !== 2 || !v.usableFraction.every(n => finite(n, 1e-6, 1))) return null;
    result.viewport = { aspect: v.aspect, usableFraction: [v.usableFraction[0], v.usableFraction[1]] };
  }
  if (value.viewOffset !== undefined) {
    const v = value.viewOffset;
    if (!record(v) || !finite(v.fullWidth, 1, 1e6) || !finite(v.fullHeight, 1, 1e6)
      || !finite(v.width, 1, v.fullWidth) || !finite(v.height, 1, v.fullHeight)
      || !finite(v.offsetX, -v.fullWidth, v.fullWidth) || !finite(v.offsetY, -v.fullHeight, v.fullHeight)) return null;
    result.viewOffset = { fullWidth: v.fullWidth, fullHeight: v.fullHeight, width: v.width, height: v.height, offsetX: v.offsetX, offsetY: v.offsetY };
  }
  return result;
}

function physiology(value: unknown): PhysiologyState | null {
  if (!record(value) || !member(value.kind, ['pupil', 'accommodation', 'signal'])
    || !integer(value.step, 0, PHYSIOLOGY_LENGTHS[value.kind] - 1) || typeof value.playing !== 'boolean'
    || !member(value.returnPreset, presets) || !member(value.returnExperiment, experiments) || typeof value.returnShowOptics !== 'boolean') return null;
  const returnInput = optics(value.returnInput);
  return returnInput ? { kind: value.kind, step: value.step, playing: false, returnInput, returnPreset: value.returnPreset, returnExperiment: value.returnExperiment, returnShowOptics: value.returnShowOptics } : null;
}

function parseDraft(value: unknown, mode: Mode): PersistedDraft | null {
  if (!record(value) || !structureOrNull(value.selectedId) || !structureOrNull(value.isolateId)
    || (value.presetId !== null && !member(value.presetId, SCENE_PRESETS))
    || !finite(value.explode, 0, 1) || typeof value.labels !== 'boolean' || !member(value.view, ['oblique', 'front', 'side', 'back'])
    || !member(value.opticsPreset, presets) || !member(value.opticsExperiment, experiments)
    || (value.showOptics !== undefined && typeof value.showOptics !== 'boolean')) return null;
  const parsedLayers = layers(value.layers), input = optics(value.opticsInput), clip = value.clip;
  if (!parsedLayers || !input || !record(clip) || typeof clip.enabled !== 'boolean' || !member(clip.axis, ['sagittal', 'axial', 'coronal'])
    || !finite(clip.offset, -1, 1) || !member(clip.keepSide, ['negative', 'positive'])) return null;
  const isolationLayers = value.isolationLayers === null ? null : layers(value.isolationLayers);
  if (value.isolationLayers !== null && !isolationLayers) return null;
  const lesson = LESSONS.find(item => item.id === value.lessonId);
  if (value.lessonId !== null && !lesson || !integer(value.step, 0, lesson ? lesson.steps.length - 1 : 0)) return null;
  const savedCamera = value.camera === null || value.camera === undefined ? null : parseCamera(value.camera);
  if (value.camera !== null && value.camera !== undefined && !savedCamera) return null;
  let comparison: PersistedDraft['comparison'] = null;
  if (value.comparison !== null) {
    if (!record(value.comparison) || !member(value.comparison.showing, ['reference', 'current'])
      || !(mode === 'optics' || mode === 'tour' && value.lessonId === 'myopia')) return null;
    const reference = optics(value.comparison.input);
    if (!reference) return null;
    comparison = { input: reference, showing: value.comparison.showing };
  }
  const demo = value.physiology === null ? null : physiology(value.physiology);
  if (value.physiology !== null && (!demo || comparison || !(mode === 'optics' || mode === 'tour' && value.lessonId === 'vision' && demo.kind === 'signal'))) return null;
  if (demo && JSON.stringify(input) !== JSON.stringify(physiologyInput(demo.kind, demo.step))) return null;
  return {
    selectedId: value.selectedId, layers: parsedLayers, isolateId: value.isolateId,
    clip: { enabled: clip.enabled, axis: clip.axis, offset: clip.offset, keepSide: clip.keepSide }, presetId: value.presetId,
    explode: value.explode, labels: value.labels, view: value.view, opticsPreset: value.opticsPreset, opticsInput: input, opticsExperiment: value.opticsExperiment,
    comparison, physiology: demo, showOptics: value.showOptics ?? false, camera: savedCamera, isolationLayers,
    lessonId: lesson?.id ?? null, step: value.step,
    ...(member(value.selectedEye, ['right', 'left']) ? { selectedEye: value.selectedEye } : {}),
    ...(typeof value.quizSessionId === 'string' ? { quizSessionId: value.quizSessionId } : {}),
  };
}

function taskProgress(key: string, value: unknown): TaskProgress | null {
  const task = Object.hasOwn(TOUR_TASKS, key) ? TOUR_TASKS[key] : null;
  if (!task || !record(value) || !member(value.status, ['visited', 'done']) || typeof value.hint !== 'boolean'
    || !Array.isArray(value.actions) || value.actions.length > task.actions.length || !value.actions.every((token, i) => token === task.actions[i])) return null;
  const complete = value.actions.length === task.actions.length;
  if ((value.status === 'done') !== complete || complete && value.hint) return null;
  return { status: value.status, actions: [...value.actions], hint: value.hint };
}

export function parseProgress(raw: string | null): { value: SavedProgress | null; discarded: boolean } {
  if (raw === null) return { value: null, discarded: false };
  let source: unknown;
  try { source = JSON.parse(raw); } catch { return { value: null, discarded: true }; }
  if (!record(source) || source.schemaVersion !== 2 || typeof source.contentVersion !== 'string' || !source.contentVersion.trim()) return { value: null, discarded: true };
  let discarded = source.contentVersion !== CONTENT_VERSION;
  function entries<T>(value: unknown, parse: (key: string, entry: unknown) => T | null): Record<string, T> {
    if (!record(value)) { discarded = true; return {}; }
    return Object.fromEntries(Object.entries(value).flatMap(([key, entry]) => {
      const parsed = parse(key, entry);
      if (parsed === null) { discarded = true; return []; }
      return [[key, parsed]];
    }));
  }
  const mode = member(source.mode, modes) ? source.mode : 'explore';
  if (mode !== source.mode) discarded = true;
  const drafts = entries(source.drafts, (key, value) => member(key, modes) ? parseDraft(value, key) : null);
  const diseaseDrafts = source.diseaseDrafts === undefined ? {} : entries(source.diseaseDrafts, (key, value) => {
    const parsed = parseDiseaseDraft(value);
    if (!isDiseaseId(key) || parsed?.id !== key || !record(value)) return null;
    const camera = value.camera == null ? null : parseCamera(value.camera);
    if (value.camera != null && !camera) discarded = true;
    if (parsed.id === 'cataract') {
      const contextCamera = value.contextCamera == null ? null : parseCamera(value.contextCamera);
      if (value.contextCamera != null && !contextCamera) discarded = true;
      return { ...parsed, camera, contextCamera };
    }
    return { ...parsed, camera, ...(parsed.id === 'glaucoma' ? { flowPlaying: false } : {}) };
  });
  const activeDiseaseId = isDiseaseId(source.activeDiseaseId) ? source.activeDiseaseId : null;
  const diseaseReturnMode = member(source.diseaseReturnMode, modes) && source.diseaseReturnMode !== 'disease' ? source.diseaseReturnMode : 'explore';
  if (source.activeDiseaseId != null && activeDiseaseId === null || source.diseaseReturnMode !== undefined && diseaseReturnMode !== source.diseaseReturnMode) discarded = true;
  const diseases = { diseaseDrafts, activeDiseaseId, diseaseReturnMode };
  if (!isSupportedContentVersion(source.contentVersion)) return {
    value: { schemaVersion: 2, contentVersion: CONTENT_VERSION, mode, drafts, lessonPositions: {}, tourTasks: {}, sessions: {}, activeSessions: {}, activeQuizId: null, ...diseases },
    discarded: true,
  };
  const lessonPositions = entries(source.lessonPositions, (key, value) => {
    const lesson = LESSONS.find(item => item.id === key);
    return lesson && integer(value, 0, lesson.steps.length - 1) ? value : null;
  });
  const tourTasks = entries(source.tourTasks, taskProgress);
  const sessions = entries(source.sessions, (key, value) => {
    const session = restoreSession(value);
    if (!session || session.sessionId !== key || !record(value)) return null;
    if (value.contentVersion !== session.contentVersion || JSON.stringify(value.order) !== JSON.stringify(session.order)
      || Object.keys(session.optionOrder).some(id => JSON.stringify((value.optionOrder as Record<string, unknown>)[id]) !== JSON.stringify(session.optionOrder[id]))
      || Object.keys(value.answers as object).length !== Object.keys(session.answers).length
      || Object.entries(session.answers).some(([id, answer]) => (value.answers as Record<string, { correct: unknown }>)[id]?.correct !== answer.correct)) discarded = true;
    return session;
  });
  const activeSessions = entries(source.activeSessions, (context, id) => typeof id === 'string' && Object.hasOwn(sessions, id) && sessions[id].context === context ? id : null);
  const activeQuizId = typeof source.activeQuizId === 'string' && Object.hasOwn(sessions, source.activeQuizId) ? source.activeQuizId : null;
  if (source.activeQuizId !== activeQuizId) discarded = true;
  return { value: { schemaVersion: 2, contentVersion: CONTENT_VERSION, mode, drafts, lessonPositions, tourTasks, sessions, activeSessions, activeQuizId, ...diseases }, discarded };
}
