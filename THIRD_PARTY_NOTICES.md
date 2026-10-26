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

## Skull context model

`public/models/skull-context.glb` is adapted from [ScatteringSkull in Khronos glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/ScatteringSkull), retrieved 2026-10-24. The [source notice](https://github.com/KhronosGroup/glTF-Sample-Assets/blob/main/Models/ScatteringSkull/README.md) credits Vladimir Petkovic and dedicates the model under [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/legalcode). The embedded source copyright reads: `2025 (c) Adobe Inc., model by Vladimir Petkovic, CC0 1.0 Universal`.

The original GLB SHA-256 is `339eafce3fdbc4175ed4798addba7d0c175cb0dab316e9d91abc053422050a00`. Eyesight reduces the geometry from 188,871 to 29,999 triangles, removes textures and material extensions, and bakes a uniform scale, rotation and translation to approximately register the right orbital socket with the existing eye. The resulting asset is 596,428 bytes and retains vertex normals. The skull supplies passive spatial context, including the mandible; it is not a clinically calibrated anatomy model and does not add individually selectable skull bones.

`public/models/skull-preview.glb` is a second, lower-detail derivative of that same CC0 asset for progressive loading. It contains 9,999 triangles and 6,369 vertices in 214,632 bytes, with the same coordinates and retained vertex normals. Offline reduction used meshoptimizer's attribute-aware simplifier with locked borders, normal weights of 0.25 and a relative error cap of 0.02; meshoptimizer is not needed to decode the asset at runtime. The existing 29,999-triangle model remains the detailed replacement. The preview SHA-256 is `ba631f3a993d6e09c0e63033640b2e81b785e261c46a8397665dfc5883cd1a33`; its input SHA-256 is `290e511a1333b148ad5fe364610befa937a29bcdaf1f64aa054117aae246a5da`.

## Dependencies

React, Three.js, Zustand, Vite, TypeScript and Vitest are installed from npm. Exact versions are pinned in package-lock.json; each package retains its own bundled license. Browser code does not call a translation service, load external fonts, collect user data or submit quiz results.
