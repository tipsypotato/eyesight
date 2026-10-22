export type Lang = 'zh' | 'en';
export type Localized = Record<Lang, string>;
export const STRUCTURE_IDS = ['cornea', 'sclera', 'iris', 'pupil', 'ciliary-body', 'zonules', 'lens', 'anterior-chamber', 'posterior-chamber', 'vitreous', 'choroid', 'retina', 'macula', 'fovea', 'optic-disc', 'optic-nerve', 'retinal-vessels'] as const;
export type StructureId = typeof STRUCTURE_IDS[number];
export type GroupId = 'wall' | 'front' | 'inside' | 'fundus';
export type Structure = {
  id: StructureId; name: Localized; latin: string; group: GroupId; color: string;
  kind: 'tissue' | 'region' | 'space'; summary: Localized; function: Localized;
  position: Localized; fact: Localized; sources: { title: string; url: string }[];
};
export type Mode = 'explore' | 'optics' | 'tour' | 'quiz';
export type LayerMode = 'on' | 'ghost' | 'off';
export type ViewPreset = 'oblique' | 'front' | 'side' | 'back';
export type ClipAxis = 'sagittal' | 'axial' | 'coronal';
export type OpticsPreset = 'normal' | 'myopia' | 'corrected';
export interface SceneState {
  lang: Lang; mode: Mode; selectedId: StructureId | null;
  layers: Record<StructureId, LayerMode>; isolateId: StructureId | null;
  clip: { enabled: boolean; axis: ClipAxis; offset: number };
  explode: number; labels: boolean; view: ViewPreset;
  opticsPreset: OpticsPreset; quizRevealed: boolean;
  showOptics?: boolean;
}
export interface TourStep {
  title: Localized; body: Localized; target: StructureId; view: ViewPreset;
  clip: boolean; optics?: OpticsPreset;
}
export interface Lesson { id: string; title: Localized; description: Localized; steps: TourStep[] }
