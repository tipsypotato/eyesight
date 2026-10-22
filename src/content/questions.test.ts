import { describe, expect, it } from 'vitest';
import { STRUCTURES } from '../anatomy/data';
import { STRUCTURE_IDS, type Localized } from '../anatomy/types';
import { QUESTIONS, questionById, questionsFor } from './questions';

function bilingual(value: Localized) {
  expect(value.zh).toMatch(/[\u3400-\u9fff]/);
  expect(value.en).toMatch(/[A-Za-z]/);
  for (const text of Object.values(value)) {
    expect(text.trim()).toBe(text);
    expect(text).not.toMatch(/TODO|TBD|lorem ipsum|待补充|占位/i);
  }
}

describe('question catalog', () => {
  it('keeps each practice context separate with stable question IDs', () => {
    expect(questionsFor('anatomy').map(q => q.id)).toEqual(['anatomy-wall-order-01', 'anatomy-chambers-02', 'anatomy-fundus-03']);
    expect(questionsFor('vision').map(q => q.id)).toEqual(['vision-pupil-01', 'vision-focus-02', 'vision-signal-03']);
    expect(questionsFor('myopia').map(q => q.id)).toEqual(['myopia-axial-01', 'myopia-correction-02', 'myopia-limit-03']);
    expect(new Set(QUESTIONS.map(q => q.id)).size).toBe(15);
    expect(questionById('removed-question')).toBeUndefined();
    for (const q of QUESTIONS) expect(questionById(q.id)).toBe(q);
  });

  it('preserves all six identification choices and explains the chosen structure as well as the target', () => {
    const ids = ['cornea', 'sclera', 'iris', 'lens', 'retina', 'optic-nerve'];
    const questions = questionsFor('structures');
    expect(questions.map(q => q.id)).toEqual(ids);
    for (const q of questions) {
      expect(q.kind).toBe('identify');
      expect(q.target).toBe(q.id);
      expect(q.correctOptionId).toBe(q.id);
      expect(q.options.map(o => o.id)).toEqual(ids);
      const target = STRUCTURES.find(s => s.id === q.target)!;
      for (const option of q.options) {
        const selected = STRUCTURES.find(s => s.id === option.id)!;
        for (const lang of ['zh', 'en'] as const) {
          expect(option.label[lang]).toBe(selected.name[lang]);
          expect(option.feedback[lang].toLowerCase()).toContain(target.name[lang].toLowerCase());
          expect(option.feedback[lang].toLowerCase()).toContain(selected.name[lang].toLowerCase());
        }
      }
    }
  });

  it('provides a unique valid answer and complete bilingual feedback for every option', () => {
    expect(QUESTIONS.length).toBeGreaterThan(0);
    for (const q of QUESTIONS) {
      bilingual(q.prompt);
      expect(q.options.length).toBeGreaterThanOrEqual(3);
      expect(new Set(q.options.map(o => o.id)).size).toBe(q.options.length);
      expect(q.options.filter(o => o.id === q.correctOptionId)).toHaveLength(1);
      if (q.target !== null) expect(STRUCTURE_IDS).toContain(q.target);
      expect(q.sources.length).toBeGreaterThan(0);
      expect(['draft', 'llm-checked']).toContain(q.reviewStatus);
      for (const option of q.options) { bilingual(option.label); bilingual(option.feedback); }
      expect(new Set(q.options.map(o => o.feedback.en)).size).toBe(q.options.length);
    }
  });
});
