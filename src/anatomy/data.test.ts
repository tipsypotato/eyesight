import { describe, expect, it } from 'vitest';
import { GROUPS, LESSONS, STRUCTURES } from './data';
import { STRUCTURE_IDS, type Localized } from './types';

function expectBilingual(value: Localized) {
  expect(value.zh).toMatch(/[\u3400-\u9fff]/);
  expect(value.en).toMatch(/[A-Za-z]/);
  expect(value.zh).not.toEqual(value.en);
  for (const text of Object.values(value)) {
    expect(text.trim()).toBe(text);
    expect(text).not.toMatch(/TODO|TBD|lorem ipsum|待补充|占位/i);
    expect(text.length).toBeGreaterThan(1);
  }
}

describe('bilingual anatomy content', () => {
  it('covers every selectable structure exactly once', () => {
    expect(STRUCTURES.map(({ id }) => id).sort()).toEqual([...STRUCTURE_IDS].sort());
  });

  it('gives every structure usable bilingual teaching text and a traceable source', () => {
    expect(STRUCTURES.length).toBeGreaterThan(0);
    for (const structure of STRUCTURES) {
      for (const field of ['name', 'summary', 'function', 'position', 'fact'] as const) {
        expectBilingual(structure[field]);
      }
      expect(structure.latin).toMatch(/[A-Za-z]/);
      expect(structure.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(structure.sources.length).toBeGreaterThan(0);
      for (const source of structure.sources) {
        expect(source.title.trim().length).toBeGreaterThan(5);
        const url = new URL(source.url);
        expect(url.protocol).toBe('https:');
        expect(['www.nei.nih.gov', 'eyewiki.aao.org', 'www.ncbi.nlm.nih.gov', 'www.webvision.pitt.edu', 'nba.uth.tmc.edu']).toContain(url.hostname);
      }
    }
  });

  it('assigns structures to the four named display groups', () => {
    expect(GROUPS.map(({ id }) => id).sort()).toEqual(['front', 'fundus', 'inside', 'wall']);
    for (const group of GROUPS) {
      expectBilingual(group.name);
      expect(STRUCTURES.some((structure) => structure.group === group.id)).toBe(true);
    }
    for (const structure of STRUCTURES) expect(GROUPS.map(({ id }) => id)).toContain(structure.group);
  });

  it('distinguishes the pupil opening and the two aqueous chambers', () => {
    const pupil = STRUCTURES.find(({ id }) => id === 'pupil');
    const anterior = STRUCTURES.find(({ id }) => id === 'anterior-chamber');
    const posterior = STRUCTURES.find(({ id }) => id === 'posterior-chamber');
    expect(pupil?.kind).toBe('space');
    expect(pupil?.summary.en).toMatch(/opening/i);
    expect(pupil?.summary.zh).toMatch(/开口|孔/);
    expect(anterior?.kind).toBe('space');
    expect(posterior?.kind).toBe('space');
    expect(anterior?.position.en).toMatch(/cornea/i);
    expect(posterior?.position.en).toMatch(/iris/i);
    expect(posterior?.summary.en).toMatch(/vitreous/i);
    expect(posterior?.summary.zh).toMatch(/玻璃体/);
  });

  it('provides three short lessons with valid targets and paired language content', () => {
    expect(LESSONS.map(({ id }) => id)).toEqual(['anatomy', 'vision', 'myopia']);
    for (const lesson of LESSONS) {
      expectBilingual(lesson.title);
      expectBilingual(lesson.description);
      expect(lesson.steps.length).toBeGreaterThanOrEqual(3);
      expect(lesson.steps.length).toBeLessThanOrEqual(4);
      for (const step of lesson.steps) {
        expectBilingual(step.title);
        expectBilingual(step.body);
        expect(STRUCTURE_IDS).toContain(step.target);
        expect(['oblique', 'front', 'side', 'back']).toContain(step.view);
        expect(typeof step.clip).toBe('boolean');
        if (step.optics) expect(['normal', 'myopia', 'corrected']).toContain(step.optics);
      }
    }
  });

  it('states the model scope and separates optical focus from neural signaling', () => {
    const anatomy = LESSONS.find(({ id }) => id === 'anatomy');
    const vision = LESSONS.find(({ id }) => id === 'vision');
    const myopia = LESSONS.find(({ id }) => id === 'myopia');
    expect(anatomy?.description.en).toMatch(/adult right eye/i);
    expect(anatomy?.description.zh).toMatch(/成人右眼/);
    expect(anatomy?.description.en).toMatch(/schematic|representative/i);
    expect(vision?.steps.some((step) => step.target === 'retina' && /light/i.test(step.body.en))).toBe(true);
    expect(vision?.steps.some((step) => step.target === 'optic-nerve' && /neural|electrical/i.test(step.body.en))).toBe(true);
    expect(myopia?.description.en).toMatch(/axial/i);
    expect(myopia?.description.zh).toMatch(/轴性/);
    expect(myopia?.steps.map(({ optics }) => optics)).toContain('myopia');
    expect(myopia?.steps.map(({ optics }) => optics)).toContain('corrected');
  });
});
