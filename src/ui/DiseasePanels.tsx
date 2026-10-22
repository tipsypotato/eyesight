import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { useStore } from 'zustand';
import { STRUCTURES } from '../anatomy/data';
import type { Lang, Localized, StructureId } from '../anatomy/types';
import { DISEASES, DISEASE_STEPS, DISEASE_TEXT as T } from '../content/diseases';
import { messages } from '../content/messages';
import type { EyeEngine } from '../engine/EyeEngine';
import { opticsInputForPreset, traceOptics } from '../engine/optics';
import { AMBLYOPIA_CASES, DISEASE_IDS, type DiseaseDraft, type DiseaseStep } from '../modes/disease';
import { eyeStore } from '../state/store';
import { PracticeActions, PracticePanel } from './LearningPanels';
import './disease.css';

type EngineRef = RefObject<EyeEngine | null>;
type Chapter<K extends DiseaseDraft['id']> = Extract<DiseaseDraft, { id: K }>;
function Choices<V extends string>({ label, value, items, onChange }: { label: string; value: V; items: { value: V; label: string }[]; onChange: (value: V) => void }) {
  return <div className="disease-control"><span className="disease-control-label">{label}</span><div className="disease-choices" role="group" aria-label={label}>{items.map(item => <button key={item.value} aria-pressed={value === item.value} onClick={() => onChange(item.value)}>{item.label}</button>)}</div></div>;
}

export function DiseaseNavigation({ engine }: { engine: EngineRef }) {
  const s = useStore(eyeStore); const d = s.disease;
  return <nav className="disease-navigation" aria-label={T.chapters[s.lang]}>
    <h2>{T.chapters[s.lang]}</h2><p className="micro">{T.optional[s.lang]}</p>
    <div className="disease-chapters">{DISEASE_IDS.map(id => { const chapter = DISEASES[id]; return <button key={id} aria-current={d?.id === id ? 'page' : undefined} onClick={() => s.openDisease(id, engine.current?.captureCamera())}>
      <strong>{chapter.name[s.lang]}</strong><span className="disease-tag">{chapter.tag[s.lang]}</span><span>{chapter.goal[s.lang]}</span>
    </button>; })}</div>
    {d && <ol className="disease-steps">{DISEASE_STEPS.map((step, index) => <li key={index}><button aria-current={d.step === index ? 'step' : undefined} onClick={() => s.setDiseaseStep(index as DiseaseStep, engine.current?.captureCamera())}><span>{index + 1}</span>{step[s.lang]}</button></li>)}</ol>}
  </nav>;
}

export function DiseaseStatus() {
  const s = useStore(eyeStore); const d = s.disease;
  if (!d) return null;
  return <div className="disease-status" role="status"><strong>{DISEASES[d.id].name[s.lang]}</strong><span>{T[d.id === 'strabismus' || d.id === 'amblyopia' ? 'both' : 'right'][s.lang]}</span><span>{T[s.diseaseNormal || d.step === 0 ? 'normal' : 'variation'][s.lang]}</span></div>;
}

function StructureDetails({ id, lang, close }: { id: StructureId; lang: Lang; close: () => void }) {
  const titleId = useId(); const panel = useRef<HTMLDivElement>(null);
  const item = STRUCTURES.find(structure => structure.id === id)!;
  useEffect(() => { const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null; panel.current?.focus(); return () => { trigger?.focus(); }; }, []);
  return <div className="disease-structure-details" role="dialog" aria-labelledby={titleId} tabIndex={-1} ref={panel} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}>
    <h3 id={titleId}>{item.name[lang]}</h3><p>{item.position[lang]}</p><p>{item.function[lang]}</p><p className="micro">{item.fact[lang]}</p>
    <div className="sources">{item.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>)}</div>
    <button onClick={close}>{T.close[lang]}</button>
  </div>;
}

function CataractImage({ intensity, preview, lang }: { intensity: number; preview: Chapter<'cataract'>['preview']; lang: Lang }) {
  const halo = useId();
  // shortcut: contrast veil and halo are qualitative scatter illustrations, not a calibrated image-formation model.
  return <svg viewBox="0 0 240 130" role="img" aria-label={T[preview === 'test-chart' ? 'testChart' : 'glareScene'][lang]} data-clouding={intensity}>
    <defs><radialGradient id={halo}><stop stopColor="#fffbd7" stopOpacity={0.8 * intensity}/><stop offset=".3" stopColor="#fffbd7" stopOpacity={0.55 * intensity}/><stop offset="1" stopColor="#fffbd7" stopOpacity="0"/></radialGradient></defs>
    <rect width="240" height="130" rx="8" fill={preview === 'test-chart' ? '#fffdf6' : '#152b35'}/>
    {preview === 'test-chart' ? <g fill="#183a35" opacity={1 - 0.6 * intensity}><path d="M30 22h42v10H41v13h25v10H41v13h31v10H30Z"/><path d="M110 32h34v8h-25v11h21v8h-21v11h25v8h-34Z" transform="rotate(90 127 55)"/>{[0, 1, 2, 3, 4, 5, 6, 7].map(n => <rect key={n} x={25 + n * 25} y="98" width="10" height="15"/>)}</g> : <><path d="M0 115L90 75h60l90 40" fill="#38505b"/><circle cx="120" cy="51" r={18 + intensity * 62} fill={`url(#${halo})`}/><circle cx="120" cy="51" r="5" fill="#fffbe0"/><circle cx="120" cy="51" r={12 + intensity * 24} fill="none" stroke="#fff2b9" strokeWidth="2" opacity={intensity * 0.35}/></>}
    <rect width="240" height="130" rx="8" fill="#f6edd8" opacity={intensity * 0.25}/>
  </svg>;
}
export function CataractPreview({ draft, normal, comparison, lang }: { draft: Chapter<'cataract'>; normal: boolean; comparison: boolean; lang: Lang }) {
  return <figure className="disease-preview"><figcaption>{T.cataractPreview[lang]}</figcaption><div className={comparison ? 'disease-preview-pair' : ''}>
    {comparison && <div><span>{T.normal[lang]}</span><CataractImage intensity={0} preview={draft.preview} lang={lang}/></div>}
    <div><span>{T[normal && !comparison ? 'normal' : 'variation'][lang]}</span><CataractImage intensity={normal && !comparison ? 0 : draft.opacity} preview={draft.preview} lang={lang}/></div>
  </div><p className="micro">{T.cataractPreviewNote[lang]}</p></figure>;
}
function CataractControls({ draft: d, engine, normal, lang }: { draft: Chapter<'cataract'>; engine: EngineRef; normal: boolean; lang: Lang }) {
  const s = useStore(eyeStore);
  const locate = () => {
    const camera = engine.current?.captureCamera();
    if (camera) s.rememberCamera(camera);
    s.updateDisease({ view: 'lens-detail' });
  };
  const context = () => s.updateDisease({ view: 'context' });
  return <>
    <Choices label={messages.view[lang]} value={d.view} items={[{ value: 'context', label: T.contextView[lang] }, { value: 'lens-detail', label: T.lensDetail[lang] }]} onChange={view => view === 'lens-detail' ? locate() : context()}/>
    {d.step === 0 && <button onClick={locate}>{T.locateLens[lang]}</button>}
    {d.step > 0 && <div className="disease-control"><label htmlFor="disease-opacity">{T.opacity[lang]} <output>{d.opacity.toFixed(2)}</output></label><input id="disease-opacity" type="range" min="0" max="1" step="0.01" value={d.opacity} aria-describedby="disease-opacity-note" onChange={event => { s.setDiseaseNormal(false); s.updateDisease({ opacity: Number(event.target.value) }); }}/><p id="disease-opacity-note" className="micro">{T.opacityHint[lang]}</p></div>}
    {d.step === 2 && <><Choices label={T.cataractPreview[lang]} value={d.preview} items={[{ value: 'test-chart', label: T.testChart[lang] }, { value: 'glare-scene', label: T.glareScene[lang] }]} onChange={preview => s.updateDisease({ preview })}/><CataractPreview draft={d} normal={normal} comparison={s.diseaseComparison} lang={lang}/></>}
  </>;
}

export function VisualField({ defect, lang }: { defect: boolean; lang: Lang }) {
  const hatch = useId();
  return <figure className="disease-preview"><figcaption>{T.field[lang]}</figcaption><svg viewBox="0 0 260 175" role="img" aria-label={T[defect ? 'defect' : 'early'][lang]} data-field-defect={defect}>
    <defs><pattern id={hatch} width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 7L7 0" stroke="#926b2e" strokeWidth="2"/></pattern></defs>
    <ellipse cx="130" cy="85" rx="112" ry="69" fill="#edf2e8" stroke="#718366"/><path d="M130 19v132M20 85h220" stroke="#b7c2af" strokeDasharray="3 5"/>
    {defect && <path d="M60 47Q90 23 124 39L119 59Q90 53 76 69Z" fill={`url(#${hatch})`} stroke="#926b2e"/>}
    <path d="M124 85h12M130 79v12" stroke="#243c37" strokeWidth="2"/><text x="138" y="105" fontSize="11" fill="#243c37">{T.fixation[lang]}</text>
    {defect && <text x="30" y="165" fontSize="11" fill="#6a511e">{T.fieldDefect[lang]}</text>}
  </svg><p className="micro">{T.fieldNote[lang]}</p></figure>;
}
function GlaucomaControls({ draft: d, normal, lang }: { draft: Chapter<'glaucoma'>; normal: boolean; lang: Lang }) {
  const s = useStore(eyeStore);
  const scenario = normal ? 'normal' : d.scenario;
  const damaged = scenario === 'established-damage' || scenario === 'normal-tension';
  const restricted = scenario === 'outflow-risk' || scenario === 'established-damage';
  return <>
    <Choices label={messages.view[lang]} value={d.view} items={[{ value: 'outflow', label: T.outflow[lang] }, { value: 'nerve', label: T.nerve[lang] }]} onChange={view => s.updateDisease({ view })}/>
    {d.step > 0 && <Choices label={T.scenario[lang]} value={d.scenario} items={([{ value: 'normal', label: T.scenarioNormal[lang] }, { value: 'outflow-risk', label: T.scenarioRisk[lang] }, { value: 'established-damage', label: T.scenarioDamage[lang] }, { value: 'normal-tension', label: T.scenarioTension[lang] }] as const).map(item => item)} onChange={scenario => { s.setDiseaseNormal(false); s.updateDisease({ scenario }); }}/>}
    {d.view === 'outflow' && <div className="disease-flow"><h3>{T.flow[lang]}</h3><p className="disease-route">{T.flowRoute[lang]}</p><p className="micro">{T.flowNote[lang]}</p><button aria-pressed={d.flowPlaying} onClick={() => s.updateDisease({ flowPlaying: !d.flowPlaying })}>{messages[d.flowPlaying ? 'pause' : 'play'][lang]}</button></div>}
    {scenario === 'outflow-risk' && <p>{T.riskOnly[lang]}</p>}
    {scenario === 'normal-tension' && <p>{T.normalTension[lang]}</p>}
    {restricted && <><button aria-pressed={d.outflowRelieved} onClick={() => s.updateDisease({ outflowRelieved: !d.outflowRelieved })}>{T[d.outflowRelieved ? 'relieved' : 'relieve'][lang]}</button>{damaged && <p className="disease-key-point">{T.damagePersists[lang]}</p>}</>}
    {d.view === 'nerve' && <p className="micro">{T.structureNote[lang]}</p>}
    {d.step === 2 && <>
      <p>{T.early[lang]}</p>
      {damaged && <Choices label={T.field[lang]} value={d.visualField} items={[{ value: 'early', label: T.early[lang] }, { value: 'defect', label: T.defect[lang] }]} onChange={visualField => s.updateDisease({ visualField })}/>}
      <VisualField defect={damaged && d.visualField === 'defect'} lang={lang}/>
    </>}
  </>;
}

function StrabismusExplanation({ draft: d, normal, lang }: { draft: Chapter<'strabismus'>; normal: boolean; lang: Lang }) {
  const mode = normal || d.deviationDeg === 0 ? 'alignment-only' : d.visualExplanation;
  return <div className="disease-key-point"><p>{T[mode === 'alignment-only' ? 'alignmentBody' : mode === 'adult-diplopia' ? 'diplopiaBody' : 'suppressionBody'][lang]}</p>
    {mode === 'adult-diplopia' && <svg viewBox="0 0 240 90" role="img" aria-label={T.adultDiplopia[lang]}><g fill="none" strokeWidth="3"><path d="M70 22v40M50 42h40" stroke="#287b70"/><path d="M155 22v40M135 42h40" stroke="#865b94"/></g></svg>}
    {mode === 'child-suppression' && <div className="disease-suppression"><span>{T.right[lang]} {d.affectedEye === 'right' ? '⇢' : '→'}</span><span>{T.processing[lang]}</span><span>{T.left[lang]} {d.affectedEye === 'left' ? '⇢' : '→'}</span><p className="micro">{T.neuralLegend[lang]}</p></div>}
  </div>;
}
function StrabismusControls({ draft: d, normal, lang, engine }: { draft: Chapter<'strabismus'>; normal: boolean; lang: Lang; engine: EngineRef }) {
  const s = useStore(eyeStore);
  return <>
    <Choices label={T.target[lang]} value={d.targetDistance} items={[{ value: 'far', label: T.far[lang] }, { value: 'near', label: T.near[lang] }]} onChange={targetDistance => s.updateDisease({ targetDistance })}/>
    <p className="micro">{T.convergenceNote[lang]}</p>
    <label className="check"><input type="checkbox" checked={d.showAxes} onChange={event => s.updateDisease({ showAxes: event.target.checked })}/>{T.showAxes[lang]}</label>
    <Choices label={T.selectEye[lang]} value={s.selectedEye} items={[{ value: 'right', label: T.right[lang] }, { value: 'left', label: T.left[lang] }]} onChange={side => s.selectEye(side, s.selectedId)}/>
    {d.step > 0 && <>
      <Choices label={T.alignment[lang]} value={d.alignment} items={[{ value: 'normal', label: T.aligned[lang] }, { value: 'esotropia', label: T.esotropia[lang] }, { value: 'exotropia', label: T.exotropia[lang] }, { value: 'custom', label: T.custom[lang] }]} onChange={alignment => { s.setDiseaseNormal(false); s.updateDisease({ alignment }); }}/>
      <Choices label={T.affectedEye[lang]} value={d.affectedEye} items={[{ value: 'right', label: T.right[lang] }, { value: 'left', label: T.left[lang] }]} onChange={affectedEye => s.updateDisease({ affectedEye })}/>
      <div className="disease-control"><label htmlFor="disease-deviation">{T.deviation[lang]} <output>{d.deviationDeg}°</output></label><input id="disease-deviation" type="range" min="-20" max="20" step="1" value={d.deviationDeg} aria-describedby="disease-deviation-note" onChange={event => { s.setDiseaseNormal(false); s.updateDisease({ deviationDeg: Number(event.target.value) }); }}/><p id="disease-deviation-note" className="micro">{T.deviationNote[lang]}</p></div>
    </>}
    {d.step === 2 && <><Choices label={T.visualContext[lang]} value={d.visualExplanation} items={[{ value: 'alignment-only', label: T.alignmentOnly[lang] }, { value: 'adult-diplopia', label: T.adultDiplopia[lang] }, { value: 'child-suppression', label: T.childSuppression[lang] }]} onChange={visualExplanation => { s.setDiseaseNormal(false); s.updateDisease({ visualExplanation }); }}/><StrabismusExplanation draft={d} normal={normal} lang={lang}/><button onClick={() => s.openDisease('amblyopia', engine.current?.captureCamera())}>{T.developmentalLink[lang]} →</button></>}
  </>;
}

export function AmblyopiaDiagram({ draft: d, normal, lang }: { draft: Chapter<'amblyopia'>; normal: boolean; lang: Lang }) {
  const improved = normal || d.caseDrafts[d.causeCase].inputImproved;
  const blurId = useId();
  const optics = opticsInputForPreset(normal ? 'normal' : improved ? 'corrected' : 'myopia');
  const spread = traceOptics(optics).retinalSpread;
  // shortcut: reuse the existing qualitative retinal-spread display, not a visual-acuity calibration.
  const blur = d.causeCase === 'anisometropia' && !normal ? Math.min(6, (spread ?? 0) * 90) : 0;
  return <figure className="disease-development"><figcaption>{T.developmentNote[lang]}</figcaption>
    <div className="disease-inputs">{(['right', 'left'] as const).map(side => <div key={side}><strong>{T[side][lang]}</strong><svg viewBox="0 0 120 76" role="img" aria-label={`${T[side][lang]} · ${T[normal || side === 'left' ? 'normalInput' : !improved ? 'inputBaseline' : 'inputImproved'][lang]}`} data-input={side === 'right' && !normal ? improved ? 'improved' : d.causeCase : 'reference'} data-axial-increment={d.causeCase === 'anisometropia' && side === 'right' && !normal ? optics.axialIncrement : 0}>
      <defs><filter id={`${blurId}-${side}`}><feGaussianBlur stdDeviation={side === 'right' ? blur : 0}/></filter></defs><rect width="120" height="76" rx="8" fill="#fffdf5"/>
      <g filter={`url(#${blurId}-${side})`} transform={side === 'right' && !improved && d.causeCase === 'strabismic' ? 'translate(22 0)' : undefined} stroke="#285f59" strokeWidth="5"><path d="M60 17v40M40 37h40"/></g>
      {side === 'right' && !improved && d.causeCase === 'deprivation' && <rect width="120" height="76" rx="8" fill="#e8e0ce" opacity=".7"/>}
    </svg></div>)}</div>
    <svg viewBox="0 0 260 55" className="disease-neural-path" aria-hidden="true"><path d="M60 0Q60 24 130 40M200 0Q200 24 130 40" fill="none" stroke="#865b94" strokeWidth="3" strokeDasharray="5 5"/><path d="M124 35l6 12 6-12" fill="#865b94"/></svg>
    <div className="disease-processing" data-development-outcome={normal ? 'reference' : 'retained'}><strong>{T.processing[lang]}</strong><p>{T[normal ? 'normalInput' : 'developmentResult'][lang]}</p>{!normal && <p>{T.outcomeBody[lang]}</p>}</div>
    <p className="micro">{T.neuralLegend[lang]}</p><p className="micro">{T.amblyopiaLimit[lang]}</p>
  </figure>;
}
function AmblyopiaControls({ draft: d, normal, lang }: { draft: Chapter<'amblyopia'>; normal: boolean; lang: Lang }) {
  const s = useStore(eyeStore); const current = d.caseDrafts[d.causeCase];
  const updateCase = (patch: Partial<typeof current>) => s.updateDisease({ caseDrafts: { ...d.caseDrafts, [d.causeCase]: { ...current, ...patch } } });
  const cardText: Localized[] = [T[`${d.causeCase}Body`], T.inputBody, T.outcomeBody];
  return <>
    {d.step > 0 && <>
      <Choices label={T.cause[lang]} value={d.causeCase} items={AMBLYOPIA_CASES.map(value => ({ value, label: T[value][lang] }))} onChange={causeCase => { s.setDiseaseNormal(false); s.updateDisease({ causeCase }); }}/>
      <div className="disease-mechanism-cards" role="group" aria-label={DISEASE_STEPS[1][lang]}>{[T.mechanismCause, T.mechanismInput, T.mechanismOutcome].map((card, index) => <button key={index} aria-pressed={current.card === index} onClick={() => updateCase({ card: index as 0 | 1 | 2 })}>{index + 1}. {card[lang]}</button>)}</div>
      <p className="disease-key-point">{cardText[current.card][lang]}</p>
      {d.step === 2 && <label className="check"><input type="checkbox" checked={current.inputImproved} onChange={event => { s.setDiseaseNormal(false); updateCase({ inputImproved: event.target.checked }); }}/>{T[d.causeCase === 'anisometropia' ? 'improveOptics' : d.causeCase === 'strabismic' ? 'improveAlignment' : 'improveDeprivation'][lang]}</label>}
    </>}
    <AmblyopiaDiagram draft={d} normal={normal} lang={lang}/>
  </>;
}

export function DiseasePanel({ engine }: { engine: EngineRef }) {
  const s = useStore(eyeStore); const d = s.disease; const [structure, setStructure] = useState<StructureId | null>(null);
  useEffect(() => setStructure(null), [d?.id, d?.step]);
  if (!d) return null;
  const lang = s.lang, content = DISEASES[d.id], step = content.steps[d.step], normal = s.diseaseNormal || d.step === 0;
  return <div className="disease-panel">
    {d.step === 3 ? <PracticePanel engine={engine} onInspect={setStructure}/> : <div className="mode-content">
      <span className="eyebrow">{content.name[lang]} · {DISEASE_STEPS[d.step][lang]}</span><h2>{step.question[lang]}</h2><p>{step.body[lang]}</p>
      <Choices label={T.compare[lang]} value={normal ? 'normal' : 'variation'} items={[{ value: 'normal', label: T.normal[lang] }, { value: 'variation', label: T.variation[lang] }]} onChange={value => s.setDiseaseNormal(value === 'normal')}/>
      {d.step > 0 && <label className="check"><input type="checkbox" checked={s.diseaseComparison} onChange={event => s.setDiseaseComparison(event.target.checked)}/>{T.compare[lang]}</label>}
      {s.diseaseComparison && <p className="micro">{T.compareHint[lang]}</p>}
      {d.id === 'cataract' && <CataractControls draft={d} engine={engine} normal={normal} lang={lang}/>}
      {d.id === 'glaucoma' && <GlaucomaControls draft={d} normal={normal} lang={lang}/>}
      {d.id === 'strabismus' && <StrabismusControls draft={d} normal={normal} lang={lang} engine={engine}/>}
      {d.id === 'amblyopia' && <AmblyopiaControls draft={d} normal={normal} lang={lang}/>}
      <div className="disease-related"><h3>{T.related[lang]}</h3>{content.related.map(id => <button key={id} onClick={() => setStructure(id)}>{STRUCTURES.find(item => item.id === id)!.name[lang]}</button>)}</div>
      <details className="sources disease-sources"><summary>{T.sources[lang]}</summary>{content.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>)}<p className="micro">{T.pending[lang]} · {T[content.translationStatus === 'draft' ? 'translationDraft' : 'translationChecked'][lang]}</p></details>
    </div>}
    {structure && <StructureDetails key={structure} id={structure} lang={lang} close={() => setStructure(null)}/>}
  </div>;
}

export function DiseaseActions({ engine }: { engine: EngineRef }) {
  const s = useStore(eyeStore); const d = s.disease; if (!d) return null;
  return <div className="disease-actions">
    {d.step === 3 && <PracticeActions engine={engine}/>}
    <div className="disease-step-actions">{d.step > 0 && <button onClick={() => s.setDiseaseStep((d.step - 1) as DiseaseStep, engine.current?.captureCamera())}>← {messages.previous[s.lang]}</button>}{d.step < 3 && <button className="primary" onClick={() => s.setDiseaseStep((d.step + 1) as DiseaseStep, engine.current?.captureCamera())}>{DISEASE_STEPS[d.step + 1][s.lang]} →</button>}</div>
    <div className="disease-return-actions"><button onClick={s.resetDisease}>{T.reset[s.lang]}</button><button onClick={() => s.leaveDisease(engine.current?.captureCamera())}>{T.leave[s.lang]}</button></div><p className="micro">{T.resetNote[s.lang]}</p>
  </div>;
}
