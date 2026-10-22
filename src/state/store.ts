import { createStore } from 'zustand/vanilla';
import { LESSONS } from '../anatomy/data';
import { STRUCTURE_IDS, type Lang, type LayerMode, type Mode, type OpticsPreset, type SceneState, type StructureId, type ViewPreset } from '../anatomy/types';
import { createQuiz, currentTarget, nextQuestion, revealAnswer, submitAnswer, type QuizState } from '../modes/quiz';

export const QUIZ_POOL: StructureId[] = ['cornea', 'sclera', 'iris', 'lens', 'retina', 'optic-nerve'];
const defaultLayers = () => Object.fromEntries(STRUCTURE_IDS.map(id => [id, ['vitreous', 'anterior-chamber', 'posterior-chamber', 'cornea'].includes(id) ? 'ghost' : 'on'])) as Record<StructureId, LayerMode>;
const initialScene = (): SceneState => ({
  lang: 'zh', mode: 'explore', selectedId: null, layers: defaultLayers(), isolateId: null,
  clip: { enabled: true, axis: 'sagittal', offset: 0 }, explode: 0, labels: false,
  view: 'oblique', opticsPreset: 'normal', quizRevealed: false, showOptics: false,
});
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
export interface EyeState extends SceneState {
  lessonId: string | null; step: number; quiz: QuizState | null;
  setLanguage: (lang: Lang) => void; setMode: (mode: Mode) => void;
  select: (id: StructureId, preserveSection?: boolean) => void; cycleLayer: (id: StructureId) => void;
  toggleIsolate: () => void; setClip: (patch: Partial<SceneState['clip']>) => void;
  setExplode: (value: number) => void; setLabels: (value: boolean) => void;
  setView: (view: ViewPreset) => void; setOptics: (preset: OpticsPreset) => void;
  startLesson: (id: string) => void; goToStep: (step: number) => void;
  startQuiz: () => void; answerQuiz: (id: StructureId) => void;
  revealQuiz: () => void; advanceQuiz: () => void; reset: () => void;
}

function questionScene(quiz: QuizState): Partial<EyeState> {
  const target = currentTarget(quiz);
  return {
    quiz, selectedId: target, quizRevealed: false, labels: false, isolateId: null,
    clip: { enabled: false, axis: 'sagittal', offset: 0 }, explode: 0,
    layers: Object.fromEntries(STRUCTURE_IDS.map(id => [id, id === target ? 'on' : 'ghost'])) as Record<StructureId, LayerMode>,
    view: target === 'optic-nerve' ? 'back' : target === 'iris' || target === 'cornea' ? 'front' : 'oblique',
  };
}

export function createEyeStore(storage?: StorageLike) {
  let lang: Lang = 'zh';
  try { if (storage?.getItem('eyesight.language') === 'en') lang = 'en'; } catch { /* Storage may be unavailable in private contexts. */ }
  return createStore<EyeState>((set, get) => ({
    ...initialScene(), lang, lessonId: null, step: 0, quiz: null,
    setLanguage: lang => { set({ lang }); try { storage?.setItem('eyesight.language', lang); } catch { /* The live session still works. */ } },
    setMode: mode => {
      if (mode === get().mode) return;
      set({ ...initialScene(), lang: get().lang, mode, lessonId: null, step: 0, quiz: null });
      if (mode === 'optics') set({ view: 'side', labels: false });
      if (mode === 'quiz') get().startQuiz();
    },
    select: (id, preserveSection = false) => {
      if (get().mode === 'quiz') return;
      const fundus = ['macula', 'fovea', 'optic-disc', 'optic-nerve', 'retinal-vessels'].includes(id);
      set(s => ({ selectedId: id, isolateId: s.isolateId ? id : null,
        layers: { ...s.layers, [id]: 'on', ...(fundus ? { sclera: 'ghost', choroid: 'ghost', retina: 'ghost' } as const : {}) },
        clip: fundus ? { ...s.clip, enabled: false } : preserveSection ? s.clip : { ...s.clip, axis: 'sagittal', offset: 0 },
      }));
    },
    cycleLayer: id => set(s => ({ layers: { ...s.layers, [id]: ({ on: 'ghost', ghost: 'off', off: 'on' } as const)[s.layers[id]] } })),
    toggleIsolate: () => set(s => ({ isolateId: s.isolateId ? null : s.selectedId })),
    setClip: patch => set(s => ({ clip: { ...s.clip, ...patch, offset: Math.max(-1, Math.min(1, patch.offset ?? s.clip.offset)) } })),
    setExplode: value => set({ explode: Math.max(0, Math.min(1, value)) }),
    setLabels: labels => set({ labels }), setView: view => set({ view }), setOptics: opticsPreset => set({ opticsPreset }),
    startLesson: lessonId => {
      if (!LESSONS.some(lesson => lesson.id === lessonId)) return;
      set({ ...initialScene(), lang: get().lang, mode: 'tour', lessonId, step: 0, quiz: null });
      get().goToStep(0);
    },
    goToStep: index => {
      const lesson = LESSONS.find(l => l.id === get().lessonId);
      const step = lesson?.steps[index];
      if (!step) return;
      set({ step: index, selectedId: step.target, view: step.view, isolateId: null,
        layers: defaultLayers(), clip: { enabled: step.clip, axis: 'sagittal', offset: 0 },
        showOptics: !!step.optics, opticsPreset: step.optics ?? 'normal', explode: 0,
      });
      get().select(step.target);
    },
    startQuiz: () => set({ ...initialScene(), lang: get().lang, mode: 'quiz', lessonId: null, step: 0, ...questionScene(createQuiz(QUIZ_POOL)) }),
    answerQuiz: id => { const quiz = get().quiz; if (quiz) set({ quiz: submitAnswer(quiz, id), quizRevealed: true }); },
    revealQuiz: () => { const quiz = get().quiz; if (quiz) set({ quiz: revealAnswer(quiz), quizRevealed: true }); },
    advanceQuiz: () => { const quiz = get().quiz; if (quiz) set(questionScene(nextQuestion(quiz))); },
    reset: () => set({ ...initialScene(), lang: get().lang, lessonId: null, step: 0, quiz: null }),
  }));
}

let browserStorage: StorageLike | undefined;
try { browserStorage = typeof window !== 'undefined' ? window.localStorage : undefined; } catch { /* Optional preference storage. */ }
export const eyeStore = createEyeStore(browserStorage);
