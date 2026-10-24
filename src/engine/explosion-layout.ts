import * as THREE from 'three';
import { FLAT_LAYOUT_START, type StructureId } from '../anatomy/types';

export function createExplosionLayout(bounds: ReadonlyMap<StructureId, THREE.Box3>, explode: number): Map<StructureId, THREE.Vector3> {
  const parts = [...bounds].map(([id, box]) => {
    const size = box.getSize(new THREE.Vector3());
    // A depth margin keeps near surfaces inside their cells under the fitted 38° perspective camera.
    const margin = size.z * 0.35;
    return { id, center: box.getCenter(new THREE.Vector3()), size: new THREE.Vector2(size.x + margin, size.y + margin) };
  });
  const positions = new Map<StructureId, THREE.Vector3>();
  if (!parts.length) return positions;
  const measure = (columns: number) => {
    const widths = Array<number>(columns).fill(0), heights = Array<number>(Math.ceil(parts.length / columns)).fill(0);
    parts.forEach((part, index) => {
      widths[index % columns] = Math.max(widths[index % columns], part.size.x);
      heights[Math.floor(index / columns)] = Math.max(heights[Math.floor(index / columns)], part.size.y);
    });
    return { widths, heights };
  };
  let columns = 1, bestAspectError = Infinity;
  // Keep the same cells throughout the flat phase so adjusting spacing does not reorder structures.
  for (let candidate = 1; candidate <= parts.length; candidate++) {
    const { widths, heights } = measure(candidate);
    const width = widths.reduce((sum, value) => sum + value, 0) + 0.2 * (widths.length - 1);
    const height = heights.reduce((sum, value) => sum + value, 0) + 0.2 * (heights.length - 1);
    const error = Math.abs(Math.log(Math.max(width, 0.001) / Math.max(height, 0.001) / 1.35));
    if (error < bestAspectError) { columns = candidate; bestAspectError = error; }
  }
  const { widths, heights } = measure(columns);
  const gap = 0.2 + 0.6 * THREE.MathUtils.clamp((explode - FLAT_LAYOUT_START) / (1 - FLAT_LAYOUT_START), 0, 1);
  const width = widths.reduce((sum, value) => sum + value, 0) + gap * (widths.length - 1);
  const height = heights.reduce((sum, value) => sum + value, 0) + gap * (heights.length - 1);
  let y = height / 2, x = -width / 2;
  parts.forEach((part, index) => {
    const column = index % columns, row = Math.floor(index / columns);
    if (column === 0 && row > 0) { x = -width / 2; y -= heights[row - 1] + gap; }
    positions.set(part.id, new THREE.Vector3(x + widths[column] / 2, y - heights[row] / 2, 0).sub(part.center));
    x += widths[column] + gap;
  });
  const total = new THREE.Box3();
  for (const [id, box] of bounds) total.union(box.clone().translate(positions.get(id)!));
  const center = total.getCenter(new THREE.Vector3());
  for (const position of positions.values()) position.sub(center);
  return positions;
}
