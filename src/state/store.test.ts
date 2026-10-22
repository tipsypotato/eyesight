import { describe, expect, it } from 'vitest';
import { createEyeStore } from './store';
import { SCENE_PRESETS, STRUCTURE_IDS, type CameraSnapshot, type LayerMode, type OpticsExperiment, type OpticsInput, type OpticsPreset } from '../anatomy/types';

describe('learning state', () => {
  it('keeps a canvas fundus selection in the current section without changing other layers', () => {
    const store = createEyeStore();
    store.getState().setClip({ enabled: true, axis: 'axial', offset: 0.2 });
    const layers = { ...store.getState().layers };
    store.getState().select('fovea', true);
    expect(store.getState().clip).toEqual({ enabled: true, axis: 'axial', offset: 0.2, keepSide: 'negative' });
    expect(store.getState().layers).toEqual(layers);
  });
  it('restores the entry layers after selecting another hidden structure while isolated', () => {
    const store = createEyeStore();
    store.getState().cycleLayer('lens');
    store.getState().cycleLayer('lens');
    store.getState().select('iris', true);
    const layers = { ...store.getState().layers };
    store.getState().toggleIsolate();
    store.getState().select('lens', true);
    expect(store.getState()).toMatchObject({ isolateId: 'lens', layers: { lens: 'on' } });
    store.getState().toggleIsolate();
    expect(store.getState().layers).toEqual(layers);
  });
  it('can undo automatic reveal independently of language and return only a focus camera', () => {
    const store = createEyeStore();
    const camera: CameraSnapshot = { position: [3, 2, 4], target: [0.1, 0, -0.2], zoom: 1.3 };
    store.getState().setClip({ enabled: false });
    const before = store.getState();
    store.getState().revealStructure('fovea', camera);
    expect(store.getState()).toMatchObject({ selectedId: 'fovea', revealPreset: 'fundusView', layers: { iris: 'off', lens: 'off', macula: 'on', 'optic-disc': 'on' }, clip: { enabled: false } });
    store.getState().setLanguage('en');
    store.getState().returnFocus();
    expect(store.getState()).toMatchObject({ camera, selectedId: 'fovea', lang: 'en' });
    expect(store.getState().layers.iris).toBe('off');
    store.getState().undoReveal();
    expect(store.getState()).toMatchObject({ layers: before.layers, clip: before.clip, selectedId: before.selectedId, camera, lang: 'en', revealPreset: null });
    store.getState().setMode('quiz');
    const quiz = store.getState();
    store.getState().revealStructure('fovea', camera);
    expect(store.getState()).toBe(quiz);
  });
  it('restores separate mode scenes and cameras without restoring an old language', () => {
    const store = createEyeStore();
    const camera: CameraSnapshot = { position: [3, 2, 4], target: [0.1, 0, -0.2], zoom: 1.3 };
    store.getState().select('iris');
    store.getState().setExplode(0.4);
    store.getState().setClip({ offset: 0.2 });
    store.getState().setMode('optics', camera);
    store.getState().setOptics('myopia');
    store.getState().setLanguage('en');
    store.getState().setMode('explore', { ...camera, position: [5, 0, 0] });
    expect(store.getState()).toMatchObject({ mode: 'explore', lang: 'en', selectedId: 'iris', explode: 0.4, clip: { offset: 0.2 }, camera, opticsPreset: 'normal' });
    store.getState().setMode('optics');
    expect(store.getState()).toMatchObject({ opticsPreset: 'myopia', camera: { position: [5, 0, 0] } });
  });
  it('resumes a fourth tour step and an answered second quiz question across mode changes', () => {
    const store = createEyeStore();
    store.getState().startLesson('anatomy');
    store.getState().goToStep(3);
    store.getState().setMode('quiz');
    store.getState().revealQuiz();
    store.getState().advanceQuiz();
    store.getState().answerQuiz(store.getState().quiz!.order[1]);
    const quiz = store.getState().quiz;
    store.getState().setMode('tour');
    expect(store.getState()).toMatchObject({ lessonId: 'anatomy', step: 3, selectedId: 'macula' });
    store.getState().setMode('explore');
    store.getState().setLanguage('en');
    store.getState().setMode('quiz');
    expect(store.getState().quiz).toEqual(quiz);
    expect(store.getState()).toMatchObject({ quizRevealed: true, lang: 'en' });
    const before = store.getState();
    store.getState().setMode('quiz');
    expect(store.getState()).toBe(before);
  });
  it('resets only the active scene while retaining learning and other mode drafts', () => {
    const store = createEyeStore();
    store.getState().setMode('optics');
    store.getState().setOptics('corrected');
    store.getState().setMode('quiz');
    store.getState().answerQuiz(store.getState().quiz!.order[0]);
    const quiz = store.getState().quiz;
    store.getState().setExplode(0.7);
    store.getState().resetScene();
    expect(store.getState().quiz).toBe(quiz);
    expect(store.getState()).toMatchObject({ mode: 'quiz', quizRevealed: true, explode: 0 });
    store.getState().setMode('optics');
    expect(store.getState().opticsPreset).toBe('corrected');
    store.getState().resetScene();
    expect(store.getState().opticsPreset).toBe('normal');
    store.getState().startLesson('myopia');
    store.getState().goToStep(1);
    store.getState().cycleLayer('retina');
    store.getState().setExplode(0.6);
    store.getState().resetScene();
    expect(store.getState()).toMatchObject({ mode: 'tour', lessonId: 'myopia', step: 1, opticsPreset: 'myopia', showOptics: true, explode: 0 });
    store.getState().setMode('quiz');
    expect(store.getState().quiz).toBe(quiz);
  });
  it('separates camera reset from scene reset and explicit lesson restart', () => {
    const store = createEyeStore();
    store.getState().startLesson('anatomy');
    store.getState().goToStep(3);
    store.getState().setView('side');
    store.getState().setExplode(0.5);
    store.getState().setClip({ enabled: true, offset: -0.3 });
    const layers = store.getState().layers;
    store.getState().resetCamera();
    expect(store.getState()).toMatchObject({ lessonId: 'anatomy', step: 3, view: 'back', explode: 0.5, clip: { enabled: true, offset: -0.3 }, camera: null });
    expect(store.getState().layers).toBe(layers);
    store.getState().startLesson('anatomy');
    expect(store.getState().step).toBe(3);
    store.getState().restartLesson();
    expect(store.getState()).toMatchObject({ lessonId: 'anatomy', step: 0, selectedId: 'sclera', explode: 0 });
  });
  it('changes language without resetting a lesson or scene', () => {
    const store = createEyeStore();
    store.getState().setMode('optics');
    store.getState().setOptics('myopia');
    store.getState().setLanguage('en');
    expect(store.getState()).toMatchObject({ lang: 'en', mode: 'optics', opticsPreset: 'myopia' });
  });
  it('uses safe defaults for unavailable or corrupt storage', () => {
    expect(createEyeStore({ getItem: () => 'xx', setItem: () => {} }).getState().lang).toBe('zh');
    const store = createEyeStore({ getItem: () => { throw Error('blocked'); }, setItem: () => { throw Error('blocked'); } });
    expect(() => store.getState().setLanguage('en')).not.toThrow();
    expect(store.getState().lang).toBe('en');
  });
  it('reset keeps language and restores visible layers', () => {
    const store = createEyeStore();
    store.getState().setLanguage('en');
    store.getState().cycleLayer('retina');
    store.getState().reset();
    expect(store.getState()).toMatchObject({ lang: 'en', mode: 'explore', isolateId: null, explode: 0 });
    expect(store.getState().layers.retina).toBe('on');
  });
  it('reveals a selected hidden structure and gives fundus an unclipped view', () => {
    const store = createEyeStore();
    store.getState().cycleLayer('optic-disc');
    store.getState().cycleLayer('optic-disc');
    store.getState().select('optic-disc');
    expect(store.getState().layers['optic-disc']).toBe('on');
    expect(store.getState().clip.enabled).toBe(false);
  });
  it('restores a readable central section for tree selection but preserves sections on canvas clicks', () => {
    const store = createEyeStore();
    store.getState().setClip({ enabled: true, axis: 'coronal', offset: -0.9 });
    store.getState().select('cornea');
    expect(store.getState().clip).toEqual({ enabled: true, axis: 'sagittal', offset: 0, keepSide: 'negative' });
    store.getState().setClip({ axis: 'axial', offset: 0.2 });
    store.getState().select('lens', true);
    expect(store.getState().clip).toEqual({ enabled: true, axis: 'axial', offset: 0.2, keepSide: 'negative' });
  });
  it('preserves tour progress on language changes and removes optical rays when leaving', () => {
    const store = createEyeStore();
    store.getState().startLesson('myopia');
    store.getState().goToStep(1);
    store.getState().setLanguage('en');
    expect(store.getState()).toMatchObject({ lessonId: 'myopia', step: 1, showOptics: true, opticsPreset: 'myopia' });
    store.getState().setMode('explore');
    expect(store.getState()).toMatchObject({ showOptics: false, lessonId: null, lang: 'en' });
  });
  it('keeps quiz results when switching language and resets reveal for next item', () => {
    const store = createEyeStore();
    store.getState().startQuiz();
    const target = store.getState().quiz!.order[0];
    store.getState().answerQuiz(target);
    store.getState().setLanguage('en');
    expect(store.getState().quiz!.answers[target].correct).toBe(true);
    store.getState().advanceQuiz();
    expect(store.getState().quizRevealed).toBe(false);
    expect(store.getState().quiz!.index).toBe(1);
  });
});

describe('optics experiments', () => {
  const normal: OpticsInput = { axialIncrement: 0, objectDistance: 'far', accommodation: 0, pupil: 'medium', externalLens: 'off' };
  const combined: OpticsInput = { axialIncrement: 0.6, objectDistance: 'mid', accommodation: 0.4, pupil: 'large', externalLens: 'myopia' };

  it.each([
    ['normal', normal],
    ['myopia', { ...normal, axialIncrement: 1 }],
    ['corrected', { ...normal, axialIncrement: 1, externalLens: 'myopia' }],
  ] as const)('loads the complete %s benchmark after free edits', (preset, input) => {
    const store = createEyeStore();
    store.getState().setOpticsExperiment('free');
    store.getState().setOpticsInput(combined);
    store.getState().setOptics(preset);
    expect(store.getState()).toMatchObject({ opticsPreset: preset, opticsExperiment: 'baseline', opticsInput: input });
    const before = store.getState();
    store.getState().setOpticsInput({ axialIncrement: 0.2 });
    expect(store.getState()).toBe(before);
  });

  it.each([
    ['axialIncrement', 'normal', normal],
    ['objectDistance', 'normal', normal],
    ['accommodation', 'normal', { ...normal, objectDistance: 'near' }],
    ['pupil', 'normal', normal],
    ['externalLens', 'myopia', { ...normal, axialIncrement: 1 }],
  ] as const)('starts %s from its fixed teaching baseline without previous deformation', (experiment, preset, input) => {
    const store = createEyeStore();
    store.getState().setOptics('corrected');
    store.getState().setOpticsExperiment('free');
    store.getState().setOpticsInput(combined);
    store.getState().setOpticsExperiment(experiment);
    expect(store.getState()).toMatchObject({ opticsPreset: preset, opticsExperiment: experiment, opticsInput: input });
  });

  it.each([
    ['axialIncrement', { axialIncrement: 0.8 }, { pupil: 'small' }],
    ['objectDistance', { objectDistance: 'near' }, { accommodation: 1 }],
    ['accommodation', { accommodation: 1 }, { axialIncrement: 1 }],
    ['pupil', { pupil: 'small' }, { externalLens: 'myopia' }],
    ['externalLens', { externalLens: 'myopia' }, { objectDistance: 'near' }],
  ] as const)('allows only %s changes in a single-variable experiment', (experiment, allowed, locked) => {
    const store = createEyeStore();
    store.getState().setOpticsExperiment(experiment);
    const baseline = store.getState().opticsInput;
    store.getState().setOpticsInput({ ...allowed, ...locked });
    expect(store.getState().opticsInput).toBe(baseline);
    store.getState().setOpticsInput(allowed);
    expect(store.getState().opticsInput).toEqual({ ...baseline, ...allowed });
    const changed = store.getState();
    store.getState().setOpticsInput(locked);
    expect(store.getState()).toBe(changed);
  });

  it('keeps the current input when unlocking free combination and restores the selected benchmark', () => {
    const store = createEyeStore();
    store.getState().setOpticsExperiment('externalLens');
    store.getState().setOpticsInput({ externalLens: 'myopia' });
    const input = store.getState().opticsInput;
    store.getState().setOpticsExperiment('free');
    expect(store.getState().opticsInput).toEqual(input);
    store.getState().setOpticsInput(combined);
    expect(store.getState().opticsInput).toEqual(combined);
    store.getState().setOpticsExperiment('baseline');
    expect(store.getState()).toMatchObject({ opticsPreset: 'myopia', opticsExperiment: 'baseline', opticsInput: { ...normal, axialIncrement: 1 } });
  });

  it('rejects invalid numeric, enum and unknown input without writes, history or UI exceptions', () => {
    const store = createEyeStore();
    store.getState().setOpticsExperiment('free');
    const before = store.getState();
    const invalid: unknown[] = [
      { axialIncrement: NaN }, { axialIncrement: Infinity }, { axialIncrement: -0.1 }, { axialIncrement: 1.01 },
      { accommodation: NaN }, { accommodation: -Infinity }, { accommodation: -0.1 }, { accommodation: 1.01 },
      { axialIncrement: '0.5' }, { objectDistance: 'infinity' }, { pupil: 'huge' }, { externalLens: 'on' },
      { accommodation: undefined }, { extraParameter: 1 }, null,
    ];
    for (const patch of invalid) {
      expect(() => store.getState().setOpticsInput(patch as Partial<OpticsInput>)).not.toThrow();
      expect(store.getState()).toBe(before);
    }
    store.getState().setOptics('invalid' as OpticsPreset);
    store.getState().setOpticsExperiment('invalid' as OpticsExperiment);
    expect(store.getState()).toBe(before);
    store.getState().setOpticsInput({ axialIncrement: 1, accommodation: 1 });
    store.getState().setOpticsInput({ axialIncrement: 0, accommodation: 0 });
    expect(store.getState().opticsInput).toEqual(normal);
  });

  it('preserves independent experiment drafts and the latest language across modes', () => {
    const store = createEyeStore();
    store.getState().setOpticsExperiment('pupil');
    store.getState().setOpticsInput({ pupil: 'small' });
    store.getState().setMode('optics');
    expect(store.getState()).toMatchObject({ opticsInput: normal, opticsExperiment: 'baseline' });
    store.getState().setOpticsExperiment('free');
    store.getState().setOpticsInput(combined);
    store.getState().setLanguage('en');
    store.getState().setMode('explore');
    expect(store.getState()).toMatchObject({ lang: 'en', opticsExperiment: 'pupil', opticsInput: { ...normal, pupil: 'small' } });
    store.getState().setMode('optics');
    expect(store.getState()).toMatchObject({ lang: 'en', opticsExperiment: 'free', opticsInput: combined });
  });

  it('undoes one continuous parameter gesture and preserves the experiment and latest language', () => {
    const store = createEyeStore();
    store.getState().setMode('optics');
    store.getState().setOpticsExperiment('axialIncrement');
    const camera: CameraSnapshot = { position: [5, 0, 0], target: [0, 0, 0], zoom: 1.1 };
    store.getState().beginSceneChange(camera);
    for (const axialIncrement of [0.2, 0.6, 1]) store.getState().setOpticsInput({ axialIncrement });
    store.getState().endSceneChange();
    expect(store.getState().undoCount).toBe(2);
    store.getState().setLanguage('en');
    store.getState().undoScene();
    expect(store.getState()).toMatchObject({ opticsInput: normal, opticsExperiment: 'axialIncrement', camera, lang: 'en', undoCount: 1 });
    store.getState().undoScene();
    expect(store.getState()).toMatchObject({ opticsInput: normal, opticsExperiment: 'baseline', lang: 'en', undoCount: 0 });
  });

  it('does not record unchanged inputs or a parameter gesture returning to its start', () => {
    const store = createEyeStore();
    store.getState().setOpticsExperiment('accommodation');
    const undoCount = store.getState().undoCount;
    store.getState().setOpticsInput({ accommodation: 0 });
    store.getState().beginSceneChange();
    store.getState().setOpticsInput({ accommodation: 1 });
    store.getState().setOpticsInput({ accommodation: 0 });
    store.getState().endSceneChange();
    expect(store.getState().undoCount).toBe(undoCount);
  });

  it('finishes a parameter gesture on workspace change and restores its own undo history', () => {
    const store = createEyeStore();
    store.getState().setMode('optics');
    store.getState().setOpticsExperiment('axialIncrement');
    store.getState().beginSceneChange();
    store.getState().setOpticsInput({ axialIncrement: 0.8 });
    store.getState().setMode('explore');
    store.getState().endSceneChange();
    expect(store.getState()).toMatchObject({ opticsInput: normal, undoCount: 0 });
    store.getState().setMode('optics');
    expect(store.getState()).toMatchObject({ opticsInput: { ...normal, axialIncrement: 0.8 }, undoCount: 2 });
    store.getState().undoScene();
    expect(store.getState().opticsInput).toEqual(normal);
  });

  it('resets the active optics scene, permits undo and retains other workspaces', () => {
    const store = createEyeStore();
    store.getState().setOpticsExperiment('pupil');
    store.getState().setOpticsInput({ pupil: 'large' });
    store.getState().setMode('optics');
    store.getState().setOptics('corrected');
    store.getState().setOpticsExperiment('free');
    store.getState().setOpticsInput(combined);
    store.getState().setLanguage('en');
    store.getState().resetCamera();
    expect(store.getState()).toMatchObject({ opticsExperiment: 'free', opticsInput: combined });
    store.getState().reset();
    expect(store.getState()).toMatchObject({ lang: 'en', opticsPreset: 'normal', opticsExperiment: 'baseline', opticsInput: normal });
    store.getState().undoScene();
    expect(store.getState()).toMatchObject({ lang: 'en', opticsPreset: 'corrected', opticsExperiment: 'free', opticsInput: combined });
    store.getState().setMode('explore');
    expect(store.getState()).toMatchObject({ lang: 'en', opticsExperiment: 'pupil', opticsInput: { ...normal, pupil: 'large' } });
  });

  it('loads complete tour benchmarks and keeps optical drafts outside the lesson', () => {
    const store = createEyeStore();
    store.getState().setMode('optics');
    store.getState().setOpticsExperiment('free');
    store.getState().setOpticsInput(combined);
    store.getState().startLesson('myopia');
    store.getState().goToStep(1);
    expect(store.getState()).toMatchObject({ opticsPreset: 'myopia', opticsExperiment: 'baseline', opticsInput: { ...normal, axialIncrement: 1 } });
    store.getState().setOpticsExperiment('pupil');
    store.getState().setOpticsInput({ pupil: 'small' });
    store.getState().resetScene();
    expect(store.getState()).toMatchObject({ step: 1, opticsExperiment: 'baseline', opticsInput: { ...normal, axialIncrement: 1 } });
    store.getState().goToStep(2);
    expect(store.getState()).toMatchObject({ opticsPreset: 'corrected', opticsExperiment: 'baseline', opticsInput: { ...normal, axialIncrement: 1, externalLens: 'myopia' }, undoCount: 0 });
    store.getState().restartLesson();
    expect(store.getState()).toMatchObject({ step: 0, opticsPreset: 'normal', opticsExperiment: 'baseline', opticsInput: normal });
    store.getState().setMode('optics');
    expect(store.getState()).toMatchObject({ opticsExperiment: 'free', opticsInput: combined });
  });
});


describe('observation presets and scene undo', () => {
  const camera: CameraSnapshot = { position: [3, 2, 4], target: [0.1, 0, -0.2], zoom: 1.3 };
  it.each(SCENE_PRESETS)('rebuilds %s from a complete baseline regardless of hidden layers', preset => {
    const clean = createEyeStore(), dirty = createEyeStore();
    dirty.setState({ layers: Object.fromEntries(STRUCTURE_IDS.map(id => [id, 'off'])) as Record<typeof STRUCTURE_IDS[number], LayerMode> });
    dirty.getState().select('lens', true); dirty.getState().toggleIsolate();
    dirty.getState().setExplode(1); dirty.getState().setLabels(true);
    dirty.getState().setClip({ axis: 'axial', offset: 0.75, keepSide: 'positive' });
    clean.getState().applyPreset(preset); dirty.getState().applyPreset(preset);
    const a = clean.getState(), b = dirty.getState();
    expect(b.layers).toEqual(a.layers); expect(b.clip).toEqual(a.clip);
    expect(b).toMatchObject({ presetId: preset, isolateId: null, isolationLayers: null, explode: 0, labels: false, view: a.view, showOptics: a.showOptics });
    expect(b.selectedId).toBe(preset === 'fundus' ? null : 'lens');
  });
  it('uses the specified wall, fundus, chamber and optical displays without resetting optical parameters', () => {
    const store = createEyeStore();
    store.getState().setOptics('myopia'); store.getState().applyPreset('optical-path');
    expect(store.getState()).toMatchObject({ opticsPreset: 'myopia', showOptics: true, view: 'side', clip: { enabled: true, axis: 'sagittal', offset: 0, keepSide: 'negative' } });
    expect(Object.values(store.getState().layers).every(value => value === 'ghost')).toBe(true);
    store.getState().applyPreset('fundus');
    expect(store.getState()).toMatchObject({ showOptics: false, view: 'front', clip: { enabled: false }, layers: { retina: 'ghost', lens: 'off', cornea: 'off', macula: 'on', 'optic-disc': 'on' } });
    store.getState().applyPreset('chambers');
    expect(store.getState()).toMatchObject({ layers: { sclera: 'ghost', choroid: 'ghost', retina: 'ghost', 'anterior-chamber': 'ghost', 'posterior-chamber': 'ghost', vitreous: 'ghost' } });
    store.getState().applyPreset('wall-cut');
    expect(store.getState().layers.retina).toBe('on');
  });
  it('undoes an entire continuous gesture once and restores the actual starting camera', () => {
    const store = createEyeStore();
    store.getState().beginSceneChange(camera);
    for (const offset of [0.1, 0.3, 0.6, 1]) store.getState().setClip({ offset });
    store.getState().endSceneChange();
    expect(store.getState().undoCount).toBe(1);
    store.getState().setLanguage('en'); store.getState().undoScene();
    expect(store.getState()).toMatchObject({ clip: { offset: 0 }, camera, lang: 'en', undoCount: 0 });
  });
  it('does not record unchanged values, a gesture returning to its start, selection, view or language changes', () => {
    const store = createEyeStore();
    store.getState().setClip({ offset: 0 }); store.getState().setExplode(0);
    store.getState().beginSceneChange(camera); store.getState().setExplode(0.7); store.getState().setExplode(0); store.getState().endSceneChange();
    store.getState().select('lens', true); store.getState().setView('back'); store.getState().setLanguage('en');
    expect(store.getState().undoCount).toBe(0);
  });
  it('keeps only the latest twenty scene changes in each workspace', () => {
    const store = createEyeStore();
    for (let i = 1; i <= 25; i++) store.getState().setExplode(i / 25);
    expect(store.getState().undoCount).toBe(20);
    store.getState().setMode('optics'); expect(store.getState().undoCount).toBe(0);
    store.getState().setOptics('corrected'); store.getState().setMode('explore');
    for (let i = 0; i < 20; i++) store.getState().undoScene();
    expect(store.getState().explode).toBeCloseTo(0.2);
    store.getState().setMode('optics'); store.getState().undoScene();
    expect(store.getState().opticsPreset).toBe('normal');
  });
  it('restores presets, layers and isolation snapshots without changing tour steps or quiz answers', () => {
    const store = createEyeStore();
    store.getState().startLesson('anatomy'); store.getState().goToStep(1);
    store.getState().applyPreset('fundus'); store.getState().select('fovea', true); store.getState().toggleIsolate();
    store.getState().cycleLayer('retina');
    store.getState().undoScene(); store.getState().undoScene(); store.getState().undoScene();
    expect(store.getState()).toMatchObject({ lessonId: 'anatomy', step: 1, isolateId: null, isolationLayers: null });
    store.getState().setMode('quiz'); store.getState().revealQuiz();
    const quiz = store.getState().quiz;
    store.getState().setExplode(0.5); store.getState().undoScene();
    expect(store.getState().quiz).toBe(quiz); expect(store.getState().quizRevealed).toBe(true);
  });
  it('clears the active undo stack at lesson and quiz step boundaries', () => {
    const store = createEyeStore();
    store.getState().startLesson('anatomy'); store.getState().setExplode(0.5);
    store.getState().goToStep(1); expect(store.getState().undoCount).toBe(0);
    store.getState().startQuiz(); store.getState().setExplode(0.5); store.getState().revealQuiz();
    store.getState().advanceQuiz(); expect(store.getState().undoCount).toBe(0);
    store.getState().undoScene(); expect(store.getState().quiz!.index).toBe(1);
  });
  it('finishes a live gesture before switching workspaces without leaking changes', () => {
    const store = createEyeStore();
    store.getState().beginSceneChange(camera); store.getState().setExplode(0.4);
    store.getState().setMode('optics'); store.getState().endSceneChange(); store.getState().setOptics('myopia');
    store.getState().setMode('explore'); expect(store.getState().undoCount).toBe(1);
    store.getState().undoScene(); expect(store.getState().explode).toBe(0);
  });
  it('retains the observation context during free edits and resets to its own default view', () => {
    const store = createEyeStore();
    store.getState().applyPreset('chambers'); store.getState().setClip({ offset: 0.3 }); store.getState().setExplode(0.4);
    expect(store.getState().presetId).toBe('chambers');
    store.getState().applyPreset('fundus'); store.getState().setView('back');
    const undoCount = store.getState().undoCount;
    store.getState().resetCamera();
    expect(store.getState()).toMatchObject({ view: 'front', presetId: 'fundus', undoCount });
  });
  it('preserves focus and reveal return actions when undoing a later scene edit', () => {
    const store = createEyeStore();
    store.getState().rememberFocus(camera); store.getState().setLabels(true); store.getState().undoScene();
    expect(store.getState().focusReturn).toEqual(camera);
    store.getState().revealStructure('fovea', camera);
    const before = store.getState().revealReturn;
    store.getState().setLabels(true); store.getState().undoScene();
    expect(store.getState()).toMatchObject({ revealReturn: before, revealPreset: 'fundusView', focusReturn: camera });
    store.getState().undoReveal(); expect(store.getState().selectedId).toBeNull();
  });
  it('rejects nonfinite scene input and clamps section and separation ranges', () => {
    const store = createEyeStore();
    store.getState().setClip({ offset: NaN }); store.getState().setExplode(Infinity);
    expect(store.getState()).toMatchObject({ clip: { offset: 0 }, explode: 0, undoCount: 0 });
    store.getState().setClip({ offset: -2 }); store.getState().setExplode(3);
    expect(store.getState()).toMatchObject({ clip: { offset: -1 }, explode: 1 });
  });
});
