import { describe, expect, it } from 'vitest';
import { CONTENT_VERSION, questionsFor, questionById, type Question } from '../content/questions';
import * as api from './quiz';

const still = () => 0.999;
const now = () => 1000;
const pool = (): Question[] => questionsFor('structures');

describe('practice sessions', () => {
  it('creates a distinct session and freezes one question and option ordering', () => {
    const questions: Question[] = ['cornea', 'lens'].map(id => ({ id, context: 'structures', kind: 'identify', prompt: { zh: '名称', en: 'Name' }, target: id as 'cornea' | 'lens', options: ['cornea', 'lens'].map(option => ({ id: option, label: { zh: option, en: option }, feedback: { zh: option, en: option } })), correctOptionId: id, sources: ['M01'], reviewStatus: 'draft' }));
    const original = structuredClone(questions);
    const session = api.createSession('structures', questions, () => 0, now);
    expect(session.order).toEqual(['lens', 'cornea']);
    expect(session.optionOrder).toEqual({ cornea: ['lens', 'cornea'], lens: ['lens', 'cornea'] });
    expect(session.answers).toEqual({});
    expect(session.index).toBe(0);
    expect(session.contentVersion).toBe(CONTENT_VERSION);
    expect(session.sessionId).not.toBe(api.createSession('structures', questions, () => 0, now).sessionId);
    expect(questions).toEqual(original);
  });

  it('rejects a mismatched context and invalid time or random source', () => {
    const questions: Question[] = [{ id: 'cornea', context: 'structures', kind: 'identify', prompt: { zh: '名称', en: 'Name' }, target: 'cornea', options: ['cornea', 'lens'].map(id => ({ id, label: { zh: id, en: id }, feedback: { zh: id, en: id } })), correctOptionId: 'cornea', sources: ['M01'], reviewStatus: 'draft' }];
    expect(() => api.createSession('vision', questions, still, now)).toThrow(RangeError);
    expect(() => api.createSession('structures', questions, () => 1, now)).toThrow(RangeError);
    expect(() => api.createSession('structures', questions, still, () => NaN)).toThrow(RangeError);
  });

  it('treats an empty subset as safely complete', () => {
    const session = api.createSession('structures', [], still, now);
    expect(api.currentQuestion(session)).toBeNull();
    expect(api.sessionScore(session)).toBe(0);
    expect(api.nextSessionQuestion(session)).toBe(session);
    expect(api.submitSessionAnswer(session, 'cornea', now)).toBe(session);
    expect(api.revealSessionAnswer(session, now)).toBe(session);
  });

  it('rejects unknown options, locks a submission, and advances only answered questions', () => {
    const session = api.createSession('structures', pool(), still, now);
    expect(api.currentQuestion(session)?.id).toBe('cornea');
    expect(api.nextSessionQuestion(session)).toBe(session);
    expect(api.submitSessionAnswer(session, 'unknown-option', now)).toBe(session);
    const answered = api.submitSessionAnswer(session, 'cornea', () => 1200);
    expect(answered.answers.cornea).toEqual({ selected: 'cornea', revealed: false, correct: true, submittedAt: 1200 });
    expect(session.answers).toEqual({});
    expect(api.submitSessionAnswer(answered, 'lens', now)).toBe(answered);
    expect(api.revealSessionAnswer(answered, now)).toBe(answered);
    expect(api.sessionScore(answered)).toBe(1);
    const next = api.nextSessionQuestion(answered);
    expect(next.index).toBe(1);
    expect(next.optionOrder).toEqual(session.optionOrder);
    expect(next.sessionId).toBe(session.sessionId);
  });

  it('keeps incorrect and revealed questions in review, but excludes correct answers', () => {
    let session = api.createSession('structures', ['cornea', 'lens', 'retina'].map(id => questionById(id)!), still, now);
    session = api.nextSessionQuestion(api.submitSessionAnswer(session, 'cornea', now));
    session = api.nextSessionQuestion(api.submitSessionAnswer(session, 'iris', now));
    session = api.nextSessionQuestion(api.revealSessionAnswer(session, now));
    expect(api.sessionScore(session)).toBe(1);
    expect(api.wrongQuestionIds(session)).toEqual(['lens', 'retina']);
    expect(session.answers.retina).toEqual({ selected: null, revealed: true, correct: false, submittedAt: 1000 });
    expect(api.currentQuestion(session)).toBeNull();
    expect(api.nextSessionQuestion(session)).toBe(session);
    expect(api.submitSessionAnswer(session, 'retina', now)).toBe(session);
    expect(api.revealSessionAnswer(session, now)).toBe(session);
  });

  it('scores two separate questions about the same structure independently', () => {
    const questions = ['myopia-axial-01', 'myopia-correction-02'].map(id => questionById(id)!);
    expect(questions[0].target).toBe(questions[1].target);
    let session = api.createSession('myopia', questions, still, now);
    session = api.nextSessionQuestion(api.submitSessionAnswer(session, questions[0].correctOptionId, now));
    session = api.nextSessionQuestion(api.submitSessionAnswer(session, questions[1].correctOptionId, now));
    expect(Object.keys(session.answers)).toEqual(['myopia-axial-01', 'myopia-correction-02']);
    expect(api.sessionScore(session)).toBe(2);
    expect(api.wrongQuestionIds(session)).toEqual([]);
  });

  it('round trips identity and ordering, recomputing correctness rather than trusting storage', () => {
    const session = api.nextSessionQuestion(api.submitSessionAnswer(api.createSession('structures', pool(), still, now), 'cornea', () => 1200));
    const saved = JSON.parse(JSON.stringify(session));
    saved.answers.cornea.correct = false;
    const restored = api.restoreSession(saved)!;
    expect(restored).toEqual(session);
    expect(restored).not.toBe(saved);
    expect(restored.answers.cornea).not.toBe(saved.answers.cornea);
    expect(saved.answers.cornea.correct).toBe(false);
  });

  it.each(['unknown-future', 'old', '2026-10-22-t07-preview-unknown'])('rejects an unsupported content version %s', contentVersion => {
    const session = api.submitSessionAnswer(api.createSession('structures', pool(), still, now), 'cornea', now);
    expect(api.restoreSession({ ...session, contentVersion })).toBeNull();
  });

  it('rejects malformed identity, order, progress, options and answer data', () => {
    const session = api.nextSessionQuestion(api.submitSessionAnswer(api.createSession('structures', pool(), still, now), 'cornea', now));
    const corruptions: ((draft: any) => void)[] = [
      draft => { draft.sessionId = ''; }, draft => { draft.contentVersion = null; },
      draft => { draft.context = 'unknown'; }, draft => { draft.index = -1; },
      draft => { draft.index = 0.5; }, draft => { draft.index = Infinity; },
      draft => { draft.index = draft.order.length + 1; },
      draft => { draft.order.push(draft.order[0]); }, draft => { draft.order[0] = 'unknown'; },
      draft => { draft.optionOrder.cornea = ['cornea', 'cornea']; },
      draft => { delete draft.optionOrder.cornea; },
      draft => { draft.answers.cornea.selected = 'unknown'; },
      draft => { draft.answers.cornea.selected = null; },
      draft => { draft.answers.cornea.revealed = true; },
      draft => { draft.answers.cornea.submittedAt = -1; },
      draft => { draft.answers.cornea.submittedAt = NaN; },
      draft => { draft.answers.cornea.revealed = 'false'; },
      draft => { delete draft.answers.cornea; },
      draft => { draft.answers.iris = { ...draft.answers.cornea, selected: 'iris' }; },
      draft => { draft.answers.extra = draft.answers.cornea; },
      draft => { draft.optionOrder.extra = ['cornea']; },
    ];
    for (const corrupt of corruptions) {
      const invalid = structuredClone(session); corrupt(invalid);
      expect(api.restoreSession(invalid), corrupt.toString()).toBeNull();
    }
    expect(api.restoreSession(null)).toBeNull();
    expect(api.restoreSession([])).toBeNull();
  });

  it('filters deleted questions from an old version while preserving recognized results and position', () => {
    const base = api.nextSessionQuestion(api.submitSessionAnswer(api.createSession('structures', ['cornea', 'lens'].map(id => questionById(id)!), still, now), 'cornea', now));
    const saved = { ...structuredClone(base), contentVersion: '2026-10-22-t07-preview', order: ['cornea', 'deleted-question', 'lens'], index: 2 };
    saved.optionOrder['deleted-question'] = ['deleted-option'];
    saved.answers['deleted-question'] = { selected: 'deleted-option', revealed: false, correct: false, submittedAt: 900 };
    const restored = api.restoreSession(saved)!;
    expect(restored.order).toEqual(['cornea', 'lens']);
    expect(restored.index).toBe(1);
    expect(restored.sessionId).toBe(base.sessionId);
    expect(restored.contentVersion).toBe(CONTENT_VERSION);
    expect(restored.answers).toEqual(base.answers);
    expect(api.wrongQuestionIds(restored)).toEqual([]);
    expect(api.wrongQuestionIds(saved)).toEqual([]);
  });

  it('drops an obsolete answered option rather than inventing a new answer', () => {
    const saved = api.nextSessionQuestion(api.submitSessionAnswer(api.createSession('structures', ['cornea', 'lens'].map(id => questionById(id)!), still, now), 'cornea', now));
    saved.contentVersion = '2026-10-22-t07-preview';
    saved.optionOrder.cornea[0] = 'retired-option';
    saved.answers.cornea.selected = 'retired-option';
    const restored = api.restoreSession(saved)!;
    expect(restored.order).toEqual(['lens']);
    expect(restored.index).toBe(0);
    expect(restored.answers).toEqual({});
  });
});
