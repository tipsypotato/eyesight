import { STRUCTURES } from './data';
import type { GroupId, Structure, StructureId } from './types';

export type StructureSearchResult = {
  items: Structure[]; ambiguous: boolean; group: GroupId | null; relatedDisease: boolean;
};

const aliases = new Map<string, readonly StructureId[]>([
  ['白眼球', ['sclera']], ['眼白', ['sclera']],
  ['晶体', ['lens']], ['crystalline lens', ['lens']],
  ['黑眼珠', ['iris', 'pupil']],
  ['白内障', ['lens']], ['cataract', ['lens']],
  ['房角', ['iridocorneal-angle']], ['anterior chamber angle', ['iridocorneal-angle']],
  ['小梁网', ['trabecular-meshwork']], ['trabecular meshwork', ['trabecular-meshwork']],
  ['青光眼', ['optic-disc', 'optic-nerve']], ['glaucoma', ['optic-disc', 'optic-nerve']],
  ['sr', ['superior-rectus']], ['ir', ['inferior-rectus']],
  ['mr', ['medial-rectus']], ['lr', ['lateral-rectus']],
  ['so', ['superior-oblique']], ['io', ['inferior-oblique']],
  ['结膜', ['bulbar-conjunctiva', 'palpebral-conjunctiva']], ['conjunctiva', ['bulbar-conjunctiva', 'palpebral-conjunctiva']],
  ['tarsal glands', ['meibomian-glands']], ['mgd', ['meibomian-glands']], ['meibomian gland dysfunction', ['meibomian-glands']], ['睑板腺功能障碍', ['meibomian-glands']],
  ['zeis', ['zeis-glands']], ['zeiss', ['zeis-glands']], ['睫毛皮脂腺', ['zeis-glands']], ['蔡氏腺', ['zeis-glands']],
  ['zeis腺', ['zeis-glands']],
  ['moll', ['moll-glands']], ['莫氏腺', ['moll-glands']], ['睫毛汗腺', ['moll-glands']],
  ['moll腺', ['moll-glands']],
]);

export function searchStructures(query: string): StructureSearchResult {
  const normalized = query.trim().toLowerCase();
  const exact = STRUCTURES.filter(item => [item.id, item.name.zh, item.name.en, item.latin].some(name => name.toLowerCase() === normalized));
  const ids = aliases.get(normalized) ?? (exact.length ? exact.map(item => item.id) : undefined);
  const group = normalized === '眼底' || normalized === 'fundus' ? 'fundus'
    : ['眼外肌', '眼外肌群', 'extraocular', 'extraocular muscles', 'eom', 'eoms'].includes(normalized) ? 'extraocular'
    : ['结膜与眼睑', '眼睑', '眼皮', 'eyelids', 'eyelid', 'conjunctiva & eyelids', 'adnexa'].includes(normalized) ? 'adnexa' : null;
  const items = STRUCTURES.filter(item => group ? item.group === group : ids ? ids.includes(item.id)
    : `${item.name.zh} ${item.name.en} ${item.latin} ${item.id}`.toLowerCase().includes(normalized));
  return { items, ambiguous: normalized === '黑眼珠', group,
    relatedDisease: ['白内障', 'cataract', '青光眼', 'glaucoma'].includes(normalized) };
}
