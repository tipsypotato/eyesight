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
]);

export function searchStructures(query: string): StructureSearchResult {
  const normalized = query.trim().toLowerCase();
  const exact = STRUCTURES.filter(item => [item.id, item.name.zh, item.name.en, item.latin].some(name => name.toLowerCase() === normalized));
  const ids = aliases.get(normalized) ?? (exact.length ? exact.map(item => item.id) : undefined);
  const group = normalized === '眼底' || normalized === 'fundus' ? 'fundus'
    : ['眼外肌', '眼外肌群', 'extraocular', 'extraocular muscles', 'eom', 'eoms'].includes(normalized) ? 'extraocular' : null;
  const items = STRUCTURES.filter(item => group ? item.group === group : ids ? ids.includes(item.id)
    : `${item.name.zh} ${item.name.en} ${item.latin} ${item.id}`.toLowerCase().includes(normalized));
  return { items, ambiguous: normalized === '黑眼珠', group,
    relatedDisease: ['白内障', 'cataract', '青光眼', 'glaucoma'].includes(normalized) };
}
