import { Component, useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useStore } from 'zustand';
import { GROUPS, LESSONS, STRUCTURES } from '../anatomy/data';
import { searchStructures } from '../anatomy/search';
import { FLAT_LAYOUT_START, SCENE_PRESETS, sectionLimit, type ScenePreset, type ClipAxis, type Mode, type OpticsExperiment, type OpticsInput, type OpticsPreset, type PhysiologyKind, type StructureId, type ViewPreset } from '../anatomy/types';
import { messages, type MessageKey } from '../content/messages';
import type { EyeEngine } from '../engine/EyeEngine';
import { finishStartup, loadEyeEngine, setStartupStage, STARTUP_COMPLETED, STARTUP_TEXT, type StartupStage, yieldToBrowser } from '../startup';
import { traceOptics, type TraceOpticsResult } from '../engine/optics';
import { sessionScore } from '../modes/quiz';
import { RELATIONSHIPS } from '../anatomy/relationships';
import { TOUR_TASKS } from '../modes/tourTasks';
import { LEARNING_TEXT, PracticePanel, PracticeActions } from './LearningPanels';
import { DiseaseActions, DiseaseNavigation, DiseasePanel, DiseaseStatus } from './DiseasePanels';
import './disease.css';
import { PHYSIOLOGY_LENGTHS } from '../modes/physiology';
import { eyeStore } from '../state/store';

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
  if (state.mode === 'disease') {
    state.selectEye(state.selectedEye, id);
    if (focus) engine?.focus(id);
    return;
  }
  if (!engine) { state.select(id); if (focus) state.recordTourAction({ kind: 'focus', id }); return; }
  if (state.relationshipId && state.relatedIds?.includes(id)) { state.select(id, true); if (focus) { engine.focus(id); state.recordTourAction({ kind: 'focus', id }); } return; }
  const camera = engine.captureCamera();
  const visible = engine.isStructureVisible(id, true);
  if (visible) {
    state.select(id, true);
    if (focus) state.rememberFocus(camera);
  } else editScene(engine, () => state.revealStructure(id, camera));
  if (focus || !visible) engine.focus(id);
  if (focus) state.recordTourAction({ kind: 'focus', id });
}

export function Viewport({ engine, peer, reference = false, narrow = false, interactionEnabled = !narrow }: { engine: EngineRef; peer: EngineRef; reference?: boolean; narrow?: boolean; interactionEnabled?: boolean }) {
  const host = useRef<HTMLDivElement>(null); const s = useEye();
  const options = useRef({ reference, narrow, interactionEnabled }); options.current = { reference, narrow, interactionEnabled };
  const applyingState = useRef(false);
  const t = useText();
  const [failed, setFailed] = useState<'load' | 'webgl' | null>(null);
  const [loading, setLoading] = useState<StartupStage>('engine');
  const scene = (state: ReturnType<typeof eyeStore.getState>) => {
    if (state.mode === 'disease' && options.current.reference) return { ...state, diseaseNormal: true };
    return state.comparison && (options.current.reference || options.current.narrow && state.comparison.showing === 'reference')
      ? { ...state, opticsInput: state.comparison.input, physiology: null } : state;
  };
  const applyState = (instance: EyeEngine, state: ReturnType<typeof eyeStore.getState>) => {
    applyingState.current = true;
    try {
      instance.setState(scene(state));
      if (reference && peer.current) instance.syncCamera(peer.current.captureCamera());
    } finally { applyingState.current = false; }
  };
  useEffect(() => {
    if (!host.current) return;
    const element = host.current;
    let instance: EyeEngine | undefined, saveTimer: number | undefined;
    let cancelled = false, loaded = false, unsubscribe: (() => void) | undefined;
    const progress = (stage: StartupStage) => {
      setLoading(stage);
      if (!reference) setStartupStage(stage, eyeStore.getState().lang);
    };
    const fail = (error: unknown) => {
      if (cancelled) return;
      console.error('3D initialization failed', error);
      window.clearTimeout(saveTimer); unsubscribe?.(); instance?.dispose(); engine.current = null;
      setFailed(loaded ? 'webgl' : 'load');
      if (!reference) finishStartup();
    };
    void (async () => {
      progress('engine');
      const { EyeEngine } = await loadEyeEngine();
      if (cancelled) return;
      loaded = true;
      progress('model');
      await yieldToBrowser();
      if (cancelled) return;
      const active = new EyeEngine(element, (id, side) => {
        const state = eyeStore.getState();
        if (state.mode === 'disease') state.selectEye(side ?? 'right', id);
        else state.select(id, true);
      }, id => observeStructure(active, id, true), {
        begin: () => eyeStore.getState().beginSceneChange(active.captureCamera()),
        change: offset => eyeStore.getState().setClip({ offset }),
        end: () => eyeStore.getState().endSceneChange(),
      }, error => {
        if (cancelled) return;
        if (error !== undefined) { fail(error); return; }
        progress('ready');
        if (!reference) finishStartup();
      });
      instance = active; engine.current = active;
      active.setInteractionEnabled(options.current.interactionEnabled);
      active.setState(scene(eyeStore.getState()));
      active.setCameraListener(camera => {
        if (applyingState.current) return;
        peer.current?.syncCamera(camera);
        const currentEngine = reference ? peer.current : active; if (!currentEngine) return;
        const state = eyeStore.getState(), mode = state.mode, revision = state.sceneRevision;
        state.rememberCamera(currentEngine.captureCamera()); window.clearTimeout(saveTimer);
        saveTimer = window.setTimeout(() => { const current = eyeStore.getState(); if (current.mode === mode && current.sceneRevision === revision) current.flushProgress(); }, 400);
      });
      if (reference && peer.current) active.syncCamera(peer.current.captureCamera());
      else if (peer.current) peer.current.syncCamera(active.captureCamera());
      unsubscribe = eyeStore.subscribe(next => applyState(active, next));
      progress('render');
    })().catch(fail);
    return () => { cancelled = true; window.clearTimeout(saveTimer); unsubscribe?.(); instance?.dispose(); engine.current = null; };
  }, [engine]);
  useEffect(() => { engine.current?.setInteractionEnabled(interactionEnabled); }, [engine, interactionEnabled]);
  useEffect(() => { if (engine.current) applyState(engine.current, eyeStore.getState()); }, [narrow, reference, engine]);
  const binocular = s.mode === 'disease' && (s.disease?.id === 'strabismus' || s.disease?.id === 'amblyopia');
  return <div className="viewport" ref={host} role="group" aria-busy={!failed && loading !== 'ready'} aria-label={`${t(binocular ? 'bothEyes' : 'rightEye')} · ${t('schematic')}`}>
    {!s.comparison && !s.diseaseComparison && <div className="scene-corner" data-viewport-overlay>01 <span>/ {t(s.mode)}</span></div>}{!narrow && <p className="interaction-hint" data-viewport-overlay>{s.mode === 'quiz' && s.quiz?.context !== 'structures' ? LEARNING_TEXT.answerHint[s.lang] : t(s.mode === 'quiz' ? 'dragQuiz' : 'drag')}</p>}
    {!failed && loading !== 'ready' && <div className="model-loading"><EyeIcon/><p role="status">{STARTUP_TEXT[loading][s.lang]}</p><progress aria-label={STARTUP_TEXT.progress[s.lang]} max="4" value={STARTUP_COMPLETED[loading]}/><small>{STARTUP_COMPLETED[loading]} / 4</small></div>}
    {failed && <div className="webgl-error" role="alert"><EyeIcon/><p>{failed === 'load' ? STARTUP_TEXT.failure[s.lang] : t('webglError')}</p><button onClick={() => location.reload()}>{t('reload')}</button></div>}
  </div>;
}

function StructuresPanel({ engine }: { engine: EngineRef }) {
  const s = useEye(); const t = useText();
  const [query, setQuery] = useState('');
  const result = searchStructures(query), matching = result.items;
  return <><div className="panel-heading"><span className="eyebrow">{t('structures')}</span><h2>{t('structures')} <span className="count">{STRUCTURES.length}</span></h2></div>
    <div className="search"><span aria-hidden="true">⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('search')} aria-label={t('search')}/>{query && <button className="clear-search" aria-label={t('clearSearch')} onClick={() => setQuery('')}>×</button>}</div>
    {(result.ambiguous || result.group || result.relatedDisease) && <p className="search-context" role="status">{t(result.ambiguous ? 'ambiguousSearch' : result.group === 'extraocular' ? 'extraocularGroup' : result.group === 'adnexa' ? 'adnexalGroup' : result.group === 'orbit' ? 'orbitalGroup' : result.group ? 'fundusGroup' : 'relatedDisease')}</p>}
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

function RelatedObservation({ engine }: { engine: EngineRef }) {
  const s = useEye(); const t = useText();
  const active = RELATIONSHIPS.find(item => item.id === s.relationshipId);
  const available = RELATIONSHIPS.filter(item => item.members.some(member => member.id === s.selectedId));
  if (!available.length && !active) return null;
  return <section className="related-observation"><h3>{t('relatedObservation')}</h3>{active ? <>
    <strong>{active.name[s.lang]}</strong><p>{active.description[s.lang]}</p><p className="micro">{t('relatedLegend')}</p>
    {active.members.map(member => <div key={member.id}><button aria-pressed={s.selectedId === member.id} onClick={() => observeStructure(engine.current, member.id)}>{structure(member.id)!.name[s.lang]}</button><p className="micro">{member.role[s.lang]}</p></div>)}
    <button onClick={s.exitRelationship}>{t('returnSingle')}</button>
  </> : available.map(item => <button key={item.id} onClick={() => { s.enterRelationship(item.id, engine.current?.captureCamera()); engine.current?.focusStructures(item.members.map(member => member.id)); }}>{item.name[s.lang]} ↗</button>)}</section>;
}

function Details({ engine }: { engine: EngineRef }) {
  const s = useEye(); const t = useText(); const item = structure(s.selectedId);
  if (!item) return <div className="welcome-card"><div className="welcome-icon"><EyeIcon/></div><span className="eyebrow">{t('explore')}</span><h2>{t('pickTitle')}</h2><p>{t('pickBody')}</p><button className="primary" onClick={() => observeStructure(engine.current, 'cornea')}>{t('startExplore')} <span>↗</span></button><div className="welcome-stat"><b>{STRUCTURES.length}</b><span>{t('structures')}</span></div></div>;
  return <article className="details" key={item.id}><div className="detail-title"><span className="type-tag" style={{ borderColor: item.color }}>{t(item.kind)}</span><h2>{item.name[s.lang]}</h2><p className="latin">{item.latin}</p></div>
    <p className="summary">{item.summary[s.lang]}</p>
    <div className="detail-actions"><button onClick={() => observeStructure(engine.current, item.id, true)}>{t('focus')} ↗</button><button className={s.isolateId ? 'active' : ''} onClick={() => editScene(engine.current, s.toggleIsolate)}>{t(s.isolateId ? 'showAll' : 'isolate')}</button></div>
    <RelatedObservation engine={engine}/><section><h3>{t('position')}</h3><p>{item.position[s.lang]}</p></section>
    {['retina', 'macula', 'fovea', 'optic-disc'].includes(item.id) && <section className="reference-structures"><h3>{t('referenceStructures')}</h3>{(['macula', 'fovea', 'optic-disc'] as StructureId[]).filter(id => id !== item.id).map(id => <button key={id} onClick={() => observeStructure(engine.current, id)}>{structure(id)!.name[s.lang]} ↗</button>)}</section>}
    <section><h3>{t('function')}</h3><p>{item.function[s.lang]}</p></section>
    <aside className="fact"><span>↳ {t('fact')}</span><p>{item.fact[s.lang]}</p></aside>
    <details className="sources"><summary>{t('sources')}</summary>{item.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>)}</details>
  </article>;
}

function OpticsDiagram({ result: supplied, input: suppliedInput, matched = false }: { result?: TraceOpticsResult; input?: OpticsInput; matched?: boolean }) {
  const s = useEye(); const t = useText(); const clipId = useId();
  const input = suppliedInput ?? s.opticsInput, result = supplied ?? traceOptics(input);
  const front = matched ? 4 : result.objectZ ?? 2.3, back = matched ? -1.77 : result.retinaZ - 0.55;
  const x = (z: number) => 20 + (front - z) / (front - back) * 290;
  const y = (height: number) => 104 - height * 150;
  const plot = (points: [number, number, number][]) => points.map(p => `${x(p[2])},${y(p[0])}`).join(' ');
  const inViewFocus = result.focusKind === 'real' && result.focusZ !== null && result.focusZ >= back && result.focusZ <= result.lensZ;
  return <div className="optics-diagram"><svg viewBox="0 0 330 216" role="img" aria-label={t('opticsTitle')}>
    <defs><clipPath id={clipId}><rect x="15" y="26" width="305" height="160"/></clipPath></defs>
    <line x1="15" y1="104" x2="320" y2="104" stroke="#c8d1cc" strokeDasharray="3 4"/>
    <line x1={x(result.corneaZ)} y1="35" x2={x(result.corneaZ)} y2="175" stroke="#83c8cb" strokeWidth="4"/>
    <ellipse cx={x(result.lensZ)} cy="104" rx={6 + input.accommodation * 4} ry="55" fill="#d8e7c0" stroke="#adc582"/>
    <path d={`M${x(result.pupilZ)},28 V${y(result.pupilRadius)} M${x(result.pupilZ)},${y(-result.pupilRadius)} V180`} fill="none" stroke="#39786c" strokeWidth="4"/>
    {result.correctionPower !== 0 && <path d={`M${x(result.glassesZ)-3},35 Q${x(result.glassesZ)+8},104 ${x(result.glassesZ)-3},175`} fill="none" stroke="#667bc1" strokeWidth="4"/>}
    <line x1={x(result.retinaZ)} y1="28" x2={x(result.retinaZ)} y2="180" stroke="#c75d53" strokeWidth="3"/>
    <g clipPath={`url(#${clipId})`}>
      {result.rays.map((ray, i) => <polyline key={i} points={plot(ray.points)} fill="none" stroke={ray.blocked ? '#687872' : '#a86c17'} strokeWidth={ray.blocked ? '1.2' : '1.8'}/>)}
      {result.extensions.map((ray, i) => <polyline key={i} points={plot(ray.points)} fill="none" stroke="#a86c17" strokeWidth="1.3" strokeDasharray="4 4"/>)}
      {result.retinalIntersections.map((point, i) => <rect key={i} x={x(point[2])-2.7} y={y(point[0])-2.7} width="5.4" height="5.4" fill="#794599" stroke="white" strokeWidth="0.8"/>)}
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
  return <div className="mode-content"><h2>{t('opticsParameters')}</h2><fieldset className="optics-inputs" disabled={!!s.physiology}><OpticsPresets engine={engine}/>{!expanded && !s.physiology && <p>{t(`${s.opticsPreset}Body` as MessageKey)}</p>}<div className="optics-parameters">
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
  </div></fieldset><div className="comparison-actions"><button disabled={!!s.physiology} onClick={() => edit(s.saveComparison)}>{t('saveComparison')}</button>{s.comparison && <button onClick={() => edit(s.clearComparison)}>{t('exitComparison')}</button>}</div><PhysiologyControls engine={engine}/></div>;
}

function TestChart({ result }: { result: TraceOpticsResult }) {
  const t = useText(); const filterId = useId();
  // shortcut: an illustrative blur scale, replace only with a separately validated imaging model.
  const blur = result.retinalSpread === null ? null : Math.min(6, result.retinalSpread * 90);
  return <figure className="test-chart"><figcaption>{t('qualitativeImage')}</figcaption>{blur === null ? <p>{t('noRaySamples')}</p> : <svg viewBox="0 0 240 130" role="img" aria-label={t('qualitativeImage')}>
    <defs><filter id={filterId} x="-30%" y="-50%" width="160%" height="200%"><feGaussianBlur stdDeviation={blur}/></filter></defs>
    <rect width="240" height="130" fill="white"/><g filter={`url(#${filterId})`} fill="#13221b">
      <path d="M28 22h40v9H38v12h24v9H38v12h30v9H28Z"/><path d="M105 26h30v7h-23v9h19v7h-19v9h23v7h-30Z" transform="rotate(90 120 46)"/>
      <path d="M177 34h23v5h-17v7h14v5h-14v7h17v5h-23Z" transform="rotate(180 188 48)"/>
      {[24,40,56,72,88,104,120,136,152,168,184,200].map(x => <rect key={x} x={x} y="94" width="8" height="18"/>)}
    </g></svg>}<p className="micro">{t('qualitativeNote')}</p></figure>;
}

function OpticsReading({ input, label, matched = false }: { input: OpticsInput; label?: MessageKey; matched?: boolean }) {
  const t = useText(); const result = traceOptics(input);
  const conclusion: MessageKey = !result.validRayCount ? 'noRaySamples' : result.focusKind !== 'real' || result.focusZ === null ? 'noRealFocus' : Math.abs(result.focusZ - result.retinaZ) < 1e-7 ? 'focusOnRetina' : result.focusZ > result.retinaZ ? 'focusBeforeRetina' : 'focusBehindRetina';
  return <section className="optics-reading">{label && <h3>{t(label)}</h3>}<TestChart result={result}/><p className="summary optics-conclusion" role="status">{t(conclusion)}</p><OpticsDiagram result={result} input={input} matched={matched}/><dl className="optics-metrics"><div><dt>{t('retinalSamples')}</dt><dd>{result.validRayCount} / {result.rays.length}</dd></div><div><dt>{t('retinalSpread')}</dt><dd>{result.retinalSpread === null ? '—' : result.retinalSpread.toFixed(4)}</dd></div></dl></section>;
}

function OpticsPanel() {
  const s = useEye(); const t = useText();
  const narrow = window.matchMedia('(width < 900px)').matches;
  return <div className="mode-content"><span className="eyebrow">{t('optics')}</span><h2>{t('opticsTitle')}</h2>
    {s.comparison && (!narrow || s.comparison.showing === 'reference') && <OpticsReading input={s.comparison.input} label="referenceView" matched/>}
    {(!s.comparison || !narrow || s.comparison.showing === 'current') && <OpticsReading input={s.opticsInput} label={s.comparison ? 'currentView' : undefined} matched={!!s.comparison}/>}
    <p className="micro note">{t('opticsNote')}</p></div>;
}

const physiologyExplanations: Record<PhysiologyKind, MessageKey[]> = {
  pupil: ['pupilDark', 'pupilBrightening', 'pupilBright', 'pupilDimming', 'pupilDark'],
  accommodation: ['accommodationFar', 'accommodationNearStart', 'accommodationNearChanging', 'accommodationNearFocused', 'accommodationFarStart', 'accommodationRelaxing', 'accommodationFar'],
  signal: ['signalIncoming', 'signalConversion', 'signalOutgoing'],
};
const physiologyNames: Record<PhysiologyKind, MessageKey> = { pupil: 'physiologyPupil', accommodation: 'physiologyAccommodation', signal: 'physiologySignal' };

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    media.addEventListener('change', update); update();
    return () => media.removeEventListener('change', update);
  }, []);
  return reduced;
}

function PhysiologyControls({ engine, signalOnly = false }: { engine: EngineRef; signalOnly?: boolean }) {
  const s = useEye(); const t = useText(); const reduced = useReducedMotion(); const demo = s.physiology;
  const edit = (action: () => void) => editScene(engine.current, action);
  const kinds: PhysiologyKind[] = signalOnly ? ['signal'] : ['pupil', 'accommodation', 'signal'];
  return <section className="physiology-controls"><h3>{t('physiologyTitle')}</h3><div className="physiology-topics">{kinds.map(kind => <button key={kind} aria-pressed={demo?.kind === kind} onClick={() => edit(() => s.setPhysiology(kind))}>{t(physiologyNames[kind])}</button>)}</div>
    {demo ? <><p className="physiology-explanation" role="status"><b>{demo.step + 1} / {PHYSIOLOGY_LENGTHS[demo.kind]}</b> {t(physiologyExplanations[demo.kind][demo.step])}</p>
      {demo.kind === 'signal' && <div className="diagram-legend signal-legend"><span><i className="ray-key"/>{t('rays')}</span><span><i className="conversion-key"/>{t('retinalConversion')}</span><span><i className="neural-key"/>{t('neuralSignal')}</span></div>}
      <div className="playback-actions"><button disabled={!demo.playing && (reduced || demo.step === PHYSIOLOGY_LENGTHS[demo.kind]-1)} onClick={() => demo.playing ? s.pausePhysiology(true) : s.playPhysiology()}>{t(demo.playing ? 'pause' : 'play')}</button><button disabled={demo.step === PHYSIOLOGY_LENGTHS[demo.kind]-1} onClick={() => edit(() => { s.pausePhysiology(); s.advancePhysiology(true); })}>{t('singleStep')}</button><button onClick={() => edit(() => { s.replayPhysiology(); if (reduced) s.pausePhysiology(); })}>{t('replay')}</button><button onClick={() => edit(() => s.setPhysiology(null))}>{t('exitPhysiology')}</button></div>
      {reduced && <p className="micro">{t('reducedPlayback')}</p>}<p className="micro">{t('physiologyNote')}</p></> : <p className="micro">{t('physiologyStartHint')}</p>}
  </section>;
}

function ComparisonSummary({ narrow }: { narrow: boolean }) {
  const s = useEye(); const t = useText(); if (!s.comparison) return null;
  const differences = opticsFields.filter(field => s.comparison!.input[field.key] !== s.opticsInput[field.key]);
  const valueLabel = (field: typeof opticsFields[number], input: OpticsInput) => typeof input[field.key] === 'number' ? Number(input[field.key]).toFixed(2) : t(field.options!.find(([value]) => value === input[field.key])![1]);
  return <div className="comparison-summary">{narrow && <div className="comparison-switch">{(['reference', 'current'] as const).map(view => <button key={view} aria-pressed={s.comparison!.showing === view} onClick={() => s.setComparisonView(view)}>{t(view === 'reference' ? 'referenceView' : 'currentView')}</button>)}</div>}
    <strong>{t('comparisonDifference')}</strong><p>{differences.length ? differences.map(field => `${t(field.label)}: ${valueLabel(field, s.comparison!.input)} → ${valueLabel(field, s.opticsInput)}`).join(' · ') : t('comparisonSame')}</p><span className="micro">{t('comparisonHint')}</span>
  </div>;
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
  return <div className="mode-content"><div className="step-top"><span className="eyebrow">{t('step')} {s.step + 1} / {lesson.steps.length}</span><span className="micro">{lesson.title[s.lang]}</span></div><div className="progress-track">{lesson.steps.map((_, i) => <span key={i} className={i <= s.step ? 'done' : ''}/>)}</div><h2>{step.title[s.lang]}</h2><p className="tour-body">{step.body[s.lang]}</p><button className="target-chip" onClick={() => observeStructure(engine.current, step.target, true)}>{structure(step.target)!.name[s.lang]} ↗</button>{step.optics && s.showOptics && <OpticsDiagram/>}<TourTaskControls engine={engine}/>{lesson.id === 'vision' && <PhysiologyControls engine={engine} signalOnly/>}<button className="text-button" onClick={s.restartLesson}>{t('restartLesson')}</button>{isLast && <p className="micro note">{t('tourDone')}</p>}</div>;
}

function TourTaskControls({ engine }: { engine: EngineRef }) {
  const s = useEye(); const t = useText(); const gesture = useSceneRangeGesture(engine);
  const key = `${s.lessonId}:${s.step}`, task = TOUR_TASKS[key], progress = s.tourTasks[key];
  if (!task) return null;
  const focus = (id: StructureId) => <button key={id} onClick={() => observeStructure(engine.current, id, true)}>{t('focus')} · {structure(id)!.name[s.lang]}</button>;
  const edit = (action: () => void) => editScene(engine.current, action);
  return <section className="tour-task"><h3>{t('optionalAction')}</h3><p>{task.text[s.lang]}</p>
    {key === 'anatomy:0' && <button onClick={() => observeStructure(engine.current, 'sclera')}>{structure('sclera')!.name[s.lang]}</button>}
    {key === 'anatomy:1' && (['sclera', 'choroid', 'retina'] as const).map(id => <button key={id} onClick={() => observeStructure(engine.current, id)}>{structure(id)!.name[s.lang]}</button>)}
    {key === 'anatomy:2' && (['anterior-chamber', 'posterior-chamber', 'vitreous'] as const).map(focus)}
    {key === 'anatomy:3' && <>{focus('fovea')}<button onClick={() => s.recordTourAction({ kind: 'observed' })}>{t('observed')}</button></>}
    {key === 'vision:0' && <><button onClick={() => edit(() => { s.setPhysiology('signal'); s.pausePhysiology(true); })}>{t('pauseIncoming')}</button>{focus('pupil')}</>}
    {key === 'vision:1' && <><button onClick={() => { edit(() => { s.setPhysiology(null); s.setOptics('normal'); s.recordTourAction({ kind: 'sync' }); }); }}>{t('showSynchronized')}</button>{focus('lens')}</>}
    {key === 'vision:2' && <button onClick={() => s.recordTourAction({ kind: 'observed' })}>{t('observed')}</button>}
    {key === 'vision:3' && <button onClick={() => edit(() => { s.setPhysiology(null); s.setPhysiology('signal'); })}>{t('signalFromStart')}</button>}
    {key === 'myopia:0' && <><button onClick={() => edit(() => s.setOptics('normal'))}>{t('normal')}</button><button onClick={() => edit(s.saveComparison)}>{t('saveComparison')}</button></>}
    {key === 'myopia:1' && <label>{t('axialIncrement')} {s.opticsInput.axialIncrement.toFixed(2)}<input aria-label={t('axialIncrement')} aria-valuetext={`${s.opticsInput.axialIncrement.toFixed(2)} / 1 · ${t('normalizedRange')}`} type="range" min="0" max="1" step="0.01" value={s.opticsInput.axialIncrement} {...gesture} onChange={event => s.setOpticsInput({ axialIncrement: Number(event.target.value) })}/></label>}
    {key === 'myopia:2' && <button aria-pressed={s.opticsInput.externalLens === 'myopia'} onClick={() => edit(() => s.setOpticsInput({ externalLens: s.opticsInput.externalLens === 'off' ? 'myopia' : 'off' }))}>{t(s.opticsInput.externalLens === 'off' ? 'lensMyopia' : 'lensOff')}</button>}
    <p className="micro" role="status">{progress?.status === 'done' ? t('actionDone') : progress?.hint ? t('actionOrderHint') : progress ? t('actionVisited') : ''}</p>
    {progress?.status !== 'done' && <button onClick={() => { s.skipTourTask(); if (s.step < LESSONS.find(item => item.id === s.lessonId)!.steps.length - 1) s.goToStep(s.step + 1); }}>{t('skipAction')}</button>}
    <button onClick={() => s.exploreFromTour(engine.current?.captureCamera())}>{t('backExplore')}</button>
  </section>;
}

function ModeActions({ engine }: { engine: EngineRef }) {
  const s = useEye(); const t = useText();
  if (s.mode === 'disease') return <DiseaseActions engine={engine}/>;
  if (s.mode === 'tour') {
    const lesson = LESSONS.find(item => item.id === s.lessonId);
    if (!lesson) return <button className="primary" onClick={() => s.startLesson(LESSONS[0].id)}>{t('startTour')} →</button>;
    const last = s.step === lesson.steps.length - 1;
    return <div className="step-actions"><button disabled={s.step === 0} onClick={() => s.goToStep(s.step - 1)}>← {t('previous')}</button><button className="primary" onClick={() => last ? s.startPractice(lesson.id as 'anatomy' | 'vision' | 'myopia', false, false, engine.current?.captureCamera()) : s.goToStep(s.step + 1)}>{t(last ? 'practiceTopic' : 'next')} →</button></div>;
  }
  return s.mode === 'quiz' ? <PracticeActions engine={engine}/> : null;
}

const presetMessages: Record<ScenePreset, MessageKey> = {
  intact: 'presetIntact', 'wall-cut': 'presetWall', anterior: 'presetAnterior', fundus: 'presetFundus', chambers: 'presetChambers', 'optical-path': 'presetOptical', extraocular: 'presetExtraocular', eyelids: 'presetEyelids', orbit: 'presetOrbit',
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
  const compact = s.mode === 'explore';
  const presetPicker = useRef<HTMLDetailsElement>(null);
  const closePresets = () => {
    if (!presetPicker.current) return;
    presetPicker.current.open = false;
    presetPicker.current.querySelector('summary')?.focus({ preventScroll: true });
  };
  const axis = { sagittal: 'x', axial: 'y', coronal: 'z' }[s.clip.axis];
  const clipLimit = sectionLimit(s);
  const flatLayout = s.explode >= FLAT_LAYOUT_START;
  const explodeId = useId();
  const explodeHintId = `${explodeId}-hint`, sectionHintId = `${explodeId}-section-hint`;
  const explodeValue = `${t(flatLayout ? 'flatLayout' : 'separatedLayers')} · ${Math.round(s.explode * 100)}%`;
  const retainedSide = `${axis} ${s.clip.keepSide === 'negative' ? '≤' : '≥'} ${s.clip.offset.toFixed(2)}`;
  const presets = <div className="scene-presets" role="group" aria-label={t('scenePresets')}>{SCENE_PRESETS.filter(preset => (s.mode !== 'optics' || preset !== 'extraocular') && (s.mode === 'explore' || (preset !== 'eyelids' && preset !== 'orbit'))).map(preset => <button key={preset} className={s.presetId === preset ? 'active' : ''} aria-pressed={s.presetId === preset} onClick={() => { edit(() => s.applyPreset(preset)); if (compact) closePresets(); }}>{t(presetMessages[preset])}</button>)}</div>;
  const views = <div className="view-controls" role="group" aria-label={t('view')}>{(['oblique','front','side','back'] as ViewPreset[]).map(view => <button key={view} className={s.view === view ? 'active' : ''} aria-pressed={s.view === view} onClick={() => s.setView(view)}>{t(view)}</button>)}<span className="spacer"/><button className="square" aria-label={t('zoomOut')} onClick={() => engine.current?.zoom(0.15)}>−</button><button className="square" aria-label={t('zoomIn')} onClick={() => engine.current?.zoom(-0.15)}>+</button></div>;
  const undo = <button className="undo-scene" disabled={s.undoCount === 0} aria-label={`${t('undoScene')}${s.undoCount > 0 ? ` (${s.undoCount})` : ''}`} title={t('undoScene')} onClick={s.undoScene}>↶ {t(compact ? 'undoShort' : 'undoScene')}{s.undoCount > 0 && ` (${s.undoCount})`}</button>;
  const opticalLink = s.mode === 'explore' && s.showOptics && <button onClick={() => s.setMode('optics', engine.current?.captureCamera())}>{t('enterOptics')} →</button>;
  const clipToggle = <label className="check"><input type="checkbox" checked={s.clip.enabled} onChange={e => edit(() => s.setClip({ enabled: e.target.checked }))}/>{t('clip')}</label>;
  const clipAxis = <select aria-label={t('clip')} value={s.clip.axis} onChange={e => edit(() => s.setClip({ axis: e.target.value as ClipAxis }))}>{(['sagittal','axial','coronal'] as ClipAxis[]).map(axis => <option value={axis} key={axis}>{t(axis)}</option>)}</select>;
  const clipRange = <input className="section-range" aria-label={t('sectionPosition')} aria-describedby={compact ? sectionHintId : undefined} aria-valuetext={`${t(s.clip.axis)} ${s.clip.offset.toFixed(2)} · ${t('retainedSide')} ${retainedSide}`} type="range" min={-clipLimit} max={clipLimit} step="0.01" value={s.clip.offset} disabled={!s.clip.enabled} {...rangeGesture} onChange={e => s.setClip({ offset: Number(e.target.value) })}/>;
  const clipFlip = <button className="flip-section" aria-label={t('flipSection')} title={t('flipSection')} disabled={!s.clip.enabled} onClick={() => edit(() => s.setClip({ keepSide: s.clip.keepSide === 'negative' ? 'positive' : 'negative' }))}>{t(compact ? 'flipShort' : 'flipSection')}</button>;
  const explodeControl = <div className="explode-control">
    <span className="explode-heading"><label htmlFor={explodeId}>{t('explode')}</label><output htmlFor={explodeId}>{explodeValue}</output></span>
    <span className="explode-slider"><span className="explode-threshold" aria-hidden="true" style={{ left: `${FLAT_LAYOUT_START * 100}%` }}/><input id={explodeId} aria-label={t('explode')} aria-valuetext={explodeValue} aria-describedby={explodeHintId} type="range" min="0" max="1" step="0.01" value={s.explode} {...rangeGesture} onChange={e => s.setExplode(Number(e.target.value))}/></span>
    {!compact && <span className="explode-hint" id={explodeHintId}>{t('explodeHint')}</span>}
  </div>;
  const opticalHint = flatLayout && (s.mode === 'optics' || s.showOptics || s.physiology?.kind === 'signal') && <p className="section-status">{t('flatOpticsHint')}</p>;
  if (compact) return <div className="scene-controls compact-controls">
    <div className="scene-toolbar">
      <details ref={presetPicker} className="preset-picker" onKeyDown={event => { if (event.key === 'Escape' && event.currentTarget.open) { event.preventDefault(); closePresets(); } }}>
        <summary><span>{t('scenePresets')}</span><strong>{s.presetId ? t(presetMessages[s.presetId]) : t('customView')}</strong></summary>{presets}
      </details>{undo}{views}
    </div>
    <div className="scene-adjustments">
      <div className="section-controls"><div className="section-heading">{clipToggle}{clipAxis}{clipFlip}</div><div className="section-slider">{clipRange}<output className="section-value" aria-label={t('retainedSide')}>{retainedSide}</output></div></div>
      {explodeControl}
    </div>
    <div className="control-footer"><details className="control-help"><summary>{t('controlHelp')}</summary><p id={explodeHintId}>{t('explodeHint')}</p><p id={sectionHintId}>{t(flatLayout ? 'flatSectionHint' : 'sectionLocked')}</p></details>{opticalLink}</div>
    {opticalHint}
  </div>;
  return <div className="scene-controls">
    {s.mode !== 'quiz' && s.mode !== 'disease' && <>
      {presets}
      <div className="section-controls">{clipToggle}{clipAxis}{clipRange}{clipFlip}{explodeControl}</div>
      {s.clip.enabled && <p className="section-status"><span>{t('retainedSide')}: {retainedSide}</span><span>{t(flatLayout ? 'flatSectionHint' : 'sectionLocked')}</span></p>}
      {opticalHint}<div className="scene-history">{undo}{opticalLink}</div>
    </>}{views}
  </div>;
}

type PanelTab = 'structures' | 'parameters' | 'explanation';
type PanelSize = 'collapsed' | 'half' | 'full';
const panelTabs: Record<Mode, PanelTab[]> = {
  explore: ['structures', 'parameters', 'explanation'], optics: ['parameters', 'explanation'],
  tour: ['structures', 'parameters', 'explanation'], quiz: ['parameters', 'explanation'], disease: ['structures', 'explanation'],
};
const defaultPanelTab: Record<Mode, PanelTab> = { explore: 'structures', optics: 'parameters', tour: 'explanation', quiz: 'explanation', disease: 'explanation' };

function MobilePanel({ engine, size, onSize }: { engine: EngineRef; size: PanelSize; onSize: (size: PanelSize) => void }) {
  const s = useEye(); const t = useText();
  const [tabState, setTab] = useState<{ mode: Mode; tab: PanelTab }>({ mode: s.mode, tab: defaultPanelTab[s.mode] });
  const tab = tabState.mode === s.mode ? tabState.tab : defaultPanelTab[s.mode];
  const tabs = panelTabs[s.mode];
  const returnButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const contentKey = [s.mode, tab, s.step, s.quiz?.index, s.disease?.id, s.disease?.step].join(':');
  const previousContent = useRef({ mode: s.mode, key: contentKey });
  useEffect(() => {
    if (previousContent.current.mode === s.mode && previousContent.current.key !== contentKey) panel.current?.scrollIntoView({ block: 'start' });
    previousContent.current = { mode: s.mode, key: contentKey };
  }, [s.mode, contentKey]);
  useEffect(() => {
    if (s.mode === 'disease') setTab({ mode: 'disease', tab: 'explanation' });
  }, [s.mode, s.disease?.id, s.disease?.step]);
  const resize = (next: PanelSize) => {
    onSize(next);
    if (next === 'full') requestAnimationFrame(() => { returnButton.current?.focus({ preventScroll: true }); panel.current?.scrollIntoView({ block: 'start' }); });
  };
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (!event.defaultPrevented && event.key === 'Escape' && size === 'full' && !document.querySelector('footer details[open]')) { event.preventDefault(); resize('half'); }
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [size]);
  const switchTab = (next: PanelTab) => setTab({ mode: s.mode, tab: next });
  return <aside ref={panel} className={`mobile-panel panel-${size}`} aria-label={t('workspacePanel')}>
    <div className="panel-toolbar"><h2>{t(s.mode)}</h2>{size === 'full'
      ? <button ref={returnButton} onClick={() => resize('half')}>{t('returnModel')} ↑</button>
      : <div className="panel-sizes" role="group" aria-label={t('panelSize')}>
        <button aria-pressed={size === 'collapsed'} onClick={() => resize('collapsed')}>{t('panelCollapsed')}</button>
        <button aria-pressed={size === 'half'} onClick={() => resize('half')}>{t('panelHalf')}</button>
        <button onClick={() => resize('full')}>{t('panelFull')}</button>
      </div>}</div>
      <div hidden={size === 'collapsed'} className="panel-tabs" role="tablist" aria-label={t('workspacePanel')}>{tabs.map(item => <button key={item} id={`tab-${item}`} role="tab" aria-selected={tab === item} aria-controls={`panel-${item}`} tabIndex={tab === item ? 0 : -1} onClick={() => switchTab(item)} onKeyDown={event => {
        const index = tabs.indexOf(item);
        const next = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs[tabs.length - 1] : event.key === 'ArrowRight' ? tabs[(index + 1) % tabs.length] : event.key === 'ArrowLeft' ? tabs[(index + tabs.length - 1) % tabs.length] : null;
        if (next) { event.preventDefault(); switchTab(next); document.getElementById(`tab-${next}`)?.focus(); }
      }}>{t(s.mode === 'disease' ? item === 'structures' ? 'diseaseTopics' : 'diseaseExplanation' : item)}</button>)}</div>
      <div className="panel-body" hidden={size === 'collapsed'}>
        {tabs.includes('structures') && <div id="panel-structures" role="tabpanel" aria-labelledby="tab-structures" hidden={tab !== 'structures'} tabIndex={0}>{s.mode === 'disease' ? <DiseaseNavigation engine={engine}/> : <StructuresPanel engine={engine}/>}</div>}
        {tabs.includes('parameters') && <div id="panel-parameters" role="tabpanel" aria-labelledby="tab-parameters" hidden={tab !== 'parameters'} tabIndex={0}>{s.mode === 'optics' && <><OpticsControls engine={engine}/><OpticsPanel/></>}<SceneControls engine={engine}/></div>}
        <div id="panel-explanation" role="tabpanel" aria-labelledby="tab-explanation" hidden={tab !== 'explanation'} tabIndex={0}>{s.mode === 'explore' ? <Details engine={engine}/> : s.mode === 'optics' ? <OpticsPanel/> : s.mode === 'tour' ? <><details className="tour-picker"><summary>{t('backTours')}</summary><TourList/></details><TourStepPanel engine={engine}/></> : s.mode === 'disease' ? <><DiseasePanel engine={engine}/><SceneControls engine={engine}/></> : <PracticePanel engine={engine}/>}</div>
      </div>
    {(s.mode === 'tour' || s.mode === 'quiz' || s.mode === 'disease') && <div className="panel-actions"><ModeActions engine={engine}/></div>}
  </aside>;
}

export default function App() {
  const s = useEye(); const t = useText(); const engine = useRef<EyeEngine | null>(null); const referenceEngine = useRef<EyeEngine | null>(null);
  const reduced = useReducedMotion();
  useEffect(() => { if (reduced) eyeStore.getState().pausePhysiology(); }, [reduced]);
  useEffect(() => {
    if (!s.physiology?.playing || reduced) return;
    const playing = s.physiology;
    const timer = window.setTimeout(() => {
      const current = eyeStore.getState();
      if (current.physiology === playing && current.mode === s.mode) editScene(engine.current, current.advancePhysiology);
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [s.mode, s.physiology?.kind, s.physiology?.step, s.physiology?.playing, reduced]);
  const [narrow, setNarrow] = useState(() => window.matchMedia('(width < 900px)').matches);
  const [panelSize, setPanelSize] = useState<PanelSize>('half');
  const [activeModelMode, setActiveModelMode] = useState<Mode | null>(null);
  const modelInteraction = narrow && panelSize !== 'full' && activeModelMode === s.mode;
  const modelSection = useRef<HTMLElement>(null), modelToggle = useRef<HTMLButtonElement>(null);
  useEffect(() => { setActiveModelMode(null); }, [narrow, s.mode, s.disease?.id]);
  const changePanelSize = (next: PanelSize) => {
    setPanelSize(next);
    setActiveModelMode(null);
    if (panelSize === 'full' && next !== 'full') requestAnimationFrame(() => {
      modelToggle.current?.focus({ preventScroll: true }); modelSection.current?.scrollIntoView({ block: 'start' });
    });
  };
  const binocular = s.mode === 'disease' && (s.disease?.id === 'strabismus' || s.disease?.id === 'amblyopia');
  const comparing = !!s.comparison || s.mode === 'disease' && s.diseaseComparison;
  const splitComparison = !narrow && (!!s.comparison || s.mode === 'disease' && s.diseaseComparison && !binocular);
  const nav = useRef<HTMLElement>(null);
  const about = useRef<HTMLDetailsElement>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  useEffect(() => {
    const save = () => eyeStore.getState().flushProgress(engine.current?.captureCamera());
    window.addEventListener('pagehide', save);
    const hidden = () => { if (document.visibilityState === 'hidden') save(); };
    document.addEventListener('visibilitychange', hidden);
    return () => { window.removeEventListener('pagehide', save); document.removeEventListener('visibilitychange', hidden); };
  }, []);
  useEffect(() => {
    const media = window.matchMedia('(width < 900px)');
    const update = () => setNarrow(media.matches);
    media.addEventListener('change', update); update();
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => { document.documentElement.lang = s.lang === 'zh' ? 'zh-CN' : 'en'; document.title = `eyesight · ${t(binocular ? 'bothEyes' : 'rightEye')}`; }, [s.lang, binocular]);
  useEffect(() => {
    const bar = nav.current, active = bar?.querySelector<HTMLElement>('[aria-current]');
    if (!bar || !active) return;
    const item = active.getBoundingClientRect(), viewport = bar.getBoundingClientRect();
    if (item.left < viewport.left) bar.scrollLeft += item.left - viewport.left;
    else if (item.right > viewport.right) bar.scrollLeft += item.right - viewport.right;
  }, [s.mode, s.lang, narrow]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const open = document.querySelector<HTMLDetailsElement>('footer details[open]');
      if (open) { event.preventDefault(); open.open = false; open.querySelector('summary')?.focus(); }
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, []);
  return <div className={`app ${narrow ? 'narrow' : ''}`}><header className="header"><a className="brand" href="#" onClick={e => { e.preventDefault(); s.setMode('explore', engine.current?.captureCamera()); }} aria-label="eyesight"><span className="brand-icon"><EyeIcon small/></span><b>eyesight</b><span className="brand-tagline">{t('tagline')}</span></a><nav ref={nav} aria-label={t('workspaces')}>{(['explore','optics','tour','quiz','disease'] as Mode[]).map(mode => <button key={mode} className={s.mode === mode ? 'active' : ''} aria-current={s.mode === mode ? 'page' : undefined} onClick={() => s.setMode(mode, engine.current?.captureCamera())}>{t(mode)}</button>)}</nav><div className="language-switch" role="group" aria-label="Language / 语言"><button lang="zh-CN" aria-pressed={s.lang === 'zh'} onClick={() => s.setLanguage('zh')}>中</button><span aria-hidden="true">/</span><button lang="en" aria-pressed={s.lang === 'en'} onClick={() => s.setLanguage('en')}>EN</button></div></header>
    {s.storageNotice && <div className="storage-notice" role="status"><p>{t(s.storageNotice === 'unavailable' ? 'storageUnavailable' : 'storageRecovered')}</p><button onClick={s.dismissStorageNotice}>{t('dismissNotice')}</button></div>}
    <main className={`workspace mode-${s.mode}`}>
      <section ref={modelSection} className={modelInteraction ? "scene-column model-interaction-active" : "scene-column"} hidden={narrow && panelSize === 'full'}><div className="scene-heading"><div><span className="eyebrow">{binocular ? 'OD · OS' : 'OCULUS DEXTER · OD'}</span><h1>{t(binocular ? 'bothEyes' : 'rightEye')}<span>{t('schematic')}</span></h1></div><div className="scene-actions">{s.mode !== 'quiz' && <button className={s.labels ? 'active' : ''} aria-pressed={s.labels} onClick={() => editScene(engine.current, () => s.setLabels(!s.labels))}>{t('labels')}</button>}<button onClick={s.resetCamera}>{t('resetCamera')}</button>{s.mode !== 'disease' && <button title={t('resetSceneHint')} onClick={() => editScene(engine.current, s.resetScene)}>{t('reset')}</button>}</div></div>{s.mode === 'disease' && <DiseaseStatus/>}<ComparisonSummary narrow={narrow}/>{narrow && <div className="mobile-model-controls"><button ref={modelToggle} aria-pressed={modelInteraction} aria-describedby="model-touch-hint" onClick={() => setActiveModelMode(modelInteraction ? null : s.mode)}>{t(modelInteraction ? 'stopModelInteraction' : 'interactModel')}</button><p id="model-touch-hint" role="status">{t(modelInteraction ? 'modelTouchHint' : 'scrollPageHint')}</p></div>}<div className="stage"><div className="stage-grid"/><div className={`model-views ${splitComparison ? 'comparison-split' : ''}`}><div className="model-view" data-comparison={comparing ? s.mode === 'disease' ? s.diseaseNormal ? 'reference' : 'current' : narrow ? s.comparison!.showing : 'current' : undefined}><Viewport engine={engine} peer={referenceEngine} narrow={narrow} interactionEnabled={!narrow || modelInteraction}/>{comparing && <span className="model-view-label" data-viewport-overlay>{t(s.mode === 'disease' ? s.diseaseNormal || s.disease?.step === 0 ? 'referenceView' : 'currentView' : narrow && s.comparison?.showing === 'reference' ? 'referenceView' : 'currentView')}</span>}</div>{splitComparison && <div className="model-view reference-model" data-comparison="reference"><Viewport engine={referenceEngine} peer={engine} reference/><span className="model-view-label" data-viewport-overlay>{t('referenceView')}</span></div>}</div></div><div className="observation-actions">{s.practiceObservation && <button onClick={s.continuePractice}>{t('continuePractice')}</button>}{s.revealPreset && <span role="status">{t(s.revealPreset)} <button onClick={() => editScene(engine.current, s.undoReveal)}>{t('undoReveal')}</button></span>}{s.focusReturn && <button onClick={s.returnFocus}>{t('returnFocus')}</button>}</div>{!narrow && <SceneControls engine={engine}/>}</section>
      {narrow ? <MobilePanel engine={engine} size={panelSize} onSize={changePanelSize}/> : <>
        <aside className="left-panel">{s.mode === 'explore' ? <StructuresPanel engine={engine}/> : s.mode === 'tour' ? <TourList/> : s.mode === 'optics' ? <OpticsControls engine={engine}/> : s.mode === 'disease' ? <DiseaseNavigation engine={engine}/> : <div className="mode-content"><span className="eyebrow">{t('quiz')}</span><h2>{s.quiz?.context === 'structures' ? t('quizPanel') : LESSONS.find(lesson => lesson.id === s.quiz?.context)?.title[s.lang]}</h2><p>{s.quiz?.context === 'structures' ? t('quizHint') : LEARNING_TEXT.optional[s.lang]}</p><div className="sidebar-illustration"><EyeIcon/></div><p className="micro">{t('score')} · {s.quiz ? sessionScore(s.quiz) : 0} / {(s.quiz?.order.length ?? 6)}</p></div>}</aside>
        <aside className="right-panel"><div className="desktop-panel-body">{s.mode === 'explore' ? <Details engine={engine}/> : s.mode === 'optics' ? <OpticsPanel/> : s.mode === 'tour' ? <TourStepPanel engine={engine}/> : s.mode === 'disease' ? <DiseasePanel engine={engine}/> : <PracticePanel engine={engine}/>}</div>{(s.mode === 'tour' || s.mode === 'quiz' || s.mode === 'disease') && <div className="panel-actions"><ModeActions engine={engine}/></div>}</aside>
      </>}
    </main><footer><span><i/>{t('anatomyCount')}</span><details ref={about}><summary>{t('info')} ↗</summary><div><p>{t('modelNote')}</p><p>{t('opticsNote')}</p></div></details><details className="local-progress"><summary>{t('localProgress')}</summary><div>{confirmClear ? <><button onClick={() => { s.clearLocalProgress(); setConfirmClear(false); }}>{t('confirmClearProgress')}</button><button onClick={() => setConfirmClear(false)}>{t('cancel')}</button></> : <button onClick={() => setConfirmClear(true)}>{t('clearProgress')}</button>}</div></details><span className="footer-version">eyesight / 0.1</span></footer>
  </div>;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { finishStartup(); }
  render() { return this.state.failed ? <div className="fatal-error"><h1>eyesight</h1><p>{messages.loadError.zh} / {messages.loadError.en}</p><button onClick={() => location.reload()}>{messages.reload.zh} / {messages.reload.en}</button></div> : this.props.children; }
}
