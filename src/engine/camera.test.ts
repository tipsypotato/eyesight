import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Animator } from './animator';
import { CameraRig } from './camera';

function setup() {
  const document = new EventTarget();
  const canvas = Object.assign(new EventTarget(), {
    style: { touchAction: '', cursor: 'crosshair' }, clientWidth: 600, clientHeight: 400,
    ownerDocument: document, getRootNode: () => document,
    setPointerCapture: () => {}, releasePointerCapture: () => {},
  });
  const camera = new THREE.PerspectiveCamera(40, 1.5, 0.02, 50);
  camera.position.set(3, 2, 5);
  const animator = new Animator();
  const rig = new CameraRig(camera, canvas as unknown as HTMLElement, animator);
  const pointer = (target: EventTarget, type: string, x: number, y: number) => target.dispatchEvent(Object.assign(new Event(type), {
    pointerId: 1, pointerType: 'mouse', button: 0, clientX: x, clientY: y,
    ctrlKey: false, metaKey: false, shiftKey: false,
  }));
  return { camera, animator, rig, canvas, document, pointer };
}

const expectVector = (actual: THREE.Vector3, expected: number[]) => actual.toArray().forEach((value, i) => expect(value).toBeCloseTo(expected[i], 12));

describe('workspace camera lifecycle', () => {
  it.each([['fovea', 0.06], ['lens', 0.55]] as const)('preserves the %s focus and user zoom through panel resizing', (_name, radius) => {
    const { camera, animator, rig } = setup();
    animator.reducedMotion = true;
    const center = new THREE.Vector3(0.2, -0.1, 0.3);
    try {
      rig.setViewport(390, 300, { x: 8, y: 110, width: 374, height: 174 });
      rig.focus(center, radius, new THREE.Vector3(0, 0, 1));
      rig.zoom(0.25);
      const relativeZoom = camera.position.distanceTo(center) / rig.distanceFor(radius);
      const direction = camera.position.clone().sub(center).normalize();
      for (const [width, height, available] of [
        [320, 568, { x: 150, y: 100, width: 150, height: 450 }],
        [844, 390, { x: 8, y: 80, width: 828, height: 280 }],
        [390, 300, { x: 8, y: 110, width: 374, height: 174 }],
      ] as const) {
        rig.setViewport(width, height, available);
        camera.updateMatrixWorld(true);
        expect(camera.position.distanceTo(center) / rig.distanceFor(radius)).toBeCloseTo(relativeZoom);
        expect(camera.position.clone().sub(center).normalize().dot(direction)).toBeCloseTo(1);
        expectVector(rig.controls.target, center.toArray());
        for (let latitude = 0; latitude <= 12; latitude++) for (let longitude = 0; longitude < 24; longitude++) {
          const point = new THREE.Vector3().setFromSphericalCoords(radius, latitude * Math.PI / 12, longitude * Math.PI / 12).add(center).project(camera);
          const x = (point.x + 1) * width / 2, y = (1 - point.y) * height / 2;
          expect(x).toBeGreaterThan(available.x); expect(x).toBeLessThan(available.x + available.width);
          expect(y).toBeGreaterThan(available.y); expect(y).toBeLessThan(available.y + available.height);
        }
      }
      rig.setViewport(390, 300);
      camera.updateMatrixWorld(true);
      expect(camera.view?.enabled ?? false).toBe(false);
      const projected = center.clone().project(camera);
      expect(projected.x).toBeCloseTo(0); expect(projected.y).toBeCloseTo(0);
      expect(camera.position.distanceTo(center) / rig.distanceFor(radius)).toBeCloseTo(relativeZoom);
    } finally { rig.controls.dispose(); }
  });

  it('defers repeated resize fitting until an orbit gesture ends and applies it once', () => {
    const { camera, animator, rig, canvas, document, pointer } = setup();
    animator.reducedMotion = true;
    try {
      rig.setViewport(600, 400); rig.focus(new THREE.Vector3(), 0.4);
      const distance = camera.position.length(), fit = rig.distanceFor(0.4);
      pointer(canvas, 'pointerdown', 100, 100);
      rig.setViewport(400, 600, { x: 10, y: 100, width: 180, height: 450 });
      rig.setViewport(320, 568, { x: 10, y: 100, width: 150, height: 400 });
      expect(camera.position.length()).toBeCloseTo(distance);
      pointer(document, 'pointerup', 100, 100);
      const resized = camera.position.length();
      expect(resized).toBeCloseTo(distance * rig.distanceFor(0.4) / fit);
      pointer(document, 'pointerup', 100, 100);
      expect(camera.position.length()).toBeCloseTo(resized);
      expect(animator.active).toBe(false);
    } finally { rig.controls.dispose(); }
  });

  it('adapts an in-flight focus or zoom to the latest available viewport', () => {
    const { camera, animator, rig } = setup();
    const center = new THREE.Vector3(0.2, 0, 0.3);
    try {
      rig.setViewport(600, 400); rig.focus(center, 0.4);
      animator.tick(0.1);
      rig.setViewport(320, 568, { x: 10, y: 100, width: 150, height: 450 });
      animator.tick(1);
      expectVector(rig.controls.target, center.toArray());
      expect(camera.position.distanceTo(center)).toBeCloseTo(rig.distanceFor(0.4));
      rig.zoom(0.2); animator.tick(0.05);
      rig.setViewport(600, 400); animator.tick(1);
      expect(camera.position.distanceTo(center)).toBeCloseTo(rig.distanceFor(0.4) * Math.exp(0.2));
    } finally { rig.controls.dispose(); }
  });

  it('re-fits a restored snapshot using its saved usable viewport', () => {
    const { camera, animator, rig } = setup();
    animator.reducedMotion = true;
    try {
      rig.setViewport(390, 300, { x: 8, y: 110, width: 374, height: 174 });
      rig.focus(new THREE.Vector3(), 0.4); rig.zoom(0.25);
      const saved = rig.capture(), ratio = camera.position.length() / rig.distanceFor(0.4);
      rig.setViewport(320, 568, { x: 8, y: 110, width: 304, height: 440 });
      rig.restore(saved);
      rig.setViewport(320, 568, { x: 8, y: 110, width: 304, height: 440 });
      expect(camera.position.length() / rig.distanceFor(0.4)).toBeCloseTo(ratio);
    } finally { rig.controls.dispose(); }
  });

  it('centers and fits the target inside the measured usable viewport', () => {
    const { camera, animator, rig } = setup();
    animator.reducedMotion = true;
    const center = new THREE.Vector3(0.2, -0.1, 0.3);
    const radius = 0.45;
    try {
      for (const available of [
        { x: 40, y: 50, width: 300, height: 240 },
        { x: 170, y: 10, width: 120, height: 360 },
        { x: 0, y: 180, width: 600, height: 160 },
      ]) {
        rig.setViewport(600, 400, available);
        rig.focus(center, radius, new THREE.Vector3(0, 0, 1));
        camera.updateMatrixWorld(true);
        const pixel = (point: THREE.Vector3) => {
          const projected = point.project(camera);
          return new THREE.Vector2((projected.x + 1) * 300, (1 - projected.y) * 200);
        };
        const target = pixel(center.clone());
        expect(target.x).toBeCloseTo(available.x + available.width / 2);
        expect(target.y).toBeCloseTo(available.y + available.height / 2);
        for (let latitude = 0; latitude <= 16; latitude++) {
          for (let longitude = 0; longitude < 32; longitude++) {
            const point = pixel(new THREE.Vector3().setFromSphericalCoords(radius, latitude * Math.PI / 16, longitude * Math.PI / 16).add(center));
            expect(point.x).toBeGreaterThan(available.x);
            expect(point.x).toBeLessThan(available.x + available.width);
            expect(point.y).toBeGreaterThan(available.y);
            expect(point.y).toBeLessThan(available.y + available.height);
          }
        }
      }
    } finally { rig.controls.dispose(); }
  });

  it('restores projection offsets and clears them for legacy camera snapshots or a full viewport', () => {
    const { camera, rig } = setup();
    try {
      const legacy = rig.capture();
      rig.setViewport(600, 400, { x: 50, y: 80, width: 300, height: 240 });
      const saved = rig.capture();
      const projection = camera.projectionMatrix.clone();
      expect(saved.viewOffset).toBeDefined();
      rig.setViewport(600, 400, { x: 200, y: 0, width: 350, height: 200 });
      rig.restore(saved);
      expect(camera.projectionMatrix.elements).toEqual(projection.elements);
      saved.viewOffset!.offsetX = 123;
      expect(camera.view!.offsetX).not.toBe(123);
      rig.restore(legacy);
      expect(camera.view?.enabled ?? false).toBe(false);
      rig.setViewport(600, 400, { x: 50, y: 80, width: 300, height: 240 });
      rig.setViewport(600, 400);
      expect(camera.view?.enabled ?? false).toBe(false);
      expect(rig.capture().viewOffset).toBeUndefined();
    } finally { rig.controls.dispose(); }
  });

  it('finishes a default camera transition in 400 ms', () => {
    const { camera, animator, rig } = setup();
    try {
      rig.preset('front', 1);
      animator.tick(0.399);
      expect(animator.active).toBe(true);
      animator.tick(0.001);
      expect(animator.active).toBe(false);
      expect(camera.position.distanceTo(rig.controls.target)).toBeCloseTo(rig.distanceFor(1));
    } finally { rig.controls.dispose(); }
  });

  it('restores position, target and zoom without an old focus animation or damping overwriting them', () => {
    const { camera, animator, rig, canvas, document, pointer } = setup();
    try {
      rig.controls.target.set(0.1, -0.2, 0.3);
      camera.zoom = 1.7;
      camera.updateProjectionMatrix();
      const saved = rig.capture();
      saved.position[0] = -3;
      expect(camera.position.x).toBeCloseTo(3);
      pointer(canvas, 'pointerdown', 100, 100);
      pointer(document, 'pointermove', 190, 145);
      rig.focus(new THREE.Vector3(2, 1, -1), 0.4);
      animator.tick(0.1);
      rig.restore(saved);
      animator.tick(2);
      for (let i = 0; i < 25; i++) rig.controls.update();
      expectVector(camera.position, [-3, 2, 5]);
      expectVector(rig.controls.target, [0.1, -0.2, 0.3]);
      expect(camera.zoom).toBe(1.7);
      expect(camera.projectionMatrix.elements[0]).toBeCloseTo(1.7 / (1.5 * Math.tan(Math.PI / 9)));
      expect(camera.getWorldDirection(new THREE.Vector3()).dot(new THREE.Vector3(3.1, -2.2, -4.7).normalize())).toBeCloseTo(1);
    } finally { rig.controls.dispose(); }
  });

  it('cancels an active gesture and inertia at the current pose while accepting a new drag', () => {
    const { camera, animator, rig, canvas, document, pointer } = setup();
    try {
      pointer(canvas, 'pointerdown', 100, 100);
      pointer(document, 'pointermove', 160, 130);
      const position = camera.position.clone();
      const target = rig.controls.target.clone();
      rig.cancel();
      pointer(document, 'pointermove', 300, 240);
      animator.tick(2);
      for (let i = 0; i < 25; i++) rig.controls.update();
      expectVector(camera.position, position.toArray());
      expectVector(rig.controls.target, target.toArray());
      expect(rig.controls.enableDamping).toBe(true);
      pointer(canvas, 'pointerdown', 100, 100);
      pointer(document, 'pointermove', 130, 100);
      expect(camera.position.distanceTo(position)).toBeGreaterThan(0.01);
    } finally { rig.controls.dispose(); }
  });

  it('lets the last focus win and completes reduced-motion transitions immediately', () => {
    const { camera, animator, rig, canvas, document, pointer } = setup();
    try {
      pointer(canvas, 'pointerdown', 100, 100);
      pointer(document, 'pointermove', 180, 130);
      rig.focus(new THREE.Vector3(1, 0, 0), 0.3);
      animator.tick(0.1);
      rig.focus(new THREE.Vector3(0, 1, 0), 0.4);
      rig.focus(new THREE.Vector3(0, 0, 1), 0.5, new THREE.Vector3(0, 0, 1));
      animator.tick(2);
      rig.controls.update();
      expectVector(rig.controls.target, [0, 0, 1]);
      expect(camera.position.x).toBeCloseTo(0, 12);
      expect(camera.position.distanceTo(rig.controls.target)).toBeCloseTo(rig.distanceFor(0.5));
      animator.reducedMotion = true;
      rig.preset('front', 1);
      expectVector(rig.controls.target, [0, 0, -0.08]);
      expect(camera.position.x).toBeCloseTo(0);
      expect(animator.active).toBe(false);
    } finally { rig.controls.dispose(); }
  });
});
