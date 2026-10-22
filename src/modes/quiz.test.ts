import { describe, expect, it } from 'vitest';
import type { StructureId } from '../anatomy/types';
import { createQuiz, currentTarget, nextQuestion, quizScore, revealAnswer, submitAnswer } from './quiz';

describe('quiz', () => {
  it('deduplicates and shuffles a copy of the question pool', () => {
    const pool: readonly StructureId[] = Object.freeze(['cornea', 'lens', 'retina', 'cornea']);
    const quiz = createQuiz(pool, () => 0);
    expect(quiz.order).toEqual(['lens', 'retina', 'cornea']);
    expect(pool).toEqual(['cornea', 'lens', 'retina', 'cornea']);
    expect(currentTarget(quiz)).toBe('lens');
    expect(quiz.index).toBe(0);
    expect(quiz.answers).toEqual({});
    expect(createQuiz(pool, () => 0.999).order).toEqual(['cornea', 'lens', 'retina']);
  });

  it.each([NaN, Infinity, -0.1, 1])('rejects an invalid random value %s without corrupting the order', (random) => {
    expect(() => createQuiz(['cornea', 'lens'], () => random)).toThrow(RangeError);
  });

  it('records one correct answer immutably and cannot score it twice', () => {
    const quiz = createQuiz(['cornea']);
    Object.freeze(quiz.order);
    Object.freeze(quiz.answers);
    Object.freeze(quiz);
    const answered = submitAnswer(quiz, 'cornea');
    expect(answered).not.toBe(quiz);
    expect(quiz.answers).toEqual({});
    expect(answered.answers.cornea).toEqual({ selected: 'cornea', revealed: false, correct: true });
    expect(quizScore(answered)).toBe(1);
    expect(submitAnswer(answered, 'cornea')).toBe(answered);
    expect(submitAnswer(answered, 'lens')).toBe(answered);
    expect(quizScore(submitAnswer(answered, 'cornea'))).toBe(1);
  });

  it('locks an incorrect answer and permits advancing', () => {
    const quiz = createQuiz(['cornea', 'lens'], () => 0.999);
    expect(nextQuestion(quiz)).toBe(quiz);
    const answered = submitAnswer(quiz, 'retina');
    expect(answered.answers.cornea).toEqual({ selected: 'retina', revealed: false, correct: false });
    expect(submitAnswer(answered, 'cornea')).toBe(answered);
    expect(quizScore(answered)).toBe(0);
    const next = nextQuestion(answered);
    expect(currentTarget(next)).toBe('lens');
    expect(answered.index).toBe(0);
    expect(next.answers).toEqual(answered.answers);
  });

  it('reveals an answer immutably without awarding credit or allowing another attempt', () => {
    const quiz = createQuiz(['cornea']);
    const revealed = revealAnswer(quiz);
    expect(quiz.answers).toEqual({});
    expect(revealed.answers.cornea).toEqual({ selected: null, revealed: true, correct: false });
    expect(quizScore(revealed)).toBe(0);
    expect(submitAnswer(revealed, 'cornea')).toBe(revealed);
    expect(revealAnswer(revealed)).toBe(revealed);
    expect(currentTarget(nextQuestion(revealed))).toBeNull();
  });

  it('keeps a submitted answer when reveal is called afterward', () => {
    const quiz = submitAnswer(createQuiz(['cornea']), 'cornea');
    expect(revealAnswer(quiz)).toBe(quiz);
    expect(quizScore(quiz)).toBe(1);
  });

  it('scores the completed quiz and makes subsequent actions harmless', () => {
    let quiz = createQuiz(['cornea', 'lens', 'retina'], () => 0.999);
    quiz = nextQuestion(submitAnswer(quiz, 'cornea'));
    quiz = nextQuestion(revealAnswer(quiz));
    quiz = nextQuestion(submitAnswer(quiz, 'retina'));
    expect(currentTarget(quiz)).toBeNull();
    expect(quiz.index).toBe(3);
    expect(quizScore(quiz)).toBe(2);
    expect(nextQuestion(quiz)).toBe(quiz);
    expect(submitAnswer(quiz, 'cornea')).toBe(quiz);
    expect(revealAnswer(quiz)).toBe(quiz);
  });

  it('treats an empty quiz as safely complete', () => {
    const quiz = createQuiz([]);
    expect(currentTarget(quiz)).toBeNull();
    expect(quizScore(quiz)).toBe(0);
    expect(nextQuestion(quiz)).toBe(quiz);
    expect(submitAnswer(quiz, 'cornea')).toBe(quiz);
    expect(revealAnswer(quiz)).toBe(quiz);
  });
});
