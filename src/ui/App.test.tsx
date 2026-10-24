import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mode } from '../anatomy/types';
import * as search from '../anatomy/search';
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
  it.each(['zh', 'en'] as const)('starts mobile browsing with an explicit model interaction control in %s', lang => {
    store.getState().setLanguage(lang);
    const html = renderApp(true);
    expect(html).toMatch(/<button[^>]*aria-pressed="false"[^>]*aria-describedby="model-touch-hint"/);
    expect(html).toContain(lang === 'zh' ? '操作模型' : 'Interact with model');
    expect(html).toContain(lang === 'zh' ? '上下滑动浏览页面' : 'Swipe up or down to scroll the page');
    expect(renderApp(false)).not.toContain('id="model-touch-hint"');
  });
  it('marks the model busy with a named progress bar before the engine is ready in either language', () => {
    for (const lang of ['zh', 'en'] as const) {
      store.getState().setLanguage(lang);
      const html = renderApp(false);
      expect(html).toMatch(/class="viewport"[^>]*aria-busy="true"/);
      expect(html).toMatch(/<progress[^>]*aria-label="[^"]+"[^>]*max="4"[^>]*value="1"/);
      expect(html).toContain('role="status"');
    }
  });
  it('exposes the extraocular preset and selected muscle details in both languages', () => {
    store.getState().applyPreset('extraocular'); store.getState().select('superior-oblique', true);
    for (const lang of ['zh', 'en'] as const) {
      store.getState().setLanguage(lang);
      const html = renderApp(false);
      expect(html).toContain(messages.presetExtraocular[lang]);
      expect(html).toContain(lang === 'zh' ? '上斜肌' : 'Superior oblique');
      expect(html).toContain('Musculus obliquus superior');
      expect(html).toContain(messages.isolate[lang]);
      expect(html).toContain(messages.focus[lang]);
    }
    expect(store.getState()).toMatchObject({ presetId: 'extraocular', selectedId: 'superior-oblique' });
    store.getState().setMode('optics');
    expect(renderApp(false)).not.toContain(messages.presetExtraocular.en);
  });
  it.each(['zh', 'en'] as const)('offers the eyelid preset only in exploration in %s', lang => {
    store.getState().setLanguage(lang); store.getState().applyPreset('eyelids');
    const label = messages.presetEyelids[lang].replace('&', '&amp;');
    expect(renderApp(false)).toMatch(new RegExp(`<button[^>]*aria-pressed="true"[^>]*>${label}</button>`));
    for (const mode of ['optics', 'tour', 'quiz', 'disease'] as const) {
      store.getState().setMode(mode);
      expect(renderApp(false)).not.toContain(`>${label}</button>`);
    }
  });
  it.each(['zh', 'en'] as const)('offers an orbital preset only in exploration in %s', lang => {
    store.getState().setLanguage(lang); store.getState().applyPreset('orbit');
    const label = lang === 'zh' ? '眼眶与内容物' : 'Orbit &amp; contents';
    expect(renderApp(false)).toMatch(new RegExp(`<button[^>]*aria-pressed="true"[^>]*>${label}</button>`));
    for (const mode of ['optics', 'tour', 'quiz', 'disease'] as const) {
      store.getState().setMode(mode);
      expect(renderApp(false)).not.toContain(`>${label}</button>`);
    }
  });
  it.each(['zh', 'en'] as const)('orders exploration presets from all structures to focused views in %s', lang => {
    store.getState().setLanguage(lang);
    const labels = lang === 'zh'
      ? ['全部结构', '眼眶与内容物', '结膜与眼睑', '眼外肌观察', '完整眼球', '眼球壁剖面', '前段观察', '眼内空间', '眼底观察', '光路观察']
      : ['All structures', 'Orbit &amp; contents', 'Conjunctiva &amp; eyelids', 'Extraocular muscles', 'Whole eye', 'Eye wall section', 'Anterior segment', 'Intraocular spaces', 'Fundus view', 'Optical path'];
    for (const narrow of [false, true]) {
      const picker = renderApp(narrow).match(/<details[^>]*class="preset-picker"[^>]*>([\s\S]*?)<\/details>/)?.[1];
      expect(picker).toBeDefined();
      expect([...picker!.matchAll(/<button\b[^>]*>([^<]+)<\/button>/g)].map(match => match[1])).toEqual(labels);
      expect(picker).toContain(`<strong>${labels[0]}</strong>`);
      expect(picker).toMatch(new RegExp(`<button[^>]*aria-pressed="true"[^>]*>${labels[0]}</button>`));
    }
    for (const mode of ['optics', 'tour', 'quiz', 'disease'] as const) {
      store.getState().setMode(mode);
      for (const narrow of [false, true]) expect(renderApp(narrow)).not.toContain(`>${labels[0]}</button>`);
    }
  });
  it('extends the section slider to the orbital apex and restores native coordinates when tiled', () => {
    store.getState().applyPreset('intact');
    const range = () => [...renderApp(false).matchAll(/<input\b[^>]*>/g)].find(([tag]) => tag.includes('class="section-range"'))?.[0];
    expect(range()).toContain('min="-1" max="1"');
    store.getState().applyPreset('orbit'); store.getState().setClip({ enabled: true, axis: 'coronal', offset: -2.1 });
    expect(range()).toContain('min="-3" max="3"');
    expect(range()).toContain('value="-2.1"');
    store.getState().setExplode(0.5);
    expect(range()).toContain('min="-5.25" max="5.25"');
    store.getState().setExplode(1);
    expect(range()).toContain('min="-3" max="3"');
  });
  it.each(['zh', 'en'] as const)('keeps gland details and observation actions available in %s', lang => {
    store.getState().setLanguage(lang); store.getState().applyPreset('eyelids');
    store.getState().select('meibomian-glands', true);
    for (const narrow of [false, true]) {
      const html = renderApp(narrow);
      expect(html).toContain(lang === 'zh' ? '睑板腺' : 'Meibomian glands');
      expect(html).toContain('Glandulae tarsales');
      expect(html).toContain(messages.isolate[lang]);
      expect(html).toContain(messages.focus[lang]);
      expect(html).toContain(messages.anatomyCount[lang]);
    }
    expect(store.getState()).toMatchObject({ presetId: 'eyelids', selectedId: 'meibomian-glands' });
  });
  it.each(['zh', 'en'] as const)('describes eyelid group search results without a fundus hint in %s', lang => {
    const result = search.searchStructures('eyelids');
    vi.spyOn(search, 'searchStructures').mockReturnValue(result);
    store.getState().setLanguage(lang);
    const html = renderApp(false);
    expect(html).not.toContain(messages.fundusGroup[lang]);
    expect(html).toContain(lang === 'zh' ? '结膜与眼睑分组' : 'Conjunctiva and eyelid group');
    expect(html.match(/class="structure-row/g)).toHaveLength(9);
  });
  it.each(['zh', 'en'] as const)('describes orbital group results without a fundus hint in %s', lang => {
    const result = search.searchStructures('orbit');
    vi.spyOn(search, 'searchStructures').mockReturnValue(result);
    store.getState().setLanguage(lang);
    const html = renderApp(false);
    expect(html).not.toContain(messages.fundusGroup[lang]);
    expect(html).toContain(lang === 'zh' ? '眼眶与内容物分组' : 'Orbit and contents group');
    expect(html.match(/class="structure-row/g)).toHaveLength(17);
  });
  it('keeps orbital details, observation controls and language state available on both layouts', () => {
    store.getState().applyPreset('orbit'); store.getState().select('ciliary-ganglion', true);
    for (const lang of ['zh', 'en'] as const) {
      store.getState().setLanguage(lang);
      for (const narrow of [false, true]) {
        const html = renderApp(narrow);
        expect(html).toContain(lang === 'zh' ? '睫状神经节' : 'Ciliary ganglion');
        expect(html).toContain('Ganglion ciliare');
        expect(html).toContain(messages.isolate[lang]);
        expect(html).toContain(messages.focus[lang]);
      }
    }
    expect(store.getState()).toMatchObject({ presetId: 'orbit', selectedId: 'ciliary-ganglion', lang: 'en' });
  });
  it.each<{ mode: Mode; tabs: string[]; active: string }>([
    { mode: 'explore', tabs: ['structures', 'parameters', 'explanation'], active: 'structures' },
    { mode: 'optics', tabs: ['parameters', 'explanation'], active: 'parameters' },
    { mode: 'tour', tabs: ['structures', 'parameters', 'explanation'], active: 'explanation' },
    { mode: 'quiz', tabs: ['parameters', 'explanation'], active: 'explanation' },
    { mode: 'disease', tabs: ['structures', 'explanation'], active: 'explanation' },
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
    expect(separation).toContain(`aria-valuetext="${lang === 'zh' ? '分层分离' : 'Separated layers'} · 37%"`);
    expect(separation).toContain('value="0.37"');
  });

  it.each(['zh', 'en'] as const)('marks the final third as a flat layout and describes its section controls in %s', lang => {
    store.getState().setLanguage(lang);
    store.getState().setClip({ enabled: true });
    for (const narrow of [false, true]) {
      store.getState().setExplode(0.66);
      let html = renderApp(narrow);
      expect(html).toContain(`aria-valuetext="${lang === 'zh' ? '分层分离' : 'Separated layers'} · 66%"`);
      expect(html).toContain(messages.sectionLocked[lang]);
      store.getState().setExplode(0.67);
      html = renderApp(narrow);
      expect(html).toContain(`aria-valuetext="${lang === 'zh' ? '平铺展示' : 'Flat layout'} · 67%"`);
      expect(html).toContain(lang === 'zh' ? '平铺可见结构' : 'lay out visible structures');
      expect(html).toContain(lang === 'zh' ? '平铺时逐个结构剖切，请使用位置滑块。' : 'Each structure is sectioned separately in the flat layout. Use the position slider.');
      expect(html).not.toContain(messages.sectionLocked[lang]);
      const range = [...html.matchAll(/<input\b[^>]*type="range"[^>]*>/g)].find(([tag]) => tag.includes(`aria-label="${messages.explode[lang]}"`))?.[0];
      expect(range).toContain('min="0" max="1" step="0.01"');
      const hintId = range?.match(/aria-describedby="([^"]+)"/)?.[1];
      expect(hintId).toBeTruthy();
      expect(html).toContain(`id="${hintId}"`);
      expect(html).toMatch(/class="explode-threshold"[^>]*aria-hidden="true"/);
    }
  });

  it.each(['zh', 'en'] as const)('explains hidden 3D optical overlays only while a flat optical scene is displayed in %s', lang => {
    store.getState().setLanguage(lang);
    const hint = lang === 'zh' ? '平铺时暂隐三维光路与信号，返回分层后恢复。' : '3D light paths and signals are hidden in the flat layout and return when you leave it.';
    store.getState().setExplode(0.8);
    expect(renderApp(false)).not.toContain(hint);
    store.getState().setMode('optics'); store.getState().setExplode(0.8);
    expect(renderApp(false)).toContain(hint);
    store.getState().setExplode(0.66);
    expect(renderApp(false)).not.toContain(hint);
  });

  it.each(['zh', 'en'] as const)('keeps compact exploration tools accessible while presets and help start collapsed in %s', lang => {
    store.getState().setLanguage(lang); store.getState().applyPreset('orbit'); store.getState().setExplode(0.8);
    for (const narrow of [false, true]) {
      const html = renderApp(narrow);
      const picker = html.match(/<details[^>]*class="preset-picker"[^>]*>([\s\S]*?)<\/details>/);
      expect(picker).not.toBeNull();
      expect(picker![0].split('>')[0]).not.toContain('open');
      expect(picker![1].match(/<button\b/g)).toHaveLength(10);
      expect(picker![1]).toContain(messages.presetOrbit[lang].replace('&', '&amp;'));
      const help = html.match(/<details[^>]*class="control-help"[^>]*>([\s\S]*?)<\/details>/);
      expect(help).not.toBeNull();
      expect(help![0].split('>')[0]).not.toContain('open');
      expect(help![1]).toContain(messages.explodeHint[lang]);
      const visibleControls = html.replace(picker![0], '').replace(help![0], '');
      expect(visibleControls).toContain(`${messages.flatLayout[lang]} · 80%`);
      expect(visibleControls).toMatch(/<button[^>]*aria-label="(?:撤销场景操作|Undo scene change)[^"]*"/);
      expect(visibleControls).toContain(`aria-label="${messages.sectionPosition[lang]}"`);
      expect(visibleControls).toContain(`aria-label="${messages.flipSection[lang]}"`);
      expect(visibleControls).toContain(`aria-label="${messages.zoomIn[lang]}"`);
      expect(visibleControls).toContain(`aria-label="${messages.zoomOut[lang]}"`);
    }
    store.getState().setMode('optics');
    expect(renderApp(false)).not.toContain('class="preset-picker"');
    expect(renderApp(false)).not.toContain('class="control-help"');
  });

  it('orders desktop scene tools before side panels and mounts a single viewport', () => {
    const html = renderApp(false);
    const scene = html.indexOf('<section class="scene-column"');
    const controls = html.indexOf('class="scene-controls');
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

describe('comparison and physiology presentation', () => {
  function comparison() {
    store.getState().setMode('optics');
    store.setState({ comparison: { input: optics.opticsInputForPreset('normal'), showing: 'current' }, opticsInput: optics.opticsInputForPreset('myopia') });
  }
  it('shows two desktop models with frozen reference and a parameter difference summary', () => {
    comparison();
    const html = renderApp(false);
    expect(html.match(/class="viewport"/g)).toHaveLength(2);
    expect(html).toContain('class="comparison-summary"');
    expect(html).toContain('0.00 → 1.00');
    expect(html).toContain('data-comparison="reference"');
    expect(html).toContain('data-comparison="current"');
  });
  it('uses a single narrow viewport and labels the selected comparison scene', () => {
    comparison();
    store.setState({ comparison: { ...store.getState().comparison!, showing: 'reference' } });
    const html = renderApp();
    expect(html.match(/class="viewport"/g)).toHaveLength(1);
    expect(html).toContain('data-comparison="reference"');
    expect(html).toContain('0.00 → 1.00');
    expect(html).toMatch(/aria-pressed="true"[^>]*>对照/);
  });
  it('derives qualitative blur from the respective ray result without claiming visual acuity', () => {
    comparison();
    const html = renderApp(false);
    const amounts = [...html.matchAll(/<feGaussianBlur stdDeviation="([^"]+)"/g)].map(m => Number(m[1]));
    expect(amounts).toHaveLength(2);
    expect(amounts[0]).toBeLessThan(0.00001);
    expect(amounts[1]).toBeGreaterThan(0.1);
    expect(html).toContain('模糊示意，不代表视力表结果');
  });
  it('does not depict an empty ray result as a sharply focused chart', () => {
    store.getState().setMode('optics');
    const result = optics.traceOptics(store.getState().opticsInput);
    vi.spyOn(optics, 'traceOptics').mockReturnValue({ ...result, rays: [], extensions: [], retinalIntersections: [], validRayCount: 0, retinalSpread: null });
    const html = renderApp(false);
    expect(html).not.toContain('<feGaussianBlur');
    expect(html).toContain('未得到通过瞳孔的光线样本');
  });
  it('keeps manual physiology controls and distinct signal legends while paused', () => {
    store.getState().setMode('optics');
    store.setState({ physiology: { kind: 'signal', step: 2, playing: false, returnInput: optics.opticsInputForPreset('normal'), returnExperiment: 'baseline', returnPreset: 'normal', returnShowOptics: false } });
    const html = renderApp(false);
    expect(html).toContain('单步');
    expect(html).toContain('重播');
    expect(html).toContain('神经信号');
    expect(html).toContain('class="neural-key"');
    expect(html).toContain('class="conversion-key"');
    expect(html).toContain('视神经传出');
  });
  it('exposes the signal demonstration within the existing vision tour', () => {
    store.getState().startLesson('vision');
    store.getState().goToStep(3);
    expect(renderApp(false)).toContain('光到神经信号');
  });
});


describe('disease workspace integration', () => {
  it('makes the disease workspace directly reachable from the main navigation', () => {
    const html = renderApp(false);
    const nav = html.match(/<nav\b[^>]*>(.*?)<\/nav>/s)?.[1];
    expect(nav).toContain('常见眼病');
    expect(nav?.match(/<button\b/g)).toHaveLength(5);
  });

  it('offers two models for a single-eye comparison and a single viewport on a narrow screen', () => {
    store.getState().openDisease('cataract');
    store.getState().setDiseaseNormal(false);
    store.getState().setDiseaseComparison(true);
    const desktop = renderApp(false);
    expect(desktop.match(/class="viewport"/g)).toHaveLength(2);
    expect(desktop).toContain('data-comparison="reference"');
    expect(desktop).toContain('data-comparison="current"');
    expect(desktop).not.toContain('class="scene-presets"');
    expect(renderApp().match(/class="viewport"/g)).toHaveLength(1);
  });

  it.each(['strabismus', 'amblyopia'] as const)('keeps %s as one eye pair during desktop comparison', id => {
    store.getState().openDisease(id);
    store.getState().setDiseaseNormal(false);
    store.getState().setDiseaseComparison(true);
    const html = renderApp(false);
    expect(html.match(/class="viewport"/g)).toHaveLength(1);
    expect(html).toContain('OD · OS');
    expect(html).not.toContain('OCULUS DEXTER');
    expect(html).not.toContain('class="section-controls"');
  });
});


it.each(['zh', 'en'] as const)('offers one compact skull checkbox with a disabled-context explanation in %s', lang => {
  store.getState().setLanguage(lang);
  const checkbox = () => renderApp(false).match(/<label class="check skull-toggle"[^>]*>([\s\S]*?)<\/label>/)?.[0];
  expect(checkbox()).toContain(lang === 'zh' ? '头骨参照' : 'Skull reference');
  expect(checkbox()).toContain('checked=""');
  expect(checkbox()).not.toContain('disabled=""');
  store.getState().setClip({ enabled: true });
  expect(checkbox()).toContain('disabled=""');
  expect(checkbox()).toContain(lang === 'zh' ? '剖切' : 'sectioning');
  store.getState().setMode('optics');
  expect(checkbox()).toBeUndefined();
});
