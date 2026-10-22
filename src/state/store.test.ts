import { describe, expect, it } from 'vitest';
import { createEyeStore } from './store';

describe('learning state', () => {
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
    expect(store.getState().clip).toEqual({ enabled: true, axis: 'sagittal', offset: 0 });
    store.getState().setClip({ axis: 'axial', offset: 0.2 });
    store.getState().select('lens', true);
    expect(store.getState().clip).toEqual({ enabled: true, axis: 'axial', offset: 0.2 });
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
