<div align="center">
  <img src="public/favicon.svg" width="72" height="72" alt="eyesight icon">

# eyesight

[简体中文](README.md) · **English**

**See how seeing happens.**

Interactive eye anatomy, optics, and common eye conditions for physician-led explanations.

[Live demo](https://tipsypotato.github.io/eyesight/) · [Features](#features) · [Quick start](#quick-start) · [Progress & roadmap (Chinese)](docs/development-status-2026-10-22.md)

</div>

![eyesight interactive preview](preview.png)

eyesight is a frontend-only 3D educational tool. Physicians can select a structure or condition, point out its location, adjust the model, and compare normal anatomy with changes while explaining them to patients and the public. No account or backend is required. The interface supports Chinese and English, with layouts for desktop and mobile screens.

> [!IMPORTANT]
> This project provides educational illustrations. Its geometry, optics, and condition effects are not clinically calibrated and do not provide diagnoses, prescriptions, or predictions of treatment outcomes. Medical content still awaits expert review.

## Features

| Workspace | Capabilities |
| --- | --- |
| Anatomy | 51 selectable tissues, regions, and spaces in an adult right eye; extraocular muscles, conjunctiva, eyelids, orbit and its contents, and a skull reference; search, layers, isolation, related structures, ten presets, sections along three axes, and separated or tiled layouts |
| Light & focus | Normal focus, axial myopia, and lens correction; five parameter groups, 2D and 3D rays from the same optical model, controlled comparisons, and pupil, accommodation, and neural signal demonstrations |
| Guided tours | Three tours with 11 steps and 11 optional observation tasks; return to exploration at any time |
| Check understanding | 29 questions on anatomy, tour topics, and eye conditions, with separate sessions, explanations, and review of incorrect answers |
| Common eye conditions | Cataracts, glaucoma, strabismus, and amblyopia, with normal/changed views, mechanism explanations, and optional questions |

Each visit starts with all structures and the skull visible. Eye geometry is generated procedurally, and the skull uses CC0 assets bundled with the project. A simplified skull appears first, followed by the detailed model and iris textures; the eye remains usable if these assets fail to load.

## How to use

1. Open the [live demo](https://tipsypotato.github.io/eyesight/). In **Anatomy**, search for or click a structure to read about its location, function, and sources. Use observation presets, sectioning, and layer separation to inspect internal structures.
2. Switch to **Light & focus** to adjust parameters and save a comparison, or open **Common eye conditions** to compare normal and changed views. Tours and questions are optional; there is no required lesson sequence.
3. On desktop, drag to rotate and use the scroll wheel to zoom. On mobile, swiping scrolls the page by default. Select **Interact with model** to rotate, pinch to zoom, or drag the section frame. Use the upper-right controls to switch languages or open the GitHub repository.

> [!NOTE]
> Language preferences, tour progress, answers, and condition records are stored only in the current browser, with no cross-device sync. Reloading returns to the all-structures overview while retaining progress. Clearing browser storage removes these records; there is no server backup.

## Quick start

You need Git, npm, and Node.js 22.x starting at 22.12, 24.x, or 26+. The current local verification environment uses Node.js 26.5.0 and npm 11.17.0; CI uses Node.js 26. Your browser must have JavaScript enabled and support WebGL.

```sh
git clone https://github.com/tipsypotato/eyesight.git
cd eyesight
npm ci
npm run dev
```

Open the URL printed in the terminal, usually [http://127.0.0.1:5173](http://127.0.0.1:5173). The development server binds to the local machine only. No API keys or environment variables are needed.

## Local development

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server with hot reload |
| `npm test -- --maxWorkers=1` | Run all Vitest tests, using the same command as CI |
| `npm run typecheck` | Check TypeScript types |
| `npm run build` | Check types and build the application into `dist/` |
| `npm run preview` | Preview an existing build, usually at `http://127.0.0.1:4173` |

Built with React, TypeScript, Three.js, Zustand, Vite, and Vitest. Content and translations are bundled with the application; no runtime translation service is used.

Main directories:

| Directory | Responsibility |
| --- | --- |
| `src/anatomy/`, `src/content/` | Structures, relationships, bilingual descriptions, and question banks |
| `src/engine/` | Geometry, rendering, cameras, sectioning, optics, and condition effects |
| `src/state/`, `src/modes/` | Scene drafts, local persistence, question sessions, and demonstration state |
| `src/ui/`, `src/styles/` | Responsive workspaces and controls |
| `public/`, `scripts/` | Static assets and iris texture generation |
| `docs/` | Feature documentation, planned work, and pending validation |

After changing the iris pixel algorithm, run `node scripts/bake-iris-textures.mjs` with Node.js 26 to regenerate the bundled asset. Each feature iteration updates the [feature checklist](docs/development-status-2026-10-22.md) and is committed to local Git. See [AGENTS.md](AGENTS.md) for maintenance rules; both documents are in Chinese.

## Deployment

Run `npm run build`, then serve `dist/` through a static HTTP server. Relative asset paths support subpaths such as `/eyesight/` on GitHub Pages. Opening `dist/index.html` directly from the filesystem is not supported.

The repository includes a [GitHub Pages workflow](.github/workflows/pages.yml). A push to `main`, or a manual Actions run on `main`, installs locked dependencies, runs tests, builds the application (including type checks), and publishes `dist/` after successful checks. Set **Settings → Pages → Source** to **GitHub Actions**. Failed checks leave the published site unchanged.

The live version corresponds to the commit successfully deployed by [Actions](https://github.com/tipsypotato/eyesight/actions/workflows/pages.yml). Local and live-site browser records are separate. To roll back, push the appropriate `git revert` commit to `main` and let the workflow validate and redeploy it.

## Troubleshooting

- **Skull unavailable or only the simplified version appears?** The eye remains usable. If the detailed model fails to load, the simplified reference stays visible. Turn **Skull reference** off and on to retry. See [startup and progressive loading](docs/development-status-2026-10-22.md#启动与渐进加载) (Chinese) for loading stages and asset details.
- **Seeing `504 Outdated Optimize Dep` during development?** Stop the development server, run `npm run dev -- --force`, and refresh the page. Any additional temporary Vite server must use its own `cacheDir`. There is no need to clear browser records.
- **Dragging on mobile scrolls the page?** This is the default browsing behavior. Select **Interact with model** to rotate and zoom; exit that mode to resume page scrolling.

## Limitations and planned work

Retinal microstructure, scene-sharing links, PNG export, a presentation mode, and a structure atlas remain optional future work. Dynamic muscles, blinking, the complete lacrimal apparatus, and detailed orbital networks are not implemented. See the [planned work and pending validation checklist](docs/development-status-2026-10-22.md#待实现及待验证清单) (Chinese).

Actual test, build, browser-check, and deployment results are recorded under [validation scope](docs/development-status-2026-10-22.md#验证范围) (Chinese). Real-device testing, low-end GPU testing, and comprehensive browser and screen-reader validation remain outstanding. LLM checks for consistency between Chinese and English do not replace medical expert review.

Author: tipsypotato · Code licensed under [MIT](LICENSE) · [Third-party notices and sources](THIRD_PARTY_NOTICES.md)
