# eyesight Implementation Plan

> Execution uses the approved chat design and user instruction to implement now. No additional approval gate or Git commit is needed.

**Goal:** A runnable bilingual adult right-eye demo with layers, clipping, optics, three short tours and structure identification.

**Architecture:** An imperative Three.js engine with camera/section helpers, data-driven anatomy, Zustand state and React panels. Eye geometry is procedural schematic educational geometry. Static Vite application with local preferences; adapted helper provenance is retained in THIRD_PARTY_NOTICES.md.

**Tech Stack:** React, TypeScript, Three.js, Zustand, Vite, Vitest; reuse upstream dependency families.

**Spec:** The accepted design in this conversation. Adults, right eye, Chinese/English, medical education and public science. No patient-specific measurement.

## Tasks
- [x] Scaffold project and shared types; retrieve and attribute upstream helpers.
- [x] Create 17 bilingual structure entries, three guided lessons and interface strings; test meaningful content and matching keys.
- [x] Implement tested paraxial optics and quiz scoring; focus is on the retina for normal/corrected, anterior for axial myopia; revealed answers never score.
- [x] Implement schematic right-eye mesh groups, camera, selection, layer visibility, isolation, three clipping axes, separation and optical rays.
- [x] Build responsive React workspace, language toggle, structure search/cards, layers, guide and quiz; preserve language preference and answer safety.
- [x] Independent LLM translation and code review; fix material findings, run unit tests/typecheck/build, inspect desktop/mobile browser flows, package runnable source and static build.

## Interfaces
Shared data and scene types live in `src/anatomy/types.ts`. Data exports `STRUCTURES`, `GROUPS`, `LESSONS` from `src/anatomy/data.ts`; strings export `messages` from `src/content/messages.ts`. Engine exports `EyeEngine` from `src/engine/EyeEngine.ts`: constructor(host, onSelect), setState(SceneState), focus(StructureId), setView(ViewPreset), zoom(number), resetCamera(), dispose(). Optics exports `computeOptics(OpticsPreset)` with documented numeric rays; quiz module exports typed pure functions for creating/submitting/revealing/advancing a round.

## Review focus
1. Language switching during tours and quizzes keeps progress and translates all visible text.
2. Hidden/clipped structures cannot intercept visible selection; hidden targets can be revealed by the tree.
3. Quiz answers do not leak from labels, structure names, detail cards or URL before submission.
4. Reset and mode transitions restore a usable scene; malformed local storage falls back safely.
5. WebGL failure and reduced-motion preferences remain usable; mobile panels do not cover all controls.

## Verification
Tests cover registry/i18n coverage, optical focal relationships and rays, quiz scoring/reveal, store transitions and persistence. Browser checks cover selecting, clipping, language changes, optics presets, all lesson steps and quiz completion. `npm test`, `npm run typecheck`, `npm run build` must pass. UI automation uses the desktop browser only; ARTEMIS is outside this task.
