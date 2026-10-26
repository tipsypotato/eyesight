import { mkdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { createIrisPixels } from '../src/engine/irisTexture.ts';

const pixels = createIrisPixels();
const bytes = Buffer.concat([pixels.color, pixels.relief]);
const compressed = gzipSync(bytes, { level: 9 });
const destination = new URL('../public/textures/iris-pixels.rgba.gz', import.meta.url);
await mkdir(new URL('.', destination), { recursive: true });
await writeFile(destination, compressed);
console.log(`Baked iris pixels: ${bytes.length} bytes → ${compressed.length} bytes`);
