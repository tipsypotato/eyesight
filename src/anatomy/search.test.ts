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

  it('finds all six extraocular muscles through group names and EOM abbreviations', () => {
    const members = STRUCTURES.filter(item => item.group === 'extraocular');
    expect(members).toHaveLength(6);
    for (const query of ['眼外肌', '眼外肌群', 'Extraocular', 'extraocular muscles', ' EOM ', 'EOMs']) {
      const result = searchStructures(query);
      expect(result.group).toBe('extraocular');
      expect(result.items).toEqual(members);
      expect(result.ambiguous).toBe(false);
      expect(result.relatedDisease).toBe(false);
    }
  });

  it('resolves muscle abbreviations only as whole queries and keeps their anatomical identity', () => {
    for (const [id, chinese, abbreviation] of [
      ['superior-rectus', '上直肌', 'SR'], ['inferior-rectus', '下直肌', 'IR'],
      ['medial-rectus', '内直肌', 'MR'], ['lateral-rectus', '外直肌', 'LR'],
      ['superior-oblique', '上斜肌', 'SO'], ['inferior-oblique', '下斜肌', 'IO'],
    ]) {
      for (const query of [id, chinese, abbreviation, ` ${abbreviation.toLowerCase()} `]) expect(ids(query)).toEqual([id]);
    }
    expect(ids('Musculus obliquus superior')).toEqual(['superior-oblique']);
    expect(ids('iris')).toEqual(['iris']);
    expect(ids('anterior chamber')).toEqual(['anterior-chamber']);
  });
});

it('finds aqueous outflow anatomy without treating an exact cornea query as an angle query', () => {
  expect(ids('cornea')).toEqual(['cornea']);
  expect(ids('角膜')).toEqual(['cornea']);
  for (const query of ['房角', 'iridocorneal-angle', 'anterior chamber angle']) expect(ids(query)).toEqual(['iridocorneal-angle']);
  for (const query of ['小梁网', 'trabecular meshwork']) expect(ids(query)).toEqual(['trabecular-meshwork']);
});
