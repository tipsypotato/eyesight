/** Adapted from Dental Scope src/engine/camera.ts (MIT; see THIRD_PARTY_NOTICES.md).
 * Retains the upstream sphere fit and spherical interpolation to avoid crossing anatomy.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Animator } from './animator';
import type { CameraSnapshot, ViewPreset } from '../anatomy/types';

const DIRECTIONS: Record<ViewPreset, THREE.Vector3> = {
  oblique: new THREE.Vector3(0.94, 0.38, 0.87),
  front: new THREE.Vector3(0, 0.015, 1),
  side: new THREE.Vector3(1, 0.015, 0.02),
  back: new THREE.Vector3(0, 0.015, -1),
};

export class CameraRig {
  readonly controls: OrbitControls;
  motionRevision = 0;
  private usableFraction = new THREE.Vector2(1, 1);
  private interacting = false;
  private interactionEnabled = true;
  private pendingViewportScale = 1;
  private distanceRadius = 0;
  constructor(readonly camera: THREE.PerspectiveCamera, canvas: HTMLElement, private animator: Animator) {
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.085;
    controls.rotateSpeed = 0.75;
    controls.zoomSpeed = 0.8;
    controls.panSpeed = 0.65;
    controls.screenSpacePanning = true;
    controls.addEventListener('start', () => { this.motionRevision++; this.interacting = true; animator.cancel('camera'); });
    controls.addEventListener('end', () => { this.interacting = false; this.applyViewportScale(); });
    this.controls = controls;
    this.updateDistanceLimits();
  }
  capture(): CameraSnapshot {
    this.applyViewportScale();
    const view = this.camera.view;
    return { position: this.camera.position.toArray(), target: this.controls.target.toArray(), zoom: this.camera.zoom,
      viewport: { aspect: this.camera.aspect, usableFraction: [this.usableFraction.x, this.usableFraction.y] },
      ...(view?.enabled ? { viewOffset: { fullWidth: view.fullWidth, fullHeight: view.fullHeight, offsetX: view.offsetX, offsetY: view.offsetY, width: view.width, height: view.height } } : {}) };
  }
  private apply(snapshot: CameraSnapshot) {
    this.camera.position.fromArray(snapshot.position);
    this.controls.target.fromArray(snapshot.target);
    this.camera.zoom = snapshot.zoom;
    if (snapshot.viewport) {
      this.camera.aspect = snapshot.viewport.aspect;
      this.usableFraction.fromArray(snapshot.viewport.usableFraction);
    } else this.usableFraction.set(1, 1);
    const view = snapshot.viewOffset;
    if (view) this.camera.setViewOffset(view.fullWidth, view.fullHeight, view.offsetX, view.offsetY, view.width, view.height);
    else this.camera.clearViewOffset();
    this.distanceRadius = Math.max(this.distanceRadius, this.camera.position.distanceTo(this.controls.target) / this.distanceFor(1));
    this.updateDistanceLimits();
    this.camera.lookAt(this.controls.target);
    this.controls.update();
  }
  cancel() {
    this.motionRevision++;
    this.interacting = false;
    const snapshot = this.capture();
    const damping = this.controls.enableDamping;
    const element = this.controls.domElement!;
    const cursor = element.style.cursor;
    this.animator.cancel('camera');
    this.controls.disconnect();
    // OrbitControls exposes no inertia reset; a non-damped update drains it before restoring the pose.
    this.controls.enableDamping = false;
    this.controls.update();
    this.apply(snapshot);
    this.controls.enableDamping = damping;
    if (this.interactionEnabled) this.controls.connect(element);
    else element.style.touchAction = 'pan-y pinch-zoom';
    element.style.cursor = cursor;
  }
  setInteractionEnabled(enabled: boolean) {
    if (enabled === this.interactionEnabled) return;
    this.interactionEnabled = enabled;
    this.controls.enabled = enabled;
    this.cancel();
  }
  restore(snapshot: CameraSnapshot) {
    this.cancel();
    this.apply(snapshot);
  }
  setViewport(width: number, height: number, available = { x: 0, y: 0, width, height }) {
    const previousFit = this.distanceFor(1);
    width = Math.max(1, width);
    height = Math.max(1, height);
    const x = THREE.MathUtils.clamp(available.x, 0, width - 1);
    const y = THREE.MathUtils.clamp(available.y, 0, height - 1);
    const usableWidth = THREE.MathUtils.clamp(available.width, 1, width - x);
    const usableHeight = THREE.MathUtils.clamp(available.height, 1, height - y);
    this.usableFraction.set(usableWidth / width, usableHeight / height);
    this.camera.aspect = width / height;
    if (x === 0 && y === 0 && usableWidth === width && usableHeight === height) this.camera.clearViewOffset();
    else this.camera.setViewOffset(width, height, width / 2 - x - usableWidth / 2, height / 2 - y - usableHeight / 2, width, height);
    this.pendingViewportScale *= this.distanceFor(1) / previousFit;
    if (!this.interacting) this.applyViewportScale();
  }
  private applyViewportScale() {
    const scale = this.pendingViewportScale;
    this.pendingViewportScale = 1;
    this.updateDistanceLimits();
    if (Math.abs(scale - 1) < 1e-10) return;
    this.camera.position.sub(this.controls.target).multiplyScalar(scale).add(this.controls.target);
    this.controls.dispatchEvent({ type: 'change' });
  }
  private updateDistanceLimits() {
    const fullHeightFit = 1.08 / Math.sin(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    const scale = this.distanceFor(1) / fullHeightFit;
    this.controls.minDistance = 0.18 * scale;
    this.controls.maxDistance = Math.max(12 * scale, this.distanceFor(this.distanceRadius));
    const far = this.controls.maxDistance + this.distanceRadius;
    if (far > this.camera.far) {
      this.camera.far = far;
      this.camera.updateProjectionMatrix();
    }
  }
  distanceFor(radius: number) {
    const tangent = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2) / this.camera.zoom;
    return Math.max(radius / Math.sin(Math.atan(tangent * this.usableFraction.y)), radius / Math.sin(Math.atan(tangent * this.camera.aspect * this.usableFraction.x))) * 1.08;
  }
  focus(center: THREE.Vector3, radius: number, direction?: THREE.Vector3, duration = 0.4) {
    this.cancel();
    const startTarget = this.controls.target.clone();
    const start = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(startTarget));
    const initialFit = this.distanceFor(1);
    this.distanceRadius = Math.max(radius * 2, start.radius / initialFit);
    this.updateDistanceLimits();
    const endDirection = direction?.clone() ?? this.camera.position.clone().sub(startTarget);
    const end = new THREE.Spherical().setFromVector3(endDirection.normalize().multiplyScalar(this.distanceFor(radius)));
    let theta = end.theta - start.theta;
    if (theta > Math.PI) theta -= Math.PI * 2;
    if (theta < -Math.PI) theta += Math.PI * 2;
    const sphere = new THREE.Spherical();
    this.animator.run('camera', duration, k => {
      this.controls.target.lerpVectors(startTarget, center, k);
      sphere.set(THREE.MathUtils.lerp(start.radius, end.radius, k) * this.distanceFor(1) / initialFit, THREE.MathUtils.lerp(start.phi, end.phi, k), start.theta + theta * k);
      this.camera.position.setFromSpherical(sphere).add(this.controls.target);
      this.camera.lookAt(this.controls.target);
    });
  }
  preset(view: ViewPreset, radius = 1.38, center = new THREE.Vector3(), duration = 0.4) {
    this.focus(center, radius, DIRECTIONS[view], duration);
  }
  zoom(delta: number) {
    this.cancel();
    const offset = this.camera.position.clone().sub(this.controls.target);
    const from = offset.length();
    const to = THREE.MathUtils.clamp(from * Math.exp(delta), this.controls.minDistance, this.controls.maxDistance);
    const target = this.controls.target.clone();
    const initialFit = this.distanceFor(1);
    this.animator.run('camera', 0.22, k => {
      this.camera.position.copy(target).add(offset.setLength(THREE.MathUtils.lerp(from, to, k) * this.distanceFor(1) / initialFit));
    });
  }
  orbit(azimuth: number, polar: number) {
    this.cancel();
    const sphere = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.controls.target));
    sphere.theta += azimuth;
    sphere.phi = THREE.MathUtils.clamp(sphere.phi + polar, 0.03, Math.PI - 0.03);
    this.camera.position.setFromSpherical(sphere).add(this.controls.target);
    this.camera.lookAt(this.controls.target);
  }
}
