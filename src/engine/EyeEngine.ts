import * as THREE from 'three';
import { STRUCTURES } from '../anatomy/data';
import type { SceneState, StructureId, ViewPreset } from '../anatomy/types';
import { Animator } from './animator';
import { CameraRig } from './camera';
import { buildEye, createShellSection, setPosteriorStretch, type EyePart } from './geometry';
import { computeOptics } from './optics';
import { intersectionSurvives, SECTION_AXES, SectionTool } from './section';

type Drawable = THREE.Mesh | THREE.Line;
type Label = { button: HTMLButtonElement; dot: HTMLSpanElement };

export class EyeEngine {
  readonly renderer: THREE.WebGLRenderer;
  readonly canvas: HTMLCanvasElement;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.02, 50);
  private animator = new Animator();
  private rig: CameraRig;
  private eye = buildEye(Object.fromEntries(STRUCTURES.map(item => [item.id, item.color])));
  private section = new SectionTool();
  private state: SceneState | null = null;
  private resizeObserver: ResizeObserver;
  private overlay = document.createElement('div');
  private labels = new Map<StructureId, Label>();
  private caps = new Map<StructureId, THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>>();
  private rays = new THREE.Group();
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private pointerDown = new THREE.Vector2();
  private frame = 0;
  private lastFrame = 0;
  private width = 1;
  private height = 1;
  private disposed = false;
  private media = window.matchMedia('(prefers-reduced-motion: reduce)');
  private originalPosition: string;
  private capKey = '';
  private posteriorScale = 1;

  constructor(private host: HTMLElement, private onSelect: (id: StructureId) => void) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.localClippingEnabled = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'eye-canvas';
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute('role', 'img');
    Object.assign(this.canvas.style, { width: '100%', height: '100%', display: 'block', touchAction: 'none' });
    this.originalPosition = host.style.position;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.appendChild(this.canvas);
    this.overlay.className = 'eye-labels';
    Object.assign(this.overlay.style, { position: 'absolute', inset: '0', overflow: 'hidden', pointerEvents: 'none' });
    host.appendChild(this.overlay);
    for (const structure of STRUCTURES) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'eye-label';
      Object.assign(button.style, {
        position: 'absolute', display: 'none', transform: 'translate(-50%, -50%)', pointerEvents: 'auto',
        border: '1px solid rgba(122,148,150,.28)', borderRadius: '5px', padding: '4px 7px',
        color: '#253f42', background: 'rgba(255,253,245,.92)', font: '500 10px/1.3 system-ui,sans-serif',
        whiteSpace: 'nowrap', cursor: 'pointer', boxShadow: '0 2px 8px #153b4010',
      });
      button.addEventListener('click', () => {
        if (this.state?.mode !== 'quiz') this.onSelect(structure.id);
      });
      const dot = document.createElement('span');
      Object.assign(dot.style, { width: '5px', height: '5px', borderRadius: '50%', position: 'absolute', transform: 'translate(-50%,-50%)', background: structure.color, display: 'none' });
      this.overlay.append(dot, button);
      this.labels.set(structure.id, { button, dot });
    }
    this.scene.add(this.eye.root, this.rays);
    this.scene.add(new THREE.HemisphereLight('#fff9e8', '#596e79', 1.7));
    const key = new THREE.DirectionalLight('#fff8e6', 2.4);
    key.position.set(3, 5, 6);
    const fill = new THREE.DirectionalLight('#c9e3e7', 1.0);
    fill.position.set(-4, 1, 2);
    const rim = new THREE.DirectionalLight('#f0d9ba', 0.9);
    rim.position.set(1, -2, -4);
    this.scene.add(key, fill, rim);
    this.eye.root.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
        for (const material of this.materials(object)) {
          if ('color' in material) material.userData.baseColor = (material.color as THREE.Color).clone();
        }
      }
    });
    for (const [id, part] of this.eye.parts) {
      if (!part.shell) continue;
      const material = new THREE.MeshBasicMaterial({ color: STRUCTURES.find(item => item.id === id)?.color ?? '#d5b58a', side: THREE.DoubleSide });
      material.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 0, -1), part.shell.front)];
      const cap = new THREE.Mesh(createShellSection(part.shell.outer, part.shell.inner, 0), material);
      cap.userData.structureId = id;
      cap.userData.cap = true;
      cap.visible = false;
      part.group.add(cap);
      this.caps.set(id, cap);
    }
    this.raycaster.params.Line.threshold = 0.008;
    this.camera.position.set(3.5, 1.4, 3.5);
    this.rig = new CameraRig(this.camera, this.canvas, this.animator);
    this.rig.controls.addEventListener('change', this.invalidate);
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('keydown', this.handleKeyDown);
    this.canvas.addEventListener('webglcontextrestored', this.invalidate);
    this.media.addEventListener('change', this.handleMotion);
    this.handleMotion();
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(host);
    this.resize();
    this.rig.preset('oblique', 1.38, undefined, 0);
    this.invalidate();
  }

  setState(state: SceneState) {
    if (this.disposed) return;
    const previous = this.state;
    this.state = state;
    const quizHidden = state.mode === 'quiz' && !state.quizRevealed;
    const enclosed = !state.clip.enabled && !state.isolateId && state.explode === 0 && state.layers.sclera === 'on'
      && state.layers.choroid === 'on' && state.layers.retina === 'on';
    this.canvas.setAttribute('aria-label', state.lang === 'zh'
      ? '可旋转的右眼三维模型。方向键旋转，加减键缩放。'
      : 'Rotatable 3D right eye. Arrow keys rotate; plus and minus zoom.');
    this.canvas.style.cursor = state.mode === 'quiz' ? 'grab' : 'crosshair';
    for (const [id, part] of this.eye.parts) {
      part.group.visible = state.layers[id] !== 'off' && (!state.isolateId || state.isolateId === id);
      part.group.position.copy(part.explode).multiplyScalar(state.explode);
      const selected = state.selectedId === id;
      const highlight = selected ? state.mode === 'quiz' ? 0.23 : 0.065 : 0;
      part.group.traverse(object => {
        if (!(object instanceof THREE.Mesh || object instanceof THREE.Line) || object.userData.cap) return;
        for (const material of this.materials(object)) {
          const baseOpacity = material.userData.baseOpacity ?? 1;
          material.opacity = state.layers[id] === 'ghost' ? Math.min(baseOpacity, 0.10)
            : selected && baseOpacity < 0.3 ? 0.35 : baseOpacity;
          // shortcut: approximate occlusion inside a closed globe; photometric rendering needs tissue-aware shadows.
          if (enclosed && !selected && ['lens', 'anterior-chamber', 'posterior-chamber', 'vitreous'].includes(id)) material.opacity *= 0.18;
          const transparent = material.opacity < 0.999;
          if (material.transparent !== transparent || material.clippingPlanes?.length !== (state.clip.enabled ? 1 : 0)) material.needsUpdate = true;
          material.transparent = transparent;
          material.depthWrite = !transparent;
          material.clippingPlanes = state.clip.enabled ? this.section.planes : [];
          if (material instanceof THREE.MeshPhysicalMaterial) {
            material.emissive.set(selected ? '#d69933' : '#000000');
            material.emissiveIntensity = highlight;
          }
          if ('color' in material && material.userData.baseColor) {
            (material.color as THREE.Color).copy(material.userData.baseColor);
            if (selected) (material.color as THREE.Color).lerp(new THREE.Color('#ffd18a'), highlight);
            if (enclosed && !selected && ['retina', 'macula', 'fovea', 'optic-disc', 'retinal-vessels'].includes(id)) (material.color as THREE.Color).multiplyScalar(0.018);
          }
        }
      });
      const label = this.labels.get(id);
      if (label) {
        label.button.textContent = quizHidden ? '' : STRUCTURES.find(item => item.id === id)?.name[state.lang] ?? '';
        label.button.style.borderColor = selected ? '#c58b3f' : 'rgba(122,148,150,.28)';
        label.button.style.fontWeight = selected ? '700' : '500';
      }
    }
    if (!previous || previous.opticsPreset !== state.opticsPreset) this.updateRays();
    const showingOptics = state.mode === 'optics' || !!state.showOptics;
    this.rays.visible = showingOptics;
    const posteriorScale = showingOptics ? -computeOptics(state.opticsPreset).retinaZ / 0.914 : 1;
    if (posteriorScale !== this.posteriorScale) {
      this.posteriorScale = posteriorScale;
      setPosteriorStretch(this.eye.root, posteriorScale);
    }
    this.eye.root.updateMatrixWorld(true);
    this.capKey = '';
    if (!previous || state.view !== previous.view || state.explode !== previous.explode || showingOptics !== (previous.mode === 'optics' || !!previous.showOptics)) this.setView(state.view);
    this.invalidate();
  }

  focus(id: StructureId) {
    const part = this.eye.parts.get(id);
    if (!part || !part.group.visible) return;
    const bounds = new THREE.Box3().setFromObject(part.group);
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    const center = sphere.radius > 0.65 ? sphere.center : this.anchorFor(part);
    this.rig.focus(center, Math.max(0.30, Math.min(1.35, sphere.radius * 1.1)));
    this.invalidate();
  }

  setView(view: ViewPreset) {
    const optical = this.state?.mode === 'optics' || this.state?.showOptics;
    this.rig.preset(view, optical ? 1.9 : 1.38 + (this.state?.explode ?? 0) * 0.60,
      new THREE.Vector3(0, 0, optical ? 0.35 : -0.08 + (this.state?.explode ?? 0) * 0.3));
    this.invalidate();
  }

  zoom(delta: number) { this.rig.zoom(delta); this.invalidate(); }
  resetCamera() { this.setView(this.state?.view ?? 'oblique'); }

  private materials(object: Drawable): THREE.Material[] {
    return Array.isArray(object.material) ? object.material : [object.material];
  }

  private anchorFor(part: EyePart) {
    const anchor = part.anchor.clone();
    if (anchor.z < 0) anchor.z *= this.posteriorScale;
    return anchor.add(part.group.position);
  }

  private updateRays() {
    this.disposeGroup(this.rays);
    this.rays.clear();
    const result = computeOptics(this.state?.opticsPreset ?? 'normal');
    const rayMaterial = new THREE.LineBasicMaterial({ color: '#e0a02e', transparent: true, opacity: 0.94, depthTest: false });
    for (const ray of result.rays) {
      // Rotate the meridional section about the optical axis so it reads in the sagittal view.
      const points = ray.points.map(([x, y, z]) => new THREE.Vector3(y, x, z));
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), rayMaterial);
      line.renderOrder = 10;
      this.rays.add(line);
    }
    const focus = new THREE.Mesh(new THREE.SphereGeometry(0.028, 16, 12), new THREE.MeshBasicMaterial({ color: '#dd8b22', depthTest: false }));
    focus.position.set(0, 0, result.focusZ);
    focus.renderOrder = 11;
    this.rays.add(focus);
    const retinalPlane = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -0.32, result.retinaZ), new THREE.Vector3(0, 0.32, result.retinaZ)]), new THREE.LineDashedMaterial({ color: '#c46a50', dashSize: 0.035, gapSize: 0.025, depthTest: false }));
    retinalPlane.computeLineDistances();
    retinalPlane.renderOrder = 10;
    this.rays.add(retinalPlane);
    if (this.state?.opticsPreset === 'corrected') {
      const lens = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.012, 8, 64), new THREE.MeshBasicMaterial({ color: '#56a9b0', transparent: true, opacity: 0.85, depthTest: false }));
      lens.position.z = result.glassesZ;
      lens.renderOrder = 10;
      this.rays.add(lens);
      const outline = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, -0.28, result.glassesZ - 0.025), new THREE.Vector3(0, -0.12, result.glassesZ),
        new THREE.Vector3(0, 0.12, result.glassesZ), new THREE.Vector3(0, 0.28, result.glassesZ - 0.025),
      ]), new THREE.LineBasicMaterial({ color: '#56a9b0', depthTest: false }));
      this.rays.add(outline);
    }
  }

  private updateSections() {
    if (!this.state) return;
    this.section.update(this.state.clip, this.camera);
    const key = `${this.state.clip.enabled}|${this.state.clip.axis}|${this.state.clip.offset}|${this.state.explode}|${this.posteriorScale}`;
    for (const [id, cap] of this.caps) {
      const part = this.eye.parts.get(id)!;
      cap.visible = this.state.clip.enabled && this.state.layers[id] === 'on';
      if (key !== this.capKey) {
        const axis = SECTION_AXES[this.state.clip.axis];
        const offset = this.state.clip.offset - axis.dot(part.group.position);
        const nativeOffset = this.state.clip.axis === 'coronal' && offset < 0 ? offset / this.posteriorScale : offset;
        cap.geometry.dispose();
        cap.geometry = createShellSection(part.shell!.outer, part.shell!.inner, nativeOffset);
        cap.position.copy(axis).multiplyScalar(offset);
        cap.quaternion.identity();
        cap.geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis));
        if (this.state.clip.axis !== 'coronal') {
          const positions = cap.geometry.getAttribute('position');
          for (let i = 0; i < positions.count; i++) if (positions.getZ(i) < 0) positions.setZ(i, positions.getZ(i) * this.posteriorScale);
          positions.needsUpdate = true;
          cap.geometry.computeBoundingSphere();
        }
        cap.material.clippingPlanes![0].constant = part.shell!.front + part.group.position.z;
      }
    }
    this.capKey = key;
  }

  private renderLabels() {
    const state = this.state;
    if (!state) return;
    const enabled = state.labels && (state.mode !== 'quiz' || state.quizRevealed);
    const occupied: { x: number; y: number; w: number }[] = [];
    const ids = [...this.labels.keys()].sort((a, b) => Number(b === state.selectedId) - Number(a === state.selectedId));
    for (const id of ids) {
      const { button, dot } = this.labels.get(id)!;
      button.style.display = dot.style.display = 'none';
      const part = this.eye.parts.get(id)!;
      if (!enabled || !part.group.visible || state.layers[id] === 'ghost') continue;
      const world = this.anchorFor(part);
      if (state.clip.enabled && !this.section.keeps(world)) continue;
      const point = world.clone().project(this.camera);
      if (Math.abs(point.x) > 0.90 || Math.abs(point.y) > 0.88 || point.z > 1 || point.z < -1) continue;
      const x = (point.x + 1) * this.width / 2;
      const y = (1 - point.y) * this.height / 2;
      const w = state.lang === 'zh' ? button.textContent!.length * 11 + 14 : button.textContent!.length * 5.5 + 14;
      if (occupied.some(other => Math.abs(other.x - x) < (w + other.w) / 2 + 4 && Math.abs(other.y - y) < 26)) continue;
      occupied.push({ x, y, w });
      button.style.left = `${x}px`;
      button.style.top = `${y - 11}px`;
      button.style.display = 'block';
      dot.style.left = `${x}px`;
      dot.style.top = `${y + 5}px`;
      dot.style.display = 'block';
    }
  }

  private handlePointerDown = (event: PointerEvent) => {
    this.pointerDown.set(event.clientX, event.clientY);
  };

  private handlePointerUp = (event: PointerEvent) => {
    const state = this.state;
    if (!state || state.mode === 'quiz' || event.button !== 0 || this.pointerDown.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 6) return;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const candidates = [...this.eye.parts.values()].filter(part => part.group.visible && state.layers[part.id] === 'on');
    const hits: { id: StructureId; distance: number }[] = [];
    for (const part of candidates) {
      const intersection = this.raycaster.intersectObject(part.group, true).find(intersectionSurvives);
      if (intersection) hits.push({ id: part.id, distance: intersection.distance });
    }
    const pupil = this.eye.parts.get('pupil')!;
    if (pupil.group.visible && state.layers.pupil === 'on') {
      const center = pupil.anchor.clone().add(pupil.group.position);
      const hit = this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -center.z), new THREE.Vector3());
      if (hit && Math.hypot(hit.x - center.x, hit.y - center.y) < 0.213 && (!state.clip.enabled || this.section.keeps(hit))) hits.push({ id: 'pupil', distance: this.raycaster.ray.origin.distanceTo(hit) });
    }
    hits.sort((a, b) => a.distance - b.distance);
    if (hits.length) this.onSelect(hits[0].id);
  };

  private handleKeyDown = (event: KeyboardEvent) => {
    const actions: Record<string, () => void> = {
      ArrowLeft: () => this.rig.orbit(-0.15, 0), ArrowRight: () => this.rig.orbit(0.15, 0),
      ArrowUp: () => this.rig.orbit(0, -0.15), ArrowDown: () => this.rig.orbit(0, 0.15),
      '+': () => this.zoom(-0.15), '=': () => this.zoom(-0.15), '-': () => this.zoom(0.15),
    };
    if (actions[event.key]) { event.preventDefault(); actions[event.key](); this.invalidate(); }
  };

  private handleMotion = () => {
    this.animator.reducedMotion = this.media.matches;
    if (this.media.matches) this.animator.tick(10);
    if (this.rig) this.rig.controls.enableDamping = !this.media.matches;
    this.invalidate();
  };

  private resize = () => {
    this.width = Math.max(1, this.host.clientWidth);
    this.height = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.invalidate();
  };

  private invalidate = () => {
    if (!this.frame && !this.disposed) this.frame = requestAnimationFrame(this.render);
  };

  private render = (time: number) => {
    this.frame = 0;
    if (this.disposed) return;
    const dt = Math.min(0.05, (time - (this.lastFrame || time)) / 1000);
    this.lastFrame = time;
    this.animator.tick(dt);
    const moved = this.rig.controls.update();
    this.updateSections();
    this.renderLabels();
    this.renderer.render(this.scene, this.camera);
    if (this.animator.active || moved) this.invalidate();
  };

  private disposeGroup(group: THREE.Group) {
    const materials = new Set<THREE.Material>();
    group.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
        object.geometry.dispose();
        this.materials(object).forEach(material => materials.add(material));
      }
    });
    materials.forEach(material => material.dispose());
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.media.removeEventListener('change', this.handleMotion);
    this.rig.controls.removeEventListener('change', this.invalidate);
    this.rig.controls.dispose();
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('keydown', this.handleKeyDown);
    this.canvas.removeEventListener('webglcontextrestored', this.invalidate);
    this.eye.dispose();
    this.disposeGroup(this.rays);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
    this.overlay.remove();
    this.host.style.position = this.originalPosition;
  }
}
