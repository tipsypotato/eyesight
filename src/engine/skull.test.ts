import { afterEach, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { loadSkullContext, SKULL_BOUNDS } from './skull';

afterEach(() => vi.unstubAllGlobals());

it('loads the bundled skull within its reserved camera bounds without adding selectable anatomy', async () => {
  const { readFileSync } = await vi.importActual<{ readFileSync(path: URL): Uint8Array<ArrayBuffer> }>('node:fs');
  const asset = readFileSync(new URL('../../public/models/skull-context.glb', import.meta.url));
  expect(asset.byteLength).toBeLessThan(1_000_000);
  const fetchAsset = vi.fn().mockResolvedValue(new Response(asset));
  vi.stubGlobal('fetch', fetchAsset);
  const controller = new AbortController();
  const skull = await loadSkullContext(controller.signal);
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  try {
    expect(fetchAsset).toHaveBeenCalledWith(expect.stringMatching(/models\/skull-context\.glb$/), { signal: controller.signal });
    const bounds = new THREE.Box3().setFromObject(skull);
    expect(bounds.isEmpty()).toBe(false);
    expect(SKULL_BOUNDS.containsBox(bounds)).toBe(true);
    const meshes: THREE.Mesh[] = [];
    skull.traverse(object => {
      expect(object.userData.structureId).toBeUndefined();
      if (!(object instanceof THREE.Mesh)) return;
      meshes.push(object); geometries.add(object.geometry);
      const position = object.geometry.getAttribute('position'), normal = object.geometry.getAttribute('normal');
      expect(position.count).toBeGreaterThan(1000);
      expect(Array.from(position.array).every(Number.isFinite)).toBe(true);
      expect(normal.count).toBe(position.count);
      expect(Array.from(normal.array).every(Number.isFinite)).toBe(true);
      expect(object.geometry.index).not.toBeNull();
      const indices = object.geometry.index!;
      expect(Array.from({ length: indices.count }, (_, i) => indices.getX(i)).every(index => Number.isInteger(index) && index >= 0 && index < position.count)).toBe(true);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material);
        expect(material.transparent).toBe(true);
        expect(material.opacity).toBeGreaterThan(0);
        expect(material.opacity).toBeLessThan(0.5);
        expect(material.depthWrite).toBe(false);
        const bone = material as THREE.MeshStandardMaterial;
        expect(bone.map).toBeNull();
        const channels = bone.color.toArray();
        expect(Math.max(...channels) - Math.min(...channels)).toBeLessThan(0.25);
      }
    });
    expect(meshes.length).toBeGreaterThan(0);
    const ray = new THREE.Raycaster(new THREE.Vector3(2.64, 4, 20), new THREE.Vector3(0, 0, -1));
    const ordinaryHits: THREE.Intersection[] = [];
    for (const mesh of meshes) THREE.Mesh.prototype.raycast.call(mesh, ray, ordinaryHits);
    expect(ordinaryHits.length).toBeGreaterThan(0);
    expect(ray.intersectObject(skull, true)).toHaveLength(0);
  } finally {
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
  }
});

it('reports an unavailable optional asset instead of parsing an HTTP error body', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Unavailable', { status: 503 })));
  await expect(loadSkullContext(new AbortController().signal)).rejects.toThrow('503');
});

it('passes cancellation to the optional asset request', async () => {
  const controller = new AbortController();
  controller.abort();
  vi.stubGlobal('fetch', vi.fn(async (_url, options: RequestInit) => {
    expect(options.signal).toBe(controller.signal);
    options.signal!.throwIfAborted();
    throw new Error('An aborted request must not continue');
  }));
  await expect(loadSkullContext(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
});
