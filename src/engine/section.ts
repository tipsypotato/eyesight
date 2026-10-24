/** Adapted from Dental Scope src/engine/section.ts (MIT, see THIRD_PARTY_NOTICES.md).
 * The retained half and offset follow the anatomical axis.
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

/** Intersect the existing volume with a world-space plane; the result stays in its parent's coordinates. */
export function createSectionContour(mesh: THREE.Mesh, plane: THREE.Plane) {
  mesh.updateWorldMatrix(true, false);
  const localPlane = plane.clone().applyMatrix4(mesh.matrixWorld.clone().invert());
  const positions = mesh.geometry.getAttribute('position'), index = mesh.geometry.index;
  const points: THREE.Vector3[] = [];
  const count = index?.count ?? positions.count;
  for (let i = 0; i < count; i += 3) {
    const vertices = [0, 1, 2].map(j => new THREE.Vector3().fromBufferAttribute(positions, index ? index.getX(i + j) : i + j));
    const crossings: THREE.Vector3[] = [];
    for (let j = 0; j < 3; j++) {
      const a = vertices[j], b = vertices[(j + 1) % 3];
      const da = localPlane.distanceToPoint(a), db = localPlane.distanceToPoint(b);
      const point = Math.abs(da) < 1e-7 ? a.clone() : da * db < 0 ? a.clone().lerp(b, da / (da - db)) : null;
      if (point && !crossings.some(existing => existing.distanceToSquared(point) < 1e-12)) crossings.push(point);
    }
    if (crossings.length === 2) points.push(...crossings.map(point => point.applyMatrix4(mesh.matrix)));
  }
  return new THREE.BufferGeometry().setFromPoints(points);
}

export class SectionTool {
  readonly plane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
  readonly planes = [this.plane];
  private visual: { guide: THREE.Group; frame: THREE.LineLoop; arrow: THREE.ArrowHelper } | null = null;
  private enabled = false;
  private limit = 1;
  private extent = 1.24;
  private drag: { axis: THREE.Vector3; origin: THREE.Vector3; plane: THREE.Plane | null; offset: number; lastOffset: number; pointerY: number; unitsPerPixel: number } | null = null;

  get guide() { return this.visuals.guide; }
  get frame() { return this.visuals.frame; }
  get arrow() { return this.visuals.arrow; }

  private get visuals() {
    if (!this.visual) {
      const guide = new THREE.Group();
      const frame = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-1.24, -1.24, 0), new THREE.Vector3(1.24, -1.24, 0),
        new THREE.Vector3(1.24, 1.24, 0), new THREE.Vector3(-1.24, 1.24, 0),
      ]), new THREE.LineBasicMaterial({ color: '#547f99', transparent: true, opacity: 0.65, depthTest: false }));
      const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1.24, 0), 0.34, '#547f99', 0.10, 0.055);
      guide.add(frame, arrow);
      guide.traverse(object => {
        object.renderOrder = 20;
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(material => { material.depthTest = false; material.depthWrite = false; });
        }
      });
      this.visual = { guide, frame, arrow };
      this.updateGuide();
    }
    return this.visual;
  }

  private updateGuide() {
    if (!this.visual) return;
    const { guide, arrow } = this.visual;
    const axis = this.plane.normal.clone().set(Math.abs(this.plane.normal.x), Math.abs(this.plane.normal.y), Math.abs(this.plane.normal.z));
    guide.visible = this.enabled;
    guide.scale.setScalar(this.extent / 1.24);
    guide.position.copy(this.plane.normal).multiplyScalar(-this.plane.constant);
    guide.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis);
    arrow.setDirection(new THREE.Vector3(0, 0, this.plane.normal.dot(axis)));
  }

  update(clip: SceneState['clip'], _camera?: THREE.Camera, limit = 1, extent = 1.24) {
    const axis = SECTION_AXES[clip.axis];
    const normal = axis.clone().multiplyScalar(clip.keepSide === 'positive' ? 1 : -1);
    this.plane.setFromNormalAndCoplanarPoint(normal, axis.clone().multiplyScalar(clip.offset));
    this.enabled = clip.enabled;
    this.limit = limit;
    this.extent = extent;
    this.updateGuide();
  }
  keeps(point: THREE.Vector3) {
    return this.plane.distanceToPoint(point) >= -1e-5;
  }

  beginDrag(ray: THREE.Ray, point: THREE.Vector3, camera: THREE.PerspectiveCamera, pointerY: number, height: number) {
    const axis = new THREE.Vector3(0, 0, 1).applyQuaternion(this.guide.quaternion);
    const normal = ray.direction.clone().addScaledVector(axis, -ray.direction.dot(axis));
    const endOn = Math.abs(camera.getWorldDirection(new THREE.Vector3()).dot(axis)) > 0.98;
    this.drag = {
      axis, origin: point.clone(), offset: this.guide.position.dot(axis), lastOffset: this.guide.position.dot(axis), pointerY,
      plane: !endOn && normal.lengthSq() > 0.01 ? new THREE.Plane().setFromNormalAndCoplanarPoint(normal.normalize(), point) : null,
      unitsPerPixel: 2 * camera.position.distanceTo(point) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / (Math.max(1, height) * camera.zoom),
    };
  }

  dragOffset(ray: THREE.Ray, pointerY: number): number | null {
    const drag = this.drag;
    if (!drag) return null;
    const point = drag.plane && Math.abs(ray.direction.dot(drag.plane.normal)) > 0.02
      ? ray.intersectPlane(drag.plane, new THREE.Vector3()) : null;
    if (drag.plane && !point) return drag.lastOffset;
    // An axis viewed end-on has no stable screen projection; vertical travel supplies a bounded fallback.
    const delta = point ? point.sub(drag.origin).dot(drag.axis) : (drag.pointerY - pointerY) * drag.unitsPerPixel;
    const value = drag.offset + delta;
    if (!Number.isFinite(value)) return null;
    drag.lastOffset = THREE.MathUtils.clamp(value, -this.limit, this.limit);
    return drag.lastOffset;
  }

  endDrag() { this.drag = null; }
}
