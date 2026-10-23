import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createIrisTextures } from './irisTexture';

describe('procedural iris textures', () => {
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
