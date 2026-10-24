import { describe, expect, it } from 'vitest';
import { ADNEXAL_IDS, ORBITAL_IDS, STRUCTURE_IDS } from '../anatomy/types';
import { CONTENT_VERSION, questionsFor } from '../content/questions';
import { createSession, submitSessionAnswer, wrongQuestionIds } from '../modes/quiz';
import { parseProgress, type PersistedDraft, type SavedProgress } from './progress';

const draft = (): PersistedDraft => ({
  selectedId: 'lens', layers: Object.fromEntries(STRUCTURE_IDS.map(id => [id, 'on'])) as PersistedDraft['layers'], isolateId: null,
  clip: { enabled: true, axis: 'sagittal', offset: 0.2, keepSide: 'negative' }, presetId: 'wall-cut',
  explode: 0.3, labels: true, view: 'side', opticsPreset: 'normal',
  opticsInput: { axialIncrement: 0, objectDistance: 'far', accommodation: 0, pupil: 'medium', externalLens: 'off' }, opticsExperiment: 'free',
  comparison: null, physiology: null, showOptics: true, showSkull: false,
  camera: { position: [3, 2, 4], target: [0.2, 0, 0], zoom: 1.2,
    viewport: { aspect: 1.6, usableFraction: [0.8, 0.7] }, viewOffset: { fullWidth: 1000, fullHeight: 625, offsetX: -40, offsetY: 20, width: 1000, height: 625 } },
  isolationLayers: null, lessonId: null, step: 0,
});
const saved = (): SavedProgress => ({ schemaVersion: 3, contentVersion: CONTENT_VERSION, mode: 'explore', drafts: { explore: draft() }, lessonPositions: {}, tourTasks: {}, sessions: {}, activeSessions: {}, activeQuizId: null });
it('migrates pre-orbit scenes and isolation snapshots without discarding their scene or answers', () => {
  const value = saved(), scene = value.drafts.explore!;
  scene.isolateId = 'lens'; scene.isolationLayers = { ...scene.layers };
  for (const id of ORBITAL_IDS) { delete (scene.layers as Partial<typeof scene.layers>)[id]; delete (scene.isolationLayers as Partial<typeof scene.layers>)[id]; }
  const session = createSession('structures', questionsFor('structures'));
  value.sessions[session.sessionId] = session; value.activeSessions.structures = session.sessionId;
  const result = parseProgress(JSON.stringify(value));
  expect(result.discarded).toBe(false);
  expect(result.value?.drafts.explore).toMatchObject({ selectedId: 'lens', isolateId: 'lens', camera: scene.camera, clip: scene.clip });
  for (const id of ORBITAL_IDS) {
    expect(result.value?.drafts.explore?.layers[id]).toBe('off');
    expect(result.value?.drafts.explore?.isolationLayers?.[id]).toBe('off');
  }
  expect(result.value?.sessions).toEqual(value.sessions);
});

it('restores orbital selections and presets but rejects malformed orbital layers', () => {
  const value = saved();
  Object.assign(value.drafts.explore!, { selectedId: 'ciliary-ganglion', isolateId: 'ciliary-ganglion', presetId: 'orbit', clip: { enabled: true, axis: 'coronal', offset: -2.1, keepSide: 'negative' } });
  const result = parseProgress(JSON.stringify(value));
  expect(result.discarded).toBe(false);
  expect(result.value?.drafts.explore).toEqual(value.drafts.explore);
  const invalid = JSON.parse(JSON.stringify(value));
  invalid.drafts.explore.layers['ciliary-ganglion'] = 'invalid';
  expect(parseProgress(JSON.stringify(invalid)).value?.drafts.explore).toBeUndefined();
});

it('restores older scenes and isolation snapshots with the new eyelid structures hidden', () => {
  const value = saved(), scene = value.drafts.explore!;
  scene.isolateId = 'lens'; scene.isolationLayers = { ...scene.layers };
  for (const id of ADNEXAL_IDS) { delete (scene.layers as Partial<typeof scene.layers>)[id]; delete (scene.isolationLayers as Partial<typeof scene.layers>)[id]; }
  const session = createSession('structures', questionsFor('structures'));
  value.sessions[session.sessionId] = session; value.activeSessions.structures = session.sessionId;
  const result = parseProgress(JSON.stringify(value));
  expect(result.discarded).toBe(false);
  expect(result.value?.drafts.explore).toMatchObject({ selectedId: 'lens', isolateId: 'lens', camera: scene.camera, clip: scene.clip });
  for (const id of ADNEXAL_IDS) {
    expect(result.value?.drafts.explore?.layers[id]).toBe('off');
    expect(result.value?.drafts.explore?.isolationLayers?.[id]).toBe('off');
  }
  expect(result.value?.sessions).toEqual(value.sessions);
});

it('restores an eyelid preset and gland selection while rejecting invalid added layers', () => {
  const value = saved();
  Object.assign(value.drafts.explore!, { selectedId: 'meibomian-glands', isolateId: 'meibomian-glands', presetId: 'eyelids' });
  const result = parseProgress(JSON.stringify(value));
  expect(result.discarded).toBe(false);
  expect(result.value?.drafts.explore).toEqual(value.drafts.explore);
  const invalid = JSON.parse(JSON.stringify(value));
  invalid.drafts.explore.layers['meibomian-glands'] = 'invalid';
  expect(parseProgress(JSON.stringify(invalid)).value?.drafts.explore).toBeUndefined();
});

it('restores pre-muscle drafts and isolation layers without discarding the previous scene or answers', () => {
  const value = saved(), scene = value.drafts.explore!;
  scene.isolateId = 'lens'; scene.isolationLayers = { ...scene.layers };
  const muscles = ['superior-rectus', 'inferior-rectus', 'medial-rectus', 'lateral-rectus', 'superior-oblique', 'inferior-oblique'] as const;
  for (const id of muscles) { delete (scene.layers as Partial<typeof scene.layers>)[id]; delete (scene.isolationLayers as Partial<typeof scene.layers>)[id]; }
  const session = createSession('structures', questionsFor('structures'));
  value.sessions[session.sessionId] = session; value.activeSessions.structures = session.sessionId;
  const result = parseProgress(JSON.stringify(value));
  expect(result.discarded).toBe(false);
  expect(result.value?.drafts.explore).toMatchObject({ selectedId: 'lens', isolateId: 'lens', camera: scene.camera, clip: scene.clip });
  for (const id of muscles) {
    expect(result.value?.drafts.explore?.layers[id]).toBe('off');
    expect(result.value?.drafts.explore?.isolationLayers?.[id]).toBe('off');
  }
  expect(result.value?.sessions).toEqual(value.sessions);
});

it('restores a saved muscle selection and preset while rejecting an invalid muscle layer', () => {
  const value = saved();
  Object.assign(value.drafts.explore!, { selectedId: 'superior-oblique', isolateId: 'superior-oblique', presetId: 'extraocular' });
  const result = parseProgress(JSON.stringify(value));
  expect(result.discarded).toBe(false);
  expect(result.value?.drafts.explore).toEqual(value.drafts.explore);
  const invalid = JSON.parse(JSON.stringify(value));
  invalid.drafts.explore.layers['superior-oblique'] = 'invalid';
  expect(parseProgress(JSON.stringify(invalid)).value?.drafts.explore).toBeUndefined();
});
const parse = (value: unknown) => parseProgress(JSON.stringify(value));

describe('saved progress boundary', () => {
  it('distinguishes a new visit from invalid JSON and unknown schemas', () => {
    expect(parseProgress(null)).toEqual({ value: null, discarded: false });
    for (const raw of ['', '{bad', '[]', 'null', '{"schemaVersion":999}', '{"schemaVersion":2,"contentVersion":3}']) {
      expect(parseProgress(raw)).toEqual({ value: null, discarded: true });
    }
  });

  it.each([0.8, 1])('migrates legacy separation %s without changing its displacement, camera, cut or answers', explode => {
    const old = { ...saved(), schemaVersion: 2 };
    old.drafts.explore!.explode = explode;
    old.drafts.explore!.isolateId = 'lens';
    old.drafts.explore!.isolationLayers = { ...old.drafts.explore!.layers };
    old.drafts.optics = { ...draft(), explode: 1 };
    const question = questionsFor('structures')[0];
    const session = submitSessionAnswer(createSession('structures', [question]), question.correctOptionId);
    old.sessions[session.sessionId] = session; old.activeSessions.structures = session.sessionId;
    const result = parse(old);
    expect(result.discarded).toBe(false);
    expect(result.value?.schemaVersion).toBe(3);
    expect(result.value?.drafts.explore).toEqual({ ...old.drafts.explore, explode: explode / 4.5 });
    expect(result.value?.drafts.optics).toEqual({ ...old.drafts.optics, explode: 1 / 4.5 });
    expect(result.value?.sessions).toEqual(old.sessions);
    expect(result.value?.activeSessions).toEqual(old.activeSessions);
    expect(parse(result.value)).toEqual(result);
  });
  it('preserves a new flat layout and its fitted camera without applying legacy scaling', () => {
    const value = saved(), scene = value.drafts.explore!;
    scene.explode = 0.83; scene.view = 'front';
    scene.camera = { position: [0, 0, 35], target: [0, 0, 0], zoom: 1 };
    const result = parse(value);
    expect(result.discarded).toBe(false);
    expect(result.value?.schemaVersion).toBe(3);
    expect(result.value?.drafts.explore).toEqual(scene);
  });

  it('restores allowed scene fields, drops transient fields, and pauses a valid demonstration', () => {
    const value = saved(); const optics = draft();
    optics.physiology = { kind: 'signal', step: 1, playing: true, returnInput: { ...optics.opticsInput }, returnPreset: 'normal', returnExperiment: 'free', returnShowOptics: false };
    value.drafts.optics = Object.assign(optics, { lang: 'en', relatedIds: ['lens'], undoCount: 99, quizRevealed: true });
    const result = parse(value);
    expect(result.discarded).toBe(false);
    expect(result.value?.drafts.explore).toEqual(value.drafts.explore);
    expect(result.value?.drafts.optics?.physiology).toMatchObject({ kind: 'signal', step: 1, playing: false });
    for (const field of ['lang', 'relatedIds', 'undoCount', 'quizRevealed']) expect(result.value?.drafts.optics).not.toHaveProperty(field);
  });

  it('keeps valid scene drafts but discards learning semantics from an unknown content version', () => {
    const value = saved(); const session = createSession('anatomy', questionsFor('anatomy'));
    value.contentVersion = 'unknown-future'; value.lessonPositions = { anatomy: 2 };
    value.tourTasks = { 'anatomy:0': { status: 'done', actions: ['select:sclera'], hint: false } };
    value.sessions = { [session.sessionId]: session }; value.activeSessions = { anatomy: session.sessionId }; value.activeQuizId = session.sessionId;
    const result = parse(value);
    expect(result.discarded).toBe(true);
    expect(result.value?.drafts).toEqual(value.drafts);
    expect(result.value).toMatchObject({ contentVersion: CONTENT_VERSION, mode: 'explore', lessonPositions: {}, tourTasks: {}, sessions: {}, activeSessions: {}, activeQuizId: null });
    expect(parse(result.value).discarded).toBe(false);
  });

  it('drops only an unsupported session and its pointers under a current content version', () => {
    const value = saved(); const healthy = createSession('vision', questionsFor('vision'));
    const unknown = { ...createSession('anatomy', questionsFor('anatomy')), contentVersion: 'unknown-future' };
    value.sessions = { [healthy.sessionId]: healthy, [unknown.sessionId]: unknown };
    value.activeSessions = { vision: healthy.sessionId, anatomy: unknown.sessionId }; value.activeQuizId = unknown.sessionId;
    value.tourTasks = { 'anatomy:0': { status: 'done', actions: ['select:sclera'], hint: false } };
    const result = parse(value);
    expect(result.discarded).toBe(true);
    expect(result.value).toMatchObject({ sessions: { [healthy.sessionId]: healthy }, activeSessions: { vision: healthy.sessionId }, activeQuizId: null });
    expect(Object.keys(result.value!.sessions)).toEqual([healthy.sessionId]);
    expect(result.value?.tourTasks).toEqual(value.tourTasks);
    expect(result.value?.drafts).toEqual(value.drafts);
  });

  it.each([
    ['structure', { selectedId: 'unknown' }], ['layer', { layers: { sclera: 'on' } }],
    ['clip', { clip: { enabled: true, axis: 'sagittal', offset: 6.01, keepSide: 'negative' } }],
    ['explode', { explode: -1 }], ['optics', { opticsInput: { axialIncrement: 1.1, accommodation: 0, objectDistance: 'far', pupil: 'medium', externalLens: 'off' } }],
    ['preset', { opticsPreset: 'surgery' }], ['camera zoom', { camera: { position: [3, 2, 4], target: [0, 0, 0], zoom: 0 } }],
    ['camera overflow', { camera: { position: [1e308, 2, 4], target: [0, 0, 0], zoom: 1 } }],
    ['camera coincident', { camera: { position: [0, 0, 0], target: [0, 0, 0], zoom: 1 } }],
    ['viewport fraction', { camera: { position: [3, 2, 4], target: [0, 0, 0], zoom: 1, viewport: { aspect: 1, usableFraction: [0, 1] } } }],
    ['lesson position', { lessonId: 'anatomy', step: 4 }],
    ['comparison', { comparison: { showing: 'reference', input: {} } }],
    ['physiology', { physiology: { kind: 'signal', step: 99 } }],
  ])('discards an invalid %s draft without losing a healthy workspace', (_name, patch) => {
    const value = saved(); value.drafts.optics = Object.assign(draft(), patch);
    const result = parse(value);
    expect(result.discarded).toBe(true);
    expect(result.value?.drafts.optics).toBeUndefined();
    expect(result.value?.drafts.explore).toEqual(value.drafts.explore);
  });

  it.each([-6, -5.9, 5.9, 6])('restores expanded separation clipping at %s without changing saved scene data', offset => {
    const value = saved();
    const scene = value.drafts.explore!;
    scene.explode = 0.66; scene.presetId = 'orbit'; scene.clip.offset = offset;
    const result = parse(value);
    expect(result.discarded).toBe(false);
    expect(result.value?.drafts.explore).toEqual(scene);
    scene.explode = 0.83; scene.view = 'front';
    const flat = parse(value);
    expect(flat.discarded).toBe(false);
    expect(flat.value?.drafts.explore).toEqual(scene);
  });
  it.each([-6.01, 6.01, NaN, Infinity, -Infinity])('rejects invalid expanded clipping offset %s without discarding other workspaces', offset => {
    const value = saved(); value.drafts.optics = draft();
    value.drafts.explore!.clip.offset = offset;
    const result = parse(value);
    expect(result.discarded).toBe(true);
    expect(result.value?.drafts.explore).toBeUndefined();
    expect(result.value?.drafts.optics).toEqual(value.drafts.optics);
  });

  it('recovers independent modules while rejecting mismatched references', () => {
    const value = saved(); const session = createSession('vision', questionsFor('vision'));
    value.sessions = { [session.sessionId]: session, broken: {} as typeof session };
    value.activeSessions = { vision: session.sessionId, anatomy: session.sessionId, unknown: session.sessionId };
    value.activeQuizId = 'missing';
    value.lessonPositions = { anatomy: 3, vision: 1.5, missing: 0 };
    value.tourTasks = { 'anatomy:1': { status: 'done', actions: ['select:sclera', 'select:choroid', 'select:retina'], hint: false },
      'vision:1': { status: 'done', actions: [], hint: false } };
    const result = parse(value);
    expect(result.discarded).toBe(true);
    expect(result.value?.sessions).toEqual({ [session.sessionId]: session });
    expect(result.value?.activeSessions).toEqual({ vision: session.sessionId });
    expect(result.value?.activeQuizId).toBeNull();
    expect(result.value?.lessonPositions).toEqual({ anatomy: 3 });
    expect(Object.keys(result.value!.tourTasks)).toEqual(['anatomy:1']);
  });

  it.each([
    { status: 'done', actions: ['select:sclera'], hint: false },
    { status: 'visited', actions: ['select:choroid'], hint: false },
    { status: 'visited', actions: ['select:sclera', 'select:choroid', 'select:retina'], hint: false },
    { status: 'done', actions: ['select:sclera', 'select:choroid', 'select:retina'], hint: true },
  ])('rejects forged or inconsistent operation completion %#', progress => {
    const result = parse({ ...saved(), tourTasks: { 'anatomy:1': progress } });
    expect(result.discarded).toBe(true);
    expect(result.value?.tourTasks).toEqual({});
  });

  it('keeps a valid task prefix and normalizes a missing module without throwing', () => {
    const result = parse({ ...saved(), mode: 'future', sessions: null, drafts: null,
      tourTasks: { 'anatomy:1': { status: 'visited', actions: ['select:sclera'], hint: true } } });
    expect(result.discarded).toBe(true);
    expect(result.value).toMatchObject({ mode: 'explore', sessions: {}, drafts: {}, tourTasks: { 'anatomy:1': { status: 'visited', actions: ['select:sclera'], hint: true } } });
  });

  it('uses version-aware session restoration and removes retired questions from review', () => {
    const value = saved(); const session = createSession('structures', questionsFor('structures').slice(0, 1));
    session.contentVersion = '2026-10-22-t07-preview'; session.order.unshift('retired'); session.index = 1;
    session.optionOrder.retired = ['retired'];
    session.answers.retired = { selected: null, revealed: true, correct: false, submittedAt: 1 };
    value.contentVersion = '2026-10-22-t07-preview'; value.sessions[session.sessionId] = session;
    value.activeSessions.structures = session.sessionId; value.activeQuizId = session.sessionId;
    const result = parse(value); expect(result.value).not.toBeNull();
    const restored = result.value!.sessions[session.sessionId];
    expect(result.discarded).toBe(true);
    expect(restored.order).toEqual(['cornea']); expect(restored.index).toBe(0);
    expect(wrongQuestionIds(restored)).toEqual([]);
    expect(result.value?.activeQuizId).toBe(session.sessionId);
    expect(result.value?.contentVersion).toBe(CONTENT_VERSION); expect(restored.contentVersion).toBe(CONTENT_VERSION);
    expect(parse(result.value).discarded).toBe(false);
  });

  it('rejects overflowing JSON numbers before restoring a camera or optical input', () => {
    const value = saved(); value.drafts.optics = draft();
    const raw = JSON.stringify(value).replace('"zoom":1.2', '"zoom":1e999');
    const result = parseProgress(raw);
    expect(result.discarded).toBe(true);
    expect(result.value?.drafts.explore).toBeUndefined();
    expect(result.value?.drafts.optics).toEqual(value.drafts.optics);
  });

  it('rejects a demonstration whose current input contradicts its saved step', () => {
    const value = saved(); const optics = draft();
    optics.physiology = { kind: 'accommodation', step: 3, playing: false, returnInput: { ...optics.opticsInput }, returnPreset: 'normal', returnExperiment: 'free', returnShowOptics: false };
    value.drafts.optics = optics;
    const result = parse(value);
    expect(result.discarded).toBe(true);
    expect(result.value?.drafts.optics).toBeUndefined();
    expect(result.value?.drafts.explore).toBeDefined();
  });

  it('recomputes tampered answer correctness and rejects mismatched session keys', () => {
    const value = saved(); const original = createSession('structures', questionsFor('structures').slice(0, 1));
    const session = submitSessionAnswer(original, 'iris'); session.answers.cornea.correct = true;
    value.sessions = { [session.sessionId]: session, alias: session };
    value.activeSessions = { structures: session.sessionId }; value.activeQuizId = session.sessionId;
    const result = parse(value);
    expect(result.discarded).toBe(true);
    expect(result.value?.sessions[session.sessionId].answers.cornea.correct).toBe(false);
    expect(result.value?.sessions.alias).toBeUndefined();
    expect(wrongQuestionIds(result.value!.sessions[session.sessionId])).toEqual(['cornea']);
  });
});


it('restores optional skull visibility without enabling it in legacy scenes', () => {
  const value = saved();
  delete value.drafts.explore!.showSkull;
  const legacy = parseProgress(JSON.stringify(value));
  expect(legacy.discarded).toBe(false);
  expect(legacy.value?.drafts.explore).toMatchObject({ showSkull: false, camera: value.drafts.explore!.camera });
  value.drafts.explore!.showSkull = true;
  expect(parseProgress(JSON.stringify(value)).value?.drafts.explore?.showSkull).toBe(true);
  for (const invalid of [null, 1, 'true', {}, []]) {
    const payload = JSON.parse(JSON.stringify(value)); payload.drafts.explore.showSkull = invalid;
    const result = parseProgress(JSON.stringify(payload));
    expect(result.discarded).toBe(true);
    expect(result.value?.drafts.explore).toBeUndefined();
  }
});
