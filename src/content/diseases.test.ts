import { describe, expect, it } from 'vitest';
import { STRUCTURE_IDS, type Localized } from '../anatomy/types';
import { DISEASE_IDS } from '../modes/disease';
import { DISEASES, DISEASE_SOURCES, DISEASE_STEPS, DISEASE_TEXT } from './diseases';
import { CONTENT_VERSION, QUESTIONS, questionsFor } from './questions';

const expected = {
  cataract: ['cat-location-01', 'cat-mechanism-02', 'cat-distinction-03'],
  glaucoma: ['gla-route-01', 'gla-pressure-02', 'gla-normal-tension-03', 'gla-irreversible-04'],
  strabismus: ['str-alignment-01', 'str-convergence-02', 'str-amblyopia-03'],
  amblyopia: ['amb-cause-01', 'amb-appearance-02', 'amb-input-03', 'amb-distinction-04'],
};
function bilingual(pair: Localized) {
  expect(pair.zh.trim()).toMatch(/[\u3400-\u9fff]/);
  expect(pair.en.trim()).toMatch(/[A-Za-z]/);
  expect(`${pair.zh} ${pair.en}`).not.toMatch(/TODO|TBD|lorem ipsum|待补充/);
}
describe('complete bilingual condition content', () => {
  it('has four independently accessible chapters with four complete sections and valid source links', () => {
    expect(Object.keys(DISEASES)).toEqual([...DISEASE_IDS]);
    expect(DISEASE_STEPS).toHaveLength(4);
    DISEASE_STEPS.forEach(bilingual);
    for (const id of DISEASE_IDS) {
      const chapter = DISEASES[id];
      expect(chapter.id).toBe(id); expect(chapter.steps).toHaveLength(4);
      [chapter.name, chapter.goal, chapter.tag, ...chapter.steps.flatMap(step => [step.question, step.body])].forEach(bilingual);
      expect(chapter.related.length).toBeGreaterThan(0);
      chapter.related.forEach(id => expect(STRUCTURE_IDS).toContain(id));
      expect(chapter.sources.length).toBeGreaterThan(0);
      chapter.sources.forEach(source => { expect(source.title.length).toBeGreaterThan(4); expect(new URL(source.url).protocol).toBe('https:'); });
      expect(chapter.contentVersion).toBe(CONTENT_VERSION);
      expect(chapter.medicalReviewStatus).toBe('pending');
      expect(['draft', 'llm-checked']).toContain(chapter.translationStatus);
    }
    Object.values(DISEASE_TEXT).forEach(bilingual);
  });
  it('adds exactly the fourteen specified questions while retaining all original contexts', () => {
    expect(CONTENT_VERSION).toBe('2026-10-22-diseases');
    expect(QUESTIONS).toHaveLength(29);
    for (const id of DISEASE_IDS) {
      const questions = questionsFor(id);
      expect(questions.map(question => question.id)).toEqual(expected[id]);
      for (const question of questions) {
        expect(question.medicalReviewStatus).toBe('pending');
        expect(question.contentVersion).toBe(CONTENT_VERSION);
        expect(['draft', 'llm-checked']).toContain(question.translationStatus);
        question.sources.forEach(source => expect(DISEASE_SOURCES).toHaveProperty(source));
      }
    }
    expect(questionsFor('structures')).toHaveLength(6);
    for (const context of ['anatomy', 'vision', 'myopia'] as const) expect(questionsFor(context)).toHaveLength(3);
  });
});
