import * as THREE from 'three';
import type { EyeSide } from '../anatomy/types';
import type { DiseaseDraft } from '../modes/disease';
import type { buildEye } from './geometry';

export function applyLensClouding(eye: ReturnType<typeof buildEye>, opacity: number) {
  const amount = THREE.MathUtils.clamp(Number.isFinite(opacity) ? opacity : 0, 0, 1);
  eye.parts.get('lens')!.group.traverse(object => {
    if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshPhysicalMaterial)) return;
    const material = object.material;
    material.opacity = material.userData.baseOpacity + (0.94 - material.userData.baseOpacity) * amount;
    material.color.copy(material.userData.baseColor).lerp(new THREE.Color('#ede6ce'), amount);
    material.roughness = material.userData.baseRoughness + (0.9 - material.userData.baseRoughness) * amount;
    material.clearcoat = material.userData.baseClearcoat * (1 - amount * 0.85);
    material.emissiveIntensity = 0;
    material.transparent = true; material.depthWrite = false;
  });
}

export function glaucomaAppearance(draft: Extract<DiseaseDraft, { id: 'glaucoma' }>, normal: boolean) {
  const baseline = normal || draft.step === 0;
  return {
    restricted: !baseline && !draft.outflowRelieved && ['outflow-risk', 'established-damage'].includes(draft.scenario),
    damage: !baseline && ['established-damage', 'normal-tension'].includes(draft.scenario),
  };
}

export const aqueousRoute = [
  { region: 'ciliary-body', point: new THREE.Vector3(-0.60, 0, 0.51) },
  { region: 'posterior-chamber', point: new THREE.Vector3(-0.43, 0, 0.625) },
  { region: 'pupil', point: new THREE.Vector3(-0.15, 0, 0.677) },
  { region: 'anterior-chamber', point: new THREE.Vector3(-0.30, 0, 0.83) },
  { region: 'trabecular-meshwork', point: new THREE.Vector3(-0.67, 0, 0.715) },
] as const;

export function createAqueousFlow(restricted: boolean) {
  const group = new THREE.Group(); group.name = 'aqueous-flow';
  for (let i = 0; i < aqueousRoute.length - 1; i++) {
    const start = aqueousRoute[i].point, end = aqueousRoute[i + 1].point;
    const direction = end.clone().sub(start);
    const arrow = new THREE.ArrowHelper(direction.clone().normalize(), start, direction.length(), restricted && i === 3 ? '#bc7140' : '#247c95', 0.045, 0.026);
    arrow.line.geometry = arrow.line.geometry.clone(); arrow.cone.geometry = arrow.cone.geometry.clone();
    arrow.name = `${aqueousRoute[i].region}-to-${aqueousRoute[i + 1].region}`;
    arrow.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          material.depthTest = false; material.transparent = true;
        }
        object.renderOrder = 15;
      }
    });
    group.add(arrow);
  }
  return group;
}

export function createNerveDamage(damaged = true) {
  const group = new THREE.Group(); group.name = damaged ? 'nerve-damage' : 'nerve-fibers';
  // shortcut: a local dashed fiber interruption is qualitative; replace only with a clinically reviewed nerve model.
  for (let i = 0; i < 5; i++) {
    const surface = (x: number, y: number) => new THREE.Vector3(x, y, -Math.sqrt(0.906 ** 2 - x * x - y * y));
    const points = new THREE.CatmullRomCurve3([surface(0.03 + i * 0.055, 0.27), surface(0.1 + i * 0.03, 0.16), surface(0.30, 0.035)]).getPoints(24);
    const material = damaged ? new THREE.LineDashedMaterial({ color: '#98516d', dashSize: 0.025, gapSize: 0.045, depthTest: false }) : new THREE.LineBasicMaterial({ color: '#9c8a61', depthTest: false });
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material);
    line.computeLineDistances(); line.renderOrder = 15; group.add(line);
  }
  return group;
}

export function orientEye(root: THREE.Group, side: EyeSide, target: THREE.Vector3, deviation: number) {
  root.position.set(side === 'right' ? -1.35 : 1.35, 0, 0);
  const yaw = Math.atan2(target.x - root.position.x, target.z - root.position.z);
  root.rotation.set(0, yaw + THREE.MathUtils.degToRad(deviation) * (side === 'right' ? 1 : -1), 0);
  root.updateMatrixWorld(true);
}

export function binocularInputs(draft: DiseaseDraft, normal: boolean) {
  const result = { right: { deviation: 0, opacity: 0, myopia: false, corrected: false }, left: { deviation: 0, opacity: 0, myopia: false, corrected: false } };
  if (normal || draft.step === 0) return result;
  if (draft.id === 'strabismus') result[draft.affectedEye].deviation = draft.alignment === 'normal' ? 0 : draft.deviationDeg;
  if (draft.id === 'amblyopia') {
    if (draft.causeCase === 'anisometropia') {
      result.right.myopia = true; result.right.corrected = draft.caseDrafts[draft.causeCase].inputImproved;
    }
    if (draft.caseDrafts[draft.causeCase].inputImproved) return result;
    if (draft.causeCase === 'strabismic') result.right.deviation = 10;
    if (draft.causeCase === 'deprivation') result.right.opacity = 0.55;
  }
  return result;
}
