import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { failStartup, finishStartup, loadEyeEngine, setStartupStage, STARTUP_TEXT, yieldToBrowser } from './startup';

vi.mock('./engine/EyeEngine', () => ({ EyeEngine: class {} }));

class ElementStub {
  textContent = '';
  value = 0;
  max = 4;
  hidden = false;
  lang = '';
  removed = false;
  attributes = new Map<string, string>();
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  removeAttribute(name: string) { this.attributes.delete(name); }
  remove() { this.removed = true; }
}

let elements: Record<string, ElementStub>;
beforeEach(() => {
  elements = Object.fromEntries(['startup-screen', 'startup-title', 'startup-status', 'startup-progress', 'startup-count', 'startup-retry', 'root'].map(id => [id, new ElementStub()]));
  elements.root.setAttribute('inert', '');
  elements.root.setAttribute('aria-busy', 'true');
  vi.stubGlobal('document', { getElementById: (id: string) => elements[id] });
  vi.stubGlobal('window', { localStorage: { getItem: () => null } });
});
afterEach(() => vi.unstubAllGlobals());

it('reports completed startup steps without claiming download percentages', () => {
  for (const [stage, completed] of [['interface', 0], ['engine', 1], ['model', 2], ['render', 3], ['ready', 4]] as const) {
    setStartupStage(stage, 'en');
    expect(elements['startup-progress'].value).toBe(completed);
    expect(elements['startup-count'].textContent).toBe(`${completed} / 4`);
    expect(elements['startup-status'].textContent).toBe(STARTUP_TEXT[stage].en);
    expect(elements['startup-progress'].attributes.get('aria-valuetext')).toContain(STARTUP_TEXT[stage].en);
  }
});

it('uses the saved language and permits the active UI language to override it', () => {
  vi.stubGlobal('window', { localStorage: { getItem: () => 'en' } });
  setStartupStage('engine');
  expect(elements['startup-screen'].lang).toBe('en');
  expect(elements['startup-title'].textContent).toBe(STARTUP_TEXT.title.en);
  expect(elements['startup-retry'].textContent).toBe(STARTUP_TEXT.retry.en);
  setStartupStage('model', 'zh');
  expect(elements['startup-screen'].lang).toBe('zh-CN');
  expect(elements['startup-status'].textContent).toBe(STARTUP_TEXT.model.zh);
});

it('falls back to Chinese when saved language is invalid or storage is inaccessible', () => {
  vi.stubGlobal('window', { localStorage: { getItem: () => 'unexpected' } });
  setStartupStage('interface');
  expect(elements['startup-status'].textContent).toBe(STARTUP_TEXT.interface.zh);
  vi.stubGlobal('window', { get localStorage() { throw new Error('Storage denied'); } });
  expect(() => setStartupStage('engine')).not.toThrow();
  expect(elements['startup-status'].textContent).toBe(STARTUP_TEXT.engine.zh);
});

it('reveals the app only when startup has finished and tolerates repeated cleanup', () => {
  finishStartup();
  expect(elements['startup-screen'].removed).toBe(true);
  expect(elements.root.attributes.has('inert')).toBe(false);
  expect(elements.root.attributes.has('aria-busy')).toBe(false);
  vi.stubGlobal('document', { getElementById: () => null });
  expect(finishStartup).not.toThrow();
  expect(() => setStartupStage('ready')).not.toThrow();
});

it('announces download failure and retains a usable retry link', () => {
  setStartupStage('engine', 'zh');
  failStartup('en');
  expect(elements['startup-screen'].lang).toBe('en');
  expect(elements['startup-title'].textContent).toBe(STARTUP_TEXT.title.en);
  expect(elements['startup-status'].textContent).toBe(STARTUP_TEXT.failure.en);
  expect(elements['startup-status'].attributes.get('role')).toBe('alert');
  expect(elements['startup-progress'].hidden).toBe(true);
  expect(elements['startup-count'].hidden).toBe(true);
  expect(elements['startup-retry'].hidden).toBe(false);
  expect(elements['startup-screen'].removed).toBe(false);
});

it('shares the engine download between the bootstrap and viewport', async () => {
  const first = loadEyeEngine();
  expect(loadEyeEngine()).toBe(first);
  expect((await first).EyeEngine).toBeTypeOf('function');
});

it('gives the browser a paint opportunity before continuing model construction', async () => {
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; });
  let resumed = false;
  const pending = yieldToBrowser().then(() => { resumed = true; });
  expect(frames).toHaveLength(1);
  frames.shift()!(0);
  await Promise.resolve();
  expect(resumed).toBe(false);
  expect(frames).toHaveLength(1);
  frames.shift()!(16);
  await pending;
  expect(resumed).toBe(true);
});
