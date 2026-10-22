import { createStore } from 'zustand/vanilla';
import { LESSONS } from '../anatomy/data';
import { SCENE_PRESETS, STRUCTURE_IDS, type ScenePreset, type CameraSnapshot, type Lang, type LayerMode, type Mode, type OpticsExperiment, type OpticsInput, type OpticsPreset, type PhysiologyKind, type SceneState, type StructureId, type ViewPreset } from '../anatomy/types';
import { opticsInputForPreset, validateOpticsInput } from '../engine/optics';
import { PHYSIOLOGY_LENGTHS, physiologyInput } from '../modes/physiology';
import { createQuiz, currentTarget, nextQuestion, revealAnswer, submitAnswer, type QuizState } from '../modes/quiz';

export const QUIZ_POOL: StructureId[] = ['cornea', 'sclera', 'iris', 'lens', 'retina', 'optic-nerve'];
const defaultLayers = () => Object.fromEntries(STRUCTURE_IDS.map(id => [id, ['vitreous', 'anterior-chamber', 'posterior-chamber', 'cornea'].includes(id) ? 'ghost' : 'on'])) as Record<StructureId, LayerMode>;
const initialScene = (): SceneState => ({
  lang: 'zh', mode: 'explore', selectedId: null, layers: defaultLayers(), isolateId: null,
  clip: { enabled: true, axis: 'sagittal', offset: 0, keepSide: 'negative' }, presetId: null, explode: 0, labels: false,
  view: 'oblique', opticsPreset: 'normal', opticsInput: opticsInputForPreset('normal'), opticsExperiment: 'baseline', comparison: null, physiology: null, quizRevealed: false, showOptics: false, camera: null, sceneRevision: 0,
});
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
type ObservationScene = Pick<SceneState, 'selectedId' | 'layers' | 'isolateId' | 'clip' | 'explode' | 'labels' | 'view' | 'presetId' | 'showOptics'>;
const clearedObservation = { focusReturn: null, revealReturn: null, revealPreset: null };
export interface EyeState extends SceneState {
  undoCount: number;
  applyPreset: (preset: ScenePreset) => void;
  beginSceneChange: (camera?: CameraSnapshot) => void; endSceneChange: () => void; undoScene: () => void;
  lessonId: string | null; step: number; quiz: QuizState | null;
  isolationLayers: SceneState['layers'] | null;
  focusReturn: CameraSnapshot | null;
  revealReturn: (ObservationScene & { camera: CameraSnapshot | null; isolationLayers: SceneState['layers'] | null }) | null;
  revealPreset: 'fundusView' | 'nerveView' | 'anteriorView' | 'sectionView' | 'frontView' | null;
  setLanguage: (lang: Lang) => void; setMode: (mode: Mode, camera?: CameraSnapshot) => void;
  select: (id: StructureId, preserveSection?: boolean) => void; cycleLayer: (id: StructureId) => void;
  toggleIsolate: () => void; setClip: (patch: Partial<SceneState['clip']>) => void;
  setExplode: (value: number) => void; setLabels: (value: boolean) => void;
  setView: (view: ViewPreset) => void; setOptics: (preset: OpticsPreset) => void;
  setOpticsInput: (patch: Partial<OpticsInput>) => void; setOpticsExperiment: (value: OpticsExperiment) => void;
  saveComparison: () => void; clearComparison: () => void; setComparisonView: (showing: 'reference' | 'current') => void;
  setPhysiology: (kind: PhysiologyKind | null) => void;
  playPhysiology: () => void; pausePhysiology: () => void; advancePhysiology: () => void; replayPhysiology: () => void;
  startLesson: (id: string) => void; goToStep: (step: number) => void;
  startQuiz: () => void; answerQuiz: (id: StructureId) => void;
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

function questionScene(quiz: QuizState) {
  const target = currentTarget(quiz);
  return {
    selectedId: target, quizRevealed: !!(target && quiz.answers[target]), labels: false, isolateId: null,
    clip: { enabled: false, axis: 'sagittal' as const, offset: 0, keepSide: 'negative' as const }, explode: 0,
    layers: Object.fromEntries(STRUCTURE_IDS.map(id => [id, id === target ? 'on' : 'ghost'])) as Record<StructureId, LayerMode>,
    view: (target === 'optic-nerve' ? 'back' : target === 'iris' || target === 'cornea' ? 'front' : 'oblique') as ViewPreset,
  };
}

function sceneFor(mode: Mode, lessonId: string | null = null, index = 0, quiz: QuizState | null = null): SceneState {
  const scene = { ...initialScene(), mode };
  if (mode === 'optics') return { ...scene, view: 'side' };
  if (mode === 'quiz' && quiz) return { ...scene, ...questionScene(quiz) };
  const step = mode === 'tour' ? LESSONS.find(lesson => lesson.id === lessonId)?.steps[index] : null;
  if (!step) return scene;
  const teachingScene: SceneState = { ...scene, selectedId: step.target, view: step.view,
    clip: { enabled: step.clip, axis: 'sagittal', offset: 0, keepSide: 'negative' }, showOptics: !!step.optics,
    opticsPreset: step.optics ?? 'normal', opticsInput: opticsInputForPreset(step.optics ?? 'normal') };
  return { ...teachingScene, ...selectionPatch(teachingScene, step.target) };
}

type SceneSnapshot = ObservationScene & Pick<EyeState, 'isolationLayers' | 'opticsPreset' | 'opticsInput' | 'opticsExperiment' | 'comparison' | 'physiology' | 'focusReturn' | 'revealReturn' | 'revealPreset'> & { camera: CameraSnapshot | null };
function captureScene(s: EyeState, camera = s.camera): SceneSnapshot {
  const { selectedId, layers, isolateId, clip, explode, labels, view, presetId, showOptics, isolationLayers, opticsPreset, opticsInput, opticsExperiment, comparison, physiology, focusReturn, revealReturn, revealPreset } = s;
  return structuredClone({ selectedId, layers, isolateId, clip, explode, labels, view, presetId, showOptics, isolationLayers, opticsPreset, opticsInput, opticsExperiment, comparison, physiology, focusReturn, revealReturn, revealPreset, camera: camera ?? null });
}
function sameScene(a: SceneSnapshot, b: SceneSnapshot) {
  const comparable = ({ camera: _camera, focusReturn: _focus, revealReturn: _reveal, revealPreset: _preset, ...scene }: SceneSnapshot) => scene;
  const sceneA = comparable(a), sceneB = comparable(b);
  return JSON.stringify(sceneA) === JSON.stringify(sceneB);
}
function presetScene(presetId: ScenePreset, s: EyeState): Partial<EyeState> {
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
  try { if (storage?.getItem('eyesight.language') === 'en') lang = 'en'; } catch { /* Storage may be unavailable in private contexts. */ }
  return createStore<EyeState>((set, get) => {
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
    const changeScene = (patch: Partial<EyeState>) => {
      const before = captureScene(get()), after = captureScene({ ...get(), ...patch });
      if (!sameScene(before, after)) {
        if (gesture) gesture.changed = true;
        else push(before);
      }
      set(patch);
    };
    const canPlayPhysiology = (kind: PhysiologyKind) => get().mode === 'optics' || (kind === 'signal' && get().mode === 'tour' && get().lessonId === 'vision');
    return ({
    ...initialScene(), ...clearedObservation, isolationLayers: null, undoCount: 0, lang, lessonId: null, step: 0, quiz: null,
    applyPreset: preset => { if (get().mode !== 'quiz' && SCENE_PRESETS.includes(preset)) changeScene(presetScene(preset, get())); },
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
      const current = get();
      if (mode === current.mode) return;
      finishGesture();
      drafts.set(current.mode, captureDraft(current, camera));
      let draft = drafts.get(mode);
      if (!draft) {
        const quiz = mode === 'quiz' ? createQuiz(QUIZ_POOL) : null;
        draft = captureDraft({ ...sceneFor(mode, null, 0, quiz), lessonId: null, step: 0, quiz, isolationLayers: null });
      }
      set({ ...draft, ...clearedObservation, mode, undoCount: histories.get(mode)?.length ?? 0, lang: current.lang, sceneRevision: (current.sceneRevision ?? 0) + 1 });
    },
    select: (id, preserveSection = false) => {
      if (get().mode === 'quiz') return;
      set(s => selectionPatch(s, id, preserveSection));
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
    },
    setOpticsInput: patch => {
      const s = get();
      if (s.physiology || !patch || typeof patch !== 'object' || Array.isArray(patch) || s.opticsExperiment === 'baseline') return;
      const keys = Object.keys(patch);
      if (keys.some(key => !Object.hasOwn(s.opticsInput, key) || (s.opticsExperiment !== 'free' && key !== s.opticsExperiment))) return;
      const opticsInput = { ...s.opticsInput, ...patch };
      try { validateOpticsInput(opticsInput); } catch { return; }
      if (JSON.stringify(opticsInput) !== JSON.stringify(s.opticsInput)) changeScene({ opticsInput });
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
      if (s.mode === 'optics' && !s.physiology) changeScene({ comparison: { input: { ...s.opticsInput }, showing: 'current' } });
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
    },
    playPhysiology: () => {
      const physiology = get().physiology;
      if (physiology && canPlayPhysiology(physiology.kind) && !physiology.playing && physiology.step < PHYSIOLOGY_LENGTHS[physiology.kind] - 1) set({ physiology: { ...physiology, playing: true } });
    },
    pausePhysiology: () => {
      const physiology = get().physiology;
      if (physiology?.playing) set({ physiology: { ...physiology, playing: false } });
    },
    advancePhysiology: () => {
      const physiology = get().physiology;
      if (!physiology || !canPlayPhysiology(physiology.kind)) return;
      const step = physiology.step + 1, last = PHYSIOLOGY_LENGTHS[physiology.kind] - 1;
      if (step > last) return;
      changeScene({ physiology: { ...physiology, step, playing: physiology.playing && step < last }, opticsInput: physiologyInput(physiology.kind, step) });
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
      get().goToStep(0);
    },
    goToStep: index => {
      const lesson = LESSONS.find(l => l.id === get().lessonId);
      if (get().mode !== 'tour' || !lesson?.steps[index]) return;
      clearHistory();
      set(s => ({ ...sceneFor('tour', s.lessonId, index), ...clearedObservation, isolationLayers: null, lang: s.lang, step: index, sceneRevision: (s.sceneRevision ?? 0) + 1 }));
    },
    startQuiz: () => { if (get().mode !== 'quiz') get().setMode('quiz'); else get().restartQuiz(); },
    restartQuiz: () => {
      if (get().mode !== 'quiz') return;
      const quiz = createQuiz(QUIZ_POOL);
      clearHistory();
      set(s => ({ ...sceneFor('quiz', null, 0, quiz), ...clearedObservation, isolationLayers: null, lang: s.lang, quiz, sceneRevision: (s.sceneRevision ?? 0) + 1 }));
    },
    restartLesson: () => { if (get().mode === 'tour' && get().lessonId) get().goToStep(0); },
    answerQuiz: id => { const quiz = get().quiz; if (quiz) set({ quiz: submitAnswer(quiz, id), quizRevealed: true }); },
    revealQuiz: () => { const quiz = get().quiz; if (quiz) set({ quiz: revealAnswer(quiz), quizRevealed: true }); },
    advanceQuiz: () => {
      const previous = get().quiz;
      if (!previous) return;
      const quiz = nextQuestion(previous);
      if (quiz === previous) return;
      clearHistory();
      set(s => ({ ...sceneFor('quiz', null, 0, quiz), ...clearedObservation, isolationLayers: null, lang: s.lang, quiz, sceneRevision: (s.sceneRevision ?? 0) + 1 }));
    },
    resetCamera: () => set(s => ({ view: s.presetId ? presetScene(s.presetId, s).view : sceneFor(s.mode, s.lessonId, s.step, s.quiz).view, camera: null, focusReturn: null, sceneRevision: (s.sceneRevision ?? 0) + 1 })),
    resetScene: () => { const s = get(); changeScene({ ...sceneFor(s.mode, s.lessonId, s.step, s.quiz), ...clearedObservation, isolationLayers: null, lang: s.lang, sceneRevision: (s.sceneRevision ?? 0) + 1 }); },
    rememberFocus: camera => { if (get().mode !== 'quiz') set({ focusReturn: structuredClone(camera) }); },
    returnFocus: () => {
      const camera = get().focusReturn;
      if (camera) set(s => ({ camera, focusReturn: null, sceneRevision: (s.sceneRevision ?? 0) + 1 }));
    },
    revealStructure: (id, camera) => {
      const s = get();
      if (s.mode === 'quiz') return;
      const { selectedId, layers, isolateId, clip, explode, labels, view, isolationLayers, presetId, showOptics } = s;
      const fundus = ['macula', 'fovea', 'optic-disc', 'optic-nerve', 'retinal-vessels', 'retina'].includes(id);
      const anterior = ['lens', 'zonules', 'ciliary-body', 'anterior-chamber', 'posterior-chamber'].includes(id);
      const front = ['cornea', 'iris', 'pupil', 'sclera'].includes(id);
      const revealed = defaultLayers();
      if (fundus) for (const part of STRUCTURE_IDS) revealed[part] = ['macula', 'fovea', 'optic-disc', 'optic-nerve', 'retinal-vessels'].includes(part) ? 'on' : part === 'retina' ? 'ghost' : 'off';
      if (anterior) Object.assign(revealed, { sclera: 'ghost', choroid: 'ghost', retina: 'ghost', iris: 'off', vitreous: 'off', 'anterior-chamber': 'off', 'posterior-chamber': 'off' });
      revealed[id] = 'on';
      changeScene({ selectedId: id, presetId: null, showOptics: false, layers: isolateId ? { ...layers, [id]: 'on' } : revealed, isolateId: isolateId ? id : null,
        clip: { enabled: !(fundus || front || isolateId), axis: 'sagittal', offset: 0, keepSide: 'negative' }, explode: 0,
        view: fundus ? id === 'optic-nerve' ? 'back' : 'front' : front ? 'front' : 'side',
        camera: null, sceneRevision: (s.sceneRevision ?? 0) + 1,
        focusReturn: camera ? structuredClone(camera) : null,
        revealPreset: fundus ? id === 'optic-nerve' ? 'nerveView' : 'fundusView' : anterior ? 'anteriorView' : front ? 'frontView' : 'sectionView',
        revealReturn: { selectedId, layers: { ...layers }, isolateId, clip: { ...clip }, explode, labels, view, isolationLayers, presetId, showOptics,
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
}

let browserStorage: StorageLike | undefined;
try { browserStorage = typeof window !== 'undefined' ? window.localStorage : undefined; } catch { /* Optional preference storage. */ }
export const eyeStore = createEyeStore(browserStorage);
