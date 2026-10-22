import type { StructureId } from '../anatomy/types';

export interface QuizState {
  order: StructureId[];
  index: number;
  answers: Record<string, { selected: StructureId | null; revealed: boolean; correct: boolean }>;
}

export function createQuiz(pool: readonly StructureId[], random = Math.random): QuizState {
  const order = [...new Set(pool)];
  for (let i = order.length - 1; i > 0; i -= 1) {
    const sample = random();
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1) throw new RangeError('Random source must return a value in [0, 1).');
    const j = Math.floor(sample * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { order, index: 0, answers: {} };
}

export function currentTarget(quiz: QuizState): StructureId | null {
  return quiz.order[quiz.index] ?? null;
}

export function submitAnswer(quiz: QuizState, selected: StructureId): QuizState {
  const target = currentTarget(quiz);
  if (!target || quiz.answers[target]) return quiz;
  return {
    ...quiz,
    answers: { ...quiz.answers, [target]: { selected, revealed: false, correct: selected === target } },
  };
}

export function revealAnswer(quiz: QuizState): QuizState {
  const target = currentTarget(quiz);
  if (!target || quiz.answers[target]) return quiz;
  return {
    ...quiz,
    answers: { ...quiz.answers, [target]: { selected: null, revealed: true, correct: false } },
  };
}

export function nextQuestion(quiz: QuizState): QuizState {
  const target = currentTarget(quiz);
  return target && quiz.answers[target] ? { ...quiz, index: quiz.index + 1 } : quiz;
}

export function quizScore(quiz: QuizState): number {
  return Object.values(quiz.answers).filter((answer) => answer.correct && !answer.revealed).length;
}
