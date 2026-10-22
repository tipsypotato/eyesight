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
