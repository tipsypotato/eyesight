import { STRUCTURES } from './data';
import type { Localized, ScenePreset, StructureId } from './types';

export type RelationshipId = 'accommodation' | 'aqueous' | 'fundus';
export type Relationship = {
  id: RelationshipId; name: Localized; description: Localized; preset: ScenePreset;
  members: { id: StructureId; role: Localized }[];
};
const member = (id: StructureId, field: 'function' | 'position' | 'fact') => ({ id, role: STRUCTURES.find(item => item.id === id)![field] });

export const RELATIONSHIPS: Relationship[] = [
  {
    id: 'accommodation', preset: 'anterior', name: { zh: '调节关系', en: 'Accommodation relationships' },
    description: { zh: '一起观察睫状体、悬韧带与晶状体；这些结构通过张力变化共同参与调节。', en: 'Observe the ciliary body, zonular fibers and lens together; changes in tension link their roles in accommodation.' },
    members: [member('ciliary-body', 'fact'), member('zonules', 'function'), member('lens', 'function')],
  },
  {
    id: 'aqueous', preset: 'chambers', name: { zh: '房水相关结构', en: 'Aqueous humor relationships' },
    description: { zh: '区分产生房水的组织、容纳房水的空间与瞳孔开口；这里只观察到前房，尚未展示完整流出路线。', en: 'Distinguish the tissue producing aqueous humor, the spaces containing it and the pupil opening; this view ends at the anterior chamber and does not show the full outflow route.' },
    members: [member('ciliary-body', 'function'), member('posterior-chamber', 'function'), member('pupil', 'position'), member('anterior-chamber', 'fact')],
  },
  {
    id: 'fundus', preset: 'fundus', name: { zh: '眼底地标关系', en: 'Fundus landmark relationships' },
    description: { zh: '黄斑与中央凹是视网膜上的区域；对照视盘和视神经，观察包含关系与鼻颞方位。', en: 'The macula and fovea are regions of the retina; compare them with the optic disc and nerve to examine their relationships and nasal–temporal positions.' },
    members: [member('retina', 'function'), member('macula', 'position'), member('fovea', 'position'), member('optic-disc', 'position'), member('optic-nerve', 'function')],
  },
];
