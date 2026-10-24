import type { DiseaseDraft } from '../modes/disease';

export type Lang = 'zh' | 'en';
export type Localized = Record<Lang, string>;
export const EXTRAOCULAR_IDS = ['superior-rectus', 'inferior-rectus', 'medial-rectus', 'lateral-rectus', 'superior-oblique', 'inferior-oblique'] as const;
export const ADNEXAL_IDS = ['bulbar-conjunctiva', 'palpebral-conjunctiva', 'eyelid-skin', 'orbicularis-oculi', 'levator-palpebrae', 'tarsal-plates', 'meibomian-glands', 'zeis-glands', 'moll-glands'] as const;
export const ORBITAL_IDS = ['orbital-roof', 'orbital-floor', 'medial-orbital-wall', 'lateral-orbital-wall', 'intraconal-fat', 'extraconal-fat', 'oculomotor-nerve', 'trochlear-nerve', 'abducens-nerve', 'frontal-nerve', 'lacrimal-nerve', 'nasociliary-nerve', 'ciliary-ganglion', 'ophthalmic-artery', 'superior-ophthalmic-vein', 'inferior-ophthalmic-vein', 'lacrimal-gland'] as const;
export const STRUCTURE_IDS = ['cornea', 'sclera', 'iris', 'pupil', 'ciliary-body', 'zonules', 'lens', 'anterior-chamber', 'posterior-chamber', 'vitreous', 'choroid', 'retina', 'macula', 'fovea', 'optic-disc', 'optic-nerve', 'retinal-vessels', 'iridocorneal-angle', 'trabecular-meshwork', ...EXTRAOCULAR_IDS, ...ADNEXAL_IDS, ...ORBITAL_IDS] as const;
export type StructureId = typeof STRUCTURE_IDS[number];
export type EyeSide = 'right' | 'left';
export type EyeRef = { side: EyeSide; structureId: StructureId };
export type GroupId = 'wall' | 'front' | 'inside' | 'fundus' | 'extraocular' | 'adnexa' | 'orbit';
export type Structure = {
  id: StructureId; name: Localized; latin: string; group: GroupId; color: string;
  kind: 'tissue' | 'region' | 'space'; summary: Localized; function: Localized;
  position: Localized; fact: Localized; sources: { title: string; url: string }[];
};
export type Mode = 'explore' | 'optics' | 'tour' | 'quiz' | 'disease';
export type LayerMode = 'on' | 'ghost' | 'off';
export type ViewPreset = 'oblique' | 'front' | 'side' | 'back';
export type ClipAxis = 'sagittal' | 'axial' | 'coronal';
export type KeepSide = 'negative' | 'positive';
export const SCENE_PRESETS = ['intact', 'wall-cut', 'anterior', 'fundus', 'chambers', 'optical-path', 'extraocular', 'eyelids', 'orbit'] as const;
export type ScenePreset = typeof SCENE_PRESETS[number];
export type OpticsPreset = 'normal' | 'myopia' | 'corrected';
export type OpticsInput = {
  axialIncrement: number;
  objectDistance: 'far' | 'mid' | 'near';
  accommodation: number;
  pupil: 'small' | 'medium' | 'large';
  externalLens: 'off' | 'myopia';
};
export type OpticsExperiment = 'baseline' | 'free' | keyof OpticsInput;
export type PhysiologyKind = 'pupil' | 'accommodation' | 'signal';
export type PhysiologyState = {
  kind: PhysiologyKind; step: number; playing: boolean;
  returnInput: OpticsInput; returnExperiment: OpticsExperiment; returnPreset: OpticsPreset; returnShowOptics: boolean;
};
export type CameraSnapshot = {
  position: [number, number, number]; target: [number, number, number]; zoom: number;
  viewOffset?: { fullWidth: number; fullHeight: number; offsetX: number; offsetY: number; width: number; height: number };
  viewport?: { aspect: number; usableFraction: [number, number] };
};
export interface SceneState {
  lang: Lang; mode: Mode; selectedId: StructureId | null;
  disease?: DiseaseDraft | null; diseaseNormal?: boolean; selectedEye?: EyeSide;
  relatedIds?: StructureId[];
  layers: Record<StructureId, LayerMode>; isolateId: StructureId | null;
  clip: { enabled: boolean; axis: ClipAxis; offset: number; keepSide: KeepSide };
  presetId: ScenePreset | null;
  explode: number; labels: boolean; view: ViewPreset;
  opticsPreset: OpticsPreset; opticsInput: OpticsInput; opticsExperiment: OpticsExperiment; quizRevealed: boolean;
  comparison: { input: OpticsInput; showing: 'reference' | 'current' } | null;
  physiology: PhysiologyState | null;
  showOptics?: boolean;
  camera?: CameraSnapshot | null;
  sceneRevision?: number;
}
export const FLAT_LAYOUT_START = 2 / 3;
export const EXPLODE_SCALE = 3 / FLAT_LAYOUT_START;

export function sectionLimit(scene: Pick<SceneState, 'layers' | 'isolateId' | 'clip' | 'explode'>): number {
  const orbital = ORBITAL_IDS.some(id => scene.layers[id] !== 'off' && (!scene.isolateId || scene.isolateId === id));
  const separation = scene.explode < FLAT_LAYOUT_START ? scene.explode * EXPLODE_SCALE : 0;
  // Expanded adnexa and the optic nerve extend beyond the globe's unit radius.
  const extent = orbital ? 3 + separation : scene.explode > 0 ? 2.3 + 1.2 * separation : 1;
  return Math.max(extent, Math.abs(scene.clip.offset));
}
export interface TourStep {
  title: Localized; body: Localized; target: StructureId; view: ViewPreset;
  clip: boolean; optics?: OpticsPreset;
}
export interface Lesson { id: string; title: Localized; description: Localized; steps: TourStep[] }
