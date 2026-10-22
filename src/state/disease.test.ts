import { describe, expect, it } from 'vitest';
import type { CameraSnapshot } from '../anatomy/types';
import { currentQuestion } from '../modes/quiz';
import { createDiseaseDraft, parseDiseaseDraft, type DiseaseId } from '../modes/disease';
import { createEyeStore } from './store';
import { PROGRESS_KEY } from './progress';

const camera: CameraSnapshot = { position: [3, 2, 4], target: [0.1, 0, 0], zoom: 1.2 };
const memory = () => { const data = new Map<string, string>(); return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } }; };

describe('doctor-led disease workspace', () => {
  it('opens the normal cataract view without a mandatory practice session', () => {
    const store = createEyeStore(); store.getState().setMode('disease');
    expect(store.getState()).toMatchObject({ mode: 'disease', disease: { id: 'cataract', step: 0, opacity: 0.55 }, diseaseNormal: true, diseaseReturnMode: 'explore', quiz: null });
    expect(store.getState().sessions).toEqual({});
  });

  it('restores independent chapter steps, parameters and actual cameras', () => {
    const store = createEyeStore(); const s = () => store.getState();
    s().openDisease('cataract'); s().setDiseaseStep(2); s().updateDisease({ opacity: 0.8 });
    s().openDisease('glaucoma', camera); s().setDiseaseStep(1); s().updateDisease({ scenario: 'normal-tension' });
    s().openDisease('cataract', { ...camera, position: [0, 0, 6] });
    expect(s()).toMatchObject({ disease: { id: 'cataract', step: 2, opacity: 0.8 }, camera });
    s().openDisease('glaucoma');
    expect(s()).toMatchObject({ disease: { id: 'glaucoma', step: 1, scenario: 'normal-tension' }, camera: { position: [0, 0, 6] } });
  });

  it('preserves disease parameters while normal and comparison views are active', () => {
    const store = createEyeStore(); const s = () => store.getState();
    s().openDisease('cataract'); s().setDiseaseStep(1); s().updateDisease({ opacity: 0.9 });
    s().setDiseaseStep(0);
    expect(s()).toMatchObject({ disease: { opacity: 0.9 }, diseaseNormal: true });
    s().setDiseaseNormal(false); expect(s()).toMatchObject({ disease: { step: 1, opacity: 0.9 }, diseaseNormal: false });
    s().setDiseaseStep(2); s().setDiseaseNormal(true); s().setDiseaseComparison(true);
    expect(s()).toMatchObject({ disease: { opacity: 0.9 }, diseaseNormal: true, diseaseComparison: true });
    s().setDiseaseNormal(false); expect(s().disease).toMatchObject({ opacity: 0.9 });
  });

  it('returns to the original optics scene and clears disease and animation state', () => {
    const store = createEyeStore(); const s = () => store.getState();
    s().setMode('optics'); s().setOptics('myopia'); s().saveComparison();
    s().openDisease('glaucoma', camera); s().setDiseaseStep(1); s().updateDisease({ flowPlaying: true }); s().setDiseaseComparison(true);
    expect(s()).toMatchObject({ opticsPreset: 'normal', physiology: null, comparison: null });
    s().leaveDisease();
    expect(s()).toMatchObject({ mode: 'optics', opticsPreset: 'myopia', camera, disease: null, diseaseComparison: false });
    expect(s().comparison).not.toBeNull();
    expect(s().diseaseDrafts.glaucoma).toMatchObject({ flowPlaying: false });
  });

  it('keeps established damage when flow improves and resets relief on case changes', () => {
    const store = createEyeStore(); const s = () => store.getState();
    s().openDisease('glaucoma'); s().setDiseaseStep(2);
    s().updateDisease({ scenario: 'established-damage', visualField: 'defect' }); s().updateDisease({ outflowRelieved: true, flowPlaying: true });
    expect(s().disease).toMatchObject({ scenario: 'established-damage', visualField: 'defect', outflowRelieved: true });
    s().updateDisease({ scenario: 'normal-tension' });
    expect(s().disease).toMatchObject({ scenario: 'normal-tension', outflowRelieved: false, flowPlaying: false });
  });

  it('keeps each amblyopia cause card and input switch independent', () => {
    const store = createEyeStore(); const s = () => store.getState(); s().openDisease('amblyopia'); s().setDiseaseStep(2);
    const d = s().disease!; if (d.id !== 'amblyopia') throw Error('wrong chapter');
    s().updateDisease({ caseDrafts: { ...d.caseDrafts, anisometropia: { card: 2, inputImproved: true } } });
    s().updateDisease({ causeCase: 'strabismic' });
    expect(s().disease).toMatchObject({ caseDrafts: { anisometropia: { card: 2, inputImproved: true }, strabismic: { card: 0, inputImproved: false }, deprivation: { card: 0, inputImproved: false } } });
    s().openDisease('cataract'); expect(s().disease).toMatchObject({ opacity: 0.55 });
    s().openDisease('amblyopia'); s().updateDisease({ causeCase: 'anisometropia' });
    expect(s().disease).toMatchObject({ caseDrafts: { anisometropia: { card: 2, inputImproved: true } } });
  });

  it('uses signed alignment presets and retains deviation when the affected eye changes', () => {
    const store = createEyeStore(); const s = () => store.getState(); s().openDisease('strabismus');
    s().updateDisease({ alignment: 'esotropia' }); expect(s().disease).toMatchObject({ deviationDeg: 10 });
    s().updateDisease({ affectedEye: 'left' }); expect(s().disease).toMatchObject({ deviationDeg: 10, affectedEye: 'left' });
    s().updateDisease({ deviationDeg: -7 }); expect(s().disease).toMatchObject({ deviationDeg: -7, alignment: 'custom' });
    s().selectEye('left', 'iris'); expect(s()).toMatchObject({ selectedEye: 'left', selectedId: 'iris' });
  });

  it('restores a left-eye selection after another chapter and a browser refresh', () => {
    const storage = memory(), store = createEyeStore(storage); const s = () => store.getState();
    s().openDisease('strabismus'); s().selectEye('left', 'iris'); s().openDisease('cataract'); s().openDisease('strabismus');
    expect(s()).toMatchObject({ selectedEye: 'left', selectedId: 'iris' });
    expect(createEyeStore(storage).getState()).toMatchObject({ selectedEye: 'left', selectedId: 'iris' });
  });

  it('creates an optional shared session on step three and locks submitted answers', () => {
    const store = createEyeStore(); const s = () => store.getState(); s().openDisease('cataract'); s().setDiseaseStep(3);
    expect(s().quiz?.context).toBe('cataract'); const question = currentQuestion(s().quiz!)!;
    s().answerQuiz(question.correctOptionId); const answered = s().quiz!;
    s().revealQuiz(); expect(s().quiz).toBe(answered);
    s().setDiseaseNormal(true); s().setDiseaseComparison(true); s().setDiseaseStep(1); s().setDiseaseStep(3);
    expect(s().quiz).toBe(answered); expect(s().mode).toBe('disease');
    s().advanceQuiz(); expect(s().quiz?.index).toBe(1); expect(s().disease?.step).toBe(3);
    s().resetDisease(); expect(s().sessions[answered.sessionId].answers).toEqual(answered.answers); expect(s().disease?.step).toBe(0);
    s().setDiseaseStep(3); expect(s().quiz?.index).toBe(1);
  });

  it('rejects invalid runtime chapter patches without altering a valid draft', () => {
    const store = createEyeStore(); const s = () => store.getState(); s().openDisease('cataract'); const before = s().disease;
    for (const patch of [{ opacity: NaN }, { opacity: 1.1 }, { view: 'future' }, { preview: 'future' }, { id: 'glaucoma' }, { step: 9 }, { unknown: 1 }]) s().updateDisease(patch as never);
    expect(s().disease).toEqual(before);
    s().openDisease('strabismus'); s().updateDisease({ deviationDeg: 21 }); expect(s().disease).toMatchObject({ deviationDeg: 0 });
  });

  it.each([
    ['cataract', { opacity: -0.1 }], ['cataract', { opacity: Infinity }], ['cataract', { preview: 'remote-image' }], ['cataract', { view: 'unknown' }],
    ['glaucoma', { scenario: 'pressure-stage-4' }], ['glaucoma', { view: 'unknown' }], ['glaucoma', { visualField: 'total-blindness' }], ['glaucoma', { outflowRelieved: 'yes' }], ['glaucoma', { flowPlaying: 1 }],
    ['strabismus', { deviationDeg: -21 }], ['strabismus', { alignment: 'unknown' }], ['strabismus', { affectedEye: 'both' }], ['strabismus', { targetDistance: 'middle' }], ['strabismus', { visualExplanation: 'all-see-double' }], ['strabismus', { showAxes: 1 }],
    ['amblyopia', { causeCase: 'adult-age' }], ['amblyopia', { caseDrafts: { anisometropia: { card: 4, inputImproved: true } } }],
    ['cataract', { step: 1.2 }], ['cataract', { selectedEye: 'both' }], ['cataract', { selectedId: 'missing' }],
  ] as [DiseaseId, object][])('rejects invalid persisted %s fields %#', (id, patch) => {
    expect(parseDiseaseDraft({ ...createDiseaseDraft(id), ...patch })).toBeNull();
  });

  it('keeps the regular quiz and each disease practice independent across refresh', () => {
    const storage = memory(), store = createEyeStore(storage); const s = () => store.getState();
    s().startPractice('vision'); s().revealQuiz(); const originalQuiz = s().quiz!;
    s().startPractice('cataract'); s().revealQuiz(); const cataractQuiz = s().quiz!;
    s().startPractice('glaucoma'); s().revealQuiz();
    const restored = createEyeStore(storage); restored.getState().setMode('quiz');
    expect(restored.getState().quiz).toEqual(originalQuiz);
    expect(restored.getState().activeQuizId).toBe(originalQuiz.sessionId);
    restored.getState().startPractice('cataract'); expect(restored.getState().quiz).toEqual(cataractQuiz);
    expect(restored.getState().mode).toBe('disease');
  });

  it('undoes a disease parameter without changing its locked practice answer', () => {
    const store = createEyeStore(); const s = () => store.getState();
    s().startPractice('cataract'); s().revealQuiz(); const answers = s().quiz!.answers;
    s().setDiseaseStep(1); s().beginSceneChange(camera); s().updateDisease({ opacity: 0.9 }); s().endSceneChange(); s().undoScene();
    expect(s().disease).toMatchObject({ opacity: 0.55 }); expect(s().quiz!.answers).toEqual(answers);
    s().openDisease('glaucoma'); s().openDisease('cataract'); expect(s().disease).toMatchObject({ opacity: 0.55 });
  });

  it('restores chapter drafts and pauses flow while discarding transient comparison', () => {
    const storage = memory(), store = createEyeStore(storage); const s = () => store.getState();
    s().openDisease('cataract'); s().setDiseaseStep(2); s().updateDisease({ opacity: 0.7 });
    s().openDisease('glaucoma', camera); s().setDiseaseStep(2); s().updateDisease({ scenario: 'established-damage', flowPlaying: true }); s().setDiseaseComparison(true);
    s().flushProgress({ ...camera, position: [0, 0, 5] });
    const restored = createEyeStore(storage);
    expect(restored.getState()).toMatchObject({ mode: 'disease', disease: { id: 'glaucoma', step: 2, scenario: 'established-damage', flowPlaying: false }, diseaseComparison: false, camera: { position: [0, 0, 5] } });
    restored.getState().openDisease('cataract'); expect(restored.getState()).toMatchObject({ disease: { step: 2, opacity: 0.7 }, camera });
  });

  it('clears a restored chapter identity when all local progress is reset', () => {
    const storage = memory(), store = createEyeStore(storage); store.getState().openDisease('amblyopia');
    const restored = createEyeStore(storage); restored.getState().clearLocalProgress(); restored.getState().setMode('disease');
    expect(restored.getState().disease?.id).toBe('cataract');
    expect(restored.getState().sessions).toEqual({});
  });

  it('opens the general structure quiz when no regular quiz existed before disease practice', () => {
    const storage = memory(), store = createEyeStore(storage); store.getState().startPractice('cataract');
    const restored = createEyeStore(storage); restored.getState().setMode('quiz');
    expect(restored.getState().quiz?.context).toBe('structures');
  });

  it('recovers a corrupt chapter without losing healthy disease and original workspace drafts', () => {
    const storage = memory(), store = createEyeStore(storage); const s = () => store.getState();
    s().setExplode(0.4); s().openDisease('cataract'); s().updateDisease({ opacity: 0.8 }); s().openDisease('glaucoma');
    const saved = JSON.parse(storage.data.get(PROGRESS_KEY)!); saved.diseaseDrafts.glaucoma.scenario = 'future'; saved.diseaseDrafts.cataract.extra = 'ignored'; storage.setItem(PROGRESS_KEY, JSON.stringify(saved));
    const restored = createEyeStore(storage); expect(restored.getState().diseaseDrafts.cataract).toMatchObject({ opacity: 0.8 });
    expect(restored.getState().diseaseDrafts.cataract).not.toHaveProperty('extra');
    expect(restored.getState().diseaseDrafts.glaucoma).toMatchObject({ scenario: 'outflow-risk' });
    restored.getState().leaveDisease(); expect(restored.getState()).toMatchObject({ mode: 'explore', explode: 0.4 });
  });

  it('migrates published T07 sessions and old structure-layer maps without losing answers', () => {
    const storage = memory(), store = createEyeStore(storage); store.getState().startPractice('anatomy'); store.getState().revealQuiz();
    const old = JSON.parse(storage.data.get(PROGRESS_KEY)!); old.contentVersion = '2026-10-22-t07';
    for (const session of Object.values(old.sessions) as { contentVersion: string }[]) session.contentVersion = '2026-10-22-t07';
    for (const draft of Object.values(old.drafts) as { layers: Record<string, string> }[]) { delete draft.layers['iridocorneal-angle']; delete draft.layers['trabecular-meshwork']; }
    delete old.diseaseDrafts; delete old.diseaseReturnMode;
    storage.setItem(PROGRESS_KEY, JSON.stringify(old)); const restored = createEyeStore(storage);
    expect(restored.getState().quiz?.answers).toEqual(store.getState().quiz?.answers);
    expect(restored.getState().quiz?.sessionId).toBe(store.getState().quiz?.sessionId);
    expect(restored.getState().layers['trabecular-meshwork']).toBeDefined();
  });
});

it('opens the optic nerve view with the existing fundus preset and no clipping through the disc', () => {
  const store = createEyeStore(); store.getState().openDisease('glaucoma'); store.getState().updateDisease({ view: 'nerve' });
  expect(store.getState()).toMatchObject({ view: 'front', clip: { enabled: false }, presetId: 'fundus', selectedId: 'optic-disc', layers: { 'optic-disc': 'on', 'optic-nerve': 'on', macula: 'on', iris: 'off' } });
  store.getState().updateDisease({ view: 'outflow' });
  expect(store.getState()).toMatchObject({ view: 'oblique', clip: { enabled: true }, layers: { 'trabecular-meshwork': 'on', iris: 'on' } });
});

it('retains the original cataract context camera across chapter changes and refresh while detail has its own camera', () => {
  const storage = memory(), store = createEyeStore(storage), detail = { ...camera, position: [0.5, 0.2, 1.8] as [number, number, number] };
  store.getState().openDisease('cataract'); store.getState().setDiseaseStep(1); store.getState().rememberCamera(camera);
  store.getState().updateDisease({ view: 'lens-detail' });
  expect(store.getState().disease).toMatchObject({ contextCamera: camera });
  store.getState().openDisease('glaucoma', detail); store.getState().openDisease('cataract');
  expect(store.getState()).toMatchObject({ camera: detail, disease: { view: 'lens-detail', contextCamera: camera } });
  store.getState().flushProgress(detail);
  const restored = createEyeStore(storage);
  expect(restored.getState().disease).toMatchObject({ contextCamera: camera });
  restored.getState().updateDisease({ view: 'context' });
  expect(restored.getState().camera).toEqual(camera);
  restored.getState().resetDisease(); expect(restored.getState().disease).toMatchObject({ contextCamera: null });
});

it('drops a malformed persisted context camera without discarding the cataract parameters', () => {
  const storage = memory(), store = createEyeStore(storage);
  store.getState().openDisease('cataract'); store.getState().updateDisease({ opacity: 0.8 });
  const saved = JSON.parse(storage.data.get(PROGRESS_KEY)!);
  saved.diseaseDrafts.cataract.contextCamera = { position: [1, 2, 3], target: [1, 2, 3], zoom: 1 };
  storage.setItem(PROGRESS_KEY, JSON.stringify(saved));
  const restored = createEyeStore(storage);
  expect(restored.getState().disease).toMatchObject({ opacity: 0.8, contextCamera: null });
  expect(restored.getState().storageNotice).toBe('recovered');
});

it('can select an eye without choosing a structure and records the choice in its chapter draft', () => {
  const storage = memory(), store = createEyeStore(storage);
  store.getState().openDisease('strabismus'); store.getState().selectEye('left', null);
  expect(store.getState()).toMatchObject({ selectedEye: 'left', selectedId: null, disease: { selectedEye: 'left', selectedId: null } });
  expect(store.getState().diseaseDrafts.strabismus).toMatchObject({ selectedEye: 'left', selectedId: null });
  store.getState().selectEye('left', 'iris'); store.getState().selectEye('right', null);
  expect(store.getState()).toMatchObject({ selectedEye: 'right', selectedId: 'iris' });
  const restored = createEyeStore(storage); expect(restored.getState()).toMatchObject({ selectedEye: 'right', selectedId: 'iris' });
});
