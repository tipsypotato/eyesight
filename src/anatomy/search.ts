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
  ['青光眼', ['optic-disc', 'optic-nerve']], ['glaucoma', ['optic-disc', 'optic-nerve']],
]);

export function searchStructures(query: string): StructureSearchResult {
  const normalized = query.trim().toLowerCase();
  const ids = aliases.get(normalized);
  const group = normalized === '眼底' || normalized === 'fundus' ? 'fundus' : null;
  const items = STRUCTURES.filter(item => group ? item.group === group : ids ? ids.includes(item.id)
    : `${item.name.zh} ${item.name.en} ${item.latin} ${item.id}`.toLowerCase().includes(normalized));
  return { items, ambiguous: normalized === '黑眼珠', group,
    relatedDisease: ['白内障', 'cataract', '青光眼', 'glaucoma'].includes(normalized) };
}
