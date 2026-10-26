import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

const { readFileSync } = await vi.importActual<{ readFileSync(path: URL): Uint8Array<ArrayBuffer> }>('node:fs');
const { gzipSync, gunzipSync } = await vi.importActual<{ gzipSync(data: Uint8Array): Uint8Array<ArrayBuffer>; gunzipSync(data: Uint8Array): Uint8Array<ArrayBuffer> }>('node:zlib');
const asset = readFileSync(new URL('../../public/textures/iris-pixels.rgba.gz', import.meta.url));
let createIrisTextures: typeof import('./irisTexture')['createIrisTextures'];
let prepareIrisTextures: typeof import('./irisTexture')['prepareIrisTextures'];

beforeEach(async () => {
  vi.resetModules();
  ({ createIrisTextures, prepareIrisTextures } = await import('./irisTexture'));
  vi.stubGlobal('fetch', vi.fn(async () => new Response(asset)));
});
afterEach(() => vi.unstubAllGlobals());

describe('progressive iris textures', () => {
  it.each(['gzip', 'http-decoded', 'http-decoded-without-native'] as const)('uses %s downloaded pixels instead of regenerating them', async encoding => {
    const pixels = new Uint8Array(1_048_576);
    pixels.fill(171, 0, 524_288); pixels.fill(63, 524_288);
    for (let i = 3; i < pixels.length; i += 4) pixels[i] = 255;
    if (encoding === 'http-decoded-without-native') vi.stubGlobal('DecompressionStream', undefined);
    vi.stubGlobal('fetch', async () => new Response(encoding === 'gzip' ? gzipSync(pixels) : pixels, { headers: { 'Content-Encoding': 'gzip' } }));
    await prepareIrisTextures();
    const textures = createIrisTextures();
    expect(Array.from(textures.color.image.data!.slice(0, 4))).toEqual([171, 171, 171, 255]);
    expect(Array.from(textures.relief.image.data!.slice(0, 4))).toEqual([63, 63, 63, 255]);
    Object.values(textures).forEach(texture => texture.dispose());
  });

  it('ships the exact original detailed pixels in the compressed asset', async () => {
    const pixels = gunzipSync(asset);
    expect(pixels).toHaveLength(1_048_576);
    for (const [offset, expected] of [[0, '2c01317f50be6ec9d196aae41419fea65180c007610c638abfe0f8d9b2a3c76d'], [524_288, 'cc6ba941598e64cda0b3586dadc389bcd027d7e8668164c87dfb268bd67cb198']] as const) {
      const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(pixels.slice(offset, offset + 524_288))));
      expect(Array.from(hash, byte => byte.toString(16).padStart(2, '0')).join('')).toBe(expected);
    }
  });

  it('keeps usable textures while the download is pending, then upgrades those same textures', async () => {
    let resolve!: (response: Response) => void;
    const fetchAsset = vi.fn(() => new Promise<Response>(done => { resolve = done; }));
    vi.stubGlobal('fetch', fetchAsset);
    const first = createIrisTextures();
    const version = first.color.version, pixels = first.color.image.data;
    const loading = prepareIrisTextures();
    const concurrent = prepareIrisTextures();
    expect(first.color.image.width).toBe(512);
    expect(first.color.image.height).toBe(256);
    expect(new Set(first.relief.image.data!.filter((_value, i) => i % 4 !== 3)).size).toBe(1);
    expect(first.color.image.data!.every((value, i) => i % 4 !== 3 || value === 255)).toBe(true);
    resolve(new Response(asset));
    await Promise.all([loading, concurrent]);
    expect(fetchAsset).toHaveBeenCalledTimes(1);
    expect(fetchAsset).toHaveBeenCalledWith(expect.stringMatching(/textures\/iris-pixels\.rgba\.gz$/));
    expect(first.color.image.data).not.toBe(pixels);
    expect(first.color.version).toBeGreaterThan(version);
    expect(new Set(first.relief.image.data!.filter((_value, i) => i % 4 !== 3)).size).toBeGreaterThan(30);
    const second = createIrisTextures();
    expect(first.color.image.data).not.toBe(second.color.image.data);
    expect(first.color.image.data!.every((value, i) => value === second.color.image.data![i])).toBe(true);
    for (const texture of [...Object.values(first), ...Object.values(second)]) texture.dispose();
    await prepareIrisTextures();
    expect(fetchAsset).toHaveBeenCalledTimes(1);
  });

  it('does not update disposed textures when the high detail pixels arrive', async () => {
    let resolve!: (response: Response) => void;
    vi.stubGlobal('fetch', () => new Promise<Response>(done => { resolve = done; }));
    const textures = createIrisTextures(), data = textures.color.image.data, version = textures.color.version;
    const loading = prepareIrisTextures();
    textures.color.dispose();
    resolve(new Response(asset)); await loading;
    expect(textures.color.image.data).toBe(data);
    expect(textures.color.version).toBe(version);
    expect(new Set(textures.relief.image.data!.filter((_value, i) => i % 4 !== 3)).size).toBeGreaterThan(30);
    textures.relief.dispose();
  });

  it.each(['http', 'network', 'gzip', 'size', 'unsupported'] as const)('restores the original detailed pixels on %s failure', async kind => {
    if (kind === 'unsupported') vi.stubGlobal('DecompressionStream', undefined);
    vi.stubGlobal('fetch', vi.fn(async () => {
      if (kind === 'network') throw new Error('offline');
      if (kind === 'http') return new Response('Unavailable', { status: 503 });
      return new Response(kind === 'unsupported' ? asset : kind === 'size' ? gzipSync(new Uint8Array(4)) : new Uint8Array([0x1f, 0x8b, 0, 0]));
    }));
    const textures = createIrisTextures();
    await expect(prepareIrisTextures()).resolves.toBeUndefined();
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(textures.color.image.data!)));
    expect(Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('')).toBe('2c01317f50be6ec9d196aae41419fea65180c007610c638abfe0f8d9b2a3c76d');
    Object.values(textures).forEach(texture => texture.dispose());
  });
});

describe('procedural iris textures', () => {
  beforeEach(async () => { await prepareIrisTextures(); });
  it('preserves the original color and relief pixels after startup optimization', async () => {
    const textures = createIrisTextures();
    const hashes = {
      color: '2c01317f50be6ec9d196aae41419fea65180c007610c638abfe0f8d9b2a3c76d',
      relief: 'cc6ba941598e64cda0b3586dadc389bcd027d7e8668164c87dfb268bd67cb198',
    };
    try {
      for (const key of ['color', 'relief'] as const) {
        const bytes = Uint8Array.from(textures[key].image.data!);
        const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
        expect(Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('')).toBe(hashes[key]);
      }
    } finally { Object.values(textures).forEach(texture => texture.dispose()); }
  });

  it('supplies opaque RGBA maps with angular wrapping and separate color/height spaces', () => {
    const textures = createIrisTextures();
    for (const texture of Object.values(textures)) {
      expect(texture.image.width).toBe(512);
      expect(texture.image.height).toBe(256);
      expect(texture.image.data).toBeInstanceOf(Uint8Array);
      expect(texture.image.data).toHaveLength(512 * 256 * 4);
      expect(texture.wrapS).toBe(THREE.RepeatWrapping);
      expect(texture.wrapT).toBe(THREE.ClampToEdgeWrapping);
      expect(texture.version).toBeGreaterThan(0);
      expect(texture.image.data!.every((value, i) => Number.isFinite(value) && value >= 0 && value <= 255 && (i % 4 !== 3 || value === 255))).toBe(true);
      texture.dispose();
    }
    expect(textures.color.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(textures.relief.colorSpace).toBe(THREE.NoColorSpace);
  });

  it('has brown pigmentation and nonconstant grayscale relief throughout the iris', () => {
    const { color, relief } = createIrisTextures();
    const pixels = color.image.data!;
    const heights = relief.image.data!;
    const levels = new Set<number>();
    let brownPixels = 0;
    let grayscale = true;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] > pixels[i + 1] && pixels[i + 1] > pixels[i + 2]) brownPixels++;
      levels.add(heights[i]);
      grayscale &&= heights[i + 1] === heights[i] && heights[i + 2] === heights[i];
    }
    expect(brownPixels / (512 * 256)).toBeGreaterThan(0.95);
    expect(levels.size).toBeGreaterThan(30);
    expect(grayscale).toBe(true);
    color.dispose();
    relief.dispose();
  });

  it('joins both sides of the angular seam without a color or bump discontinuity', () => {
    for (const texture of Object.values(createIrisTextures())) {
      const { width, height } = texture.image;
      const data = texture.image.data!;
      for (let y = 0; y < height; y++) {
        const first = y * width * 4;
        const last = first + (width - 1) * 4;
        expect(Array.from(data.slice(first, first + 4))).toEqual(Array.from(data.slice(last, last + 4)));
      }
      texture.dispose();
    }
  });

  it('keeps the pupillary border and iris root darker than the intervening stroma', () => {
    const { color, relief } = createIrisTextures();
    const { width } = color.image;
    const data = color.image.data!;
    const rowBrightness = (row: number) => {
      let total = 0;
      for (let x = 0; x < width; x++) {
        const offset = (row * width + x) * 4;
        total += data[offset] + data[offset + 1] + data[offset + 2];
      }
      return total / (width * 3);
    };
    expect(rowBrightness(0)).toBeLessThan(rowBrightness(128) * 0.7);
    expect(rowBrightness(255)).toBeLessThan(rowBrightness(128) * 0.8);
    color.dispose();
    relief.dispose();
  });

  it('recreates identical pixels in independently owned textures', () => {
    const first = createIrisTextures();
    const second = createIrisTextures();
    for (const key of ['color', 'relief'] as const) {
      // Avoid Vitest's deep-comparison diagnostics for large, equal pixel buffers.
      expect(Object.is(first[key], second[key])).toBe(false);
      expect(Object.is(first[key].image.data, second[key].image.data)).toBe(false);
      expect(first[key].image.data!.every((value, i) => value === second[key].image.data![i])).toBe(true);
      first[key].dispose();
      second[key].dispose();
    }
  });

  it('does not let one eye mutate or dispose another eye’s future texture pixels', () => {
    const first = createIrisTextures();
    const original = Object.fromEntries(Object.entries(first).map(([key, texture]) => [key, texture.image.data![0]]));
    for (const texture of Object.values(first)) {
      texture.image.data![0] = 255;
      texture.dispose();
    }
    const second = createIrisTextures();
    try {
      for (const key of ['color', 'relief'] as const) expect(second[key].image.data![0]).toBe(original[key]);
    } finally { Object.values(second).forEach(texture => texture.dispose()); }
  });
});
