import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { buildEye } from './geometry';
import { applyLensClouding, aqueousRoute, glaucomaAppearance, binocularInputs, orientEye } from './disease';
import type { DiseaseDraft } from '../modes/disease';

const glaucoma = (scenario: 'normal'|'outflow-risk'|'established-damage'|'normal-tension', outflowRelieved = false) => ({ id: 'glaucoma', step: 1, scenario, outflowRelieved, view: 'outflow', visualField: 'early', flowPlaying: false } as const);
const amblyopia = (causeCase: 'anisometropia'|'strabismic'|'deprivation', inputImproved = false) => ({ id: 'amblyopia', step: 1, causeCase, caseDrafts: { anisometropia: { card: 0, inputImproved }, strabismic: { card: 0, inputImproved }, deprivation: { card: 0, inputImproved } } } as const);

describe('disease rendering invariants', () => {
  it('clouds only the lens materials, preserving geometry, aperture and independent eyes', () => {
    const right = buildEye(), left = buildEye({}, 'left');
    const lens = right.parts.get('lens')!.group.children as THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>[];
    const before = lens.map(m => ({ color: m.material.color.clone(), opacity: m.material.opacity, roughness: m.material.roughness, positions: Array.from(m.geometry.attributes.position.array) }));
    const cornea = right.parts.get('cornea')!.group.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>;
    const corneaBefore = cornea.material.clone();
    const leftLens = left.parts.get('lens')!.group.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>;
    const leftOpacity = leftLens.material.opacity;
    try {
      applyLensClouding(right, 0.55);
      lens.forEach((m, i) => { expect(m.material.opacity).toBeGreaterThan(before[i].opacity); expect(m.material.roughness).toBeGreaterThan(before[i].roughness); expect(Array.from(m.geometry.attributes.position.array)).toEqual(before[i].positions); });
      expect(cornea.material.opacity).toBe(corneaBefore.opacity);
      expect(leftLens.material.opacity).toBe(leftOpacity);
      applyLensClouding(right, 0);
      lens.forEach((m, i) => { expect(m.material.color).toEqual(before[i].color); expect(m.material.opacity).toBe(before[i].opacity); expect(m.material.roughness).toBe(before[i].roughness); });
      expect(right.parts.get('pupil')!.group.children.every(c => c instanceof THREE.Line)).toBe(true);
    } finally { right.dispose(); left.dispose(); corneaBefore.dispose(); }
  });

  it('separates outflow restriction from established nerve damage in all scenarios', () => {
    expect(glaucomaAppearance(glaucoma('normal'), false)).toEqual({ restricted: false, damage: false });
    expect(glaucomaAppearance(glaucoma('outflow-risk'), false)).toEqual({ restricted: true, damage: false });
    expect(glaucomaAppearance(glaucoma('established-damage'), false)).toEqual({ restricted: true, damage: true });
    expect(glaucomaAppearance(glaucoma('established-damage', true), false)).toEqual({ restricted: false, damage: true });
    expect(glaucomaAppearance(glaucoma('normal-tension'), false)).toEqual({ restricted: false, damage: true });
    expect(glaucomaAppearance(glaucoma('normal-tension'), true)).toEqual({ restricted: false, damage: false });
  });

  it('routes aqueous through the pupil and anterior chamber without entering vitreous', () => {
    expect(aqueousRoute.map(p => p.region)).toEqual(['ciliary-body', 'posterior-chamber', 'pupil', 'anterior-chamber', 'trabecular-meshwork']);
    expect(aqueousRoute.every(p => p.point.z > 0.45)).toBe(true);
    const pupil = aqueousRoute[2].point;
    expect(Math.hypot(pupil.x, pupil.y)).toBeLessThan(0.215);
    expect(pupil.z).toBeCloseTo(0.677);
  });

  it('mirrors left-eye landmarks, face winding and normals without a negative root scale', () => {
    const right = buildEye(), left = buildEye({}, 'left');
    try {
      expect(left.root.scale.toArray()).toEqual([1, 1, 1]);
      expect(left.parts.get('macula')!.anchor.x).toBeGreaterThan(left.parts.get('optic-disc')!.anchor.x);
      for (const id of ['macula', 'fovea', 'optic-disc', 'optic-nerve'] as const) {
        const r = new THREE.Box3().setFromObject(right.parts.get(id)!.group), l = new THREE.Box3().setFromObject(left.parts.get(id)!.group);
        expect(l.min.x).toBeCloseTo(-r.max.x, 5); expect(l.max.x).toBeCloseTo(-r.min.x, 5);
      }
      const rightMeshes: THREE.Mesh[] = [], leftMeshes: THREE.Mesh[] = [];
      right.root.traverse(o => { if (o instanceof THREE.Mesh) rightMeshes.push(o); });
      left.root.traverse(o => { if (o instanceof THREE.Mesh) leftMeshes.push(o); });
      for (const [j, mesh] of leftMeshes.entries()) {
        const source = rightMeshes[j], index = mesh.geometry.index, sourceIndex = source.geometry.index;
        const n = mesh.geometry.attributes.normal, sourceNormal = source.geometry.attributes.normal;
        if (index && sourceIndex) for (let i = 0; i + 2 < index.count; i += Math.max(3, Math.floor(index.count / 30 / 3) * 3)) {
          expect([index.getX(i), index.getX(i + 1), index.getX(i + 2)]).toEqual([sourceIndex.getX(i), sourceIndex.getX(i + 2), sourceIndex.getX(i + 1)]);
        }
        if (!n || !sourceNormal) continue;
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(source.matrixWorld);
        for (let i = 0; i < n.count; i += Math.max(1, Math.floor(n.count / 30))) {
          const expected = new THREE.Vector3().fromBufferAttribute(sourceNormal, i).applyNormalMatrix(normalMatrix); expected.x *= -1;
          const actual = new THREE.Vector3().fromBufferAttribute(n, i);
          expect(actual.distanceTo(expected), mesh.name || mesh.parent?.name).toBeLessThan(1e-6);
        }
      }
    } finally { right.dispose(); left.dispose(); }
  });

  it('aims both eyes at the target and applies nasal deviation with opposite world signs', () => {
    for (const z of [4, 8]) for (const side of ['right', 'left'] as const) {
      const eye = new THREE.Group(), target = new THREE.Vector3(0, 0, z);
      orientEye(eye, side, target, 0);
      const expected = target.clone().sub(eye.position).normalize();
      expect(new THREE.Vector3(0, 0, 1).applyQuaternion(eye.quaternion).distanceTo(expected)).toBeLessThan(1e-10);
      const before = eye.rotation.y;
      orientEye(eye, side, target, 10);
      expect(Math.sign(eye.rotation.y - before)).toBe(side === 'right' ? 1 : -1);
    }
  });

  it('keeps weak-input cases separate and improves only the active input', () => {
    expect(binocularInputs(amblyopia('anisometropia'), false).right).toEqual({ deviation: 0, opacity: 0, myopia: true, corrected: false });
    expect(binocularInputs(amblyopia('strabismic'), false).right).toEqual({ deviation: 10, opacity: 0, myopia: false, corrected: false });
    expect(binocularInputs(amblyopia('deprivation'), false).right).toEqual({ deviation: 0, opacity: 0.55, myopia: false, corrected: false });
    for (const cause of ['anisometropia', 'strabismic', 'deprivation'] as const) {
      expect(binocularInputs(amblyopia(cause, true), false).right).toEqual({ deviation: 0, opacity: 0, myopia: cause === 'anisometropia', corrected: cause === 'anisometropia' });
      expect(binocularInputs(amblyopia(cause), true).right).toEqual({ deviation: 0, opacity: 0, myopia: false, corrected: false });
    }
    const draft = { id: 'strabismus', step: 1, alignment: 'esotropia', deviationDeg: 10, affectedEye: 'left', targetDistance: 'near', visualExplanation: 'alignment-only', showAxes: true } as DiseaseDraft;
    expect(binocularInputs(draft, false).left.deviation).toBe(10);
    expect(binocularInputs(draft, false).right.deviation).toBe(0);
  });

  it('releases independent eye geometry, material and texture ownership', () => {
    const eye = buildEye({}, 'left');
    const iris = eye.root.getObjectByName('iris-stroma') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>;
    const geometry = vi.fn(), material = vi.fn(), texture = vi.fn();
    iris.geometry.addEventListener('dispose', geometry); iris.material.addEventListener('dispose', material); iris.material.map!.addEventListener('dispose', texture);
    eye.dispose(); expect(geometry).toHaveBeenCalledOnce(); expect(material).toHaveBeenCalledOnce(); expect(texture).toHaveBeenCalledOnce();
  });
});
