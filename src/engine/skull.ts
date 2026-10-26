import * as THREE from 'three';

export type SkullStatus = 'loading' | 'upgrading' | 'preview' | 'ready' | 'error';

// Baked asset bounds keep the camera stable while the optional reference downloads.
export const SKULL_BOUNDS = new THREE.Box3(
  new THREE.Vector3(-3.482, -9.295, -15.787),
  new THREE.Vector3(8.761, 7.885, 2.245),
);

export async function loadSkullContext(signal: AbortSignal, detail: 'preview' | 'full' = 'full'): Promise<THREE.Group> {
  const [buffer, { GLTFLoader }] = await Promise.all([
    fetch(`${import.meta.env.BASE_URL}models/skull-${detail === 'preview' ? 'preview' : 'context'}.glb`, { signal }).then(response => {
      if (!response.ok) throw new Error(`Skull reference request failed: ${response.status}`);
      return response.arrayBuffer();
    }),
    import('three/examples/jsm/loaders/GLTFLoader.js'),
  ]);
  signal.throwIfAborted();
  const { scene } = await new GLTFLoader().parseAsync(buffer, '');
  const originals = new Set<THREE.Material>();
  const material = new THREE.MeshStandardMaterial({ color: '#c6bda8', roughness: 0.95, transparent: true, opacity: 0.28, depthWrite: false });
  scene.name = 'skull-context';
  scene.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const original of Array.isArray(object.material) ? object.material : [object.material]) originals.add(original);
    object.material = material;
    object.raycast = () => {};
  });
  originals.forEach(original => original.dispose());
  return scene;
}
