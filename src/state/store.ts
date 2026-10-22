import { createStore } from 'zustand/vanilla';
import { LESSONS } from '../anatomy/data';
import { STRUCTURE_IDS, type CameraSnapshot, type Lang, type LayerMode, type Mode, type OpticsPreset, type SceneState, type StructureId, type ViewPreset } from '../anatomy/types';
import { createQuiz, currentTarget, nextQuestion, revealAnswer, submitAnswer, type QuizState } from '../modes/quiz';

export const QUIZ_POOL: StructureId[] = ['cornea', 'sclera', 'iris', 'lens', 'retina', 'optic-nerve'];
const defaultLayers = () => Object.fromEntries(STRUCTURE_IDS.map(id => [id, ['vitreous', 'anterior-chamber', 'posterior-chamber', 'cornea'].includes(id) ? 'ghost' : 'on'])) as Record<StructureId, LayerMode>;
const initialScene = (): SceneState => ({
  lang: 'zh', mode: 'explore', selectedId: null, layers: defaultLayers(), isolateId: null,
  clip: { enabled: true, axis: 'sagittal', offset: 0 }, explode: 0, labels: false,
  view: 'oblique', opticsPreset: 'normal', quizRevealed: false, showOptics: false, camera: null, sceneRevision: 0,
});
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
type ObservationScene = Pick<SceneState, 'selectedId' | 'layers' | 'isolateId' | 'clip' | 'explode' | 'labels' | 'view'>;
const clearedObservation = { focusReturn: null, revealReturn: null, revealPreset: null };
export interface EyeState extends SceneState {
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
  startLesson: (id: string) => void; goToStep: (step: number) => void;
  startQuiz: () => void; answerQuiz: (id: StructureId) => void;
  revealQuiz: () => void; advanceQuiz: () => void; reset: () => void;
  resetCamera: () => void; resetScene: () => void; restartLesson: () => void; restartQuiz: () => void;
  rememberFocus: (camera: CameraSnapshot) => void; returnFocus: () => void;
  revealStructure: (id: StructureId, camera?: CameraSnapshot) => void; undoReveal: () => void;
}

type WorkspaceDraft = Omit<SceneState, 'lang' | 'mode' | 'sceneRevision'> & Pick<EyeState, 'lessonId' | 'step' | 'quiz' | 'isolationLayers'>;

function captureDraft(state: SceneState & Pick<EyeState, 'lessonId' | 'step' | 'quiz' | 'isolationLayers'>, camera = state.camera): WorkspaceDraft {
  const { selectedId, layers, isolateId, clip, explode, labels, view, opticsPreset, quizRevealed, showOptics, lessonId, step, quiz } = state;
  return { selectedId, layers: { ...layers }, isolateId, clip: { ...clip }, explode, labels, view, opticsPreset, quizRevealed, showOptics, lessonId, step, quiz,
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
    clip: { enabled: false, axis: 'sagittal' as const, offset: 0 }, explode: 0,
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
    clip: { enabled: step.clip, axis: 'sagittal', offset: 0 }, showOptics: !!step.optics, opticsPreset: step.optics ?? 'normal' };
  return { ...teachingScene, ...selectionPatch(teachingScene, step.target) };
}

export function createEyeStore(storage?: StorageLike) {
  const drafts = new Map<Mode, WorkspaceDraft>();
  let lang: Lang = 'zh';
  try { if (storage?.getItem('eyesight.language') === 'en') lang = 'en'; } catch { /* Storage may be unavailable in private contexts. */ }
  return createStore<EyeState>((set, get) => ({
    ...initialScene(), ...clearedObservation, isolationLayers: null, lang, lessonId: null, step: 0, quiz: null,
    setLanguage: lang => { set({ lang }); try { storage?.setItem('eyesight.language', lang); } catch { /* The live session still works. */ } },
    setMode: (mode, camera) => {
      const current = get();
      if (mode === current.mode) return;
      drafts.set(current.mode, captureDraft(current, camera));
      let draft = drafts.get(mode);
      if (!draft) {
        const quiz = mode === 'quiz' ? createQuiz(QUIZ_POOL) : null;
        draft = captureDraft({ ...sceneFor(mode, null, 0, quiz), lessonId: null, step: 0, quiz, isolationLayers: null });
      }
      set({ ...draft, ...clearedObservation, mode, lang: current.lang, sceneRevision: (current.sceneRevision ?? 0) + 1 });
    },
    select: (id, preserveSection = false) => {
      if (get().mode === 'quiz') return;
      set(s => selectionPatch(s, id, preserveSection));
    },
    cycleLayer: id => set(s => ({ layers: { ...s.layers, [id]: ({ on: 'ghost', ghost: 'off', off: 'on' } as const)[s.layers[id]] } })),
    toggleIsolate: () => set(s => s.isolateId
      ? { isolateId: null, layers: s.isolationLayers ?? s.layers, isolationLayers: null, ...clearedObservation }
      : s.selectedId ? { isolateId: s.selectedId, isolationLayers: { ...s.layers }, ...clearedObservation } : {}),
    setClip: patch => set(s => ({ clip: { ...s.clip, ...patch, offset: Math.max(-1, Math.min(1, patch.offset ?? s.clip.offset)) } })),
    setExplode: value => set({ explode: Math.max(0, Math.min(1, value)) }),
    setLabels: labels => set({ labels }),
    setView: view => set(s => ({ view, camera: null, sceneRevision: (s.sceneRevision ?? 0) + 1 })),
    setOptics: opticsPreset => set({ opticsPreset }),
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
      set(s => ({ ...sceneFor('tour', s.lessonId, index), ...clearedObservation, isolationLayers: null, lang: s.lang, step: index, sceneRevision: (s.sceneRevision ?? 0) + 1 }));
    },
    startQuiz: () => { if (get().mode !== 'quiz') get().setMode('quiz'); else get().restartQuiz(); },
    restartQuiz: () => {
      if (get().mode !== 'quiz') return;
      const quiz = createQuiz(QUIZ_POOL);
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
      set(s => ({ ...sceneFor('quiz', null, 0, quiz), ...clearedObservation, isolationLayers: null, lang: s.lang, quiz, sceneRevision: (s.sceneRevision ?? 0) + 1 }));
    },
    resetCamera: () => set(s => ({ view: sceneFor(s.mode, s.lessonId, s.step, s.quiz).view, camera: null, focusReturn: null, sceneRevision: (s.sceneRevision ?? 0) + 1 })),
    resetScene: () => set(s => ({ ...sceneFor(s.mode, s.lessonId, s.step, s.quiz), ...clearedObservation, isolationLayers: null, lang: s.lang, sceneRevision: (s.sceneRevision ?? 0) + 1 })),
    rememberFocus: camera => { if (get().mode !== 'quiz') set({ focusReturn: structuredClone(camera) }); },
    returnFocus: () => {
      const camera = get().focusReturn;
      if (camera) set(s => ({ camera, focusReturn: null, sceneRevision: (s.sceneRevision ?? 0) + 1 }));
    },
    revealStructure: (id, camera) => {
      const s = get();
      if (s.mode === 'quiz') return;
      const { selectedId, layers, isolateId, clip, explode, labels, view, isolationLayers } = s;
      const fundus = ['macula', 'fovea', 'optic-disc', 'optic-nerve', 'retinal-vessels', 'retina'].includes(id);
      const anterior = ['lens', 'zonules', 'ciliary-body', 'anterior-chamber', 'posterior-chamber'].includes(id);
      const front = ['cornea', 'iris', 'pupil', 'sclera'].includes(id);
      const revealed = defaultLayers();
      if (fundus) for (const part of STRUCTURE_IDS) revealed[part] = ['macula', 'fovea', 'optic-disc', 'optic-nerve', 'retinal-vessels'].includes(part) ? 'on' : part === 'retina' ? 'ghost' : 'off';
      if (anterior) Object.assign(revealed, { sclera: 'ghost', choroid: 'ghost', retina: 'ghost', iris: 'off', vitreous: 'off', 'anterior-chamber': 'off', 'posterior-chamber': 'off' });
      revealed[id] = 'on';
      set({ selectedId: id, layers: isolateId ? { ...layers, [id]: 'on' } : revealed, isolateId: isolateId ? id : null,
        clip: { enabled: !(fundus || front || isolateId), axis: 'sagittal', offset: 0 }, explode: 0,
        view: fundus ? id === 'optic-nerve' ? 'back' : 'front' : front ? 'front' : 'side',
        camera: null, sceneRevision: (s.sceneRevision ?? 0) + 1,
        focusReturn: camera ? structuredClone(camera) : null,
        revealPreset: fundus ? id === 'optic-nerve' ? 'nerveView' : 'fundusView' : anterior ? 'anteriorView' : front ? 'frontView' : 'sectionView',
        revealReturn: { selectedId, layers: { ...layers }, isolateId, clip: { ...clip }, explode, labels, view, isolationLayers,
          camera: camera ? structuredClone(camera) : null },
      });
    },
    undoReveal: () => {
      const previous = get().revealReturn;
      if (previous) set(s => ({ ...previous, ...clearedObservation, sceneRevision: (s.sceneRevision ?? 0) + 1 }));
    },
    reset: () => get().resetScene(),
  }));
}

let browserStorage: StorageLike | undefined;
try { browserStorage = typeof window !== 'undefined' ? window.localStorage : undefined; } catch { /* Optional preference storage. */ }
export const eyeStore = createEyeStore(browserStorage);
