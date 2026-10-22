import { expect, it } from 'vitest';
import { STRUCTURE_IDS } from './types';
import { RELATIONSHIPS } from './relationships';

it('provides three navigable relationship groups with existing members and bilingual roles', () => {
  expect(new Set(RELATIONSHIPS.map(group => group.id))).toEqual(new Set(['accommodation', 'aqueous', 'fundus']));
  for (const group of RELATIONSHIPS) {
    expect(group.members.length).toBeGreaterThanOrEqual(3);
    expect(new Set(group.members.map(member => member.id)).size).toBe(group.members.length);
    for (const text of [group.name, group.description, ...group.members.map(member => member.role)]) {
      expect(text.zh.trim()).not.toBe(''); expect(text.en.trim()).not.toBe('');
    }
    for (const member of group.members) expect(STRUCTURE_IDS).toContain(member.id);
  }
});
