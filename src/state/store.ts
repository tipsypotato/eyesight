import { createStore } from 'zustand/vanilla';
import { RELATIONSHIPS } from '../anatomy/relationships';
import { advanceTask, type TaskProgress, type TourAction } from '../modes/tourTasks';
import { LESSONS } from '../anatomy/data';
import { SCENE_PRESETS, STRUCTURE_IDS, type ScenePreset, type CameraSnapshot, type Lang, type LayerMode, type Mode, type OpticsExperiment, type OpticsInput, type OpticsPreset, type PhysiologyKind, type SceneState, type StructureId, type ViewPreset } from '../anatomy/types';
import { opticsInputForPreset, validateOpticsInput } from '../engine/optics';
import { PHYSIOLOGY_LENGTHS, physiologyInput } from '../modes/physiology';
import { createSession, currentQuestion, nextSessionQuestion, revealSessionAnswer, submitSessionAnswer, wrongQuestionIds, type PracticeSession } from '../modes/quiz';
import { parseProgress, PROGRESS_KEY, type SavedProgress } from './progress';
import { CONTENT_VERSION, questionsFor, type QuestionContext } from '../content/questions';

export const QUIZ_POOL: StructureId[] = ['cornea', 'sclera', 'iris', 'lens', 'retina', 'optic-nerve'];
const defaultLayers = () => Object.fromEntries(STRUCTURE_IDS.map(id => [id, ['vitreous', 'anterior-chamber', 'posterior-chamber', 'cornea'].includes(id) ? 'ghost' : 'on'])) as Record<StructureId, LayerMode>;
const initialScene = (): SceneState => ({
  lang: 'zh', mode: 'explore', selectedId: null, relatedIds: [], layers: defaultLayers(), isolateId: null,
  clip: { enabled: true, axis: 'sagittal', offset: 0, keepSide: 'negative' }, presetId: null, explode: 0, labels: false,
  view: 'oblique', opticsPreset: 'normal', opticsInput: opticsInputForPreset('normal'), opticsExperiment: 'baseline', comparison: null, physiology: null, quizRevealed: false, showOptics: false, camera: null, sceneRevision: 0,
});
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
type ObservationScene = Pick<SceneState, 'selectedId' | 'layers' | 'isolateId' | 'clip' | 'explode' | 'labels' | 'view' | 'presetId' | 'showOptics'>;
const clearedObservation = { focusReturn: null, revealReturn: null, revealPreset: null };
const clearedRelationship = { relatedIds: [] as StructureId[], relationshipId: null, relationshipReturn: null };
export interface EyeState extends SceneState {
  relationshipId: string | null;
  relationshipReturn: SceneSnapshot | null;
  enterRelationship: (id: string, camera?: CameraSnapshot) => void; exitRelationship: () => void;
  tourTasks: Record<string, TaskProgress>; lessonPositions: Record<string, number>;
  recordTourAction: (event: TourAction) => void; skipTourTask: () => void;
  sessions: Record<string, PracticeSession>; activeSessions: Record<string, string>; activeQuizId: string | null;
  storageNotice: 'unavailable' | 'recovered' | null; dismissStorageNotice: () => void;
  flushProgress: (camera?: CameraSnapshot) => void; rememberCamera: (camera: CameraSnapshot) => void; clearLocalProgress: () => void;
  startPractice: (context: QuestionContext, restart?: boolean, wrongOnly?: boolean, camera?: CameraSnapshot) => void;
  practiceObservation: SceneSnapshot | null; inspectQuizStructure: (camera?: CameraSnapshot) => void; continuePractice: () => void;
  undoCount: number;
  applyPreset: (preset: ScenePreset) => void;
  beginSceneChange: (camera?: CameraSnapshot) => void; endSceneChange: () => void; undoScene: () => void;
  lessonId: string | null; step: number; quiz: PracticeSession | null;
  isolationLayers: SceneState['layers'] | null;
  focusReturn: CameraSnapshot | null;
  revealReturn: (ObservationScene & Pick<EyeState, 'relatedIds' | 'relationshipId' | 'relationshipReturn'> & { camera: CameraSnapshot | null; isolationLayers: SceneState['layers'] | null }) | null;
  revealPreset: 'fundusView' | 'nerveView' | 'anteriorView' | 'sectionView' | 'frontView' | null;
  setLanguage: (lang: Lang) => void; setMode: (mode: Mode, camera?: CameraSnapshot) => void;
  select: (id: StructureId, preserveSection?: boolean) => void; cycleLayer: (id: StructureId) => void;
  toggleIsolate: () => void; setClip: (patch: Partial<SceneState['clip']>) => void;
  setExplode: (value: number) => void; setLabels: (value: boolean) => void;
  setView: (view: ViewPreset) => void; setOptics: (preset: OpticsPreset) => void;
  setOpticsInput: (patch: Partial<OpticsInput>) => void; setOpticsExperiment: (value: OpticsExperiment) => void;
  saveComparison: () => void; clearComparison: () => void; setComparisonView: (showing: 'reference' | 'current') => void;
  setPhysiology: (kind: PhysiologyKind | null) => void;
  playPhysiology: () => void; pausePhysiology: (manual?: boolean) => void; advancePhysiology: (manual?: boolean) => void; replayPhysiology: () => void;
  startLesson: (id: string) => void; goToStep: (step: number) => void; exploreFromTour: (camera?: CameraSnapshot) => void;
  startQuiz: () => void; answerQuiz: (id: string) => void;
  revealQuiz: () => void; advanceQuiz: () => void; reset: () => void;
  resetCamera: () => void; resetScene: () => void; restartLesson: () => void; restartQuiz: () => void;
  rememberFocus: (camera: CameraSnapshot) => void; returnFocus: () => void;
  revealStructure: (id: StructureId, camera?: CameraSnapshot) => void; undoReveal: () => void;
}

type WorkspaceDraft = Omit<SceneState, 'lang' | 'mode' | 'sceneRevision'> & Pick<EyeState, 'lessonId' | 'step' | 'quiz' | 'isolationLayers'>;

function captureDraft(state: SceneState & Pick<EyeState, 'lessonId' | 'step' | 'quiz' | 'isolationLayers'>, camera = state.camera): WorkspaceDraft {
  const { selectedId, layers, isolateId, clip, explode, labels, view, presetId, opticsPreset, opticsInput, opticsExperiment, comparison, physiology, quizRevealed, showOptics, lessonId, step, quiz } = state;
  return { selectedId, layers: { ...layers }, isolateId, clip: { ...clip }, explode, labels, view, presetId, opticsPreset, opticsInput: { ...opticsInput }, opticsExperiment, quizRevealed, showOptics, lessonId, step, quiz,
    comparison: structuredClone(comparison), physiology: physiology ? structuredClone({ ...physiology, playing: false }) : null,
    isolationLayers: state.isolationLayers ? { ...state.isolationLayers } : null, camera: camera ? structuredClone(camera) : null };
}

function selectionPatch(state: SceneState, id: StructureId, preserveSection = false): Partial<SceneState> {
  if (preserveSection) return { selectedId: id, isolateId: state.isolateId ? id : null, layers: { ...state.layers, [id]: 'on' } };
  const fundus = ['macula', 'fovea', 'optic-disc', 'optic-nerve', 'retinal-vessels'].includes(id);
  return { selectedId: id, isolateId: state.isolateId ? id : null,
    layers: { ...state.layers, [id]: 'on', ...(fundus ? { sclera: 'ghost', choroid: 'ghost', retina: 'ghost' } as const : {}) },
    clip: fundus ? { ...state.clip, enabled: false } : preserveSection ? state.clip : { ...state.clip, axis: 'sagittal', offset: 0 } };
}

function questionScene(quiz: PracticeSession) {
  const question = currentQuestion(quiz);
  const target = question?.kind === 'identify' ? question.target : null;
  return {
    selectedId: target, quizRevealed: !!(question && quiz.answers[question.id]), labels: false, isolateId: null,
    clip: { enabled: false, axis: 'sagittal' as const, offset: 0, keepSide: 'negative' as const }, explode: 0,
    layers: Object.fromEntries(STRUCTURE_IDS.map(id => [id, id === target ? 'on' : 'ghost'])) as Record<StructureId, LayerMode>,
    view: (target === 'optic-nerve' ? 'back' : target === 'iris' || target === 'cornea' ? 'front' : 'oblique') as ViewPreset,
  };
}

function sceneFor(mode: Mode, lessonId: string | null = null, index = 0, quiz: PracticeSession | null = null): SceneState {
  const scene = { ...initialScene(), mode };
  if (mode === 'optics') return { ...scene, view: 'side' };
  if (mode === 'quiz' && quiz) return { ...scene, ...questionScene(quiz) };
  const step = mode === 'tour' ? LESSONS.find(lesson => lesson.id === lessonId)?.steps[index] : null;
  if (!step) return scene;
  const teachingScene: SceneState = { ...scene, selectedId: step.target, view: step.view,
    clip: { enabled: step.clip, axis: 'sagittal', offset: 0, keepSide: 'negative' }, showOptics: !!step.optics,
    opticsPreset: step.optics ?? 'normal', opticsInput: opticsInputForPreset(step.optics ?? 'normal') };
  if (lessonId === 'myopia' && index === 1) Object.assign(teachingScene, { opticsInput: opticsInputForPreset('normal'), opticsExperiment: 'axialIncrement' });
  if (lessonId === 'myopia' && index === 2) Object.assign(teachingScene, { opticsInput: opticsInputForPreset('myopia'), opticsExperiment: 'externalLens' });
  if (lessonId === 'vision' && index === 1) teachingScene.showOptics = false;
  if (lessonId === 'anatomy' && index === 3) return { ...teachingScene, ...presetScene('fundus', teachingScene) };
  return { ...teachingScene, ...selectionPatch(teachingScene, step.target) };
}

type SceneSnapshot = ObservationScene & Pick<EyeState, 'isolationLayers' | 'opticsPreset' | 'opticsInput' | 'opticsExperiment' | 'comparison' | 'physiology' | 'focusReturn' | 'revealReturn' | 'revealPreset' | 'relatedIds' | 'relationshipId' | 'relationshipReturn'> & { camera: CameraSnapshot | null };
function captureScene(s: EyeState, camera = s.camera): SceneSnapshot {
  const { selectedId, layers, isolateId, clip, explode, labels, view, presetId, showOptics, isolationLayers, opticsPreset, opticsInput, opticsExperiment, comparison, physiology, focusReturn, revealReturn, revealPreset, relatedIds, relationshipId, relationshipReturn } = s;
  return structuredClone({ selectedId, layers, isolateId, clip, explode, labels, view, presetId, showOptics, isolationLayers, opticsPreset, opticsInput, opticsExperiment, comparison, physiology, focusReturn, revealReturn, revealPreset, relatedIds, relationshipId, relationshipReturn, camera: camera ?? null });
}
function sameScene(a: SceneSnapshot, b: SceneSnapshot) {
  const comparable = ({ camera: _camera, focusReturn: _focus, revealReturn: _reveal, revealPreset: _preset, ...scene }: SceneSnapshot) => scene;
  const sceneA = comparable(a), sceneB = comparable(b);
  return JSON.stringify(sceneA) === JSON.stringify(sceneB);
}
function presetScene(presetId: ScenePreset, s: Pick<SceneState, 'selectedId' | 'sceneRevision'>): Partial<EyeState> {
  const layers = defaultLayers();
  if (presetId === 'anterior' || presetId === 'chambers') Object.assign(layers, { sclera: 'ghost', choroid: 'ghost', retina: 'ghost' });
  if (presetId === 'anterior') for (const id of ['macula', 'fovea', 'optic-disc', 'retinal-vessels'] as const) layers[id] = 'off';
  if (presetId === 'fundus') for (const id of STRUCTURE_IDS) layers[id] = ['macula', 'fovea', 'optic-disc', 'optic-nerve', 'retinal-vessels'].includes(id) ? 'on' : id === 'retina' ? 'ghost' : 'off';
  if (presetId === 'optical-path') for (const id of STRUCTURE_IDS) layers[id] = 'ghost';
  return { presetId, layers, selectedId: s.selectedId && layers[s.selectedId] !== 'off' ? s.selectedId : null,
    isolateId: null, isolationLayers: null, explode: 0, labels: false,
    clip: { enabled: !['intact', 'fundus'].includes(presetId), axis: 'sagittal', offset: 0, keepSide: 'negative' },
    view: presetId === 'fundus' ? 'front' : ['intact', 'anterior'].includes(presetId) ? 'oblique' : 'side',
    showOptics: presetId === 'optical-path', camera: null, ...clearedObservation, sceneRevision: (s.sceneRevision ?? 0) + 1 };
}

export function createEyeStore(storage?: StorageLike) {
  const drafts = new Map<Mode, WorkspaceDraft>();
  let lang: Lang = 'zh';
  let saved: SavedProgress | null = null, storageFailed = false;
  let notice: EyeState['storageNotice'] = null;
  let liveCamera: CameraSnapshot | null = null;
  try {
    if (storage?.getItem('eyesight.language') === 'en') lang = 'en';
    const parsed = parseProgress(storage?.getItem(PROGRESS_KEY) ?? null); saved = parsed.value;
    if (parsed.discarded) notice = 'recovered';
  } catch { storageFailed = true; notice = 'unavailable'; }
  const sessions = saved?.sessions ?? {}, activeSessions = saved?.activeSessions ?? {};
  let activeQuizId = saved?.activeQuizId ?? null;
  let restoredQuiz = activeQuizId ? sessions[activeQuizId] : null;
  if (saved?.mode === 'quiz' && !restoredQuiz) {
    restoredQuiz = createSession('structures', questionsFor('structures'));
    activeQuizId = restoredQuiz.sessionId; sessions[activeQuizId] = restoredQuiz; activeSessions.structures = activeQuizId;
  }
  for (const [mode, draft] of Object.entries(saved?.drafts ?? {})) {
    const quiz = mode === 'quiz' ? restoredQuiz : null;
    drafts.set(mode as Mode, { ...draft, relatedIds: [], quiz, quizRevealed: false, ...(quiz ? questionScene(quiz) : {}) });
  }
  const restoredMode = saved?.mode ?? 'explore';
  const restored = drafts.get(restoredMode) ?? captureDraft({ ...sceneFor(restoredMode, null, 0, restoredMode === 'quiz' ? restoredQuiz : null), lessonId: null, step: 0, quiz: restoredMode === 'quiz' ? restoredQuiz : null, isolationLayers: null });
  let persist: (camera?: CameraSnapshot) => void = () => {};
  const store = createStore<EyeState>((set, get) => {
    const histories = new Map<Mode, SceneSnapshot[]>();
    let gesture: { mode: Mode; before: SceneSnapshot; changed: boolean } | null = null;
    const history = () => histories.get(get().mode) ?? [];
    const push = (before: SceneSnapshot) => {
      const next = [...history(), before].slice(-20);
      histories.set(get().mode, next); set({ undoCount: next.length });
    };
    const finishGesture = () => {
      const current = gesture; gesture = null;
      if (current?.changed && current.mode === get().mode && !sameScene(current.before, captureScene(get()))) push(current.before);
    };
    const clearHistory = () => { gesture = null; histories.delete(get().mode); set({ undoCount: 0 }); };
    const clearRelationshipHistory = () => {
      finishGesture();
      const entries = history().filter(entry => !entry.relationshipId && !entry.revealReturn?.relationshipId);
      histories.set(get().mode, entries); set({ undoCount: entries.length });
    };
    const changeScene = (patch: Partial<EyeState>) => {
      const before = captureScene(get()), after = captureScene({ ...get(), ...patch });
      if (!sameScene(before, after)) {
        if (gesture) gesture.changed = true;
        else push(before);
      }
      set(patch);
    };
    const canPlayPhysiology = (kind: PhysiologyKind) => get().mode === 'optics' || (kind === 'signal' && get().mode === 'tour' && get().lessonId === 'vision');
    const commitQuiz = (quiz: PracticeSession) => set(s => ({ quiz, sessions: { ...s.sessions, [quiz.sessionId]: quiz }, activeSessions: { ...s.activeSessions, [quiz.context]: quiz.sessionId }, activeQuizId: quiz.sessionId }));
    return ({
    ...initialScene(), ...restored, mode: restoredMode, sessions, activeSessions, activeQuizId, storageNotice: notice, practiceObservation: null, relationshipId: null, relationshipReturn: null, tourTasks: saved?.tourTasks ?? {}, lessonPositions: saved?.lessonPositions ?? {}, ...clearedObservation, undoCount: 0, lang,
    dismissStorageNotice: () => set({ storageNotice: null }),
    flushProgress: camera => persist(camera),
    rememberCamera: camera => { liveCamera = structuredClone(camera); },
    clearLocalProgress: () => {
      drafts.clear(); histories.clear(); gesture = null; liveCamera = null; storageFailed = false;
      set(s => ({ ...initialScene(), ...clearedObservation, lang: s.lang, sceneRevision: (s.sceneRevision ?? 0) + 1, isolationLayers: null, undoCount: 0, lessonId: null, step: 0, quiz: null, sessions: {}, activeSessions: {}, activeQuizId: null, tourTasks: {}, lessonPositions: {}, relationshipId: null, relationshipReturn: null, practiceObservation: null, storageNotice: null }));
    },
    recordTourAction: event => {
      const s = get(); if (s.mode !== 'tour' || !s.lessonId) return;
      const key = `${s.lessonId}:${s.step}`, progress = advanceTask(key, s.tourTasks[key], event);
      if (key === 'vision:1' && event.kind === 'sync') changeScene({ showOptics: true });
      if (progress && progress !== s.tourTasks[key]) set({ tourTasks: { ...s.tourTasks, [key]: progress } });
    },
    skipTourTask: () => { const s = get(); if (s.mode !== 'tour' || !s.lessonId) return; const key = `${s.lessonId}:${s.step}`; if (s.tourTasks[key]?.status !== 'done') set({ tourTasks: { ...s.tourTasks, [key]: { status: 'visited', actions: s.tourTasks[key]?.actions ?? [], hint: false } } }); },
    enterRelationship: (id, camera) => {
      const s = get(), relationship = RELATIONSHIPS.find(item => item.id === id);
      if (!relationship || s.mode === 'quiz' || s.relationshipId === id) return;
      finishGesture();
      const previous = s.relationshipReturn ?? captureScene(s, camera);
      const patch = presetScene(relationship.preset, s);
      const layers = { ...patch.layers! }; for (const member of relationship.members) layers[member.id] = 'on';
      set({ ...patch, layers, selectedId: s.selectedId, relatedIds: relationship.members.map(member => member.id), relationshipId: id, relationshipReturn: previous });
    },
    exitRelationship: () => { const s = get(); if (s.relationshipReturn) { clearRelationshipHistory(); set({ ...s.relationshipReturn, ...clearedRelationship, sceneRevision: (s.sceneRevision ?? 0) + 1 }); } },
    applyPreset: preset => { if (get().mode !== 'quiz' && SCENE_PRESETS.includes(preset)) changeScene({ ...presetScene(preset, get()), ...clearedRelationship }); },
    beginSceneChange: camera => { if (!gesture) gesture = { mode: get().mode, before: captureScene(get(), camera), changed: false }; },
    endSceneChange: finishGesture,
    undoScene: () => {
      finishGesture();
      const entries = history(), previous = entries.at(-1);
      if (!previous) return;
      histories.set(get().mode, entries.slice(0, -1));
      set(s => ({ ...previous, physiology: previous.physiology ? { ...previous.physiology, playing: false } : null, undoCount: entries.length - 1, sceneRevision: (s.sceneRevision ?? 0) + 1 }));
    },
    setLanguage: lang => { set({ lang }); try { storage?.setItem('eyesight.language', lang); } catch { /* The live session still works. */ } },
    setMode: (mode, camera) => {
      if (mode === get().mode) return;
      const temporaryReturn = get().practiceObservation ?? get().relationshipReturn;
      if (get().relationshipId) get().exitRelationship();
      if (get().practiceObservation) set({ ...get().practiceObservation!, practiceObservation: null });
      const current = get();
      clearRelationshipHistory();
      drafts.set(current.mode, captureDraft(current, temporaryReturn ? current.camera : camera));
      let draft = drafts.get(mode);
      if (!draft) {
        const quiz = mode === 'quiz' ? (current.activeQuizId && current.sessions[current.activeQuizId]) || createSession('structures', questionsFor('structures')) : null;
        if (quiz) commitQuiz(quiz);
        draft = captureDraft({ ...sceneFor(mode, null, 0, quiz), lessonId: null, step: 0, quiz, isolationLayers: null });
      }
      set({ ...draft, ...clearedObservation, mode, undoCount: histories.get(mode)?.length ?? 0, lang: current.lang, sceneRevision: (current.sceneRevision ?? 0) + 1 });
    },
    select: (id, preserveSection = false) => {
      if (get().mode === 'quiz') return;
      set(s => selectionPatch(s, id, preserveSection));
      get().recordTourAction({ kind: 'select', id });
    },
    cycleLayer: id => changeScene({ layers: { ...get().layers, [id]: ({ on: 'ghost', ghost: 'off', off: 'on' } as const)[get().layers[id]] } }),
    toggleIsolate: () => {
      const s = get();
      if (s.isolateId) changeScene({ isolateId: null, layers: s.isolationLayers ?? s.layers, isolationLayers: null, ...clearedObservation });
      else if (s.selectedId) changeScene({ isolateId: s.selectedId, isolationLayers: { ...s.layers }, ...clearedObservation });
    },
    setClip: patch => {
      const s = get();
      if (patch.offset !== undefined && !Number.isFinite(patch.offset)) return;
      const clip = { ...s.clip, ...patch, offset: Math.max(-1, Math.min(1, patch.offset ?? s.clip.offset)) };
      if (JSON.stringify(clip) !== JSON.stringify(s.clip)) changeScene({ clip });
    },
    setExplode: value => {
      if (!Number.isFinite(value)) return;
      const explode = Math.max(0, Math.min(1, value));
      if (explode !== get().explode) changeScene({ explode });
    },
    setLabels: labels => changeScene({ labels }),
    setView: view => set(s => ({ view, camera: null, sceneRevision: (s.sceneRevision ?? 0) + 1 })),
    setOptics: opticsPreset => {
      if (get().physiology || !['normal', 'myopia', 'corrected'].includes(opticsPreset)) return;
      changeScene({ opticsPreset, opticsInput: opticsInputForPreset(opticsPreset), opticsExperiment: 'baseline' });
      if (opticsPreset === 'normal') get().recordTourAction({ kind: 'normal' });
    },
    setOpticsInput: patch => {
      const s = get();
      if (s.physiology || !patch || typeof patch !== 'object' || Array.isArray(patch) || s.opticsExperiment === 'baseline') return;
      const keys = Object.keys(patch);
      if (keys.some(key => !Object.hasOwn(s.opticsInput, key) || (s.opticsExperiment !== 'free' && key !== s.opticsExperiment))) return;
      const opticsInput = { ...s.opticsInput, ...patch };
      try { validateOpticsInput(opticsInput); } catch { return; }
      if (JSON.stringify(opticsInput) !== JSON.stringify(s.opticsInput)) {
        changeScene({ opticsInput });
        if (s.opticsInput.axialIncrement < 0.8 && opticsInput.axialIncrement >= 0.8) get().recordTourAction({ kind: 'axial' });
        if (s.opticsInput.externalLens === 'off' && opticsInput.externalLens === 'myopia') get().recordTourAction({ kind: 'lens' });
      }
    },
    setOpticsExperiment: opticsExperiment => {
      const s = get();
      if (s.physiology) return;
      if (opticsExperiment === 'free') { changeScene({ opticsExperiment }); return; }
      if (opticsExperiment === 'baseline') { get().setOptics(s.opticsPreset); return; }
      if (!Object.hasOwn(s.opticsInput, opticsExperiment)) return;
      const opticsPreset = opticsExperiment === 'externalLens' ? 'myopia' : 'normal';
      const opticsInput = opticsInputForPreset(opticsPreset);
      if (opticsExperiment === 'accommodation') opticsInput.objectDistance = 'near';
      changeScene({ opticsPreset, opticsInput, opticsExperiment });
    },
    saveComparison: () => {
      const s = get();
      if ((s.mode === 'optics' || s.mode === 'tour' && s.lessonId === 'myopia') && !s.physiology) {
        changeScene({ comparison: { input: { ...s.opticsInput }, showing: 'current' } });
        if (JSON.stringify(s.opticsInput) === JSON.stringify(opticsInputForPreset('normal'))) get().recordTourAction({ kind: 'comparison' });
      }
    },
    clearComparison: () => { if (get().comparison) changeScene({ comparison: null }); },
    setComparisonView: showing => {
      const comparison = get().comparison;
      if (comparison && ['reference', 'current'].includes(showing) && comparison.showing !== showing) set({ comparison: { ...comparison, showing } });
    },
    setPhysiology: kind => {
      const s = get(), previous = s.physiology;
      if (kind === null) {
        if (previous) changeScene({ physiology: null, opticsInput: { ...previous.returnInput }, opticsExperiment: previous.returnExperiment, opticsPreset: previous.returnPreset, showOptics: previous.returnShowOptics });
        return;
      }
      if (!Object.hasOwn(PHYSIOLOGY_LENGTHS, kind) || !canPlayPhysiology(kind) || previous?.kind === kind) return;
      changeScene({ comparison: null, opticsPreset: 'normal', opticsExperiment: 'baseline', opticsInput: physiologyInput(kind, 0), showOptics: true,
        physiology: { kind, step: 0, playing: false, returnInput: { ...(previous?.returnInput ?? s.opticsInput) }, returnExperiment: previous?.returnExperiment ?? s.opticsExperiment, returnPreset: previous?.returnPreset ?? s.opticsPreset, returnShowOptics: previous?.returnShowOptics ?? !!s.showOptics } });
      if (kind === 'signal') get().recordTourAction({ kind: 'signal-start' });
    },
    playPhysiology: () => {
      const physiology = get().physiology;
      if (physiology && canPlayPhysiology(physiology.kind) && !physiology.playing && physiology.step < PHYSIOLOGY_LENGTHS[physiology.kind] - 1) set({ physiology: { ...physiology, playing: true } });
    },
    pausePhysiology: (manual = false) => {
      const physiology = get().physiology;
      if (physiology?.playing) set({ physiology: { ...physiology, playing: false } });
      if (manual && physiology?.kind === 'signal' && physiology.step === 0) get().recordTourAction({ kind: 'pause' });
    },
    advancePhysiology: (manual = false) => {
      const physiology = get().physiology;
      if (!physiology || !canPlayPhysiology(physiology.kind)) return;
      const step = physiology.step + 1, last = PHYSIOLOGY_LENGTHS[physiology.kind] - 1;
      if (step > last) return;
      changeScene({ physiology: { ...physiology, step, playing: physiology.playing && step < last }, opticsInput: physiologyInput(physiology.kind, step) });
      if (manual && physiology.kind === 'signal') get().recordTourAction({ kind: step === 1 ? 'signal-retina' : 'signal-nerve' });
    },
    replayPhysiology: () => {
      const physiology = get().physiology;
      if (physiology && canPlayPhysiology(physiology.kind)) changeScene({ physiology: { ...physiology, step: 0, playing: true }, opticsInput: physiologyInput(physiology.kind, 0) });
    },
    startLesson: lessonId => {
      if (!LESSONS.some(lesson => lesson.id === lessonId)) return;
      if (get().mode !== 'tour') get().setMode('tour');
      if (get().lessonId === lessonId) return;
      set({ lessonId });
      get().goToStep(get().lessonPositions[lessonId] ?? 0);
    },
    goToStep: index => {
      const lesson = LESSONS.find(l => l.id === get().lessonId);
      if (get().mode !== 'tour' || !lesson?.steps[index]) return;
      if (get().relationshipId) get().exitRelationship();
      clearHistory();
      set(s => ({ ...sceneFor('tour', s.lessonId, index), lessonPositions: { ...s.lessonPositions, [s.lessonId!]: index }, comparison: s.lessonId === 'myopia' ? s.comparison : null, ...clearedObservation, isolationLayers: null, lang: s.lang, step: index, sceneRevision: (s.sceneRevision ?? 0) + 1 }));
    },
    exploreFromTour: camera => {
      if (get().mode !== 'tour') return;
      const temporary = !!get().relationshipId;
      if (temporary) get().exitRelationship();
      const scene = captureDraft(get(), temporary ? get().camera : camera);
      get().setMode('explore', scene.camera ?? undefined);
      clearHistory();
      set(s => ({ ...scene, ...clearedObservation, ...clearedRelationship, mode: 'explore', lessonId: null, step: 0, quiz: null, physiology: null, comparison: null, sceneRevision: (s.sceneRevision ?? 0) + 1 }));
    },
    startPractice: (context, restart = false, wrongOnly = false, camera) => {
      if (!questionsFor(context).length) return;
      if (get().mode !== 'quiz') get().setMode('quiz', camera);
      const previous = get().sessions[get().activeSessions[context]];
      let pool = questionsFor(context);
      if (wrongOnly) { const ids = previous ? wrongQuestionIds(previous) : []; pool = pool.filter(q => ids.includes(q.id)); if (!pool.length) return; }
      const quiz = previous && !restart && !wrongOnly ? previous : createSession(context, pool);
      clearHistory(); commitQuiz(quiz);
      set(s => ({ ...sceneFor('quiz', null, 0, quiz), ...clearedObservation, isolationLayers: null, lang: s.lang, quiz, sceneRevision: (s.sceneRevision ?? 0) + 1 }));
    },
    startQuiz: () => { if (get().mode !== 'quiz') get().setMode('quiz'); else get().restartQuiz(); },
    restartQuiz: () => { if (get().mode === 'quiz') get().startPractice((get().quiz?.context ?? 'structures') as QuestionContext, true); },
    restartLesson: () => { if (get().mode === 'tour' && get().lessonId) get().goToStep(0); },
    answerQuiz: id => { const quiz = get().quiz; if (get().mode !== 'quiz' || !quiz) return; const next = submitSessionAnswer(quiz, id); if (next !== quiz) { commitQuiz(next); set({ quizRevealed: true }); } },
    revealQuiz: () => { const quiz = get().quiz; if (get().mode !== 'quiz' || !quiz) return; const next = revealSessionAnswer(quiz); if (next !== quiz) { commitQuiz(next); set({ quizRevealed: true }); } },
    advanceQuiz: () => {
      const previous = get().quiz;
      if (get().mode !== 'quiz' || !previous) return;
      const quiz = nextSessionQuestion(previous);
      if (quiz === previous) return;
      clearHistory(); commitQuiz(quiz);
      set(s => ({ ...sceneFor('quiz', null, 0, quiz), ...clearedObservation, isolationLayers: null, lang: s.lang, quiz, sceneRevision: (s.sceneRevision ?? 0) + 1 }));
    },
    inspectQuizStructure: camera => {
      const s = get(), question = s.quiz && currentQuestion(s.quiz);
      if (s.mode !== 'quiz' || !question?.target || !s.quiz!.answers[question.id]) return;
      s.setMode('explore', camera); set({ practiceObservation: captureScene(get()) });
      get().revealStructure(question.target, get().camera ?? undefined);
    },
    continuePractice: () => { if (get().practiceObservation) get().setMode('quiz'); },
    resetCamera: () => set(s => ({ view: s.presetId ? presetScene(s.presetId, s).view : sceneFor(s.mode, s.lessonId, s.step, s.quiz).view, camera: null, focusReturn: null, sceneRevision: (s.sceneRevision ?? 0) + 1 })),
    resetScene: () => { const s = get(); changeScene({ ...sceneFor(s.mode, s.lessonId, s.step, s.quiz), ...clearedObservation, ...clearedRelationship, isolationLayers: null, lang: s.lang, sceneRevision: (s.sceneRevision ?? 0) + 1 }); },
    rememberFocus: camera => { if (get().mode !== 'quiz') set({ focusReturn: structuredClone(camera) }); },
    returnFocus: () => {
      const camera = get().focusReturn;
      if (camera) set(s => ({ camera, focusReturn: null, sceneRevision: (s.sceneRevision ?? 0) + 1 }));
    },
    revealStructure: (id, camera) => {
      const s = get();
      if (s.mode === 'quiz') return;
      const { selectedId, layers, isolateId, clip, explode, labels, view, isolationLayers, presetId, showOptics, relatedIds, relationshipId, relationshipReturn } = s;
      const fundus = ['macula', 'fovea', 'optic-disc', 'optic-nerve', 'retinal-vessels', 'retina'].includes(id);
      const anterior = ['lens', 'zonules', 'ciliary-body', 'anterior-chamber', 'posterior-chamber'].includes(id);
      const front = ['cornea', 'iris', 'pupil', 'sclera'].includes(id);
      const revealed = defaultLayers();
      if (fundus) for (const part of STRUCTURE_IDS) revealed[part] = ['macula', 'fovea', 'optic-disc', 'optic-nerve', 'retinal-vessels'].includes(part) ? 'on' : part === 'retina' ? 'ghost' : 'off';
      if (anterior) Object.assign(revealed, { sclera: 'ghost', choroid: 'ghost', retina: 'ghost', iris: 'off', vitreous: 'off', 'anterior-chamber': 'off', 'posterior-chamber': 'off' });
      revealed[id] = 'on';
      get().recordTourAction({ kind: 'select', id });
      changeScene({ ...clearedRelationship, selectedId: id, presetId: null, showOptics: false, layers: isolateId ? { ...layers, [id]: 'on' } : revealed, isolateId: isolateId ? id : null,
        clip: { enabled: !(fundus || front || isolateId), axis: 'sagittal', offset: 0, keepSide: 'negative' }, explode: 0,
        view: fundus ? id === 'optic-nerve' ? 'back' : 'front' : front ? 'front' : 'side',
        camera: null, sceneRevision: (s.sceneRevision ?? 0) + 1,
        focusReturn: camera ? structuredClone(camera) : null,
        revealPreset: fundus ? id === 'optic-nerve' ? 'nerveView' : 'fundusView' : anterior ? 'anteriorView' : front ? 'frontView' : 'sectionView',
        revealReturn: { selectedId, layers: { ...layers }, isolateId, clip: { ...clip }, explode, labels, view, isolationLayers, presetId, showOptics, relatedIds, relationshipId, relationshipReturn,
          camera: camera ? structuredClone(camera) : null },
      });
    },
    undoReveal: () => {
      const previous = get().revealReturn;
      if (previous) changeScene({ ...previous, ...clearedObservation, sceneRevision: (get().sceneRevision ?? 0) + 1 });
    },
    reset: () => get().resetScene(),
  });
  });
  persist = camera => {
    if (!storage || storageFailed) return;
    const s = store.getState();
    if (camera) liveCamera = structuredClone(camera);
    const base = s.relationshipReturn ?? s.practiceObservation;
    const current = captureDraft(base ? { ...s, ...base } : s, base ? base.camera : liveCamera ?? s.camera);
    const allDrafts = Object.fromEntries([...drafts, [s.mode, current]]);
    const sceneDrafts = Object.fromEntries(Object.entries(allDrafts).map(([mode, draft]) => {
      const { quiz: _quiz, quizRevealed: _revealed, relatedIds: _related, ...scene } = draft;
      return [mode, scene];
    }));
    const payload: SavedProgress = { schemaVersion: 2, contentVersion: CONTENT_VERSION, mode: s.mode, drafts: sceneDrafts, lessonPositions: s.lessonPositions, tourTasks: s.tourTasks, sessions: s.sessions, activeSessions: s.activeSessions, activeQuizId: s.activeQuizId };
    try { storage.setItem(PROGRESS_KEY, JSON.stringify(payload)); }
    catch { storageFailed = true; store.setState({ storageNotice: 'unavailable' }); }
  };
  store.subscribe((state, previous) => {
    if (state.mode !== previous.mode || state.sceneRevision !== previous.sceneRevision) liveCamera = null;
    persist();
  });
  return store;
}

let browserStorage: StorageLike | undefined;
try { browserStorage = typeof window !== 'undefined' ? window.localStorage : undefined; } catch { browserStorage = { getItem: () => { throw new Error('Storage unavailable'); }, setItem: () => { throw new Error('Storage unavailable'); } }; }
export const eyeStore = createEyeStore(browserStorage);
