/** Adapted from Dental Scope src/engine/section.ts (MIT, see THIRD_PARTY_NOTICES.md).
 * The removed half follows the camera; the offset follows the anatomical axis.
 */
import * as THREE from 'three';
import type { ClipAxis, SceneState } from '../anatomy/types';

export const SECTION_AXES: Record<ClipAxis, THREE.Vector3> = {
  sagittal: new THREE.Vector3(1, 0, 0),
  axial: new THREE.Vector3(0, 1, 0),
  coronal: new THREE.Vector3(0, 0, 1),
};

/** Three's raycaster ignores both visibility and shader clipping; apply the rendered constraints. */
export function intersectionSurvives(hit: THREE.Intersection): boolean {
  let ancestor: THREE.Object3D | null = hit.object;
  while (ancestor) {
    if (!ancestor.visible) return false;
    ancestor = ancestor.parent;
  }
  if (!(hit.object instanceof THREE.Mesh || hit.object instanceof THREE.Line)) return false;
  const material: THREE.Material = Array.isArray(hit.object.material) ? hit.object.material[hit.face?.materialIndex ?? 0] : hit.object.material;
  return material.visible && material.opacity > 0 && !material.clippingPlanes?.some(plane => plane.distanceToPoint(hit.point) < -1e-5);
}

export class SectionTool {
  readonly plane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
  readonly planes = [this.plane];
  update(clip: SceneState['clip'], camera: THREE.Camera) {
    const axis = SECTION_AXES[clip.axis];
    const normal = axis.clone();
    if (normal.dot(camera.position) >= 0) normal.negate();
    this.plane.setFromNormalAndCoplanarPoint(normal, axis.clone().multiplyScalar(clip.offset));
  }
  keeps(point: THREE.Vector3) {
    return this.plane.distanceToPoint(point) >= -1e-5;
  }
}
