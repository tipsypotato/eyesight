import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mode } from '../anatomy/types';
import { messages } from '../content/messages';
import * as optics from '../engine/optics';
import { createEyeStore, eyeStore } from '../state/store';
import App from './App';

let store: ReturnType<typeof createEyeStore>;
beforeEach(() => {
  store = createEyeStore();
  vi.spyOn(eyeStore, 'getInitialState').mockImplementation(() => store.getState());
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function renderApp(narrow = true) {
  vi.stubGlobal('window', { matchMedia: (query: string) => ({ matches: query === '(width < 900px)' && narrow }) });
  return renderToStaticMarkup(<App/>);
}

function expectDockedAction(html: string, label: string) {
  const bodyStart = html.indexOf('<div class="panel-body">');
  const actionsStart = html.indexOf('<div class="panel-actions">');
  expect(bodyStart).toBeGreaterThan(-1);
  expect(actionsStart).toBeGreaterThan(bodyStart);
  let depth = 0, bodyEnd = -1;
  for (const tag of html.slice(bodyStart).matchAll(/<\/?div\b[^>]*>/g)) {
    depth += tag[0].startsWith('</') ? -1 : 1;
    if (depth === 0) { bodyEnd = bodyStart + tag.index + tag[0].length; break; }
  }
  expect(bodyEnd).toBeGreaterThan(bodyStart);
  expect(actionsStart).toBeGreaterThanOrEqual(bodyEnd);
  expect(html.slice(actionsStart, html.indexOf('</aside>', actionsStart))).toContain(label);
  const actions = [...html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].filter(match => match[1].includes(label));
  expect(actions).toHaveLength(1);
}

describe('responsive workspace markup', () => {
  it.each<{ mode: Mode; tabs: string[]; active: string }>([
    { mode: 'explore', tabs: ['structures', 'parameters', 'explanation'], active: 'structures' },
    { mode: 'optics', tabs: ['parameters', 'explanation'], active: 'parameters' },
    { mode: 'tour', tabs: ['structures', 'parameters', 'explanation'], active: 'explanation' },
    { mode: 'quiz', tabs: ['parameters', 'explanation'], active: 'explanation' },
  ])('links applicable tabs and panels in $mode without duplicating the model', ({ mode, tabs, active }) => {
    store.getState().setMode(mode);
    const html = renderApp();
    const tabTags = [...html.matchAll(/<button\b[^>]*role="tab"[^>]*>/g)].map(match => match[0]);
    const panels = [...html.matchAll(/<div\b[^>]*role="tabpanel"[^>]*>/g)].map(match => match[0]);
    expect(tabTags).toHaveLength(tabs.length);
    expect(panels).toHaveLength(tabs.length);
    for (const id of tabs) {
      const tab = tabTags.find(tag => tag.includes(`id="tab-${id}"`));
      const panel = panels.find(tag => tag.includes(`id="panel-${id}"`));
      expect(tab).toContain(`aria-controls="panel-${id}"`);
      expect(tab).toContain(`aria-selected="${id === active}"`);
      expect(tab).toContain(`tabindex="${id === active ? 0 : -1}"`);
      expect(panel).toContain(`aria-labelledby="tab-${id}"`);
      expect(panel?.includes('hidden=""')).toBe(id !== active);
    }
    expect(html.match(/class="viewport"/g)).toHaveLength(1);
  });

  it('does not expose structure controls or a correct answer before answering a narrow-screen quiz', () => {
    store.getState().setMode('quiz');
    const html = renderApp();
    expect(html).not.toContain('id="tab-structures"');
    expect(html).not.toContain('class="structure-list"');
    expect(html).not.toContain('class="scene-presets"');
    expect(html).not.toContain('class="section-controls"');
    expect(html).not.toContain('correct-answer');
    expect(html).not.toContain('class="answer-feedback"');
    expectDockedAction(html, messages.reveal.zh);
  });

  it('keeps reveal, next-question and result actions outside the feedback scroll region', () => {
    store.getState().setMode('quiz');
    store.getState().revealQuiz();
    expectDockedAction(renderApp(), messages.nextQuestion.zh);
    while (store.getState().quiz!.index < store.getState().quiz!.order.length - 1) {
      store.getState().advanceQuiz();
      store.getState().revealQuiz();
    }
    expectDockedAction(renderApp(), messages.result.zh);
    store.getState().advanceQuiz();
    const completed = renderApp();
    expectDockedAction(completed, messages.retry.zh);
    expectDockedAction(completed, messages.backExplore.zh);
  });

  it('docks tour start, previous and next actions exactly once', () => {
    store.getState().setMode('tour');
    expectDockedAction(renderApp(), messages.startTour.zh);
    store.getState().startLesson('anatomy');
    store.getState().goToStep(1);
    const html = renderApp();
    expectDockedAction(html, messages.previous.zh);
    expectDockedAction(html, messages.next.zh);
  });

  it.each(['zh', 'en'] as const)('announces the actual section side and separation amount in %s', lang => {
    store.getState().setLanguage(lang);
    store.getState().setClip({ enabled: true, axis: 'coronal', offset: -0.25, keepSide: 'positive' });
    store.getState().setExplode(0.37);
    const ranges = [...renderApp().matchAll(/<input\b[^>]*type="range"[^>]*>/g)].map(match => match[0]);
    expect(ranges).toHaveLength(2);
    const section = ranges.find(tag => tag.includes(`aria-label="${messages.sectionPosition[lang]}"`));
    expect(section).toContain(`aria-valuetext="${messages.coronal[lang]} -0.25 · ${messages.retainedSide[lang]} z ≥ -0.25"`);
    expect(section).toContain('value="-0.25"');
    const separation = ranges.find(tag => tag.includes(`aria-label="${messages.explode[lang]}"`));
    expect(separation).toContain('aria-valuetext="37%"');
    expect(separation).toContain('value="0.37"');
  });

  it('orders desktop scene tools before side panels and mounts a single viewport', () => {
    const html = renderApp(false);
    const scene = html.indexOf('<section class="scene-column"');
    const controls = html.indexOf('class="scene-controls"');
    const left = html.indexOf('<aside class="left-panel"');
    const right = html.indexOf('<aside class="right-panel"');
    expect(scene).toBeGreaterThan(html.indexOf('<nav'));
    expect(controls).toBeGreaterThan(scene);
    expect(left).toBeGreaterThan(controls);
    expect(right).toBeGreaterThan(left);
    expect(html).not.toContain('role="tablist"');
    expect(html.match(/class="viewport"/g)).toHaveLength(1);
  });
});

describe('optical parameter presentation', () => {
  it.each(['normal', 'myopia', 'corrected'] as const)('keeps the causal explanation for the %s benchmark', preset => {
    store.getState().setMode('optics');
    store.getState().setOptics(preset);
    expect(renderApp(false)).toContain(messages[`${preset}Body`].zh);
  });

  it('exposes only the active variable while explaining the locked baseline', () => {
    store.getState().setMode('optics');
    store.setState({ opticsExperiment: 'accommodation', opticsInput: { axialIncrement: 0, objectDistance: 'near', accommodation: 0, pupil: 'medium', externalLens: 'off' } });
    const html = renderApp(false);
    const controls = [...html.matchAll(/<(?:input|select)\b[^>]*data-optics-input="([^"]+)"[^>]*>/g)];
    expect(controls).toHaveLength(5);
    for (const [tag, key] of controls) expect(tag.includes('disabled=""')).toBe(key !== 'accommodation');
    expect(html).toContain('正常眼轴、较近物体');
    expect(html).toContain('当前模型内无有限实焦点');
    expect(html).not.toContain('平行光经过角膜和晶状体折射，在视网膜处会聚。');
  });

  it('keeps all free-combination inputs editable and localizes their actual values', () => {
    store.getState().setMode('optics');
    store.getState().setLanguage('en');
    store.setState({ opticsExperiment: 'free', opticsInput: { axialIncrement: 0.6, objectDistance: 'mid', accommodation: 0.45, pupil: 'small', externalLens: 'off' } });
    const html = renderApp();
    const controls = [...html.matchAll(/<(?:input|select)\b[^>]*data-optics-input="[^"]+"[^>]*>/g)];
    expect(controls).toHaveLength(5);
    expect(controls.every(([tag]) => !tag.includes('disabled=""'))).toBe(true);
    expect(html).toContain('aria-valuetext="0.60 / 1');
    expect(html).toContain('aria-valuetext="0.45 / 1');
    expect(html).toContain('Geometric extension');
    expect(html).not.toMatch(/(?:NaN|Infinity)/);
    expect(html.match(/class="viewport"/g)).toHaveLength(1);
  });

  it('updates the retinal conclusion and distinguishes custom parameters from benchmark presets', () => {
    store.getState().setMode('optics');
    store.setState({ opticsExperiment: 'axialIncrement', opticsInput: { axialIncrement: 0.5, objectDistance: 'far', accommodation: 0, pupil: 'medium', externalLens: 'off' } });
    const html = renderApp(false);
    expect(html).toContain('焦点位于视网膜前方');
    const presets = html.slice(html.indexOf('class="preset-list"'), html.indexOf('class="optics-parameters"'));
    expect(presets).not.toContain('aria-pressed="true"');
    expect(html).toContain('视网膜交点');
  });

  it('renders parallel and empty ray results without finite-focus claims or invalid SVG coordinates', () => {
    store.getState().setMode('optics');
    store.setState({ opticsExperiment: 'free', opticsInput: { axialIncrement: 0, objectDistance: 'near', accommodation: 0.073595625, pupil: 'medium', externalLens: 'off' } });
    const parallel = renderApp(false);
    expect(parallel).toContain('当前模型内无有限实焦点');
    expect(parallel).not.toMatch(/(?:NaN|Infinity)/);
    const result = optics.traceOptics(store.getState().opticsInput);
    vi.spyOn(optics, 'traceOptics').mockReturnValue({ ...result, rays: [], extensions: [], retinalIntersections: [], validRayCount: 0, retinalSpread: null });
    const empty = renderApp(false);
    expect(empty).toContain('未得到通过瞳孔的光线样本');
    expect(empty).not.toContain('焦点落在视网膜上');
    expect(empty).not.toMatch(/(?:NaN|Infinity)/);
  });
});
