import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LESSONS } from '../anatomy/data';
import { questionsFor, type QuestionContext } from '../content/questions';
import { messages } from '../content/messages';
import { createSession, currentQuestion, nextSessionQuestion, revealSessionAnswer, submitSessionAnswer, type PracticeSession } from '../modes/quiz';
import { createEyeStore, eyeStore } from '../state/store';
import { PracticeActions, PracticePanel } from './LearningPanels';

let store: ReturnType<typeof createEyeStore>;
const engine = { current: null };
const text = (value: string) => renderToStaticMarkup(<span>{value}</span>).slice(6, -7);
beforeEach(() => {
  store = createEyeStore();
  vi.spyOn(eyeStore, 'getInitialState').mockImplementation(() => store.getState());
});
afterEach(() => vi.restoreAllMocks());
function install(session: PracticeSession) {
  store.setState({ quiz: session, sessions: { [session.sessionId]: session }, activeSessions: { [session.context]: session.sessionId } });
}
function session(context: QuestionContext = 'vision') { return createSession(context, questionsFor(context), () => 0.5, () => 100); }

it('renders all optional topics and unanswered choices in stored order without answer feedback', () => {
  const quiz = session(); install(quiz);
  const question = currentQuestion(quiz)!;
  const html = renderToStaticMarkup(<PracticePanel engine={engine}/>);
  expect(html.match(/<option\b/g)).toHaveLength(4);
  for (const lesson of LESSONS) expect(html).toContain(text(lesson.title.zh));
  expect(html).toContain(text(question.prompt.zh));
  const offsets = quiz.optionOrder[question.id].map(id => html.indexOf(text(question.options.find(option => option.id === id)!.label.zh)));
  expect(offsets.every(offset => offset >= 0)).toBe(true);
  expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
  expect(html).not.toContain('correct-answer');
  expect(html).not.toContain('answer-feedback');
  for (const option of question.options) expect(html).not.toContain(text(option.feedback.zh));
  expect(html).not.toContain('data-target');
  expect(html).not.toContain('放弃本轮并重开');
  expect(html).toContain('回到本组讲解');
  const actions = renderToStaticMarkup(<PracticeActions engine={engine}/>);
  expect(actions).toContain(messages.reveal.zh);
  expect(actions).not.toContain(messages.nextQuestion.zh);
});

it('locks submitted choices and explains both the correct relation and the mistaken choice', () => {
  let quiz = session('anatomy'); const question = currentQuestion(quiz)!;
  const wrong = question.options.find(option => option.id !== question.correctOptionId)!;
  quiz = submitSessionAnswer(quiz, wrong.id); install(quiz);
  const html = renderToStaticMarkup(<PracticePanel engine={engine}/>);
  expect(html).toContain('correct-answer'); expect(html).toContain('wrong-answer');
  expect(html).toContain(text(wrong.feedback.zh));
  expect(html).toContain(text(question.options.find(option => option.id === question.correctOptionId)!.feedback.zh));
  expect(html.match(/<button[^>]*disabled=""[^>]*class="[^"]*(?:answer)?[^>]*>/g)?.length).toBeGreaterThanOrEqual(question.options.length);
  expect(html).toContain('回到结构查看');
  const actions = renderToStaticMarkup(<PracticeActions engine={engine}/>);
  expect(actions).toContain('id="quiz-action"'); expect(actions).toContain(messages.nextQuestion.zh);
});

it('changes choice language without changing the saved order or feedback state', () => {
  const quiz = session('myopia'); install(quiz); store.setState({ lang: 'en' });
  const question = currentQuestion(quiz)!;
  const html = renderToStaticMarkup(<PracticePanel engine={engine}/>);
  const offsets = quiz.optionOrder[question.id].map(id => html.indexOf(text(question.options.find(option => option.id === id)!.label.en)));
  expect(offsets.every(offset => offset >= 0)).toBe(true); expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
  expect(html).not.toContain('answer-feedback');
});

it('separates correct, incorrect and revealed results and offers only applicable review actions', () => {
  let quiz = session('vision');
  let question = currentQuestion(quiz)!; quiz = nextSessionQuestion(submitSessionAnswer(quiz, question.correctOptionId));
  question = currentQuestion(quiz)!; quiz = nextSessionQuestion(submitSessionAnswer(quiz, question.options.find(option => option.id !== question.correctOptionId)!.id));
  quiz = nextSessionQuestion(revealSessionAnswer(quiz)); install(quiz);
  const html = renderToStaticMarkup(<PracticePanel engine={engine}/>);
  expect(html).toContain('答对</dt><dd>1</dd>'); expect(html).toContain('答错</dt><dd>1</dd>'); expect(html).toContain('已看答案</dt><dd>1</dd>');
  const actions = renderToStaticMarkup(<PracticeActions engine={engine}/>);
  expect(actions).toContain('复习错题'); expect(actions).toContain(messages.retry.zh);
  expect(actions.match(/回到本组讲解/g)).toHaveLength(1); expect(html).not.toContain('回到本组讲解');
  expect(actions).not.toContain(messages.reveal.zh);
});

it('keeps previous round summaries available without exposing their answers in an unanswered round', () => {
  const old = session('anatomy'); const answered = submitSessionAnswer(old, currentQuestion(old)!.correctOptionId);
  const current = session('anatomy'); install(current);
  store.setState({ sessions: { [answered.sessionId]: answered, [current.sessionId]: current } });
  const html = renderToStaticMarkup(<PracticePanel engine={engine}/>);
  expect(html).toContain('<details class="practice-history"'); expect(html).toContain('历史记录');
  expect(html).not.toContain(answered.sessionId);
  expect(html).not.toContain(text(currentQuestion(answered)!.options.find(option => option.id === currentQuestion(answered)!.correctOptionId)!.feedback.zh));
});
