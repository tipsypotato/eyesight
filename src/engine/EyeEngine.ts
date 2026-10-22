import * as THREE from 'three';
import { STRUCTURES } from '../anatomy/data';
import type { CameraSnapshot, EyeSide, SceneState, StructureId, ViewPreset } from '../anatomy/types';
import { Animator } from './animator';
import { CameraRig } from './camera';
import { buildEye, createShellSection, setOpticalGeometry, setPosteriorStretch, type EyePart } from './geometry';
import { BASE_PUPIL_RADIUS, opticsInputForPreset, traceOptics, type TraceOpticsResult } from './optics';
import { createSectionContour, intersectionSurvives, SECTION_AXES, SectionTool } from './section';
import { messages } from '../content/messages';
import { visibleSurface } from './visibility';
import { applyLensClouding, binocularInputs, createAqueousFlow, createNerveDamage, glaucomaAppearance, orientEye } from './disease';

type Drawable = THREE.Mesh | THREE.Line;
type Label = { button: HTMLButtonElement; dot: HTMLSpanElement; leader: HTMLSpanElement; outline: HTMLSpanElement };
type SectionCallbacks = { begin: () => void; change: (offset: number) => void; end: () => void };
const SELECTED_COLOR = new THREE.Color('#4169e1');
const HOVER_COLOR = new THREE.Color('#93b1ff');
const FUNDUS_REFERENCES: StructureId[] = ['macula', 'fovea', 'optic-disc'];
const ANATOMICAL_AXES = [
  ['nasal', 1, 0, 0], ['temporal', -1, 0, 0], ['superior', 0, 1, 0],
  ['inferior', 0, -1, 0], ['anterior', 0, 0, 1], ['posterior', 0, 0, -1],
] as const;

export class EyeEngine {
  readonly renderer: THREE.WebGLRenderer;
  readonly canvas: HTMLCanvasElement;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.02, 50);
  private animator = new Animator();
  private rig: CameraRig;
  private eye = buildEye(Object.fromEntries(STRUCTURES.map(item => [item.id, item.color])));
  private leftEye: ReturnType<typeof buildEye> | null = null;
  private diseaseEffects: THREE.Group | null = null;
  private diseaseKey = '';
  private lensContextCamera: CameraSnapshot | null = null;
  private flowPhase = 0;
  private pickedSide: EyeSide = 'right';
  private hoveredSide: EyeSide = 'right';
  private binocularLabels: HTMLSpanElement[] = [];
  private section = new SectionTool();
  private state: SceneState | null = null;
  private resizeObserver: ResizeObserver;
  private overlay = document.createElement('div');
  private locateButton = document.createElement('button');
  private outline = document.createElement('div');
  private compass = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  private labels = new Map<StructureId, Label>();
  private caps = new Map<StructureId, THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>>();
  private rays = new THREE.Group();
  private neural = new THREE.Group();
  private neuralKey = '';
  private cameraListener: ((camera: CameraSnapshot) => void) | null = null;
  private lastCamera: CameraSnapshot | null = null;
  private syncingCamera = false;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private pointerDown = new THREE.Vector2(Infinity, Infinity);
  private pointerPosition: THREE.Vector2 | null = null;
  private pointerActive = false;
  private pointerDragged = false;
  private activePointers = new Set<number>();
  private tapPointerId: number | null = null;
  private hoveredId: StructureId | null = null;
  private sectionPointerId: number | null = null;
  private sectionGesture = false;
  private sectionControlsEnabled = true;
  private frame = 0;
  private lastFrame = 0;
  private width = 1;
  private height = 1;
  private viewportKey = '';
  private usableRect = { x: 0, y: 0, width: 1, height: 1 };
  private disposed = false;
  private media = window.matchMedia('(prefers-reduced-motion: reduce)');
  private originalPosition: string;
  private capKey = '';
  private posteriorScale = 1;
  private opticsResult: TraceOpticsResult | null = null;
  private opticalGeometryKey = '';

  constructor(private host: HTMLElement, private onSelect: (id: StructureId, side?: EyeSide) => void, private onLocate = onSelect, private sectionCallbacks?: SectionCallbacks) {
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
    this.locateButton.className = 'occluded-target';
    this.locateButton.type = 'button';
    this.locateButton.style.display = 'none';
    this.locateButton.addEventListener('click', () => { if (this.state?.selectedId && this.state.mode !== 'quiz') this.onLocate(this.state.selectedId, this.state.selectedEye); });
    this.outline.className = 'target-outline';
    this.outline.style.display = 'none';
    this.compass.classList.add('eye-compass');
    this.compass.setAttribute('viewBox', '0 0 140 110');
    this.compass.setAttribute('role', 'img');
    this.compass.setAttribute('data-viewport-overlay', '');
    this.compass.innerHTML = '<text x="70" y="14" text-anchor="middle">OD</text>' + ANATOMICAL_AXES.map(() => '<g><line x1="70" y1="65" stroke="#809575"/><text text-anchor="middle" dominant-baseline="middle"/></g>').join('');
    this.overlay.append(this.locateButton, this.outline, this.compass);
    for (const structure of STRUCTURES) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'eye-label';
      Object.assign(button.style, {
        position: 'absolute', display: 'none', transform: 'translate(-50%, -50%)', pointerEvents: 'auto',
        border: '1px solid rgba(122,148,150,.28)', borderRadius: '5px', padding: '4px 7px', minHeight: '44px', minWidth: '44px',
        color: '#253f42', background: 'rgba(255,253,245,.92)', font: '500 10px/1.3 system-ui,sans-serif',
        whiteSpace: 'nowrap', cursor: 'pointer', boxShadow: '0 2px 8px #153b4010',
      });
      button.addEventListener('click', () => {
        if (this.state?.mode !== 'quiz') this.onSelect(structure.id, this.state?.selectedEye ?? 'right');
      });
      const dot = document.createElement('span');
      Object.assign(dot.style, { width: '5px', height: '5px', borderRadius: '50%', position: 'absolute', transform: 'translate(-50%,-50%)', background: structure.color, display: 'none' });
      const leader = document.createElement('span');
      Object.assign(leader.style, { position: 'absolute', height: '1px', background: '#557443', transformOrigin: '0 0', display: 'none' });
      const outline = document.createElement('span');
      outline.setAttribute('aria-hidden', 'true');
      Object.assign(outline.style, { position: 'absolute', display: 'none', border: '1px dotted #7b8588', borderRadius: '50%', pointerEvents: 'none' });
      this.overlay.append(outline, leader, dot, button);
      this.labels.set(structure.id, { button, dot, leader, outline });
    }
    this.neural.name = 'neural-signal';
    this.scene.add(this.eye.root, this.rays, this.neural, this.section.guide);
    this.scene.add(new THREE.HemisphereLight('#fff9e8', '#596e79', 1.7));
    const key = new THREE.DirectionalLight('#fff8e6', 2.4);
    key.position.set(3, 5, 6);
    const fill = new THREE.DirectionalLight('#c9e3e7', 1.0);
    fill.position.set(-4, 1, 2);
    const rim = new THREE.DirectionalLight('#f0d9ba', 0.9);
    rim.position.set(1, -2, -4);
    this.scene.add(key, fill, rim);
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
    this.rig.controls.addEventListener('change', this.handleCameraChange);
    this.canvas.addEventListener('pointerdown', this.handlePointerDown, true);
    this.canvas.addEventListener('pointerup', this.handlePointerUp, true);
    this.canvas.addEventListener('pointermove', this.handlePointerMove, true);
    this.canvas.addEventListener('pointerleave', this.handlePointerLeave);
    this.canvas.addEventListener('pointercancel', this.handlePointerCancel, true);
    this.canvas.addEventListener('lostpointercapture', this.handlePointerCancel);
    window.addEventListener('pointerup', this.handlePointerUp, true);
    window.addEventListener('pointercancel', this.handlePointerCancel, true);
    window.addEventListener('blur', this.handlePointerCancel);
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
    const sceneChanged = !previous || state.mode !== previous.mode || state.sceneRevision !== previous.sceneRevision;
    if (sceneChanged || !state.clip.enabled || state.clip.axis !== previous?.clip.axis || state.clip.keepSide !== previous?.clip.keepSide) this.endSectionDrag();
    if (sceneChanged) this.viewportKey = '';
    if (sceneChanged || state.selectedId !== previous?.selectedId || state.selectedEye !== previous?.selectedEye) {
      this.rig.cancel();
      this.pointerDown.set(Infinity, Infinity);
      this.tapPointerId = null;
      this.pointerDragged = true;
    }
    if (state.mode === 'disease' && state.disease?.id === 'cataract' && state.disease.view === 'lens-detail'
      && previous?.mode === 'disease' && previous.disease?.id === 'cataract' && previous.disease.view === 'context') this.lensContextCamera = this.rig.capture();
    else if (sceneChanged && state.disease?.id === 'cataract' && state.disease.step === 0 && state.disease.view === 'context' && !state.camera && previous?.disease?.id === 'cataract') this.lensContextCamera = null;
    this.state = state;
    const binocular = state.mode === 'disease' && (state.disease?.id === 'strabismus' || state.disease?.id === 'amblyopia');
    if (binocular && !this.leftEye) {
      this.leftEye = buildEye(Object.fromEntries(STRUCTURES.map(item => [item.id, item.color])), 'left');
      this.scene.add(this.leftEye.root);
      for (const side of ['OD', 'OS']) {
        const label = document.createElement('span'); label.textContent = side;
        Object.assign(label.style, { position: 'absolute', color: '#24404a', font: '700 14px system-ui', transform: 'translateX(-50%)' });
        this.overlay.append(label); this.binocularLabels.push(label);
      }
    } else if (!binocular && this.leftEye) {
      this.scene.remove(this.leftEye.root); this.leftEye.dispose(); this.leftEye = null;
      this.binocularLabels.forEach(label => label.remove()); this.binocularLabels = [];
      this.eye.root.position.set(0, 0, 0); this.eye.root.quaternion.identity();
    }
    const quizHidden = (state.mode === 'quiz' || state.mode === 'disease' && state.disease?.step === 3) && !state.quizRevealed;
    if (this.locateButton) this.locateButton.textContent = quizHidden ? '' : messages.occludedTarget[state.lang];
    this.canvas.setAttribute('aria-label', state.lang === 'zh'
      ? binocular ? '可旋转的双眼三维模型。方向键旋转，加减键缩放。' : '可旋转的右眼三维模型。方向键旋转，加减键缩放。'
      : binocular ? 'Rotatable 3D binocular model. Arrow keys rotate; plus and minus zoom.' : 'Rotatable 3D right eye. Arrow keys rotate; plus and minus zoom.');
    if (sceneChanged) { this.pointerActive = false; this.hoveredId = null; }
    this.canvas.style.cursor = this.pointerActive ? 'grabbing' : 'grab';
    for (const eye of this.eyes()) for (const [id, part] of eye.parts) {
      part.group.visible = state.layers[id] !== 'off' && (!state.isolateId || state.isolateId === id);
      part.group.position.copy(part.explode).multiplyScalar(state.explode);
      const selected = state.selectedId === id;
      const label = this.labels.get(id);
      if (label) {
        label.button.textContent = quizHidden ? '' : `${binocular ? (state.selectedEye === 'left' ? 'OS · ' : 'OD · ') : ''}${STRUCTURES.find(item => item.id === id)?.name[state.lang] ?? ''}`;
        label.button.style.borderColor = selected ? '#c58b3f' : 'rgba(122,148,150,.28)';
        label.button.style.fontWeight = selected ? '700' : '500';
      }
    }
    this.updateMaterials();
    if (!this.opticsResult || previous?.opticsInput !== state.opticsInput) {
      this.opticsResult = traceOptics(state.opticsInput);
      this.updateRays(this.opticsResult);
    }
    const showingOptics = state.mode === 'optics' || !!state.showOptics;
    this.rays.visible = showingOptics;
    const posteriorScale = showingOptics ? -this.opticsResult.retinaZ / 0.914 : 1;
    if (posteriorScale !== this.posteriorScale) {
      this.posteriorScale = posteriorScale;
      setPosteriorStretch(this.eye.root, posteriorScale);
    }
    const pupilRadius = showingOptics ? this.opticsResult.pupilRadius : BASE_PUPIL_RADIUS;
    const accommodation = showingOptics ? state.opticsInput.accommodation : 0;
    const opticalGeometryKey = `${pupilRadius}|${accommodation}`;
    if (opticalGeometryKey !== this.opticalGeometryKey) {
      setOpticalGeometry(this.eye.root, { pupilRadius, accommodation });
      this.opticalGeometryKey = opticalGeometryKey;
    }
    if (binocular && state.disease && this.leftEye) {
      const inputs = binocularInputs(state.disease, !!state.diseaseNormal);
      const target = new THREE.Vector3(0, 0, state.disease.id === 'strabismus' && state.disease.targetDistance === 'near' ? 4 : 8);
      for (const [side, eye] of [['right', this.eye], ['left', this.leftEye]] as const) {
        orientEye(eye.root, side, target, inputs[side].deviation);
        setPosteriorStretch(eye.root, inputs[side].myopia ? 1.22 / 0.914 : 1);
      }
      this.posteriorScale = inputs.right.myopia ? 1.22 / 0.914 : 1;
    }
    this.eye.root.updateMatrixWorld(true);
    this.updateDiseaseEffects();
    this.updateNeural();
    this.capKey = '';
    const returningContext = state.mode === 'disease' && state.disease?.id === 'cataract' && state.disease.view === 'context'
      && previous?.disease?.id === 'cataract' && previous.disease.view === 'lens-detail' && (state.disease.contextCamera ?? this.lensContextCamera);
    if (returningContext) this.rig.restore(returningContext);
    else if (sceneChanged && state.camera) this.rig.restore(state.camera);
    else if (state.mode === 'disease' && state.disease?.id === 'cataract' && state.disease.view === 'lens-detail' && state.view === previous?.view && previous.disease?.id === 'cataract' && previous.disease.view !== 'lens-detail') this.focus('lens');
    else if (sceneChanged || state.view !== previous?.view || (state.mode === 'disease' && state.disease?.id === 'cataract' && previous?.disease?.id === 'cataract' && state.disease.view !== previous.disease.view) || state.explode !== previous?.explode || showingOptics !== (previous?.mode === 'optics' || !!previous?.showOptics)) this.setView(state.view);
    this.invalidate();
  }

  private eyes() { return this.leftEye ? [this.eye, this.leftEye] : [this.eye]; }
  private activeEye() { return this.state?.selectedEye === 'left' && this.leftEye ? this.leftEye : this.eye; }

  private updateMaterials() {
    const state = this.state;
    if (!state) return;
    const enclosed = !state.clip.enabled && !state.isolateId && state.explode === 0 && state.layers.sclera === 'on'
      && state.layers.choroid === 'on' && state.layers.retina === 'on';
    for (const eye of this.eyes()) for (const [id, part] of eye.parts) {
      const side = eye === this.eye ? 'right' : 'left';
      const selectedEye = !this.leftEye || side === (state.selectedEye ?? 'right');
      const selected = !(state.mode === 'disease' && state.disease?.step === 3 && !state.quizRevealed) && selectedEye && state.selectedId === id && state.layers[id] === 'on';
      const hovered = state.mode !== 'quiz' && !(state.mode === 'disease' && state.disease?.step === 3 && !state.quizRevealed) && (!this.leftEye || side === this.hoveredSide) && this.hoveredId === id && state.layers[id] === 'on';
      const highlight = selected ? 0.48 : hovered ? 0.18 : 0;
      const accent = selected ? SELECTED_COLOR : HOVER_COLOR;
      const outlineSpace = id === 'anterior-chamber' || id === 'posterior-chamber' || (id === 'vitreous' && state.presetId === 'chambers');
      let contour = part.group.getObjectByName('space-contour') as THREE.LineSegments | undefined;
      if (outlineSpace && !contour) {
        const material = new THREE.LineBasicMaterial({ color: STRUCTURES.find(item => item.id === id)!.color, transparent: true, opacity: 0.75, depthWrite: false });
        material.userData.baseColor = material.color.clone();
        material.userData.baseOpacity = 0.75;
        contour = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([]), material);
        contour.name = 'space-contour';
        contour.userData.structureId = id;
        part.group.add(contour);
      }
      if (contour) contour.visible = outlineSpace;
      part.group.traverse(object => {
        if (!(object instanceof THREE.Mesh || object instanceof THREE.Line) || object.userData.cap) return;
        for (const material of this.materials(object)) {
          const baseOpacity = material.userData.baseOpacity ?? 1;
          material.opacity = state.layers[id] === 'ghost' ? Math.min(baseOpacity, 0.10)
            : selected ? Math.max(baseOpacity, 0.62) : hovered ? Math.max(baseOpacity, 0.32) : baseOpacity;
          if (outlineSpace) material.opacity = object instanceof THREE.Mesh ? 0 : state.layers[id] === 'ghost' ? 0.38 : selected ? 0.95 : 0.75;
          // shortcut: approximate occlusion inside a closed globe; photometric rendering needs tissue-aware shadows.
          if (enclosed && !selected && ['lens', 'anterior-chamber', 'posterior-chamber', 'vitreous'].includes(id)) material.opacity *= 0.18;
          const transparent = material.opacity < 0.999;
          const clipped = state.clip.enabled && !this.leftEye && object !== contour;
          if (material.transparent !== transparent || material.clippingPlanes?.length !== (clipped ? 1 : 0)) material.needsUpdate = true;
          material.transparent = transparent;
          material.depthWrite = !transparent;
          material.clippingPlanes = clipped ? this.section.planes : [];
          if (material instanceof THREE.MeshPhysicalMaterial) {
            material.roughness = material.userData.baseRoughness ?? material.roughness;
            material.clearcoat = material.userData.baseClearcoat ?? material.clearcoat;
            material.emissive.copy(accent);
            material.emissiveIntensity = selected ? 0.38 : hovered ? 0.12 : 0;
          }
          if ('color' in material && material.userData.baseColor) {
            (material.color as THREE.Color).copy(material.userData.baseColor);
            if (highlight) (material.color as THREE.Color).lerp(accent, highlight);
            if (enclosed && !selected && ['retina', 'macula', 'fovea', 'optic-disc', 'retinal-vessels'].includes(id)) (material.color as THREE.Color).multiplyScalar(0.018);
          }
        }
      });
      const cap = eye === this.eye ? this.caps.get(id) : undefined;
      if (cap) cap.material.color.set(STRUCTURES.find(item => item.id === id)!.color).lerp(accent, highlight);
    }
    if (state.mode === 'disease' && state.disease) {
      const normal = !!state.diseaseNormal || state.disease.step === 0;
      if (state.disease.id === 'cataract') applyLensClouding(this.eye, normal ? 0 : state.disease.opacity);
      if (this.leftEye) {
        const inputs = binocularInputs(state.disease, normal);
        applyLensClouding(this.eye, inputs.right.opacity); applyLensClouding(this.leftEye, inputs.left.opacity);
      }
      const quizHidden = state.disease.step === 3 && !state.quizRevealed;
      if (state.disease.id === 'cataract' || this.leftEye) for (const eye of this.eyes()) {
        const side = eye === this.eye ? 'right' : 'left';
        const selected = !quizHidden && state.selectedId === 'lens' && (!this.leftEye || side === state.selectedEye);
        const hovered = !quizHidden && this.hoveredId === 'lens' && (!this.leftEye || side === this.hoveredSide);
        if (!selected && !hovered) continue;
        eye.parts.get('lens')!.group.traverse(object => {
          if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshPhysicalMaterial)) return;
          const accent = selected ? SELECTED_COLOR : HOVER_COLOR;
          object.material.color.lerp(accent, selected ? 0.12 : 0.04);
          object.material.emissive.copy(accent); object.material.emissiveIntensity = selected ? 0.12 : 0.04;
        });
      }
    }
  }

  focus(id: StructureId) {
    if (this.state?.mode === 'quiz') return;
    const part = this.activeEye().parts.get(id);
    if (!part || !part.group.visible) return;
    const bounds = this.boundsFor(part);
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    const fundus = ['macula', 'fovea', 'optic-disc', 'retinal-vessels', 'retina'].includes(id);
    const direction = fundus ? new THREE.Vector3(0, 0, 1) : id === 'optic-nerve' ? new THREE.Vector3(0, 0, -1) : undefined;
    const lensDetail = id === 'lens' && this.state?.mode === 'disease' && this.state.disease?.id === 'cataract' && this.state.disease.view === 'lens-detail';
    this.rig.focus(sphere.center, Math.max(0.06, sphere.radius / (lensDetail ? 0.72 : 0.34)), direction?.applyQuaternion(this.activeEye().root.quaternion));
    this.notifyCamera();
    this.invalidate();
  }

  focusStructures(ids: StructureId[]) {
    if (this.state?.mode === 'quiz' || this.disposed) return;
    const bounds = new THREE.Box3();
    for (const id of new Set(ids)) {
      const part = this.activeEye().parts.get(id);
      if (part?.group.visible) bounds.union(this.boundsFor(part));
    }
    if (bounds.isEmpty()) return;
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    const fundus = ids.every(id => ['retina', 'macula', 'fovea', 'optic-disc', 'optic-nerve', 'retinal-vessels'].includes(id));
    this.rig.preset(fundus ? 'front' : this.state?.view ?? 'oblique', Math.max(0.06, sphere.radius / 0.72), sphere.center);
    this.notifyCamera();
    this.invalidate();
  }

  isStructureVisible(id: StructureId, selectTarget = false) {
    const part = this.activeEye().parts.get(id);
    return !!(part && this.state && visibleSurface(part, this.activeEye().parts, this.state, this.camera, this.activeEye().root.userData.posteriorScale ?? 1, selectTarget));
  }

  private boundsFor(part: EyePart) {
    const bounds = new THREE.Box3();
    part.group.updateWorldMatrix(true, true);
    part.group.traverse(object => {
      if ((object instanceof THREE.Mesh || object instanceof THREE.Line) && !object.userData.cap) {
        object.geometry.computeBoundingBox();
        if (object.geometry.boundingBox) bounds.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
      }
    });
    return bounds;
  }

  setView(view: ViewPreset) {
    const optical = this.state?.mode === 'optics' || this.state?.showOptics;
    if (this.state?.mode === 'disease' && this.state.disease?.id === 'cataract' && this.state.disease.view === 'lens-detail') {
      const sphere = this.boundsFor(this.eye.parts.get('lens')!).getBoundingSphere(new THREE.Sphere());
      this.rig.preset(view, sphere.radius / 0.72, sphere.center);
    } else if (this.leftEye) {
      const bounds = new THREE.Box3().setFromObject(this.eye.root).union(new THREE.Box3().setFromObject(this.leftEye.root));
      if (this.diseaseEffects) bounds.union(new THREE.Box3().setFromObject(this.diseaseEffects));
      const sphere = bounds.getBoundingSphere(new THREE.Sphere());
      this.rig.preset(view, sphere.radius, sphere.center);
    } else if (optical) {
      const bounds = new THREE.Box3().setFromObject(this.eye.root);
      bounds.expandByPoint(new THREE.Vector3(0, 0, 4));
      bounds.expandByPoint(new THREE.Vector3(0, 0, -1.77));
      const sphere = bounds.getBoundingSphere(new THREE.Sphere());
      this.rig.preset(view, sphere.radius, sphere.center);
    } else this.rig.preset(view, 1.38 + (this.state?.explode ?? 0) * 0.60,
      new THREE.Vector3(0, 0, -0.08 + (this.state?.explode ?? 0) * 0.3));
    this.notifyCamera();
    this.invalidate();
  }

  zoom(delta: number) { this.rig.zoom(delta); this.notifyCamera(); this.invalidate(); }
  captureCamera() { return this.rig.capture(); }
  resetCamera() { this.setView(this.state?.view ?? 'oblique'); }

  setCameraListener(listener: ((camera: CameraSnapshot) => void) | null) {
    this.cameraListener = this.disposed ? null : listener;
    this.lastCamera = this.rig.capture();
  }

  syncCamera(snapshot: CameraSnapshot) {
    if (this.disposed) return;
    this.syncingCamera = true;
    try {
      this.rig.restore(snapshot);
      this.rig.setViewport(this.width, this.height, this.usableRect);
      this.lastCamera = this.rig.capture();
    } finally { this.syncingCamera = false; }
    this.invalidate();
  }

  private notifyCamera() {
    if (this.disposed || this.syncingCamera || !this.cameraListener) return;
    const snapshot = this.rig.capture(), previous = this.lastCamera;
    // OrbitControls can round-trip a synchronized pose with sub-pixel floating-point noise.
    if (previous && snapshot.position.every((value, i) => Math.abs(value - previous.position[i]) < 1e-9)
      && snapshot.target.every((value, i) => Math.abs(value - previous.target[i]) < 1e-9)
      && Math.abs(snapshot.zoom - previous.zoom) < 1e-9
      && JSON.stringify(snapshot.viewport) === JSON.stringify(previous.viewport)
      && JSON.stringify(snapshot.viewOffset) === JSON.stringify(previous.viewOffset)) return;
    this.lastCamera = snapshot;
    this.cameraListener(snapshot);
  }

  private handleCameraChange = () => { this.notifyCamera(); this.invalidate(); };

  private materials(object: Drawable): THREE.Material[] {
    return Array.isArray(object.material) ? object.material : [object.material];
  }

  private updateRays(result: TraceOpticsResult) {
    this.disposeGroup(this.rays);
    this.rays.clear();
    const rayMaterial = new THREE.LineBasicMaterial({ color: '#e0a02e', transparent: true, opacity: 0.94, depthTest: false });
    const blockedMaterial = new THREE.LineBasicMaterial({ color: '#687872', transparent: true, opacity: 0.65, depthTest: false });
    for (const ray of result.rays) {
      // Rotate the meridional section about the optical axis so it reads in the sagittal view.
      const points = ray.points.map(([x, y, z]) => new THREE.Vector3(y, x, z));
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), ray.blocked ? blockedMaterial : rayMaterial);
      line.name = 'optical-ray';
      line.renderOrder = 10;
      this.rays.add(line);
    }
    const backLimit = result.retinaZ - 0.55;
    for (const extension of result.extensions) {
      const [start, end] = extension.points.map(([x, y, z]) => new THREE.Vector3(y, x, z));
      if (end.z < backLimit) end.lerpVectors(start, end, (backLimit - start.z) / (end.z - start.z));
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([start, end]), new THREE.LineDashedMaterial({ color: '#b58431', dashSize: 0.04, gapSize: 0.025, depthTest: false }));
      line.name = 'optical-extension';
      line.computeLineDistances();
      line.renderOrder = 10;
      this.rays.add(line);
    }
    if (result.focusKind === 'real' && result.focusZ !== null && Number.isFinite(result.focusZ)
      && result.focusZ >= backLimit && result.focusZ < result.lensZ) {
      const focus = new THREE.Mesh(new THREE.SphereGeometry(0.028, 16, 12), new THREE.MeshBasicMaterial({ color: '#214f42', depthTest: false }));
      focus.name = 'optical-focus';
      focus.position.set(0, 0, result.focusZ);
      focus.renderOrder = 11;
      this.rays.add(focus);
    }
    for (const [x, y, z] of result.retinalIntersections) {
      const point = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), new THREE.MeshBasicMaterial({ color: '#794599', depthTest: false }));
      point.name = 'retinal-intersection';
      point.position.set(y, x, z);
      point.renderOrder = 12;
      this.rays.add(point);
    }
    const retinalPlane = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -0.32, result.retinaZ), new THREE.Vector3(0, 0.32, result.retinaZ)]), new THREE.LineDashedMaterial({ color: '#c46a50', dashSize: 0.035, gapSize: 0.025, depthTest: false }));
    retinalPlane.computeLineDistances();
    retinalPlane.renderOrder = 10;
    this.rays.add(retinalPlane);
    if (result.correctionPower !== 0) {
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

  private updateDiseaseEffects() {
    const state = this.state;
    const draft = state?.mode === 'disease' ? state.disease : null;
    const key = JSON.stringify([draft, state?.diseaseNormal]);
    if (key === this.diseaseKey) return;
    this.diseaseKey = key;
    if (this.diseaseEffects) { this.scene.remove(this.diseaseEffects); this.disposeGroup(this.diseaseEffects); this.diseaseEffects = null; }
    if (!draft) return;
    const effects = new THREE.Group(); effects.name = 'disease-effects';
    if (draft.id === 'glaucoma') {
      const appearance = glaucomaAppearance(draft, !!state?.diseaseNormal);
      if (draft.view === 'outflow') effects.add(createAqueousFlow(appearance.restricted));
      if (draft.view === 'nerve') effects.add(createNerveDamage(appearance.damage));
    }
    if (this.leftEye) {
      const distance = draft.id === 'strabismus' && draft.targetDistance === 'near' ? 4 : 8;
      const target = new THREE.Vector3(0, 0, distance);
      if (draft.id === 'amblyopia' && draft.causeCase === 'anisometropia' && !state?.diseaseNormal && draft.step > 0) {
        const corrected = draft.caseDrafts.anisometropia.inputImproved;
        const trace = traceOptics(opticsInputForPreset(corrected ? 'corrected' : 'myopia'));
        for (const ray of trace.rays.filter(ray => !ray.blocked)) {
          const points = ray.points.filter(([, , z]) => z <= trace.glassesZ).map(([x, y, z]) => this.eye.root.localToWorld(new THREE.Vector3(y, x, z)));
          const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: '#c9932e', transparent: true, opacity: 0.7, depthTest: false }));
          line.name = 'amblyopia-input-ray'; line.renderOrder = 14; effects.add(line);
        }
        if (corrected) {
          const lens = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.016, 8, 48), new THREE.MeshBasicMaterial({ color: '#247c95', depthTest: false }));
          lens.name = 'input-correction-lens'; lens.position.copy(this.eye.root.localToWorld(new THREE.Vector3(0, 0, trace.glassesZ))); lens.quaternion.copy(this.eye.root.quaternion); lens.renderOrder = 15; effects.add(lens);
        }
      }
      const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.10), new THREE.MeshBasicMaterial({ color: '#94712d', depthTest: false }));
      marker.name = 'fixation-target'; marker.position.copy(target); marker.renderOrder = 15; effects.add(marker);
      if (draft.id !== 'strabismus' || draft.showAxes) for (const [i, eye] of this.eyes().entries()) {
        const origin = eye.root.position.clone();
        const direction = new THREE.Vector3(0, 0, 1).applyQuaternion(eye.root.quaternion);
        const end = origin.clone().addScaledVector(direction, (distance - origin.z) / direction.z);
        const ray = new THREE.Line(new THREE.BufferGeometry().setFromPoints([eye.root.localToWorld(new THREE.Vector3(0, 0, 1.1)), end]), new THREE.LineDashedMaterial({ color: i === 0 ? '#2179a1' : '#a1677c', dashSize: 0.12, gapSize: 0.06, depthTest: false }));
        ray.name = i === 0 ? 'right-gaze-axis' : 'left-gaze-axis'; ray.computeLineDistances(); ray.renderOrder = 14; effects.add(ray);
        if (end.distanceTo(target) > 0.03) {
          const miss = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.014, 5, 32), new THREE.MeshBasicMaterial({ color: '#b05055', depthTest: false }));
          miss.name = 'gaze-miss'; miss.position.copy(end); miss.renderOrder = 15; effects.add(miss);
        }
      }
    }
    this.diseaseEffects = effects; this.scene.add(effects);
  }

  private animateAqueous(dt: number) {
    const draft = this.state?.mode === 'disease' ? this.state.disease : null;
    const flow = this.diseaseEffects?.getObjectByName('aqueous-flow');
    const playing = draft?.id === 'glaucoma' && draft.flowPlaying && !!flow && !this.media.matches;
    if (playing) this.flowPhase += dt * (glaucomaAppearance(draft, !!this.state?.diseaseNormal).restricted ? 0.35 : 0.8);
    flow?.children.forEach((arrow, i) => arrow.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) for (const material of this.materials(object)) {
        material.opacity = playing ? 0.55 + 0.45 * Math.max(0, Math.cos(this.flowPhase * Math.PI * 2 - i * 1.2)) : 1;
      }
    }));
    return !!playing;
  }

  private updateNeural() {
    const step = this.state?.physiology?.kind === 'signal' ? this.state.physiology.step : 0;
    const key = `${step}|${this.posteriorScale}|${this.state?.explode}|${this.eye.root.matrixWorld.elements.join(',')}`;
    if (key === this.neuralKey) return;
    this.neuralKey = key;
    this.disposeGroup(this.neural);
    this.neural.clear();
    if (step < 1 || !this.opticsResult) return;
    const retina = this.eye.parts.get('retina')!, disc = this.eye.parts.get('optic-disc')!;
    const conversion = retina.group.localToWorld(new THREE.Vector3(0, 0, this.opticsResult.retinaZ));
    const color = '#7452a8';
    const addNode = (name: string, point: THREE.Vector3, geometry: THREE.BufferGeometry) => {
      const node = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, depthTest: false }));
      node.name = name; node.position.copy(point); node.renderOrder = 14;
      this.neural.add(node);
    };
    addNode('retinal-conversion', conversion, new THREE.OctahedronGeometry(0.055));
    if (step < 2) return;
    const discPoint = disc.anchor.clone(); discPoint.z *= this.posteriorScale;
    disc.group.localToWorld(discPoint);
    const nerve = this.eye.parts.get('optic-nerve')!.group.children.find(child => child instanceof THREE.Mesh && child.geometry instanceof THREE.TubeGeometry) as THREE.Mesh<THREE.TubeGeometry>;
    const nervePoints = nerve.geometry.parameters.path.getPoints(24).map(point => {
      if (point.z < 0) point.z *= this.posteriorScale;
      return nerve.localToWorld(point);
    });
    const addPath = (name: string, points: THREE.Vector3[]) => {
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineDashedMaterial({ color, dashSize: 0.035, gapSize: 0.025, depthTest: false }));
      line.name = name; line.computeLineDistances(); line.renderOrder = 13;
      this.neural.add(line);
    };
    addPath('retinal-neural-path', [conversion, discPoint]);
    addPath('optic-nerve-signal', [discPoint, ...nervePoints]);
    addNode('optic-disc-signal', discPoint, new THREE.OctahedronGeometry(0.045));
    addNode('optic-nerve-exit-signal', nervePoints.at(-1)!, new THREE.OctahedronGeometry(0.045));
  }

  private updateSections() {
    if (!this.state) return;
    this.section.update(this.state.clip, this.camera);
    this.section.guide.visible = this.state.clip.enabled && !this.leftEye && this.state.mode !== 'quiz';
    const key = `${this.state.clip.enabled}|${this.state.clip.axis}|${this.state.clip.offset}|${this.state.explode}|${this.posteriorScale}`;
    for (const [id, cap] of this.caps) {
      const part = this.eye.parts.get(id)!;
      cap.visible = this.state.clip.enabled && !this.leftEye && this.state.layers[id] === 'on';
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
    if (key !== this.capKey) for (const id of ['anterior-chamber', 'posterior-chamber', 'vitreous'] as const) {
      const part = this.eye.parts.get(id)!;
      const contour = part.group.getObjectByName('space-contour') as THREE.LineSegments | undefined;
      if (!contour?.visible) continue;
      const mesh = part.group.children.find(object => object instanceof THREE.Mesh) as THREE.Mesh;
      contour.geometry.dispose();
      contour.geometry = createSectionContour(mesh, this.state.clip.enabled ? this.section.plane : new THREE.Plane(new THREE.Vector3(1, 0, 0), -part.group.position.x));
    }
    this.capKey = key;
  }

  private renderLabels() {
    const state = this.state;
    if (!state) return;
    const enabled = state.mode !== 'quiz' && !(state.mode === 'disease' && state.disease?.step === 3 && !state.quizRevealed);
    const references = state.selectedId && FUNDUS_REFERENCES.includes(state.selectedId) ? FUNDUS_REFERENCES : [];
    const related = enabled ? state.relatedIds ?? [] : [];
    const priority = (id: StructureId) => id === state.selectedId ? 3 : related.includes(id) ? 2 : references.includes(id) ? 1 : 0;
    const occupied: { x: number; y: number; w: number; h: number }[] = [];
    const ids = [...this.labels.keys()].sort((a, b) => priority(b) - priority(a));
    this.locateButton.style.display = this.outline.style.display = 'none';
    const area = this.usableRect;
    for (const id of ids) {
      const { button, dot, leader, outline: secondaryOutline } = this.labels.get(id)!;
      button.style.display = dot.style.display = leader.style.display = secondaryOutline.style.display = 'none';
      const part = this.activeEye().parts.get(id)!;
      if (!enabled || (!state.labels && !priority(id))) continue;
      const world = visibleSurface(part, this.activeEye().parts, state, this.camera, this.activeEye().root.userData.posteriorScale ?? 1);
      if (!world) {
        if (id === state.selectedId) this.locateButton.style.display = 'block';
        continue;
      }
      const point = world.clone().project(this.camera);
      const x = (point.x + 1) * this.width / 2;
      const y = (1 - point.y) * this.height / 2;
      if (id === state.selectedId || related.includes(id)) {
        const outline = id === state.selectedId ? this.outline : secondaryOutline;
        const bounds = this.boundsFor(part);
        const projected = new THREE.Box2();
        for (const bx of [bounds.min.x, bounds.max.x]) for (const by of [bounds.min.y, bounds.max.y]) for (const bz of [bounds.min.z, bounds.max.z]) {
          const p = new THREE.Vector3(bx, by, bz).project(this.camera);
          projected.expandByPoint(new THREE.Vector2((p.x + 1) * this.width / 2, (1 - p.y) * this.height / 2));
        }
        const size = projected.getSize(new THREE.Vector2());
        Object.assign(outline.style, { display: 'block', left: `${projected.min.x - 5}px`, top: `${projected.min.y - 5}px`, width: `${size.x + 10}px`, height: `${size.y + 10}px` });
      }
      button.style.display = 'block';
      const w = button.offsetWidth, h = button.offsetHeight;
      const position = [[0, -32], [w / 2 + 24, 0], [-w / 2 - 24, 0], [0, 34], [w / 2 + 24, -48], [-w / 2 - 24, 48]]
        .map(([dx, dy]) => ({ x: Math.max(area.x + w / 2, Math.min(area.x + area.width - w / 2, x + dx)), y: Math.max(area.y + h / 2, Math.min(area.y + area.height - h / 2, y + dy)), w, h }))
        .find(p => !occupied.some(other => Math.abs(other.x - p.x) < (w + other.w) / 2 + 6 && Math.abs(other.y - p.y) < (h + other.h) / 2 + 6));
      if (!position) { button.style.display = 'none'; continue; }
      occupied.push(position);
      button.style.left = `${position.x}px`;
      button.style.top = `${position.y}px`;
      dot.style.left = `${x}px`;
      dot.style.top = `${y}px`;
      dot.style.display = 'block';
      Object.assign(leader.style, { display: 'block', left: `${x}px`, top: `${y}px`, width: `${Math.hypot(position.x - x, position.y - y)}px`, transform: `rotate(${Math.atan2(position.y - y, position.x - x)}rad)` });
    }
    if (this.leftEye) for (const [i, eye] of this.eyes().entries()) {
      const p = eye.root.localToWorld(new THREE.Vector3(0, 1.15, 0)).project(this.camera);
      Object.assign(this.binocularLabels[i].style, { left: `${(p.x + 1) * this.width / 2}px`, top: `${(1 - p.y) * this.height / 2}px` });
    }
    this.renderCompass();
  }

  private renderCompass() {
    const lang = this.state!.lang;
    this.compass.setAttribute('aria-label', messages.compass[lang]);
    this.compass.firstElementChild!.textContent = this.leftEye ? (this.state?.selectedEye === 'left' ? 'OS' : 'OD') : messages.compassTitle[lang];
    const rotation = this.camera.quaternion.clone().invert();
    ANATOMICAL_AXES.forEach(([name, x, y, z], i) => {
      const direction = new THREE.Vector3(x * (this.leftEye && this.state?.selectedEye === 'left' ? -1 : 1), y, z).applyQuaternion(this.activeEye().root.quaternion).applyQuaternion(rotation);
      const group = this.compass.children[i + 1];
      const endX = 70 + direction.x * 30, endY = 65 - direction.y * 30;
      group.setAttribute('opacity', direction.z < 0 ? '0.55' : '1');
      group.children[0].setAttribute('x2', String(endX)); group.children[0].setAttribute('y2', String(endY));
      const text = group.children[1];
      text.textContent = messages[name][lang];
      text.setAttribute('x', String(endX + direction.x * 12));
      text.setAttribute('y', String(endY - direction.y * 10 + (Math.hypot(direction.x, direction.y) < 0.3 ? direction.z > 0 ? -10 : 10 : 0)));
    });
  }

  private measureViewport() {
    const rect = this.host.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    let top = 8, bottom = this.height - 8;
    let corner: DOMRect | null = null;
    for (const overlay of this.host.parentElement!.querySelectorAll('[data-viewport-overlay]')) {
      const box = overlay.getBoundingClientRect();
      if (box.height === 0 || box.bottom <= rect.top || box.top >= rect.bottom) continue;
      if (overlay === this.compass) { corner = box; continue; }
      if (box.top + box.height / 2 < rect.top + this.height / 2) top = Math.max(top, box.bottom - rect.top + 8);
      else bottom = Math.min(bottom, box.top - rect.top - 8);
    }
    this.usableRect = { x: 8, y: Math.min(top, this.height - 32), width: Math.max(1, this.width - 16), height: Math.max(24, bottom - top) };
    if (corner && corner.bottom - rect.top > this.usableRect.y && corner.left - rect.left < this.usableRect.x + this.usableRect.width) {
      const below = { ...this.usableRect, y: Math.max(this.usableRect.y, corner.bottom - rect.top + 8) };
      below.height = Math.max(1, this.usableRect.y + this.usableRect.height - below.y);
      const beside = { ...this.usableRect, width: Math.max(1, corner.left - rect.left - 8 - this.usableRect.x) };
      this.usableRect = Math.min(beside.width, beside.height) > Math.min(below.width, below.height) ? beside : below;
    }
    const key = JSON.stringify([this.width, this.height, this.usableRect]);
    if (key !== this.viewportKey) { this.viewportKey = key; this.rig.setViewport(this.width, this.height, this.usableRect); }
  }

  private pickStructure(clientX: number, clientY: number): StructureId | null {
    const state = this.state;
    if (!state || state.mode === 'quiz' || state.mode === 'disease' && state.disease?.step === 3 && !state.quizRevealed) return null;
    const rect = this.canvas.getBoundingClientRect();
    if (clientX < rect.left || clientY < rect.top || clientX > rect.left + rect.width || clientY > rect.top + rect.height) return null;
    this.camera.updateMatrixWorld();
    this.eye.root.updateWorldMatrix(true, true);
    this.section.update(state.clip, this.camera);
    this.pointer.set((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits: { id: StructureId; side: EyeSide; distance: number }[] = [];
    for (const eye of this.eyes()) {
      eye.root.updateWorldMatrix(true, true);
      const side: EyeSide = eye === this.eye ? 'right' : 'left';
      const candidates = [...eye.parts.values()].filter(part => part.group.visible && state.layers[part.id] === 'on');
      for (const part of candidates) {
        const intersection = this.raycaster.intersectObject(part.group, true).find(intersectionSurvives);
        if (intersection) hits.push({ id: part.id, side, distance: intersection.distance });
      }
      const pupil = eye.parts.get('pupil')!;
      if (pupil.group.visible && state.layers.pupil === 'on') {
        const center = pupil.group.localToWorld(pupil.anchor.clone());
        const normal = new THREE.Vector3(0, 0, 1).transformDirection(pupil.group.matrixWorld);
        const hit = this.raycaster.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(normal, center), new THREE.Vector3());
        if (hit && hit.distanceTo(center) < pupil.group.userData.hitRadius && (!state.clip.enabled || this.leftEye || this.section.keeps(hit))) hits.push({ id: 'pupil', side, distance: this.raycaster.ray.origin.distanceTo(hit) });
      }
    }
    hits.sort((a, b) => a.distance - b.distance);
    this.pickedSide = hits[0]?.side ?? 'right';
    return hits[0]?.id ?? null;
  }

  private updateHover() {
    const sectionHovered = this.pointerPosition && !this.pointerActive && this.pickSectionFrame(this.pointerPosition.x, this.pointerPosition.y);
    const id = this.pointerPosition && !this.pointerActive
      && !sectionHovered ? this.pickStructure(this.pointerPosition.x, this.pointerPosition.y) : null;
    if (id !== this.hoveredId || this.pickedSide !== this.hoveredSide) {
      this.hoveredId = id; this.hoveredSide = this.pickedSide;
      this.updateMaterials();
    }
    this.canvas.style.cursor = this.pointerActive ? 'grabbing' : sectionHovered ? 'move' : id ? 'pointer' : 'grab';
  }

  private setPointerRay(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    this.camera.updateMatrixWorld();
    this.pointer.set((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return rect;
  }

  private pickSectionFrame(clientX: number, clientY: number) {
    if (this.leftEye || !this.sectionCallbacks || !this.state?.clip.enabled || this.state.mode === 'quiz') return null;
    const rect = this.setPointerRay(clientX, clientY);
    this.section.update(this.state.clip);
    this.section.guide.updateMatrixWorld(true);
    const threshold = this.raycaster.params.Line.threshold;
    this.raycaster.params.Line.threshold = 9 * 2 * this.camera.position.distanceTo(this.section.guide.position)
      * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) / (Math.max(1, rect.height) * this.camera.zoom);
    const hit = this.raycaster.intersectObject(this.section.frame, false)[0] ?? null;
    this.raycaster.params.Line.threshold = threshold;
    return hit;
  }

  private beginSectionDrag(event: PointerEvent) {
    if (event.button !== 0 || this.sectionPointerId != null) return false;
    const hit = this.pickSectionFrame(event.clientX, event.clientY);
    if (!hit) return false;
    event.preventDefault(); event.stopImmediatePropagation();
    this.rig.cancel();
    this.sectionControlsEnabled = this.rig.controls.enabled;
    this.rig.controls.enabled = false;
    this.sectionPointerId = event.pointerId;
    this.sectionGesture = true;
    this.tapPointerId = null;
    this.pointerActive = true;
    this.pointerDragged = true;
    this.pointerDown.set(Infinity, Infinity);
    this.canvas.setPointerCapture(event.pointerId);
    this.section.beginDrag(this.raycaster.ray, hit.point, this.camera, event.clientY, this.canvas.getBoundingClientRect().height);
    this.sectionCallbacks!.begin();
    this.updateHover(); this.invalidate();
    return true;
  }

  private moveSectionDrag(event: PointerEvent) {
    if (this.sectionPointerId == null || event.pointerId !== this.sectionPointerId) return false;
    event.preventDefault(); event.stopImmediatePropagation();
    this.setPointerRay(event.clientX, event.clientY);
    const offset = this.section.dragOffset(this.raycaster.ray, event.clientY);
    if (offset !== null && offset !== this.state?.clip.offset) this.sectionCallbacks!.change(offset);
    this.invalidate();
    return true;
  }

  private endSectionDrag(event?: PointerEvent) {
    if (this.sectionPointerId == null || (event && event.pointerId !== this.sectionPointerId)) return false;
    event?.preventDefault(); event?.stopImmediatePropagation();
    const pointerId = this.sectionPointerId;
    this.sectionPointerId = null;
    this.section.endDrag();
    this.pointerActive = false;
    this.pointerPosition = null;
    this.pointerDown.set(Infinity, Infinity);
    this.rig.controls.enabled = this.sectionControlsEnabled;
    if (this.canvas.hasPointerCapture(pointerId)) this.canvas.releasePointerCapture(pointerId);
    this.sectionCallbacks!.end();
    this.updateHover(); this.invalidate();
    return true;
  }

  private handlePointerMove = (event: PointerEvent) => {
    if (this.sectionGesture) {
      event.preventDefault(); event.stopImmediatePropagation();
      this.moveSectionDrag(event); return;
    }
    if (event.pointerId === this.tapPointerId) {
      const samples = [...(event.getCoalescedEvents?.() ?? []), event];
      const tolerance = event.pointerType === 'touch' ? 12 : 6;
      if (samples.some(sample => Math.hypot(sample.clientX - this.pointerDown.x, sample.clientY - this.pointerDown.y) > tolerance)) this.pointerDragged = true;
    }
    if (event.pointerType !== 'touch') this.pointerPosition = new THREE.Vector2(event.clientX, event.clientY);
    this.invalidate();
  };

  private handlePointerDown = (event: PointerEvent) => {
    if (this.activePointers.has(event.pointerId)) return;
    this.activePointers.add(event.pointerId);
    this.pointerActive = true;
    if (this.sectionGesture) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    if (this.activePointers.size > 1) {
      this.tapPointerId = null;
      this.pointerDragged = true;
      this.updateHover(); this.invalidate(); return;
    }
    this.tapPointerId = event.button === 0 ? event.pointerId : null;
    this.pointerDragged = false;
    if (this.beginSectionDrag(event)) return;
    this.pointerDown.set(event.clientX, event.clientY);
    this.updateHover();
    this.invalidate();
  };

  private handlePointerUp = (event: PointerEvent) => {
    if (!this.activePointers.delete(event.pointerId)) return;
    if (this.sectionGesture) {
      event.preventDefault(); event.stopImmediatePropagation();
      this.moveSectionDrag(event); this.endSectionDrag(event);
      this.pointerActive = this.activePointers.size > 0;
      this.sectionGesture = this.pointerActive;
      this.updateHover(); this.invalidate(); return;
    }
    const clicked = event.pointerId === this.tapPointerId && !this.pointerDragged && event.button === 0
      && this.pointerDown.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) <= (event.pointerType === 'touch' ? 12 : 6);
    this.pointerActive = this.activePointers.size > 0;
    this.tapPointerId = null;
    this.pointerDown.set(Infinity, Infinity);
    this.pointerPosition = event.pointerType === 'touch' ? null : new THREE.Vector2(event.clientX, event.clientY);
    if (clicked) {
      const id = this.pickStructure(event.clientX, event.clientY);
      if (id) this.onSelect(id, this.pickedSide);
    }
    this.updateHover();
    this.invalidate();
  };

  private handlePointerLeave = () => {
    this.tapPointerId = null;
    this.pointerDragged = true;
    this.pointerPosition = null;
    this.updateHover();
    this.invalidate();
  };

  private handlePointerCancel = (event: Event) => {
    if ('pointerId' in event) {
      const id = (event as PointerEvent).pointerId;
      if (!this.activePointers.has(id)) return;
      if (this.sectionGesture) { event.preventDefault(); event.stopImmediatePropagation(); }
      // Losing capture does not end contact; keep suppressing taps until its eventual release.
      if (event.type !== 'lostpointercapture') this.activePointers.delete(id);
      if (id === this.sectionPointerId) this.endSectionDrag();
    } else {
      this.activePointers.clear();
      this.endSectionDrag();
    }
    if (event.type === 'blur' || event.type === 'lostpointercapture') this.rig.cancel();
    this.pointerActive = this.activePointers.size > 0;
    this.sectionGesture = this.sectionGesture && this.pointerActive;
    this.tapPointerId = null;
    this.pointerDragged = true;
    this.pointerDown.set(Infinity, Infinity);
    this.handlePointerLeave();
  };

  private handleKeyDown = (event: KeyboardEvent) => {
    if (this.sectionPointerId != null) {
      if (event.key === 'Escape') { event.preventDefault(); this.endSectionDrag(); }
      return;
    }
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
    if (this.host.clientWidth === 0 || this.host.clientHeight === 0) return;
    this.width = Math.max(1, this.host.clientWidth);
    this.height = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(this.width, this.height, false);
    this.measureViewport();
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
    this.measureViewport();
    this.animator.tick(dt);
    const moved = this.rig.controls.update();
    this.notifyCamera();
    this.updateSections();
    this.updateHover();
    this.renderLabels();
    const flowing = this.animateAqueous(dt);
    this.renderer.render(this.scene, this.camera);
    if (this.animator.active || moved || flowing) this.invalidate();
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
    this.endSectionDrag();
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.media.removeEventListener('change', this.handleMotion);
    this.cameraListener = null;
    this.rig.controls.removeEventListener('change', this.handleCameraChange);
    this.rig.controls.dispose();
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown, true);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp, true);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove, true);
    this.canvas.removeEventListener('pointerleave', this.handlePointerLeave);
    this.canvas.removeEventListener('pointercancel', this.handlePointerCancel, true);
    this.canvas.removeEventListener('lostpointercapture', this.handlePointerCancel);
    window.removeEventListener('pointerup', this.handlePointerUp, true);
    window.removeEventListener('pointercancel', this.handlePointerCancel, true);
    window.removeEventListener('blur', this.handlePointerCancel);
    this.canvas.removeEventListener('keydown', this.handleKeyDown);
    this.canvas.removeEventListener('webglcontextrestored', this.invalidate);
    this.eye.dispose();
    this.leftEye?.dispose();
    if (this.diseaseEffects) this.disposeGroup(this.diseaseEffects);
    this.disposeGroup(this.rays);
    this.disposeGroup(this.neural);
    this.disposeGroup(this.section.guide);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
    this.overlay.remove();
    this.host.style.position = this.originalPosition;
  }
}
