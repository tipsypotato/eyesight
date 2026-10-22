import { useState, type RefObject } from 'react';
import { useStore } from 'zustand';
import { LESSONS } from '../anatomy/data';
import type { Lang, Localized } from '../anatomy/types';
import { type QuestionContext } from '../content/questions';
import { messages } from '../content/messages';
import type { EyeEngine } from '../engine/EyeEngine';
import { currentQuestion, sessionScore, wrongQuestionIds, type PracticeSession } from '../modes/quiz';
import { eyeStore } from '../state/store';

type EngineRef = RefObject<EyeEngine | null>;
export const LEARNING_TEXT = {
  topic: { zh: '选择理解确认主题', en: 'Choose a review topic' },
  optional: { zh: '按讲解需要选题；可随时返回模型，不必完成答题才能继续演示。', en: 'Choose questions to support the explanation. You can return to the model at any time without completing a round.' },
  answerHint: { zh: '每题选择一次；查看答案会结束本题，并记为已看答案。', en: 'Choose once per question. Revealing the answer ends the question and records it as revealed.' },
  correctCount: { zh: '答对', en: 'Correct' },
  incorrectCount: { zh: '答错', en: 'Incorrect' },
  revealedCount: { zh: '已看答案', en: 'Revealed' },
  correctExplanation: { zh: '正确关系', en: 'Correct relationship' },
  choiceExplanation: { zh: '为什么所选项不符合', en: 'Why your choice does not fit' },
  inspect: { zh: '回到结构查看', en: 'Inspect the related structure' },
  reviewWrong: { zh: '复习错题', en: 'Review missed questions' },
  newRound: { zh: '新一轮', en: 'New round' },
  backLesson: { zh: '回到本组讲解', en: 'Back to this tour' },
  history: { zh: '历史记录', en: 'Previous rounds' },
  round: { zh: '记录', en: 'Round' },
  complete: { zh: '已完成', en: 'Completed' },
  incomplete: { zh: '未完成', en: 'Incomplete' },
  restartPrompt: { zh: '本轮尚未完成。重开会结束本轮并创建新记录，原记录仍保留。', en: 'This round is unfinished. Restarting ends it and creates a new record; the previous record is kept.' },
  confirmRestart: { zh: '放弃本轮并重开', en: 'End this round and restart' },
  cancel: { zh: '继续本轮', en: 'Keep this round' },
} satisfies Record<string, Localized>;

const contexts: QuestionContext[] = ['structures', 'anatomy', 'vision', 'myopia'];
const contextName = (context: string, lang: Lang) => context === 'structures' ? messages.quiz[lang] : LESSONS.find(lesson => lesson.id === context)?.title[lang] ?? messages.quiz[lang];
function Results({ session, lang }: { session: PracticeSession; lang: Lang }) {
  const answers = session.order.map(id => session.answers[id]).filter(Boolean);
  return <dl className="practice-results">
    <div><dt>{LEARNING_TEXT.correctCount[lang]}</dt><dd>{sessionScore(session)}</dd></div>
    <div><dt>{LEARNING_TEXT.incorrectCount[lang]}</dt><dd>{answers.filter(answer => !answer.correct && !answer.revealed).length}</dd></div>
    <div><dt>{LEARNING_TEXT.revealedCount[lang]}</dt><dd>{answers.filter(answer => answer.revealed).length}</dd></div>
  </dl>;
}

export function PracticePanel({ engine }: { engine: EngineRef }) {
  const s = useStore(eyeStore); const quiz = s.quiz; const lang = s.lang;
  const [confirmSession, setConfirmSession] = useState<string | null>(null);
  const context = (quiz?.context ?? 'structures') as QuestionContext;
  const question = quiz ? currentQuestion(quiz) : null;
  const answer = question && quiz ? quiz.answers[question.id] : null;
  const correct = answer && question ? question.options.find(option => option.id === question.correctOptionId)! : null;
  const chosen = answer && question ? question.options.find(option => option.id === answer.selected) : null;
  const history = Object.values(s.sessions).filter(session => session.context === context && session.sessionId !== quiz?.sessionId);
  const restart = () => { setConfirmSession(null); s.startPractice(context, true, false, engine.current?.captureCamera()); };
  return <div className="mode-content practice-panel">
    <label className="practice-topic">{LEARNING_TEXT.topic[lang]}<select value={context} onChange={event => { setConfirmSession(null); s.startPractice(event.target.value as QuestionContext, false, false, engine.current?.captureCamera()); }}>{contexts.map(topic => <option key={topic} value={topic}>{contextName(topic, lang)}</option>)}</select></label>
    <p className="micro">{LEARNING_TEXT.optional[lang]}</p>
    {quiz && question ? <>
      {context !== 'structures' && <button className="text-button" onClick={() => s.startLesson(context)}>{LEARNING_TEXT.backLesson[lang]} ←</button>}
      <span className="eyebrow">{messages.quiz[lang]} {quiz.index + 1} / {quiz.order.length}</span>
      <div className="progress-track">{quiz.order.map((_, index) => <span key={index} className={index <= quiz.index ? 'done' : ''}/>)}</div>
      <h2>{question.prompt[lang]}</h2><p>{question.kind === 'identify' ? messages.quizBody[lang] : LEARNING_TEXT.answerHint[lang]}</p>
      <div className="answers">{quiz.optionOrder[question.id].map((id, index) => {
        const option = question.options.find(item => item.id === id)!;
        return <button key={id} disabled={!!answer} className={answer && id === question.correctOptionId ? 'correct-answer' : answer?.selected === id ? 'wrong-answer' : ''} onClick={() => { s.answerQuiz(id); requestAnimationFrame(() => document.getElementById('quiz-action')?.focus()); }}><span>{String.fromCharCode(65 + index)}</span>{option.label[lang]}{answer && id === question.correctOptionId && <b>✓</b>}</button>;
      })}</div>
      {answer && correct && <div className="answer-feedback" aria-live="polite">
        <strong>{answer.revealed ? messages.revealed[lang] : answer.correct ? messages.correct[lang] : LEARNING_TEXT.incorrectCount[lang]}</strong>
        <h3>{LEARNING_TEXT.correctExplanation[lang]}</h3><p>{correct.feedback[lang]}</p>
        {chosen && !answer.correct && <><h3>{LEARNING_TEXT.choiceExplanation[lang]}</h3><p>{chosen.feedback[lang]}</p></>}
        {question.target && <button onClick={() => s.inspectQuizStructure(engine.current?.captureCamera())}>{LEARNING_TEXT.inspect[lang]} ↗</button>}
      </div>}
      {confirmSession === quiz.sessionId ? <div className="practice-restart" role="group" aria-label={LEARNING_TEXT.newRound[lang]}><p>{LEARNING_TEXT.restartPrompt[lang]}</p><button onClick={restart}>{LEARNING_TEXT.confirmRestart[lang]}</button><button onClick={() => setConfirmSession(null)}>{LEARNING_TEXT.cancel[lang]}</button></div> : <button className="text-button" onClick={() => setConfirmSession(quiz.sessionId)}>{LEARNING_TEXT.newRound[lang]}</button>}
    </> : quiz ? <div className="quiz-result"><span className="eyebrow">{messages.quizComplete[lang]}</span><h2>{contextName(context, lang)}</h2><Results session={quiz} lang={lang}/></div> : null}
    {history.length > 0 && <details className="practice-history"><summary>{LEARNING_TEXT.history[lang]} ({history.length})</summary>{history.map((session, index) => <section key={session.sessionId}><h3>{LEARNING_TEXT.round[lang]} {index + 1} · {LEARNING_TEXT[session.index >= session.order.length ? 'complete' : 'incomplete'][lang]}</h3><p className="micro">{Object.keys(session.answers).length} / {session.order.length}</p><Results session={session} lang={lang}/></section>)}</details>}
  </div>;
}

export function PracticeActions({ engine }: { engine: EngineRef }) {
  const s = useStore(eyeStore); const quiz = s.quiz; const lang = s.lang;
  if (!quiz) return null;
  const question = currentQuestion(quiz);
  if (question) return quiz.answers[question.id]
    ? <button id="quiz-action" className="primary" onClick={s.advanceQuiz}>{messages[quiz.index === quiz.order.length - 1 ? 'result' : 'nextQuestion'][lang]} →</button>
    : <button onClick={s.revealQuiz}>{messages.reveal[lang]}</button>;
  const context = quiz.context as QuestionContext;
  const wrong = wrongQuestionIds(quiz);
  return <div className="practice-actions">
    <button disabled={!wrong.length} onClick={() => s.startPractice(context, false, true, engine.current?.captureCamera())}>{LEARNING_TEXT.reviewWrong[lang]} ({wrong.length})</button>
    <button className="primary" onClick={() => s.startPractice(context, true, false, engine.current?.captureCamera())}>{messages.retry[lang]} ↻</button>
    {context !== 'structures' && <button onClick={() => s.startLesson(context)}>{LEARNING_TEXT.backLesson[lang]}</button>}
    <button onClick={() => s.setMode('explore', engine.current?.captureCamera())}>{messages.backExplore[lang]}</button>
  </div>;
}
