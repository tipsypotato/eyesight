import { Component, useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useStore } from 'zustand';
import { GROUPS, LESSONS, STRUCTURES } from '../anatomy/data';
import { searchStructures } from '../anatomy/search';
import { SCENE_PRESETS, type ScenePreset, type ClipAxis, type Mode, type OpticsExperiment, type OpticsInput, type OpticsPreset, type StructureId, type ViewPreset } from '../anatomy/types';
import { messages, type MessageKey } from '../content/messages';
import { EyeEngine } from '../engine/EyeEngine';
import { traceOptics, type TraceOpticsResult } from '../engine/optics';
import { currentTarget, quizScore } from '../modes/quiz';
import { eyeStore, QUIZ_POOL } from '../state/store';

const useEye = () => useStore(eyeStore);
const structure = (id: StructureId | null) => STRUCTURES.find(item => item.id === id);
type EngineRef = RefObject<EyeEngine | null>;
function EyeIcon({ small = false }: { small?: boolean }) {
  return <svg width={small ? 25 : 52} height={small ? 25 : 52} viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M4 20s6-10 16-10 16 10 16 10-6 10-16 10S4 20 4 20Z" stroke="currentColor" strokeWidth="2"/><circle cx="20" cy="20" r="6" stroke="currentColor" strokeWidth="2"/><circle cx="20" cy="20" r="2.5" fill="currentColor"/></svg>;
}
function useText() { const lang = useStore(eyeStore, s => s.lang); return (key: MessageKey) => messages[key][lang]; }

function editScene(engine: EyeEngine | null, action: () => void) {
  const s = eyeStore.getState();
  s.endSceneChange(); s.beginSceneChange(engine?.captureCamera());
  try { action(); } finally { s.endSceneChange(); }
}

function observeStructure(engine: EyeEngine | null, id: StructureId, focus = false) {
  const state = eyeStore.getState();
  if (state.mode === 'quiz') return;
  if (!engine) { state.select(id); return; }
  const camera = engine.captureCamera();
  const visible = engine.isStructureVisible(id, true);
  if (visible) {
    state.select(id, true);
    if (focus) state.rememberFocus(camera);
  } else editScene(engine, () => state.revealStructure(id, camera));
  if (focus || !visible) engine.focus(id);
}

function Viewport({ engine }: { engine: EngineRef }) {
  const host = useRef<HTMLDivElement>(null);
  const t = useText();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    let instance: EyeEngine;
    try {
      instance = new EyeEngine(host.current, id => eyeStore.getState().select(id, true), id => observeStructure(instance, id, true), {
        begin: () => eyeStore.getState().beginSceneChange(instance.captureCamera()),
        change: offset => eyeStore.getState().setClip({ offset }),
        end: () => eyeStore.getState().endSceneChange(),
      });
      engine.current = instance;
      instance.setState(eyeStore.getState());
    } catch (error) { console.error('3D initialization failed', error); setFailed(true); return; }
    const unsubscribe = eyeStore.subscribe(next => instance.setState(next));
    return () => { unsubscribe(); instance.dispose(); engine.current = null; };
  }, [engine]);
  return <div className="viewport" ref={host} role="group" aria-label={`${t('rightEye')} · ${t('schematic')}`}>
    {failed && <div className="webgl-error" role="alert"><EyeIcon/><p>{t('webglError')}</p></div>}
  </div>;
}

function StructuresPanel({ engine }: { engine: EngineRef }) {
  const s = useEye(); const t = useText();
  const [query, setQuery] = useState('');
  const result = searchStructures(query), matching = result.items;
  return <><div className="panel-heading"><span className="eyebrow">{t('structures')}</span><h2>{t('structures')} <span className="count">17</span></h2></div>
    <div className="search"><span aria-hidden="true">⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('search')} aria-label={t('search')}/>{query && <button className="clear-search" aria-label={t('clearSearch')} onClick={() => setQuery('')}>×</button>}</div>
    {(result.ambiguous || result.group || result.relatedDisease) && <p className="search-context" role="status">{t(result.ambiguous ? 'ambiguousSearch' : result.group ? 'fundusGroup' : 'relatedDisease')}</p>}
    <p className="micro layer-hint">{t('layerHint')}</p>
    <div className="structure-list">{GROUPS.map(group => {
      const items = matching.filter(item => item.group === group.id);
      return items.length > 0 && <section key={group.id} className="structure-group"><h3>{group.name[s.lang]}</h3>{items.map(item => <div className={`structure-row ${s.selectedId === item.id ? 'selected' : ''}`} key={item.id}>
        <button className="structure-name" aria-pressed={s.selectedId === item.id} onClick={() => observeStructure(engine.current, item.id)}><span className="color-dot" style={{ background: item.color }}/><span>{item.name[s.lang]}</span></button>
        <button className={`layer-dot ${s.layers[item.id]}`} aria-label={`${item.name[s.lang]} · ${t(s.layers[item.id])}`} title={`${item.name[s.lang]} · ${t(s.layers[item.id])}`} onClick={() => editScene(engine.current, () => s.cycleLayer(item.id))}><span/></button>
      </div>)}</section>;
    })}{matching.length === 0 && <p>{t('noResults')}</p>}</div>
  </>;
}

function Details({ engine }: { engine: EngineRef }) {
  const s = useEye(); const t = useText(); const item = structure(s.selectedId);
  if (!item) return <div className="welcome-card"><div className="welcome-icon"><EyeIcon/></div><span className="eyebrow">{t('explore')}</span><h2>{t('pickTitle')}</h2><p>{t('pickBody')}</p><button className="primary" onClick={() => observeStructure(engine.current, 'cornea')}>{t('startExplore')} <span>↗</span></button><div className="welcome-stat"><b>17</b><span>{t('structures')}</span></div></div>;
  return <article className="details" key={item.id}><div className="detail-title"><span className="type-tag" style={{ borderColor: item.color }}>{t(item.kind)}</span><h2>{item.name[s.lang]}</h2><p className="latin">{item.latin}</p></div>
    <p className="summary">{item.summary[s.lang]}</p>
    <div className="detail-actions"><button onClick={() => observeStructure(engine.current, item.id, true)}>{t('focus')} ↗</button><button className={s.isolateId ? 'active' : ''} onClick={() => editScene(engine.current, s.toggleIsolate)}>{t(s.isolateId ? 'showAll' : 'isolate')}</button></div>
    <section><h3>{t('position')}</h3><p>{item.position[s.lang]}</p></section>
    {['retina', 'macula', 'fovea', 'optic-disc'].includes(item.id) && <section className="reference-structures"><h3>{t('referenceStructures')}</h3>{(['macula', 'fovea', 'optic-disc'] as StructureId[]).filter(id => id !== item.id).map(id => <button key={id} onClick={() => observeStructure(engine.current, id)}>{structure(id)!.name[s.lang]} ↗</button>)}</section>}
    <section><h3>{t('function')}</h3><p>{item.function[s.lang]}</p></section>
    <aside className="fact"><span>↳ {t('fact')}</span><p>{item.fact[s.lang]}</p></aside>
    <details className="sources"><summary>{t('sources')}</summary>{item.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>)}</details>
  </article>;
}

function OpticsDiagram({ result: supplied }: { result?: TraceOpticsResult }) {
  const s = useEye(); const t = useText(); const clipId = useId();
  const result = supplied ?? traceOptics(s.opticsInput);
  const front = result.objectZ ?? 2.3, back = result.retinaZ - 0.55;
  const x = (z: number) => 20 + (front - z) / (front - back) * 290;
  const y = (height: number) => 104 - height * 150;
  const plot = (points: [number, number, number][]) => points.map(p => `${x(p[2])},${y(p[0])}`).join(' ');
  const inViewFocus = result.focusKind === 'real' && result.focusZ !== null && result.focusZ >= back && result.focusZ <= result.lensZ;
  return <div className="optics-diagram"><svg viewBox="0 0 330 216" role="img" aria-label={t('opticsTitle')}>
    <defs><clipPath id={clipId}><rect x="15" y="26" width="305" height="160"/></clipPath></defs>
    <line x1="15" y1="104" x2="320" y2="104" stroke="#c8d1cc" strokeDasharray="3 4"/>
    <line x1={x(result.corneaZ)} y1="35" x2={x(result.corneaZ)} y2="175" stroke="#83c8cb" strokeWidth="4"/>
    <ellipse cx={x(result.lensZ)} cy="104" rx={6 + s.opticsInput.accommodation * 4} ry="55" fill="#d8e7c0" stroke="#adc582"/>
    <path d={`M${x(result.pupilZ)},28 V${y(result.pupilRadius)} M${x(result.pupilZ)},${y(-result.pupilRadius)} V180`} fill="none" stroke="#39786c" strokeWidth="4"/>
    {result.correctionPower !== 0 && <path d={`M${x(result.glassesZ)-3},35 Q${x(result.glassesZ)+8},104 ${x(result.glassesZ)-3},175`} fill="none" stroke="#667bc1" strokeWidth="4"/>}
    <line x1={x(result.retinaZ)} y1="28" x2={x(result.retinaZ)} y2="180" stroke="#c75d53" strokeWidth="3"/>
    <g clipPath={`url(#${clipId})`}>
      {result.rays.map((ray, i) => <polyline key={i} points={plot(ray.points)} fill="none" stroke={ray.blocked ? '#687872' : '#a86c17'} strokeWidth={ray.blocked ? '1.2' : '1.8'}/>)}
      {result.extensions.map((ray, i) => <polyline key={i} points={plot(ray.points)} fill="none" stroke="#a86c17" strokeWidth="1.3" strokeDasharray="4 4"/>)}
      {result.retinalIntersections.map((point, i) => <circle key={i} cx={x(point[2])} cy={y(point[0])} r="2.7" fill="#794599" stroke="white" strokeWidth="0.8"/>)}
    </g>
    {inViewFocus && <circle cx={x(result.focusZ!)} cy="104" r="4" fill="#214f42" stroke="white" strokeWidth="1.5"/>}
    {result.objectZ !== null && <><circle cx={x(result.objectZ)} cy="104" r="3" fill="#a86c17"/><text x="20" y="195">{t('objectPoint')}</text></>}
    <text x={x(result.corneaZ)} y="16" textAnchor="middle">{structure('cornea')!.name[s.lang]}</text>
    <text x={x(result.lensZ)} y="210" textAnchor="middle">{structure('lens')!.name[s.lang]}</text>
    <text x={x(result.retinaZ)} y="16" textAnchor="middle">{t('retinalPlane')}</text>
  </svg><div className="diagram-legend"><span><i className="ray-key"/>{t('rays')}</span><span><i className="focus-key"/>{t('focalPoint')}</span><span><i className="retinal-key"/>{t('retinalIntersections')}</span><span><i className="blocked-key"/>{t('blockedRays')}</span><span><i className="extension-key"/>{t('geometricExtension')}</span></div>
    {result.focusKind === 'real' && !inViewFocus && <p className="micro">{t('focusOutside')}</p>}
  </div>;
}

function OpticsPresets({ engine }: { engine: EngineRef }) {
  const s = useEye(); const t = useText();
  return <div className="preset-list">{(['normal', 'myopia', 'corrected'] as OpticsPreset[]).map((preset, i) => {
    const selected = s.opticsExperiment === 'baseline' && s.opticsPreset === preset;
    return <button key={preset} className={selected ? 'selected' : ''} aria-pressed={selected} onClick={() => editScene(engine.current, () => s.setOptics(preset))}><span>0{i+1}</span>{t(preset)}<b>{selected ? '●' : '○'}</b></button>;
  })}</div>;
}

const opticsFields: { key: keyof OpticsInput; label: MessageKey; hint: MessageKey; options?: [string, MessageKey][] }[] = [
  { key: 'axialIncrement', label: 'axialIncrement', hint: 'axialHint' },
  { key: 'objectDistance', label: 'objectDistance', hint: 'distanceHint', options: [['far', 'objectFar'], ['mid', 'objectMid'], ['near', 'objectNear']] },
  { key: 'accommodation', label: 'accommodation', hint: 'accommodationHint' },
  { key: 'pupil', label: 'pupilSize', hint: 'pupilHint', options: [['small', 'pupilSmall'], ['medium', 'pupilMedium'], ['large', 'pupilLarge']] },
  { key: 'externalLens', label: 'externalLens', hint: 'externalLensHint', options: [['off', 'lensOff'], ['myopia', 'lensMyopia']] },
];

function OpticsControls({ engine }: { engine: EngineRef }) {
  const s = useEye(); const t = useText(); const gesture = useSceneRangeGesture(engine);
  const edit = (action: () => void) => editScene(engine.current, action);
  const expanded = s.opticsExperiment !== 'baseline';
  return <div className="mode-content"><h2>{t('opticsParameters')}</h2><OpticsPresets engine={engine}/>{!expanded && <p>{t(`${s.opticsPreset}Body` as MessageKey)}</p>}<div className="optics-parameters">
    <label className="optics-mode">{t('opticsMode')}<select value={s.opticsExperiment} onChange={e => edit(() => s.setOpticsExperiment(e.target.value as OpticsExperiment))}>
      <option value="baseline">{t('opticsBaseline')}</option>{opticsFields.map(field => <option key={field.key} value={field.key}>{t(field.label)}</option>)}<option value="free">{t('opticsFree')}</option>
    </select></label><p className="micro">{t('opticsSingleHint')}</p>
    {expanded && <><p className="optics-baseline">{t(s.opticsExperiment === 'free' ? 'opticsFreeHint' : s.opticsExperiment === 'accommodation' ? 'opticsBaselineNear' : s.opticsExperiment === 'externalLens' ? 'opticsBaselineMyopia' : 'opticsBaselineNormal')}</p>
      {opticsFields.map(field => {
        const value = s.opticsInput[field.key], disabled = s.opticsExperiment !== 'free' && s.opticsExperiment !== field.key;
        return <div key={field.key} className={`optics-field ${disabled ? 'locked' : ''}`}><label htmlFor={`optics-${field.key}`}>{t(field.label)}{typeof value === 'number' && <output>{value.toFixed(2)}</output>}</label>
          {field.options ? <select id={`optics-${field.key}`} data-optics-input={field.key} aria-describedby={`optics-${field.key}-hint`} value={value} disabled={disabled} onChange={e => edit(() => s.setOpticsInput({ [field.key]: e.target.value }))}>{field.options.map(([option, label]) => <option key={option} value={option}>{t(label)}</option>)}</select>
            : <input id={`optics-${field.key}`} data-optics-input={field.key} aria-describedby={`optics-${field.key}-hint`} aria-valuetext={`${Number(value).toFixed(2)} / 1 · ${t('normalizedRange')}`} type="range" min="0" max="1" step="0.01" value={value} disabled={disabled} {...gesture} onChange={e => s.setOpticsInput({ [field.key]: Number(e.target.value) })}/>}
          <p id={`optics-${field.key}-hint`} className="micro">{t(field.hint)}</p>
        </div>;
      })}
    </>}
  </div></div>;
}

function OpticsPanel() {
  const s = useEye(); const t = useText(); const result = traceOptics(s.opticsInput);
  const conclusion: MessageKey = !result.validRayCount ? 'noRaySamples' : result.focusKind !== 'real' || result.focusZ === null ? 'noRealFocus' : Math.abs(result.focusZ - result.retinaZ) < 1e-7 ? 'focusOnRetina' : result.focusZ > result.retinaZ ? 'focusBeforeRetina' : 'focusBehindRetina';
  return <div className="mode-content"><span className="eyebrow">{t('optics')}</span><h2>{t('opticsTitle')}</h2><p className="summary optics-conclusion" role="status">{t(conclusion)}</p><OpticsDiagram result={result}/><dl className="optics-metrics"><div><dt>{t('retinalSamples')}</dt><dd>{result.validRayCount} / {result.rays.length}</dd></div><div><dt>{t('retinalSpread')}</dt><dd>{result.retinalSpread === null ? '—' : result.retinalSpread.toFixed(4)}</dd></div></dl><p className="micro note">{t('opticsNote')}</p></div>;
}

function TourList() {
  const s = useEye(); const t = useText();
  return <div className="mode-content"><span className="eyebrow">{t('tour')}</span><h2>{t('toursTitle')}</h2><p>{t('toursBody')}</p><div className="tour-list">{LESSONS.map((lesson, index) => <button key={lesson.id} className={`tour-card ${lesson.id === s.lessonId ? 'selected' : ''}`} onClick={() => s.startLesson(lesson.id)}><span className="tour-number">0{index + 1}</span><strong>{lesson.title[s.lang]}</strong><p>{lesson.description[s.lang]}</p><span className="micro">{lesson.steps.length} {t('step')} <b>↗</b></span></button>)}</div></div>;
}

function TourStepPanel({ engine }: { engine: EngineRef }) {
  const s = useEye(); const t = useText();
  const lesson = LESSONS.find(item => item.id === s.lessonId);
  if (!lesson) return <div className="welcome-card"><EyeIcon/><h2>{t('toursTitle')}</h2><p>{t('toursBody')}</p></div>;
  const step = lesson.steps[s.step]; const isLast = s.step === lesson.steps.length - 1;
  return <div className="mode-content"><div className="step-top"><span className="eyebrow">{t('step')} {s.step + 1} / {lesson.steps.length}</span><span className="micro">{lesson.title[s.lang]}</span></div><div className="progress-track">{lesson.steps.map((_, i) => <span key={i} className={i <= s.step ? 'done' : ''}/>)}</div><h2>{step.title[s.lang]}</h2><p className="tour-body">{step.body[s.lang]}</p><button className="target-chip" onClick={() => observeStructure(engine.current, step.target, true)}>{structure(step.target)!.name[s.lang]} ↗</button>{step.optics && <OpticsDiagram/>}<button className="text-button" onClick={s.restartLesson}>{t('restartLesson')}</button>{isLast && <p className="micro note">{t('tourDone')}</p>}</div>;
}

function QuizPanel() {
  const s = useEye(); const t = useText(); const quiz = s.quiz;
  if (!quiz) return null;
  const target = currentTarget(quiz); const answer = target ? quiz.answers[target] : null;
  if (!target) return <div className="mode-content quiz-result"><span className="eyebrow">{t('quizComplete')}</span><div className="score-number">{quizScore(quiz)}<span> / {quiz.order.length}</span></div><h2>{t('score')}</h2></div>;
  return <div className="mode-content"><span className="eyebrow">{t('quiz')} {quiz.index + 1} / {quiz.order.length}</span><div className="progress-track">{quiz.order.map((_, i) => <span key={i} className={i <= quiz.index ? 'done' : ''}/>)}</div><h2>{t('question')}</h2><p>{t('quizBody')}</p><div className="answers">{QUIZ_POOL.map((id, i) => <button key={id} disabled={!!answer} className={answer && id === target ? 'correct-answer' : answer?.selected === id ? 'wrong-answer' : ''} onClick={() => { s.answerQuiz(id); requestAnimationFrame(() => document.getElementById('quiz-action')?.focus()); }}><span>{String.fromCharCode(65+i)}</span>{structure(id)!.name[s.lang]}{answer && id === target && <b>✓</b>}</button>)}</div>
    {answer ? <div className="answer-feedback" aria-live="polite"><strong>{t(answer.revealed ? 'revealed' : answer.correct ? 'correct' : 'incorrect')}</strong><p>{structure(target)!.summary[s.lang]}</p></div> : null}
  </div>;
}

function ModeActions({ engine }: { engine: EngineRef }) {
  const s = useEye(); const t = useText();
  if (s.mode === 'tour') {
    const lesson = LESSONS.find(item => item.id === s.lessonId);
    if (!lesson) return <button className="primary" onClick={() => s.startLesson(LESSONS[0].id)}>{t('startTour')} →</button>;
    const last = s.step === lesson.steps.length - 1;
    return <div className="step-actions"><button disabled={s.step === 0} onClick={() => s.goToStep(s.step - 1)}>← {t('previous')}</button><button className="primary" onClick={() => last ? s.setMode('explore', engine.current?.captureCamera()) : s.goToStep(s.step + 1)}>{t(last ? 'finishTour' : 'next')} →</button></div>;
  }
  if (s.mode !== 'quiz' || !s.quiz) return null;
  const target = currentTarget(s.quiz);
  if (!target) return <><button className="primary" onClick={s.restartQuiz}>{t('retry')} ↻</button><button onClick={() => s.setMode('explore', engine.current?.captureCamera())}>{t('backExplore')}</button></>;
  return s.quiz.answers[target]
    ? <button id="quiz-action" className="primary" onClick={s.advanceQuiz}>{t(s.quiz.index === s.quiz.order.length - 1 ? 'result' : 'nextQuestion')} →</button>
    : <button onClick={s.revealQuiz}>{t('reveal')}</button>;
}

const presetMessages: Record<ScenePreset, MessageKey> = {
  intact: 'presetIntact', 'wall-cut': 'presetWall', anterior: 'presetAnterior', fundus: 'presetFundus', chambers: 'presetChambers', 'optical-path': 'presetOptical',
};
const rangeKeys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);
function useSceneRangeGesture(engine: EngineRef) {
  const begin = () => eyeStore.getState().beginSceneChange(engine.current?.captureCamera());
  const end = () => eyeStore.getState().endSceneChange();
  useEffect(() => {
    window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end); window.addEventListener('blur', end);
    return () => { window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); window.removeEventListener('blur', end); end(); };
  }, []);
  return {
    onPointerDown: begin, onPointerUp: end, onPointerCancel: end, onLostPointerCapture: end, onBlur: end,
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => { if (rangeKeys.has(e.key)) begin(); },
    onKeyUp: (e: React.KeyboardEvent<HTMLInputElement>) => { if (rangeKeys.has(e.key)) end(); },
  };
}
function SceneControls({ engine }: { engine: EngineRef }) {
  const s = useEye(); const t = useText(); const rangeGesture = useSceneRangeGesture(engine);
  const edit = (action: () => void) => editScene(engine.current, action);
  const axis = { sagittal: 'x', axial: 'y', coronal: 'z' }[s.clip.axis];
  return <div className="scene-controls">
    {s.mode !== 'quiz' && <>
      <div className="scene-presets" role="group" aria-label={t('scenePresets')}>{SCENE_PRESETS.map(preset => <button key={preset} className={s.presetId === preset ? 'active' : ''} aria-pressed={s.presetId === preset} onClick={() => edit(() => s.applyPreset(preset))}>{t(presetMessages[preset])}</button>)}</div>
      <div className="section-controls">
        <label className="check"><input type="checkbox" checked={s.clip.enabled} onChange={e => edit(() => s.setClip({ enabled: e.target.checked }))}/>{t('clip')}</label>
        <select aria-label={t('clip')} value={s.clip.axis} onChange={e => edit(() => s.setClip({ axis: e.target.value as ClipAxis }))}>{(['sagittal','axial','coronal'] as ClipAxis[]).map(axis => <option value={axis} key={axis}>{t(axis)}</option>)}</select>
        <input className="section-range" aria-label={t('sectionPosition')} aria-valuetext={`${t(s.clip.axis)} ${s.clip.offset.toFixed(2)} · ${t('retainedSide')} ${axis} ${s.clip.keepSide === 'negative' ? '≤' : '≥'} ${s.clip.offset.toFixed(2)}`} type="range" min="-1" max="1" step="0.01" value={s.clip.offset} disabled={!s.clip.enabled} {...rangeGesture} onChange={e => s.setClip({ offset: Number(e.target.value) })}/>
        <button className="flip-section" disabled={!s.clip.enabled} onClick={() => edit(() => s.setClip({ keepSide: s.clip.keepSide === 'negative' ? 'positive' : 'negative' }))}>{t('flipSection')}</button>
        <label className="explode-control">{t('explode')}<input aria-label={t('explode')} aria-valuetext={`${Math.round(s.explode * 100)}%`} type="range" min="0" max="1" step="0.01" value={s.explode} {...rangeGesture} onChange={e => s.setExplode(Number(e.target.value))}/></label>
      </div>
      {s.clip.enabled && <p className="section-status"><span>{t('retainedSide')}: {axis} {s.clip.keepSide === 'negative' ? '≤' : '≥'} {s.clip.offset.toFixed(2)}</span><span>{t('sectionLocked')}</span></p>}
      <div className="scene-history"><button disabled={s.undoCount === 0} onClick={s.undoScene}>↶ {t('undoScene')}{s.undoCount > 0 && ` (${s.undoCount})`}</button>{s.mode === 'explore' && s.showOptics && <button onClick={() => s.setMode('optics', engine.current?.captureCamera())}>{t('enterOptics')} →</button>}</div>
    </>}
    <div className="view-controls" role="group" aria-label={t('view')}>{(['oblique','front','side','back'] as ViewPreset[]).map(view => <button key={view} className={s.view === view ? 'active' : ''} onClick={() => s.setView(view)}>{t(view)}</button>)}<span className="spacer"/><button className="square" aria-label={t('zoomOut')} onClick={() => engine.current?.zoom(0.15)}>−</button><button className="square" aria-label={t('zoomIn')} onClick={() => engine.current?.zoom(-0.15)}>+</button></div>
  </div>;
}

type PanelTab = 'structures' | 'parameters' | 'explanation';
type PanelSize = 'collapsed' | 'half' | 'full';
const panelTabs: Record<Mode, PanelTab[]> = {
  explore: ['structures', 'parameters', 'explanation'], optics: ['parameters', 'explanation'],
  tour: ['structures', 'parameters', 'explanation'], quiz: ['parameters', 'explanation'],
};
const defaultPanelTab: Record<Mode, PanelTab> = { explore: 'structures', optics: 'parameters', tour: 'explanation', quiz: 'explanation' };

function MobilePanel({ engine, size, onSize }: { engine: EngineRef; size: PanelSize; onSize: (size: PanelSize) => void }) {
  const s = useEye(); const t = useText();
  const [tabState, setTab] = useState<{ mode: Mode; tab: PanelTab }>({ mode: s.mode, tab: defaultPanelTab[s.mode] });
  const tab = tabState.mode === s.mode ? tabState.tab : defaultPanelTab[s.mode];
  const tabs = panelTabs[s.mode];
  const sizeTrigger = useRef<HTMLButtonElement>(null);
  const returnButton = useRef<HTMLButtonElement>(null);
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => { body.current?.scrollTo(0, 0); }, [s.mode, tab, s.step, s.quiz?.index]);
  const resize = (next: PanelSize) => {
    onSize(next);
    if (next === 'full' || size === 'full') requestAnimationFrame(() => (next === 'full' ? returnButton.current : sizeTrigger.current)?.focus());
  };
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (!event.defaultPrevented && event.key === 'Escape' && size === 'full' && !document.querySelector('footer details[open]')) { event.preventDefault(); resize('half'); }
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [size]);
  const switchTab = (next: PanelTab) => setTab({ mode: s.mode, tab: next });
  return <aside className={`mobile-panel panel-${size}`} aria-label={t('workspacePanel')}>
    <div className="panel-toolbar"><h2>{t(s.mode)}</h2>{size === 'full'
      ? <button ref={returnButton} onClick={() => resize('half')}>{t('returnModel')} ↓</button>
      : <div className="panel-sizes" role="group" aria-label={t('panelSize')}>
        <button aria-pressed={size === 'collapsed'} onClick={() => resize('collapsed')}>{t('panelCollapsed')}</button>
        <button aria-pressed={size === 'half'} onClick={() => resize('half')}>{t('panelHalf')}</button>
        <button ref={sizeTrigger} onClick={() => resize('full')}>{t('panelFull')}</button>
      </div>}</div>
      <div hidden={size === 'collapsed'} className="panel-tabs" role="tablist" aria-label={t('workspacePanel')}>{tabs.map(item => <button key={item} id={`tab-${item}`} role="tab" aria-selected={tab === item} aria-controls={`panel-${item}`} tabIndex={tab === item ? 0 : -1} onClick={() => switchTab(item)} onKeyDown={event => {
        const index = tabs.indexOf(item);
        const next = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs[tabs.length - 1] : event.key === 'ArrowRight' ? tabs[(index + 1) % tabs.length] : event.key === 'ArrowLeft' ? tabs[(index + tabs.length - 1) % tabs.length] : null;
        if (next) { event.preventDefault(); switchTab(next); document.getElementById(`tab-${next}`)?.focus(); }
      }}>{t(item)}</button>)}</div>
      <div className="panel-body" hidden={size === 'collapsed'} ref={body}>
        {tabs.includes('structures') && <div id="panel-structures" role="tabpanel" aria-labelledby="tab-structures" hidden={tab !== 'structures'} tabIndex={0}><StructuresPanel engine={engine}/></div>}
        <div id="panel-parameters" role="tabpanel" aria-labelledby="tab-parameters" hidden={tab !== 'parameters'} tabIndex={0}>{s.mode === 'optics' && <><OpticsControls engine={engine}/><OpticsPanel/></>}<SceneControls engine={engine}/></div>
        <div id="panel-explanation" role="tabpanel" aria-labelledby="tab-explanation" hidden={tab !== 'explanation'} tabIndex={0}>{s.mode === 'explore' ? <Details engine={engine}/> : s.mode === 'optics' ? <OpticsPanel/> : s.mode === 'tour' ? <><details className="tour-picker"><summary>{t('backTours')}</summary><TourList/></details><TourStepPanel engine={engine}/></> : <QuizPanel/>}</div>
      </div>
    {(s.mode === 'tour' || s.mode === 'quiz') && <div className="panel-actions"><ModeActions engine={engine}/></div>}
  </aside>;
}

export default function App() {
  const s = useEye(); const t = useText(); const engine = useRef<EyeEngine | null>(null);
  const [narrow, setNarrow] = useState(() => window.matchMedia('(width < 900px)').matches);
  const [panelSize, setPanelSize] = useState<PanelSize>('half');
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const nav = useRef<HTMLElement>(null);
  const about = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const media = window.matchMedia('(width < 900px)');
    const update = () => setNarrow(media.matches);
    media.addEventListener('change', update); update();
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => setKeyboardOpen(!!viewport && window.innerHeight - viewport.height > 150);
    viewport?.addEventListener('resize', update); update();
    return () => viewport?.removeEventListener('resize', update);
  }, []);
  useEffect(() => { document.documentElement.lang = s.lang === 'zh' ? 'zh-CN' : 'en'; document.title = `eyesight · ${t('rightEye')}`; }, [s.lang]);
  useEffect(() => { nav.current?.querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }, [s.mode, s.lang, narrow]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (about.current?.open) { event.preventDefault(); about.current.open = false; about.current.querySelector('summary')?.focus(); }
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, []);
  return <div className={`app ${narrow ? 'narrow' : ''} ${keyboardOpen ? 'keyboard-open' : ''}`}><header className="header"><a className="brand" href="#" onClick={e => { e.preventDefault(); s.setMode('explore', engine.current?.captureCamera()); }} aria-label="eyesight"><span className="brand-icon"><EyeIcon small/></span><b>eyesight</b><span className="brand-tagline">{t('tagline')}</span></a><nav ref={nav} aria-label={t('workspaces')}>{(['explore','optics','tour','quiz'] as Mode[]).map(mode => <button key={mode} className={s.mode === mode ? 'active' : ''} aria-current={s.mode === mode ? 'page' : undefined} onClick={() => s.setMode(mode, engine.current?.captureCamera())}>{t(mode)}</button>)}</nav><div className="language-switch" role="group" aria-label="Language / 语言"><button lang="zh-CN" aria-pressed={s.lang === 'zh'} onClick={() => s.setLanguage('zh')}>中</button><span aria-hidden="true">/</span><button lang="en" aria-pressed={s.lang === 'en'} onClick={() => s.setLanguage('en')}>EN</button></div></header>
    <main className={`workspace mode-${s.mode}`}>
      <section className="scene-column" inert={narrow && panelSize === 'full' ? true : undefined}><div className="scene-heading"><div><span className="eyebrow">OCULUS DEXTER · OD</span><h1>{t('rightEye')}<span>{t('schematic')}</span></h1></div><div className="scene-actions">{s.mode !== 'quiz' && <button className={s.labels ? 'active' : ''} aria-pressed={s.labels} onClick={() => editScene(engine.current, () => s.setLabels(!s.labels))}>{t('labels')}</button>}<button onClick={s.resetCamera}>{t('resetCamera')}</button><button title={t('resetSceneHint')} onClick={() => editScene(engine.current, s.resetScene)}>{t('reset')}</button></div></div><div className="stage"><div className="stage-grid"/><Viewport engine={engine}/><div className="scene-corner" data-viewport-overlay>01 <span>/ {t(s.mode)}</span></div><p className="interaction-hint" data-viewport-overlay>{t(s.mode === 'quiz' ? 'dragQuiz' : 'drag')}</p></div><div className="observation-actions">{s.revealPreset && <span role="status">{t(s.revealPreset)} <button onClick={() => editScene(engine.current, s.undoReveal)}>{t('undoReveal')}</button></span>}{s.focusReturn && <button onClick={s.returnFocus}>{t('returnFocus')}</button>}</div>{!narrow && <SceneControls engine={engine}/>}</section>
      {narrow ? <MobilePanel engine={engine} size={panelSize} onSize={setPanelSize}/> : <>
        <aside className="left-panel">{s.mode === 'explore' ? <StructuresPanel engine={engine}/> : s.mode === 'tour' ? <TourList/> : s.mode === 'optics' ? <OpticsControls engine={engine}/> : <div className="mode-content"><span className="eyebrow">{t('quiz')}</span><h2>{t('quizPanel')}</h2><p>{t('quizHint')}</p><div className="sidebar-illustration"><EyeIcon/></div><p className="micro">{t('score')} · {s.quiz ? quizScore(s.quiz) : 0} / {QUIZ_POOL.length}</p></div>}</aside>
        <aside className="right-panel"><div className="desktop-panel-body">{s.mode === 'explore' ? <Details engine={engine}/> : s.mode === 'optics' ? <OpticsPanel/> : s.mode === 'tour' ? <TourStepPanel engine={engine}/> : <QuizPanel/>}</div>{(s.mode === 'tour' || s.mode === 'quiz') && <div className="panel-actions"><ModeActions engine={engine}/></div>}</aside>
      </>}
    </main><footer><span><i/>{t('anatomyCount')}</span><details ref={about}><summary>{t('info')} ↗</summary><div><p>{t('modelNote')}</p><p>{t('opticsNote')}</p></div></details><span className="footer-version">eyesight / 0.1</span></footer>
  </div>;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="fatal-error"><h1>eyesight</h1><p>{messages.loadError.zh} / {messages.loadError.en}</p><button onClick={() => location.reload()}>{messages.reload.zh} / {messages.reload.en}</button></div> : this.props.children; }
}
