# Third-party notices

## Dental Scope

Source: https://github.com/Yoosseph/dental-scope (main branch, retrieved 2026-10-22).

Eyesight adapts the source code in `src/engine/camera.ts`, `animator.ts` and `section.ts` for the eye renderer. Camera fitting/spherical transitions, named animations and camera-facing clipping retain the upstream approach. Data/state/render separation, registry-driven panels and quiz layout also follow the upstream architecture.

The upstream source code is MIT-licensed. Copyright (c) 2026 Yoseph and Dental Scope contributors. The required permission notice is preserved in LICENSE.

No upstream dental model, BodyParts3D mesh, texture, or educational paragraph is redistributed. The eye meshes are newly authored procedural teaching illustrations. Eyesight's Chinese/English teaching content is newly written with the medical references linked in the structure records; those references do not license copying their site assets.

The upstream repository licenses its dental models and educational text separately (CC BY-SA); those materials are not part of this demo. This is a derivative prototype, not an official Dental Scope release.

A commit SHA was not available from the retrieval endpoint. The following SHA-256 hashes identify the exact downloaded source files used, before adaptation:

| Source file | SHA-256 |
| --- | --- |
| `src/engine/camera.ts` | `27e179af603aa24db9242b0a6362b888502ab7fe8a9c8d6a63170e1379947089` |
| `src/engine/animator.ts` | `efa7c6828af98e7a736c97354e66b1f238ce7174218e8df64a530ada1c5cc1a3` |
| `src/engine/section.ts` | `7c1820ee798b4020e19859b1abbadd0e8f8ca821dd2cad6e6751f12d0f5fed74` |

## Dependencies

React, Three.js, Zustand, Vite, TypeScript and Vitest are installed from npm. Exact versions are pinned in package-lock.json; each package retains its own bundled license. Browser code does not call a translation service, load external fonts, collect user data or submit quiz results.
