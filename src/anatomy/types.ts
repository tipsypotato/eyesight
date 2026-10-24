import type { DiseaseDraft } from '../modes/disease';

export type Lang = 'zh' | 'en';
export type Localized = Record<Lang, string>;
export const EXTRAOCULAR_IDS = ['superior-rectus', 'inferior-rectus', 'medial-rectus', 'lateral-rectus', 'superior-oblique', 'inferior-oblique'] as const;
export const ADNEXAL_IDS = ['bulbar-conjunctiva', 'palpebral-conjunctiva', 'eyelid-skin', 'orbicularis-oculi', 'levator-palpebrae', 'tarsal-plates', 'meibomian-glands', 'zeis-glands', 'moll-glands'] as const;
export const STRUCTURE_IDS = ['cornea', 'sclera', 'iris', 'pupil', 'ciliary-body', 'zonules', 'lens', 'anterior-chamber', 'posterior-chamber', 'vitreous', 'choroid', 'retina', 'macula', 'fovea', 'optic-disc', 'optic-nerve', 'retinal-vessels', 'iridocorneal-angle', 'trabecular-meshwork', ...EXTRAOCULAR_IDS, ...ADNEXAL_IDS] as const;
export type StructureId = typeof STRUCTURE_IDS[number];
export type EyeSide = 'right' | 'left';
export type EyeRef = { side: EyeSide; structureId: StructureId };
export type GroupId = 'wall' | 'front' | 'inside' | 'fundus' | 'extraocular' | 'adnexa';
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
export const SCENE_PRESETS = ['intact', 'wall-cut', 'anterior', 'fundus', 'chambers', 'optical-path', 'extraocular', 'eyelids'] as const;
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
export interface TourStep {
  title: Localized; body: Localized; target: StructureId; view: ViewPreset;
  clip: boolean; optics?: OpticsPreset;
}
export interface Lesson { id: string; title: Localized; description: Localized; steps: TourStep[] }
