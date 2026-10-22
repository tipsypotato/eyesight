/** Adapted from Dental Scope src/engine/camera.ts (MIT; see THIRD_PARTY_NOTICES.md).
 * Retains the upstream sphere fit and spherical interpolation to avoid crossing anatomy.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Animator } from './animator';
import type { ViewPreset } from '../anatomy/types';

const DIRECTIONS: Record<ViewPreset, THREE.Vector3> = {
  oblique: new THREE.Vector3(0.94, 0.38, 0.87),
  front: new THREE.Vector3(0, 0.015, 1),
  side: new THREE.Vector3(1, 0.015, 0.02),
  back: new THREE.Vector3(0, 0.015, -1),
};

export class CameraRig {
  readonly controls: OrbitControls;
  constructor(readonly camera: THREE.PerspectiveCamera, canvas: HTMLElement, private animator: Animator) {
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.085;
    controls.rotateSpeed = 0.75;
    controls.zoomSpeed = 0.8;
    controls.panSpeed = 0.65;
    controls.minDistance = 0.55;
    controls.maxDistance = 12;
    controls.screenSpacePanning = true;
    controls.addEventListener('start', () => animator.cancel('camera'));
    this.controls = controls;
  }
  distanceFor(radius: number) {
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    return Math.max(radius / Math.sin(fov / 2), radius / Math.sin(Math.atan(Math.tan(fov / 2) * this.camera.aspect))) * 1.08;
  }
  focus(center: THREE.Vector3, radius: number, direction?: THREE.Vector3, duration = 0.65) {
    const startTarget = this.controls.target.clone();
    const start = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(startTarget));
    const endDirection = direction?.clone() ?? this.camera.position.clone().sub(startTarget);
    const end = new THREE.Spherical().setFromVector3(endDirection.normalize().multiplyScalar(this.distanceFor(radius)));
    let theta = end.theta - start.theta;
    if (theta > Math.PI) theta -= Math.PI * 2;
    if (theta < -Math.PI) theta += Math.PI * 2;
    const sphere = new THREE.Spherical();
    this.animator.run('camera', duration, k => {
      this.controls.target.lerpVectors(startTarget, center, k);
      sphere.set(THREE.MathUtils.lerp(start.radius, end.radius, k), THREE.MathUtils.lerp(start.phi, end.phi, k), start.theta + theta * k);
      this.camera.position.setFromSpherical(sphere).add(this.controls.target);
      this.camera.lookAt(this.controls.target);
    });
  }
  preset(view: ViewPreset, radius = 1.38, center = new THREE.Vector3(0, 0, -0.08), duration = 0.65) {
    this.focus(center, radius, DIRECTIONS[view], duration);
  }
  zoom(delta: number) {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const from = offset.length();
    const to = THREE.MathUtils.clamp(from * Math.exp(delta), this.controls.minDistance, this.controls.maxDistance);
    const target = this.controls.target.clone();
    this.animator.run('camera', 0.22, k => {
      this.camera.position.copy(target).add(offset.setLength(THREE.MathUtils.lerp(from, to, k)));
    });
  }
  orbit(azimuth: number, polar: number) {
    this.animator.cancel('camera');
    const sphere = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.controls.target));
    sphere.theta += azimuth;
    sphere.phi = THREE.MathUtils.clamp(sphere.phi + polar, 0.03, Math.PI - 0.03);
    this.camera.position.setFromSpherical(sphere).add(this.controls.target);
    this.camera.lookAt(this.controls.target);
  }
}
