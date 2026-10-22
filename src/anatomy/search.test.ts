import { describe, expect, it } from 'vitest';
import { STRUCTURES } from './data';
import { searchStructures } from './search';

const ids = (query: string) => searchStructures(query).items.map(item => item.id);

describe('structure search', () => {
  it('matches both languages, Latin names and stable IDs without case or edge-space sensitivity', () => {
    expect(ids('  CoRnEa  ')).toEqual(['cornea']);
    expect(ids('晶状体')).toContain('lens');
    expect(ids(' Fovea centralis ')).toEqual(['fovea']);
    expect(ids('optic-disc')).toEqual(['optic-disc']);
    expect(ids('not-an-eye-structure')).toEqual([]);
    expect(searchStructures('  ')).toEqual({ items: STRUCTURES, ambiguous: false, group: null, relatedDisease: false });
  });

  it('resolves approved everyday aliases without introducing duplicate structures', () => {
    for (const query of ['白眼球', '眼白', 'sclera']) expect(ids(query)).toEqual(['sclera']);
    for (const query of ['晶体', ' CRYSTALLINE LENS ']) expect(ids(query)).toEqual(['lens']);
    const ambiguous = searchStructures('黑眼珠');
    expect(ambiguous.items.map(item => item.id)).toEqual(['iris', 'pupil']);
    expect(ambiguous.ambiguous).toBe(true);
    expect(ambiguous.group).toBeNull();
    expect(ambiguous.relatedDisease).toBe(false);
  });

  it('returns fundus group members while preserving the existing anatomy order and objects', () => {
    const members = STRUCTURES.filter(item => item.group === 'fundus');
    for (const query of ['眼底', 'Fundus']) {
      const result = searchStructures(query);
      expect(result.group).toBe('fundus');
      expect(result.items).toEqual(members);
      expect(result.items[0]).toBe(members[0]);
      expect(result.ambiguous).toBe(false);
    }
  });

  it('maps disease queries only to related available structures', () => {
    for (const query of ['白内障', 'cataract']) {
      expect(ids(query)).toEqual(['lens']);
      expect(searchStructures(query).relatedDisease).toBe(true);
    }
    for (const query of ['青光眼', 'GLAUCOMA']) {
      expect(ids(query)).toEqual(['optic-disc', 'optic-nerve']);
      expect(searchStructures(query).relatedDisease).toBe(true);
    }
    expect(searchStructures('lens').relatedDisease).toBe(false);
  });
});
