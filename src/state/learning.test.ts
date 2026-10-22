import { describe, expect, it } from 'vitest';
import { createEyeStore } from './store';
import { currentQuestion, wrongQuestionIds } from '../modes/quiz';
import { PROGRESS_KEY } from './progress';

describe('related observation and optional tour actions', () => {
  it('returns from related members to the original layers, isolation and actual camera', () => {
    const store = createEyeStore(); const s = () => store.getState();
    s().select('lens'); s().toggleIsolate(); s().setClip({ offset: 0.3 });
    const before = s(); const camera = { position: [3, 2, 4] as [number, number, number], target: [0, 0, 0] as [number, number, number], zoom: 1.2 };
    s().enterRelationship('accommodation', camera);
    expect(s()).toMatchObject({ selectedId: 'lens', isolateId: null, relatedIds: ['ciliary-body', 'zonules', 'lens'] });
    s().select('zonules', true); s().setLanguage('en'); s().exitRelationship();
    expect(s()).toMatchObject({ selectedId: 'lens', isolateId: 'lens', layers: before.layers, clip: before.clip, camera, lang: 'en', relatedIds: [] });
  });

  it('removes temporary relationship overlays on workspace changes and blocks them in quizzes', () => {
    const store = createEyeStore(); const s = () => store.getState();
    s().select('retina'); const layers = s().layers;
    s().enterRelationship('fundus'); s().setMode('quiz');
    s().enterRelationship('fundus'); expect(s().relatedIds).toEqual([]);
    s().setMode('explore'); expect(s().relationshipId).toBeNull(); expect(s().layers).toEqual(layers);
  });

  it('requires actual selection actions, rejects wrong wall order, and never auto-advances', () => {
    const store = createEyeStore(); const s = () => store.getState();
    s().startLesson('anatomy');
    expect(s().tourTasks['anatomy:0']).toBeUndefined();
    s().select('sclera', true); expect(s().tourTasks['anatomy:0'].status).toBe('done');
    s().goToStep(1); s().select('retina', true);
    expect(s().tourTasks['anatomy:1']).toMatchObject({ status: 'visited', hint: true });
    s().select('sclera', true); s().select('choroid', true); s().select('retina', true);
    expect(s().tourTasks['anatomy:1'].status).toBe('done'); expect(s().step).toBe(1);
    s().goToStep(2); s().skipTourTask(); expect(s().tourTasks['anatomy:2'].status).toBe('visited');
    s().setLanguage('en'); s().startLesson('vision'); s().startLesson('anatomy');
    expect(s().step).toBe(2); expect(s().tourTasks['anatomy:1'].status).toBe('done');
  });

  it('requires all space focus actions and both fundus focus and explicit acknowledgement', () => {
    const store = createEyeStore(); const s = () => store.getState();
    s().startLesson('anatomy'); s().goToStep(2);
    for (const id of ['anterior-chamber', 'posterior-chamber', 'vitreous'] as const) s().recordTourAction({ kind: 'focus', id });
    expect(s().tourTasks['anatomy:2'].status).toBe('done');
    s().goToStep(3); s().recordTourAction({ kind: 'observed' });
    expect(s().tourTasks['anatomy:3'].status).toBe('visited');
    s().recordTourAction({ kind: 'focus', id: 'fovea' }); s().recordTourAction({ kind: 'observed' });
    expect(s().tourTasks['anatomy:3'].status).toBe('done');
  });

  it('opens the fundus step from the inner eye with both landmark layers visible', () => {
    const store = createEyeStore(); store.getState().startLesson('anatomy'); store.getState().goToStep(3);
    expect(store.getState()).toMatchObject({ presetId: 'fundus', view: 'front', selectedId: 'macula', clip: { enabled: false }, layers: { macula: 'on', 'optic-disc': 'on', cornea: 'off', iris: 'off', lens: 'off', retina: 'ghost' } });
  });

  it('opens synchronized optics only after the deliberate tour action', () => {
    const store = createEyeStore(); const s = () => store.getState();
    s().startLesson('vision'); s().goToStep(1);
    expect(s().showOptics).toBe(false); expect(s().tourTasks['vision:1']).toBeUndefined();
    s().recordTourAction({ kind: 'sync' });
    expect(s().showOptics).toBe(true); expect(s().tourTasks['vision:1'].status).toBe('visited');
    s().recordTourAction({ kind: 'focus', id: 'lens' }); expect(s().tourTasks['vision:1'].status).toBe('done');
  });

  it('recognizes optical actions only at the matching step, not from default state', () => {
    const store = createEyeStore(); const s = () => store.getState();
    s().startLesson('myopia'); s().setOptics('normal'); s().saveComparison();
    expect(s().tourTasks['myopia:0'].status).toBe('done');
    s().goToStep(1); expect(s().tourTasks['myopia:1']).toBeUndefined();
    s().setOpticsExperiment('axialIncrement'); s().setOpticsInput({ axialIncrement: 0.7 });
    expect(s().tourTasks['myopia:1']?.status).not.toBe('done');
    s().setOpticsInput({ axialIncrement: 0.8 }); expect(s().tourTasks['myopia:1'].status).toBe('done');
    s().goToStep(2); s().setOpticsExperiment('externalLens'); s().setOpticsInput({ externalLens: 'myopia' });
    expect(s().tourTasks['myopia:2'].status).toBe('done');
  });

  it('counts deliberate light actions and manual signal steps, not automatic playback', () => {
    const store = createEyeStore(); const s = () => store.getState();
    s().startLesson('vision'); s().setPhysiology('signal'); s().pausePhysiology(true); s().recordTourAction({ kind: 'focus', id: 'pupil' });
    expect(s().tourTasks['vision:0'].status).toBe('done');
    s().goToStep(1); s().recordTourAction({ kind: 'sync' }); s().recordTourAction({ kind: 'focus', id: 'lens' });
    expect(s().tourTasks['vision:1'].status).toBe('done');
    s().goToStep(2); expect(s().tourTasks['vision:2']).toBeUndefined(); s().recordTourAction({ kind: 'observed' });
    expect(s().tourTasks['vision:2'].status).toBe('done');
    s().goToStep(3); s().setPhysiology('signal'); s().advancePhysiology(); s().advancePhysiology();
    expect(s().tourTasks['vision:3']?.status).not.toBe('done');
    s().setPhysiology(null); s().setPhysiology('signal'); s().advancePhysiology(true); s().advancePhysiology(true);
    expect(s().tourTasks['vision:3'].status).toBe('done');
  });
});

describe('temporary observation boundaries', () => {
  const camera = { position: [3, 2, 4] as [number, number, number], target: [0, 0, 0] as [number, number, number], zoom: 1.2 };
  const temporaryCamera = { ...camera, zoom: 2 };
  it('keeps the original camera when leaving related observation through navigation', () => {
    const store = createEyeStore(); const s = () => store.getState();
    s().select('lens'); s().enterRelationship('accommodation', camera);
    s().setMode('optics', temporaryCamera); s().setMode('explore');
    expect(s()).toMatchObject({ selectedId: 'lens', camera, relatedIds: [], relationshipId: null });
  });

  it('clears relationship context on scene replacement and restores it with undo', () => {
    const store = createEyeStore(); const s = () => store.getState();
    s().select('lens'); s().enterRelationship('accommodation', camera);
    const related = s();
    s().resetScene();
    expect(s()).toMatchObject({ relatedIds: [], relationshipId: null, relationshipReturn: null });
    s().undoScene();
    expect(s()).toMatchObject({ relatedIds: related.relatedIds, relationshipId: 'accommodation', relationshipReturn: related.relationshipReturn });
    s().applyPreset('fundus'); expect(s().relationshipId).toBeNull();
    s().undoScene(); expect(s().relationshipId).toBe('accommodation');
    s().revealStructure('fovea', temporaryCamera); expect(s().relationshipId).toBeNull();
    s().undoReveal(); expect(s().relationshipId).toBe('accommodation');
    s().exitRelationship(); expect(s()).toMatchObject({ selectedId: 'lens', camera, relatedIds: [], relationshipId: null });
    expect(s().undoCount).toBe(0);
  });

  it('discards temporary group undo entries while retaining the original scene history', () => {
    const store = createEyeStore(); const s = () => store.getState();
    s().setExplode(0.2); s().select('lens'); s().enterRelationship('accommodation', camera);
    s().setLabels(true); s().setClip({ offset: 0.2 }); s().exitRelationship();
    expect(s().undoCount).toBe(1); s().undoScene();
    expect(s()).toMatchObject({ explode: 0, relationshipId: null, relatedIds: [] });
  });

  it('restores the exploration camera after a quiz observation leaves via main navigation', () => {
    const store = createEyeStore(); const s = () => store.getState();
    s().select('lens'); s().startPractice('anatomy', false, false, camera); s().revealQuiz();
    const quiz = s().quiz;
    s().inspectQuizStructure(); s().setMode('optics', temporaryCamera); s().setMode('explore');
    expect(s()).toMatchObject({ selectedId: 'lens', camera, practiceObservation: null });
    s().setMode('quiz'); expect(s().quiz).toEqual(quiz);
  });

  it('returns from a tour to exploration with its last scene and camera, without requiring tasks', () => {
    const store = createEyeStore(); const s = () => store.getState();
    s().setExplode(0.7); s().startLesson('anatomy'); s().goToStep(3); s().setLanguage('en');
    const tour = s(); s().exploreFromTour(camera);
    expect(s()).toMatchObject({ mode: 'explore', selectedId: tour.selectedId, layers: tour.layers, clip: tour.clip, view: tour.view, camera, lang: 'en', lessonId: null, quiz: null });
    expect(s().tourTasks).toEqual({});
    s().setMode('tour'); expect(s()).toMatchObject({ lessonId: 'anatomy', step: 3, camera });
  });

  it('does not count automatic pause as an explicit incoming-light operation', () => {
    const store = createEyeStore(); const s = () => store.getState();
    s().startLesson('vision'); s().setPhysiology('signal'); s().playPhysiology(); s().pausePhysiology();
    s().recordTourAction({ kind: 'focus', id: 'pupil' });
    expect(s().tourTasks['vision:0']?.status).not.toBe('done');
    s().pausePhysiology(true); s().recordTourAction({ kind: 'focus', id: 'pupil' });
    expect(s().tourTasks['vision:0'].status).toBe('done');
  });
});

describe('independent practice sessions', () => {
  it('keeps each topic session and option order while navigating and switching languages', () => {
    const store = createEyeStore(); const s = () => store.getState();
    s().startPractice('anatomy'); const first = s().quiz!;
    expect(first.order).toHaveLength(3); const question = currentQuestion(first)!;
    s().answerQuiz(question.correctOptionId); const answered = s().quiz!;
    s().startPractice('vision'); expect(s().quiz!.sessionId).not.toBe(first.sessionId);
    s().setLanguage('en'); s().startPractice('anatomy');
    expect(s().quiz).toEqual(answered); expect(s().quiz!.optionOrder).toEqual(first.optionOrder);
    expect(s().sessions[first.sessionId]).toEqual(answered);
  });

  it('keeps completed history and puts only errors and revealed answers in a new review session', () => {
    const store = createEyeStore(); const s = () => store.getState();
    s().startPractice('vision');
    s().answerQuiz(currentQuestion(s().quiz!)!.correctOptionId); s().advanceQuiz();
    s().revealQuiz(); s().advanceQuiz();
    const q = currentQuestion(s().quiz!)!; s().answerQuiz(q.options.find(o => o.id !== q.correctOptionId)!.id); s().advanceQuiz();
    const completed = s().quiz!; expect(wrongQuestionIds(completed)).toHaveLength(2);
    s().startPractice('vision', true, true);
    expect(s().quiz!.order.slice().sort()).toEqual(wrongQuestionIds(completed).sort());
    expect(s().quiz!.sessionId).not.toBe(completed.sessionId); expect(s().quiz!.answers).toEqual({});
    expect(s().sessions[completed.sessionId]).toEqual(completed);
  });

  it('does not expose concept targets before answering and returns from observation to the same locked question', () => {
    const store = createEyeStore(); const s = () => store.getState();
    s().startPractice('anatomy'); expect(s().selectedId).toBeNull();
    const before = s(); s().inspectQuizStructure(); expect(s()).toBe(before);
    s().revealQuiz(); const answered = s().quiz!;
    s().inspectQuizStructure(); expect(s().mode).toBe('explore');
    s().continuePractice(); expect(s().mode).toBe('quiz'); expect(s().quiz).toEqual(answered); expect(s().quizRevealed).toBe(true);
  });
});

describe('local progress integration', () => {
  const memory = () => { const data = new Map<string, string>(); return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } }; };
  it('reloads separate scene drafts, tour position, answers and stable question/option order', () => {
    const storage = memory(); const store = createEyeStore(storage); const s = () => store.getState();
    s().setMode('optics'); s().setOptics('myopia'); s().setClip({ offset: 0.4 });
    s().startLesson('anatomy'); s().select('sclera', true); s().goToStep(2);
    s().startPractice('anatomy'); s().revealQuiz(); const quiz = s().quiz!; s().setLanguage('en');
    s().flushProgress();
    const restored = createEyeStore(storage); const r = () => restored.getState();
    expect(r()).toMatchObject({ mode: 'quiz', lang: 'en', quizRevealed: true, selectedId: null });
    expect(r().quiz).toEqual(quiz); expect(r().tourTasks['anatomy:0'].status).toBe('done');
    r().setMode('optics'); expect(r()).toMatchObject({ opticsPreset: 'myopia', clip: { offset: 0.4 } });
    r().setMode('tour'); expect(r()).toMatchObject({ lessonId: 'anatomy', step: 2 });
  });
  it('reloads paused physiology and actual camera, without temporary relationship layers', () => {
    const storage = memory(); const store = createEyeStore(storage); const s = () => store.getState();
    s().setMode('optics'); s().setPhysiology('pupil'); s().playPhysiology();
    const camera = { position: [3, 2, 4] as [number, number, number], target: [0, 0, 0] as [number, number, number], zoom: 1.3 };
    s().flushProgress(camera); const restored = createEyeStore(storage);
    expect(restored.getState()).toMatchObject({ mode: 'optics', camera, physiology: { kind: 'pupil', playing: false } });
    s().setMode('explore'); s().select('lens'); const layers = s().layers; s().enterRelationship('accommodation', camera); s().flushProgress();
    expect(createEyeStore(storage).getState()).toMatchObject({ mode: 'explore', layers, selectedId: 'lens', relationshipId: null, relatedIds: [] });
  });
  it('keeps usable modules after bad data and shows a dismissible notice once', () => {
    const storage = memory(); const store = createEyeStore(storage); store.getState().startPractice('vision'); store.getState().flushProgress();
    const raw = JSON.parse(storage.data.get(PROGRESS_KEY)!); raw.drafts.quiz.clip.offset = 999; storage.data.set(PROGRESS_KEY, JSON.stringify(raw));
    const restored = createEyeStore(storage); expect(restored.getState().storageNotice).toBe('recovered');
    expect(restored.getState().quiz!.order).toHaveLength(3); restored.getState().dismissStorageNotice(); restored.getState().setLanguage('en');
    expect(restored.getState().storageNotice).toBeNull();
  });
  it('restores the last valid quiz when its scene draft is discarded while another mode is active', () => {
    const storage = memory(); const store = createEyeStore(storage); const s = () => store.getState();
    s().startPractice('anatomy'); s().revealQuiz(); const quiz = s().quiz;
    s().setMode('explore'); s().flushProgress();
    const raw = JSON.parse(storage.data.get(PROGRESS_KEY)!); raw.drafts.quiz.clip.offset = 999; storage.data.set(PROGRESS_KEY, JSON.stringify(raw));
    const restored = createEyeStore(storage); restored.getState().setMode('quiz');
    expect(restored.getState().quiz).toEqual(quiz);
    expect(restored.getState()).toMatchObject({ quizRevealed: true, selectedId: null });
  });
  it('continues in memory when saving fails and clears records without clearing language', () => {
    let writes = 0;
    const store = createEyeStore({ getItem: () => null, setItem: () => { writes++; throw Error('quota'); } });
    store.getState().startPractice('vision'); expect(store.getState().storageNotice).toBe('unavailable');
    store.getState().dismissStorageNotice(); store.getState().revealQuiz(); store.getState().flushProgress();
    expect(store.getState().storageNotice).toBeNull(); expect(writes).toBe(1);
    const storage = memory(); const saved = createEyeStore(storage); saved.getState().setLanguage('en'); saved.getState().startPractice('vision'); saved.getState().clearLocalProgress();
    const clean = createEyeStore(storage).getState(); expect(clean).toMatchObject({ mode: 'explore', lang: 'en', sessions: {}, tourTasks: {}, quiz: null });
  });
});
