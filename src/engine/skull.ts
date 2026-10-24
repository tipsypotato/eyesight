import * as THREE from 'three';

// Baked asset bounds keep the camera stable while the optional reference downloads.
export const SKULL_BOUNDS = new THREE.Box3(
  new THREE.Vector3(-3.482, -9.295, -15.787),
  new THREE.Vector3(8.761, 7.885, 2.245),
);

export async function loadSkullContext(signal: AbortSignal): Promise<THREE.Group> {
  const response = await fetch(`${import.meta.env.BASE_URL}models/skull-context.glb`, { signal });
  if (!response.ok) throw new Error(`Skull reference request failed: ${response.status}`);
  const buffer = await response.arrayBuffer();
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
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
