import * as THREE from 'three';
import { ADNEXAL_IDS, EXTRAOCULAR_IDS, ORBITAL_IDS, FLAT_LAYOUT_START, type SceneState, type StructureId } from '../anatomy/types';
import type { EyePart } from './geometry';
import { intersectionSurvives, sectionPlane } from './section';

export function visibleSurface(part: EyePart, parts: Map<StructureId, EyePart>, state: SceneState, camera: THREE.PerspectiveCamera, posteriorScale = 1, selectTarget = false): THREE.Vector3 | null {
  if (selectTarget) state = { ...state, layers: { ...state.layers, [part.id]: 'on' }, isolateId: state.isolateId ? part.id : null };
  const shown = (item: EyePart) => {
    if (state.layers[item.id] !== 'on' || (state.isolateId && state.isolateId !== item.id)) return false;
    for (let object: THREE.Object3D | null = item.group; object; object = object.parent) {
      if (!object.visible && !(selectTarget && object === part.group)) return false;
    }
    return true;
  };
  if (!shown(part)) return null;
  camera.updateMatrixWorld(true);
  const candidates = [...parts.values()].filter(shown);
  for (const item of candidates) item.group.updateWorldMatrix(true, true);
  const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  const planes = new Map(candidates.map(item => [item, sectionPlane(state.clip, state.explode >= FLAT_LAYOUT_START ? item.group.position : undefined)]));
  const keeps = (point: THREE.Vector3, item = part) => !state.clip.enabled || planes.get(item)!.distanceToPoint(point) >= -1e-5;
  const survives = (hit: THREE.Intersection, item = part) => intersectionSurvives(hit) && keeps(hit.point, item);
  const targetSurvives = (hit: THREE.Intersection) => {
    if (!selectTarget || part.group.visible) return survives(hit);
    // Candidate selection ignores only the target group's current hidden state without mutating it.
    for (let object: THREE.Object3D | null = hit.object; object; object = object.parent) {
      if (!object.visible && object !== part.group) return false;
    }
    if (!(hit.object instanceof THREE.Mesh || hit.object instanceof THREE.Line)) return false;
    const material: THREE.Material = Array.isArray(hit.object.material) ? hit.object.material[hit.face?.materialIndex ?? 0] : hit.object.material;
    return material.visible && material.opacity > 0 && !material.clippingPlanes?.some(plane => plane.distanceToPoint(hit.point) < -1e-5)
      && keeps(hit.point);
  };
  const origin = camera.getWorldPosition(new THREE.Vector3());
  const ray = new THREE.Raycaster();
  ray.params.Line.threshold = 0.008;
  const unobstructed = (point: THREE.Vector3) => {
    if (!frustum.containsPoint(point) || !keeps(point)) return false;
    const distance = origin.distanceTo(point);
    return !candidates.some(item => item !== part && ray.intersectObject(item.group, true)
      .some(hit => hit.distance < distance - 1e-4 && survives(hit, item)));
  };
  const cast = (point: THREE.Vector3) => {
    ray.set(origin, point.clone().sub(origin).normalize());
    return ray.intersectObject(part.group, true).find(targetSurvives)?.point ?? null;
  };
  const anchor = part.anchor.clone();
  if (anchor.z < 0 && ![...EXTRAOCULAR_IDS, ...ADNEXAL_IDS, ...ORBITAL_IDS].some(id => id === part.id)) anchor.z *= posteriorScale;
  part.group.localToWorld(anchor);
  if (part.id === 'pupil') {
    ray.set(origin, anchor.clone().sub(origin).normalize());
    return unobstructed(anchor) ? anchor : null;
  }
  const surface = cast(anchor);
  if (surface && unobstructed(surface)) return surface;

  const lines: THREE.Line[] = [];
  part.group.traverse(object => { if (object instanceof THREE.Line && object.visible) lines.push(object); });
  for (const line of lines) {
    const positions = line.geometry.getAttribute('position');
    if (!positions?.count) continue;
    for (const fraction of [0.17, 0.5, 0.83]) {
      const sample = new THREE.Vector3().fromBufferAttribute(positions, Math.floor((positions.count - 1) * fraction)).applyMatrix4(line.matrixWorld);
      const hit = cast(sample);
      if (hit && unobstructed(hit)) return hit;
    }
  }

  // shortcut: sample nine surface points; increase coverage if narrow exposed edges are missed.
  const meshes: THREE.Mesh[] = [];
  part.group.traverse(object => { if (object instanceof THREE.Mesh) meshes.push(object); });
  const count = Math.min(3, meshes.length);
  for (let i = 0; i < count; i++) {
    const mesh = meshes[Math.floor(i * meshes.length / count)];
    const position = mesh.geometry.getAttribute('position');
    const index = mesh.geometry.getIndex();
    const triangles = Math.floor((index?.count ?? position.count) / 3);
    if (!triangles) continue;
    for (const fraction of [0.17, 0.5, 0.83]) {
      const start = Math.floor((triangles - 1) * fraction) * 3;
      const sample = new THREE.Vector3();
      for (let j = 0; j < 3; j++) sample.add(new THREE.Vector3().fromBufferAttribute(position, index ? index.getX(start + j) : start + j));
      sample.divideScalar(3).applyMatrix4(mesh.matrixWorld);
      const hit = cast(sample);
      if (hit && unobstructed(hit)) return hit;
    }
  }
  return null;
}
