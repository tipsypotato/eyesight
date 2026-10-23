import type { Lang } from './anatomy/types';

export const STARTUP_COMPLETED = { interface: 0, engine: 1, model: 2, render: 3, ready: 4 } as const;
export type StartupStage = keyof typeof STARTUP_COMPLETED;
export const STARTUP_TEXT = {
  title: { zh: '正在启动 eyesight', en: 'Starting eyesight' },
  interface: { zh: '正在准备界面', en: 'Preparing the interface' },
  engine: { zh: '正在加载三维引擎', en: 'Loading the 3D engine' },
  model: { zh: '正在构建眼球模型', en: 'Building the eye model' },
  render: { zh: '正在绘制场景', en: 'Rendering the scene' },
  ready: { zh: '准备就绪', en: 'Ready' },
  progress: { zh: '已完成启动步骤', en: 'Startup steps completed' },
  failure: { zh: '启动未完成，请检查网络连接后重新加载。', en: 'Startup could not finish. Check your connection and reload.' },
  retry: { zh: '重新加载', en: 'Reload' },
} as const;

let engineModule: Promise<typeof import('./engine/EyeEngine')> | undefined;
export function loadEyeEngine() {
  return engineModule ??= import('./engine/EyeEngine');
}

export function yieldToBrowser() {
  // A second frame lets the first frame paint before synchronous model work starts.
  return new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

function savedLanguage(): Lang {
  try { return window.localStorage.getItem('eyesight.language') === 'en' ? 'en' : 'zh'; }
  catch { return 'zh'; }
}

export function setStartupStage(stage: StartupStage, lang: Lang = savedLanguage()) {
  const screen = document.getElementById('startup-screen');
  if (!screen) return;
  screen.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.getElementById('startup-title')!.textContent = STARTUP_TEXT.title[lang];
  document.getElementById('startup-status')!.textContent = STARTUP_TEXT[stage][lang];
  document.getElementById('startup-retry')!.textContent = STARTUP_TEXT.retry[lang];
  const completed = STARTUP_COMPLETED[stage];
  const progress = document.getElementById('startup-progress') as HTMLProgressElement;
  progress.value = completed;
  progress.setAttribute('aria-label', STARTUP_TEXT.progress[lang]);
  progress.setAttribute('aria-valuetext', `${completed} / 4 · ${STARTUP_TEXT[stage][lang]}`);
  document.getElementById('startup-count')!.textContent = `${completed} / 4`;
}

export function finishStartup() {
  document.getElementById('startup-screen')?.remove();
  const root = document.getElementById('root');
  root?.removeAttribute('inert');
  root?.removeAttribute('aria-busy');
}

export function failStartup(lang: Lang = savedLanguage()) {
  const screen = document.getElementById('startup-screen');
  if (!screen) return;
  screen.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.getElementById('startup-title')!.textContent = STARTUP_TEXT.title[lang];
  const status = document.getElementById('startup-status')!;
  status.setAttribute('role', 'alert');
  status.setAttribute('aria-live', 'assertive');
  status.textContent = STARTUP_TEXT.failure[lang];
  document.getElementById('startup-retry')!.textContent = STARTUP_TEXT.retry[lang];
  document.getElementById('startup-progress')!.hidden = true;
  document.getElementById('startup-count')!.hidden = true;
}
