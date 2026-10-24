import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SECTION_AXES, SectionTool, intersectionSurvives } from './section';

describe('fixed anatomical clipping', () => {
  for (const axis of ['sagittal', 'axial', 'coronal'] as const) {
    for (const offset of [-1, 0, 1]) for (const keepSide of ['negative', 'positive'] as const) {
      it(`${axis} at ${offset} keeps ${keepSide} anatomy while orbiting`, () => {
        const section = new SectionTool(), camera = new THREE.PerspectiveCamera();
        const direction = SECTION_AXES[axis];
        const material = new THREE.MeshBasicMaterial({ clippingPlanes: section.planes });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(), material);
        try {
          for (const cameraSide of [-4, 4]) {
            camera.position.copy(direction).multiplyScalar(cameraSide);
            section.update({ enabled: true, axis, offset, keepSide }, camera);
            for (const delta of [-0.1, 0, 0.1]) {
              const point = direction.clone().multiplyScalar(offset + delta);
              const kept = keepSide === 'negative' ? delta <= 0 : delta >= 0;
              expect(section.keeps(point)).toBe(kept);
              expect(intersectionSurvives({ object: mesh, point, distance: 1 })).toBe(kept);
            }
          }
        } finally { mesh.geometry.dispose(); material.dispose(); }
      });
    }
  }

  it('places the frame on the cut and points its arrow toward retained anatomy', () => {
    const section = new SectionTool();
    section.update({ enabled: true, axis: 'coronal', offset: 0.4, keepSide: 'positive' });
    expect(section.guide.visible).toBe(true);
    expect(section.guide.position.toArray()).toEqual([0, 0, 0.4]);
    section.guide.updateMatrixWorld(true);
    const arrowDirection = new THREE.Vector3(0, 1, 0).applyQuaternion(section.arrow.getWorldQuaternion(new THREE.Quaternion()));
    expect(arrowDirection.distanceTo(new THREE.Vector3(0, 0, 1))).toBeLessThan(1e-8);
    section.update({ enabled: false, axis: 'coronal', offset: 0.4, keepSide: 'negative' });
    expect(section.guide.visible).toBe(false);
  });

  it('drags a grabbed frame point along its anatomical axis and clamps the extent', () => {
    const section = new SectionTool(), camera = new THREE.PerspectiveCamera(38, 1.5, 0.02, 50);
    camera.position.set(0, 0, 5);
    section.update({ enabled: true, axis: 'sagittal', offset: 0, keepSide: 'negative' });
    const grab = new THREE.Vector3(0, 1.24, 0);
    const rayTo = (point: THREE.Vector3) => new THREE.Ray(camera.position.clone(), point.clone().sub(camera.position).normalize());
    section.beginDrag(rayTo(grab), grab, camera, 100, 400);
    expect(section.dragOffset(rayTo(grab.clone().add(new THREE.Vector3(0.5, 0, 0))), 100)).toBeCloseTo(0.5);
    expect(section.dragOffset(new THREE.Ray(camera.position.clone(), new THREE.Vector3(1, 0, 0)), 100)).toBeCloseTo(0.5);
    expect(section.dragOffset(rayTo(grab.clone().add(new THREE.Vector3(4, 0, 0))), 100)).toBe(1);
    section.endDrag();
    expect(section.dragOffset(rayTo(grab), 100)).toBeNull();
  });

  it('allows an orbital section to reach the apex and restores the globe-sized guide', () => {
    const section = new SectionTool();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 30);
    camera.position.set(4, 0, 0); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    section.update({ enabled: true, axis: 'sagittal', offset: 0, keepSide: 'negative' }, camera, 3, 2.48);
    expect(section.guide.scale.x).toBe(2);
    const origin = new THREE.Vector3(0, 1.24, 0);
    const ray = new THREE.Ray(camera.position.clone(), origin.clone().sub(camera.position).normalize());
    section.beginDrag(ray, origin, camera, 100, 200);
    expect(section.dragOffset(ray, -1000)).toBe(3);
    expect(section.dragOffset(ray, 1200)).toBe(-3);
    section.endDrag();
    section.update({ enabled: true, axis: 'coronal', offset: -2.1, keepSide: 'positive' }, camera, 3);
    expect(section.guide.position.z).toBe(-2.1);
    expect(section.keeps(new THREE.Vector3(0, 0, -2))).toBe(true);
    expect(section.keeps(new THREE.Vector3(0, 0, -2.2))).toBe(false);
    section.update({ enabled: false, axis: 'sagittal', offset: 0, keepSide: 'negative' }, camera);
    expect(section.guide.scale.x).toBe(1);
  });

  it('keeps nearly axial frame drags finite and gives exact axial drags a stable fallback', () => {
    const section = new SectionTool(), camera = new THREE.PerspectiveCamera(38, 1, 0.02, 50);
    camera.position.set(5, 1.24, 0);
    camera.lookAt(0, 1.24, 0); camera.updateMatrixWorld();
    section.update({ enabled: true, axis: 'sagittal', offset: 0, keepSide: 'negative' });
    const grab = new THREE.Vector3(0, 1.24, 0), ray = new THREE.Ray(camera.position.clone(), new THREE.Vector3(-1, 0, 0));
    section.beginDrag(ray, grab, camera, 100, 400);
    expect(section.dragOffset(ray, 100)).toBe(0);
    const moved = section.dragOffset(ray, 50)!;
    expect(Number.isFinite(moved)).toBe(true);
    expect(moved).toBeGreaterThan(0);
    expect(moved).toBeLessThanOrEqual(1);
  });

  it('uses stable vertical travel when a side view faces the cut even if the grabbed frame ray is oblique', () => {
    const section = new SectionTool(), camera = new THREE.PerspectiveCamera(38, 1, 0.02, 50);
    camera.position.set(4, 0, 0); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    section.update({ enabled: true, axis: 'sagittal', offset: 0, keepSide: 'negative' });
    const grab = new THREE.Vector3(0, 1.24, 0);
    const rayTo = (point: THREE.Vector3) => new THREE.Ray(camera.position.clone(), point.clone().sub(camera.position).normalize());
    section.beginDrag(rayTo(grab), grab, camera, 100, 400);
    const offset = section.dragOffset(rayTo(new THREE.Vector3(0, 0.94, 0)), 143)!;
    expect(offset).toBeGreaterThan(-0.5);
    expect(offset).toBeLessThan(-0.1);
  });
});
