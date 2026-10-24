import { describe, expect, it } from 'vitest';
import { GROUPS, LESSONS, STRUCTURES } from './data';
import { ORBITAL_IDS, STRUCTURE_IDS, type Localized } from './types';

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
        expect(['www.nei.nih.gov', 'eyewiki.aao.org', 'www.ncbi.nlm.nih.gov', 'pmc.ncbi.nlm.nih.gov', 'www.webvision.pitt.edu', 'nba.uth.tmc.edu', 'histology.oit.duke.edu', 'morancore.utah.edu']).toContain(url.hostname);
      }
    }
  });

  it('assigns structures to the seven named display groups', () => {
    expect(GROUPS.map(({ id }) => id).sort()).toEqual(['adnexa', 'extraocular', 'front', 'fundus', 'inside', 'orbit', 'wall']);
    for (const group of GROUPS) {
      expectBilingual(group.name);
      expect(STRUCTURES.some((structure) => structure.group === group.id)).toBe(true);
    }
    for (const structure of STRUCTURES) expect(GROUPS.map(({ id }) => id)).toContain(structure.group);
  });

  it('describes orbital walls and representative contents without duplicating existing structures', () => {
    const orbit = STRUCTURES.filter(({ group }) => group === 'orbit');
    expect(orbit.map(({ id }) => id)).toEqual(ORBITAL_IDS);
    expect(orbit).toHaveLength(17);
    const byId = (id: typeof ORBITAL_IDS[number]) => orbit.find((structure) => structure.id === id)!;
    expect(byId('medial-orbital-wall').summary.en).toContain('ethmoid');
    expect(byId('intraconal-fat').position.en).toContain('rectus');
    expect(byId('extraconal-fat').position.en).toContain('outside');
    expect(byId('oculomotor-nerve').name.en).toContain('CN III');
    expect(byId('trochlear-nerve').function.en).toContain('superior oblique');
    expect(byId('abducens-nerve').function.en).toContain('lateral rectus');
    expect(byId('lacrimal-nerve').fact.en).toContain('pterygopalatine ganglion');
    expect(byId('ciliary-ganglion').fact.en).toContain('without synapsing');
    expect(byId('inferior-ophthalmic-vein').fact.en).toContain('vary');
    expect(byId('lacrimal-gland').function.en).toContain('aqueous');
    expect(orbit.some(({ id }) => ['optic-nerve', 'superior-rectus', 'levator-palpebrae'].includes(id))).toBe(false);
  });

  it('distinguishes the conjunctival surfaces and eyelid tissues from globe-moving muscles', () => {
    const adnexa = STRUCTURES.filter(({ group }) => group === 'adnexa');
    expect(adnexa.map(({ id }) => id)).toEqual([
      'bulbar-conjunctiva', 'palpebral-conjunctiva', 'eyelid-skin', 'orbicularis-oculi',
      'levator-palpebrae', 'tarsal-plates', 'meibomian-glands', 'zeis-glands', 'moll-glands',
    ]);
    for (const structure of adnexa) expect(structure.kind).toBe('tissue');
    const bulbar = adnexa.find(({ id }) => id === 'bulbar-conjunctiva')!;
    expect(bulbar.fact.zh).toMatch(/不覆盖角膜/);
    expect(bulbar.fact.en).toMatch(/does not cover the cornea/);
    const palpebral = adnexa.find(({ id }) => id === 'palpebral-conjunctiva')!;
    expect(palpebral.position.zh).toContain('穹隆');
    expect(palpebral.position.en).toContain('fornix');
    expect(adnexa.find(({ id }) => id === 'levator-palpebrae')!.function.en).toContain('upper eyelid');
    expect(adnexa.find(({ id }) => id === 'tarsal-plates')!.fact.en).toContain('not cartilage');
    expect(adnexa.find(({ id }) => id === 'zeis-glands')!.summary.en).toContain('Sebaceous');
    expect(adnexa.find(({ id }) => id === 'moll-glands')!.summary.en).toContain('apocrine sweat');
  });

  it('describes the six globe-moving muscles separately from eyelid and intraocular muscles', () => {
    const muscles = STRUCTURES.filter(({ group }) => group === 'extraocular');
    expect(muscles.map(({ id }) => id)).toEqual([
      'superior-rectus', 'inferior-rectus', 'medial-rectus', 'lateral-rectus', 'superior-oblique', 'inferior-oblique',
    ]);
    for (const muscle of muscles) {
      expect(muscle.kind).toBe('tissue');
      expect(muscle.function.zh).toContain('第一眼位');
      expect(muscle.function.en).toContain('primary position');
    }
    const superiorOblique = muscles.find(({ id }) => id === 'superior-oblique')!;
    expect(superiorOblique.position.zh).toContain('滑车');
    expect(superiorOblique.position.en).toContain('trochlea');
    expect(superiorOblique.function.en).toContain('intorts');
    const inferiorOblique = muscles.find(({ id }) => id === 'inferior-oblique')!;
    expect(inferiorOblique.position.en).toContain('anterior nasal orbital floor');
    expect(inferiorOblique.function.en).toContain('extorts');
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
