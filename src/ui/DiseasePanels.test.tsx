import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DISEASES, DISEASE_STEPS, DISEASE_TEXT as T } from '../content/diseases';
import { currentQuestion } from '../modes/quiz';
import { createDiseaseDraft, DISEASE_IDS, type DiseaseDraft, type DiseaseStep } from '../modes/disease';
import { createEyeStore, eyeStore } from '../state/store';
import { AmblyopiaDiagram, CataractPreview, DiseaseActions, DiseaseNavigation, DiseasePanel, DiseaseStatus, VisualField } from './DiseasePanels';

let store: ReturnType<typeof createEyeStore>;
const engine = { current: null };
const escaped = (value: string) => renderToStaticMarkup(<span>{value}</span>).slice(6, -7);
beforeEach(() => {
  store = createEyeStore();
  vi.spyOn(eyeStore, 'getInitialState').mockImplementation(() => store.getState());
});
afterEach(() => vi.restoreAllMocks());
function render() { return renderToStaticMarkup(<><DiseaseNavigation engine={engine}/><DiseaseStatus/><DiseasePanel engine={engine}/><DiseaseActions engine={engine}/></>); }

describe('optional disease explanation workspace', () => {
  for (const lang of ['zh', 'en'] as const) for (const id of DISEASE_IDS) {
    it(`${id} has complete reachable sections in ${lang} without a question prerequisite`, () => {
      store.getState().setLanguage(lang); store.getState().openDisease(id);
      for (const step of [0, 2, 1, 3] as DiseaseStep[]) {
        store.getState().setDiseaseStep(step);
        const html = render();
        for (const chapter of DISEASE_IDS) expect(html).toContain(escaped(DISEASES[chapter].name[lang]));
        DISEASE_STEPS.forEach(section => expect(html).toContain(escaped(section[lang])));
        expect(html).toContain('aria-current="step"');
        expect(html).toContain(escaped(T.leave[lang]));
        expect(html).not.toMatch(/<button[^>]*><\/button>/);
        expect(store.getState().disease?.step).toBe(step);
      }
      expect(Object.keys(store.getState().quiz!.answers)).toHaveLength(0);
    });
  }
  it('offers actual normal/variation switching on the initial section and preserves saved intensity', () => {
    store.getState().openDisease('cataract');
    store.getState().updateDisease({ opacity: .81 });
    let html = renderToStaticMarkup(<DiseasePanel engine={engine}/>);
    expect(html).toContain(escaped(T.variation.zh)); expect(html).not.toContain('disabled=""');
    store.getState().setDiseaseNormal(false);
    expect(store.getState().disease?.step).toBe(1);
    expect(store.getState().diseaseNormal).toBe(false);
    store.getState().setDiseaseNormal(true);
    expect((store.getState().disease as Extract<DiseaseDraft, {id:'cataract'}>).opacity).toBe(.81);
    html = renderToStaticMarkup(<DiseasePanel engine={engine}/>);
    expect(html).toContain('value="0.81"');
  });
  it('keeps disease questions in their chapter and withholds answer feedback until submission', () => {
    store.getState().openDisease('glaucoma'); store.getState().setDiseaseStep(3);
    const quiz = store.getState().quiz!; const question = currentQuestion(quiz)!;
    let html = renderToStaticMarkup(<DiseasePanel engine={engine}/>);
    expect(html).toContain(escaped(question.prompt.zh));
    expect(html).not.toContain('practice-topic'); expect(html).not.toContain('回到本组讲解');
    expect(html).not.toContain('disease-related'); expect(html).not.toContain('answer-feedback');
    for (const option of question.options) expect(html).not.toContain(escaped(option.feedback.zh));
    store.getState().answerQuiz(question.correctOptionId);
    html = renderToStaticMarkup(<DiseasePanel engine={engine}/>);
    expect(html).toContain('answer-feedback'); expect(html).toContain('practice-sources'); expect(html).toContain('回到结构查看');
    expect(store.getState().mode).toBe('disease'); expect(store.getState().disease?.id).toBe('glaucoma');
    expect(renderToStaticMarkup(<DiseaseActions engine={engine}/>)).not.toContain('回到本组讲解');
  });
  it('keeps early-symptom wording and damage after flow relief without drawing a defect for risk only', () => {
    store.getState().openDisease('glaucoma'); store.getState().setDiseaseStep(2);
    store.getState().updateDisease({ scenario: 'established-damage', visualField: 'defect', outflowRelieved: true });
    let html = renderToStaticMarkup(<DiseasePanel engine={engine}/>);
    expect(html).toContain(escaped(T.damagePersists.zh)); expect(html).toContain(escaped(T.early.zh)); expect(html).toContain('data-field-defect="true"');
    store.getState().updateDisease({ scenario: 'outflow-risk' });
    html = renderToStaticMarkup(<DiseasePanel engine={engine}/>);
    expect(html).toContain('data-field-defect="false"'); expect(html).toContain(escaped(T.riskOnly.zh));
  });
});

describe('separate mechanism illustrations', () => {
  it('uses shared chart conditions but independent normal and clouded transmission displays', () => {
    const draft = createDiseaseDraft('cataract') as Extract<DiseaseDraft, {id:'cataract'}>;
    const html = renderToStaticMarkup(<CataractPreview draft={draft} normal={false} comparison lang="en"/>);
    expect(html.match(/data-clouding="0"/g)).toHaveLength(1); expect(html.match(/data-clouding="0.55"/g)).toHaveLength(1);
    expect(html).not.toContain('feGaussianBlur'); expect(html).toContain(escaped(T.cataractPreviewNote.en));
  });
  it('assigns the possible suppression path to the selected deviating eye', () => {
    store.getState().setLanguage('en'); store.getState().openDisease('strabismus'); store.getState().setDiseaseStep(2);
    store.getState().updateDisease({ alignment: 'esotropia', visualExplanation: 'child-suppression' });
    for (const affectedEye of ['right', 'left'] as const) {
      store.getState().updateDisease({ affectedEye });
      const html = renderToStaticMarkup(<DiseasePanel engine={engine}/>);
      expect(html).toContain(`${T[affectedEye].en} ⇢</span>`);
      expect(html).toContain(`${T[affectedEye === 'right' ? 'left' : 'right'].en} →</span>`);
    }
  });
  it('names the left input as the normal reference before and after improving the right input', () => {
    const draft = createDiseaseDraft('amblyopia') as Extract<DiseaseDraft, {id:'amblyopia'}>;
    for (const inputImproved of [false, true]) {
      draft.caseDrafts.anisometropia.inputImproved = inputImproved;
      const html = renderToStaticMarkup(<AmblyopiaDiagram draft={draft} normal={false} lang="en"/>);
      expect(html).toContain(`aria-label="${T.left.en} · ${T.normalInput.en}"`);
      expect(html).not.toContain(`aria-label="${T.left.en} · ${T.inputImproved.en}"`);
      expect(html).toContain(`aria-label="${T.right.en} · ${T[inputImproved ? 'inputImproved' : 'inputBaseline'].en}"`);
    }
  });
  it('shows one localized field example, explicitly separated from subjective visual experience', () => {
    const html = renderToStaticMarkup(<VisualField defect lang="en"/>);
    expect(html).toContain('<pattern'); expect(html).toContain('data-field-defect="true"');
    expect(html).toContain(escaped(T.fieldNote.en)); expect(html).not.toContain('radialGradient');
  });
  it('retains developmental outcomes after all three cause-specific input improvements', () => {
    for (const causeCase of ['anisometropia', 'strabismic', 'deprivation'] as const) {
      const draft = createDiseaseDraft('amblyopia') as Extract<DiseaseDraft, {id:'amblyopia'}>;
      draft.causeCase = causeCase;
      const before = renderToStaticMarkup(<AmblyopiaDiagram draft={draft} normal={false} lang="en"/>);
      draft.caseDrafts[causeCase].inputImproved = true;
      const after = renderToStaticMarkup(<AmblyopiaDiagram draft={draft} normal={false} lang="en"/>);
      expect(before).toContain(`data-input="${causeCase}"`); expect(after).toContain('data-input="improved"');
      for (const html of [before, after]) { expect(html).toContain('data-development-outcome="retained"'); expect(html).toContain(escaped(T.outcomeBody.en)); }
      if (causeCase === 'anisometropia') {
        expect(before).toContain('data-axial-increment="1"'); expect(after).toContain('data-axial-increment="1"');
        const beforeBlur = Number(before.match(/stdDeviation="([^\"]+)"/)![1]), afterBlur = Number(after.match(/stdDeviation="([^\"]+)"/)![1]);
        expect(beforeBlur).toBeGreaterThan(afterBlur);
      }
    }
  });
  it('keeps adult geometry and the normal-input reference explicit in the development diagram', () => {
    const draft = createDiseaseDraft('amblyopia') as Extract<DiseaseDraft, {id:'amblyopia'}>;
    const html = renderToStaticMarkup(<AmblyopiaDiagram draft={draft} normal lang="en"/>);
    expect(html).toContain(escaped(T.developmentNote.en)); expect(html).toContain('data-development-outcome="reference"');
    expect(html).not.toContain('data-development-outcome="retained"');
  });
});
