import * as THREE from 'three';

const width = 512, height = 256;
let cachedPixels: { color: Uint8Array; relief: Uint8Array } | undefined;

function noise(u: number, v: number, columns: number, rows: number): number {
  const x = ((u % 1 + 1) % 1) * columns;
  const y = v * rows;
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const sample = (a: number, b: number) => {
    let n = Math.imul(a % columns, 374761393) + Math.imul(b, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  const top = THREE.MathUtils.lerp(sample(ix, iy), sample(ix + 1, iy), sx);
  const bottom = THREE.MathUtils.lerp(sample(ix, iy + 1), sample(ix + 1, iy + 1), sx);
  return THREE.MathUtils.lerp(top, bottom, sy);
}

function createIrisPixels() {
  const colorPixels = new Uint8Array(width * height * 4);
  const reliefPixels = new Uint8Array(width * height * 4);
  const byte = (value: number) => Math.round(THREE.MathUtils.clamp(value, 0, 255));
  const columns = Array.from({ length: width }, (_, x) => {
    const u = x === width - 1 ? 0 : x / (width - 1);
    return {
      u,
      collarette: 0.26 + 0.065 * (noise(u, 0.4, 17, 1) - 0.5) + 0.018 * Math.sin(u * Math.PI * 2 * 7),
      pupilFalloff: 0.025 + 0.008 * noise(u, 0, 47, 1),
    };
  });

  // shortcut: these are schematic stromal features; use measured textures for patient-specific anatomy.
  for (let y = 0; y < height; y++) {
    const v = y / (height - 1);
    const furrowStrength = THREE.MathUtils.smoothstep(v, 0.54, 0.88);
    const rootBand = Math.exp(-(1 - v) / 0.05);
    for (let x = 0; x < width; x++) {
      const { u, collarette, pupilFalloff } = columns[x];
      const drift = u + 0.009 * (noise(u, v, 11, 4) - 0.5);
      const fibers = 0.5 * noise(drift, v, 79, 3) + 0.32 * noise(drift, v, 149, 6) + 0.18 * noise(drift, v, 223, 11);
      const mottling = noise(u, v, 21, 13);
      const ridge = Math.exp(-(((v - collarette) / 0.021) ** 2)) * (0.5 + 0.5 * noise(u, v, 31, 3));
      const crypts = Math.exp(-(((v - collarette - 0.035) / 0.075) ** 2)) * THREE.MathUtils.smoothstep(noise(u, v, 43, 17), 0.48, 0.8);
      const furrows = furrowStrength * Math.max(0, Math.sin(v * 52 + noise(u, v, 9, 3) * 2.1)) ** 10;
      const pupilEdge = Math.exp(-v / pupilFalloff);
      const shade = (0.74 + 0.35 * (fibers - 0.5) + 0.16 * (mottling - 0.5) + 0.075 * ridge - 0.24 * crypts - 0.075 * furrows)
        * (1 - 0.65 * pupilEdge - 0.44 * rootBand);
      const warmth = noise(u, v, 17, 4) - 0.5;
      const offset = (y * width + x) * 4;
      colorPixels[offset] = byte(177 * shade + 8 * warmth);
      colorPixels[offset + 1] = byte(127 * shade - 4 * warmth);
      colorPixels[offset + 2] = byte(79 * shade + 4 * warmth);
      colorPixels[offset + 3] = 255;
      const elevation = byte(128 + 64 * (fibers - 0.5) + 26 * ridge - 55 * crypts - 20 * furrows - 15 * pupilEdge);
      reliefPixels[offset] = reliefPixels[offset + 1] = reliefPixels[offset + 2] = elevation;
      reliefPixels[offset + 3] = 255;
    }
  }
  return { color: colorPixels, relief: reliefPixels };
}

/** u wraps around the iris; v runs from the pupillary margin to the iris root. */
export function createIrisTextures(): { color: THREE.DataTexture; relief: THREE.DataTexture } {
  const pixels = cachedPixels ??= createIrisPixels();
  // Cache the deterministic computation while keeping each eye's pixels and GPU resources independent.
  const color = new THREE.DataTexture(pixels.color.slice(), width, height, THREE.RGBAFormat);
  const relief = new THREE.DataTexture(pixels.relief.slice(), width, height, THREE.RGBAFormat);
  color.colorSpace = THREE.SRGBColorSpace;
  relief.colorSpace = THREE.NoColorSpace;
  for (const texture of [color, relief]) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
  }
  return { color, relief };
}
