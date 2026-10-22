import type { StructureId } from '../anatomy/types';
import { CONTENT_VERSION, QUESTIONS, questionById, type Question } from '../content/questions';

export interface QuizState {
  order: StructureId[];
  index: number;
  answers: Record<string, { selected: StructureId | null; revealed: boolean; correct: boolean }>;
}

export function createQuiz(pool: readonly StructureId[], random = Math.random): QuizState {
  return { order: shuffled([...new Set(pool)], random), index: 0, answers: {} };
}

function shuffled<T>(pool: readonly T[], random: () => number): T[] {
  const order = [...pool];
  for (let i = order.length - 1; i > 0; i -= 1) {
    const sample = random();
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1) throw new RangeError('Random source must return a value in [0, 1).');
    const j = Math.floor(sample * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
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

export interface PracticeSession {
  sessionId: string; context: string; contentVersion: string;
  order: string[]; optionOrder: Record<string, string[]>; index: number;
  answers: Record<string, { selected: string | null; revealed: boolean; correct: boolean; submittedAt: number }>;
}

function timestamp(now: () => number): number {
  const value = now();
  if (!Number.isFinite(value) || value < 0) throw new RangeError('Time must be a finite non-negative value.');
  return value;
}

export function createSession(context: string, pool: readonly Question[], random = Math.random, now = Date.now): PracticeSession {
  if (!context || pool.some(question => question.context !== context)) throw new RangeError('Questions must belong to the session context.');
  const questions = [...new Map(pool.map(question => [question.id, question])).values()];
  return {
    sessionId: `${timestamp(now)}-${crypto.randomUUID()}`, context, contentVersion: CONTENT_VERSION,
    order: shuffled(questions.map(question => question.id), random),
    optionOrder: Object.fromEntries(questions.map(question => [question.id, shuffled(question.options.map(option => option.id), random)])),
    index: 0, answers: {},
  };
}

export function currentQuestion(session: PracticeSession): Question | null {
  return questionById(session.order[session.index]) ?? null;
}

export function submitSessionAnswer(session: PracticeSession, optionId: string, now = Date.now): PracticeSession {
  const question = currentQuestion(session);
  if (!question || Object.hasOwn(session.answers, question.id) || !question.options.some(option => option.id === optionId)) return session;
  return { ...session, answers: { ...session.answers, [question.id]: { selected: optionId, revealed: false, correct: optionId === question.correctOptionId, submittedAt: timestamp(now) } } };
}

export function revealSessionAnswer(session: PracticeSession, now = Date.now): PracticeSession {
  const question = currentQuestion(session);
  if (!question || Object.hasOwn(session.answers, question.id)) return session;
  return { ...session, answers: { ...session.answers, [question.id]: { selected: null, revealed: true, correct: false, submittedAt: timestamp(now) } } };
}

export function nextSessionQuestion(session: PracticeSession): PracticeSession {
  const question = currentQuestion(session);
  return question && Object.hasOwn(session.answers, question.id) ? { ...session, index: session.index + 1 } : session;
}

export function sessionScore(session: PracticeSession): number {
  return session.order.filter(id => session.answers[id]?.correct && !session.answers[id].revealed).length;
}

export function wrongQuestionIds(session: PracticeSession): string[] {
  return session.order.filter(id => questionById(id)?.context === session.context && session.answers[id] && (!session.answers[id].correct || session.answers[id].revealed));
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string' && item.length > 0) && new Set(value).size === value.length;

// Known catalogs retain stable question IDs and answers through content upgrades.
const migratableContentVersions: readonly string[] = ['2026-10-22-t07-preview', '2026-10-22-t07'];
export const isSupportedContentVersion = (value: unknown): value is string => typeof value === 'string'
  && (value === CONTENT_VERSION || migratableContentVersions.includes(value));

export function restoreSession(value: unknown): PracticeSession | null {
  if (!record(value) || typeof value.sessionId !== 'string' || !value.sessionId.trim()
    || !isSupportedContentVersion(value.contentVersion)
    || typeof value.context !== 'string' || !QUESTIONS.some(question => question.context === value.context)
    || !strings(value.order) || typeof value.index !== 'number' || !Number.isInteger(value.index) || value.index < 0 || value.index > value.order.length
    || !record(value.optionOrder) || !record(value.answers)) return null;
  const savedOrder = value.order, savedIndex = value.index;
  const oldVersion = value.contentVersion !== CONTENT_VERSION;
  if ([...Object.keys(value.answers), ...Object.keys(value.optionOrder)].some(id => !savedOrder.includes(id))) return null;
  const result: PracticeSession = { sessionId: value.sessionId, context: value.context, contentVersion: CONTENT_VERSION, order: [], optionOrder: {}, index: 0, answers: {} };
  for (const [position, id] of savedOrder.entries()) {
    const question = questionById(id);
    if (!question || question.context !== value.context) { if (oldVersion) continue; return null; }
    const options = value.optionOrder[id], answer = value.answers[id];
    if (!strings(options)) return null;
    const validIds = question.options.map(option => option.id);
    if (!oldVersion && (options.length !== validIds.length || options.some(option => !validIds.includes(option)))) return null;
    if (answer !== undefined) {
      if (!record(answer) || typeof answer.revealed !== 'boolean' || typeof answer.submittedAt !== 'number' || !Number.isFinite(answer.submittedAt) || answer.submittedAt < 0
        || (answer.revealed ? answer.selected !== null : typeof answer.selected !== 'string') || position > savedIndex) return null;
      if (!answer.revealed && (!validIds.includes(answer.selected as string) || !options.includes(answer.selected as string))) { if (oldVersion) continue; return null; }
      result.answers[id] = { selected: answer.selected as string | null, revealed: answer.revealed, correct: !answer.revealed && answer.selected === question.correctOptionId, submittedAt: answer.submittedAt };
    } else if (position < savedIndex) return null;
    result.order.push(id);
    result.optionOrder[id] = [...options.filter(option => validIds.includes(option)), ...validIds.filter(option => !options.includes(option))];
    if (position < savedIndex) result.index += 1;
  }
  return result;
}
