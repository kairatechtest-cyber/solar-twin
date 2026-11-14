import * as THREE from 'three';

/** Fallback scene (no GLB found) laid out like the Blender model: 17 panel arrays in two fields, 2 inverters,
 *  main station, control room, grid towers, fence and ground - using the same object names, so everything is clickable. */
export function buildProceduralPlant(): THREE.Group {
  const g = new THREE.Group(); g.name = 'ProceduralPlant';
  const std = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra });

  const ground = new THREE.Mesh(new THREE.BoxGeometry(150, 1, 108), std('#8b8f94')); ground.name = 'Ground'; ground.position.set(0, -0.5, 0); g.add(ground);

  let idx = 0;
  const addArray = (x: number, z: number) => {
    const grp = new THREE.Group(); grp.name = idx === 0 ? 'Commercial Solar Panel Array' : `Commercial Solar Panel Array.${String(idx).padStart(3, '0')}`; idx++;
    const count = 5 * 6;
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1.8, 0.08, 1.2), std('#1b3a73', { metalness: 0.6, roughness: 0.35 }), count);
    const m = new THREE.Matrix4(); let k = 0;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) {
      m.compose(new THREE.Vector3(c * 2 - 5, 1.2, r * 1.8 - 3.6), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.35, 0, 0)), new THREE.Vector3(1, 1, 1));
      im.setMatrixAt(k++, m);
    }
    im.name = 'Panels'; im.instanceMatrix.needsUpdate = true; grp.add(im); grp.position.set(x, 0, z); g.add(grp);
  };
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) addArray(-58 + c * 14, -38 + r * 12);   // PV Field A (6)
  let n = 0; for (let r = 0; r < 3; r++) for (let c = 0; c < 4 && n < 11; c++, n++) addArray(-58 + c * 14, -8 + r * 12); // PV Field B (11)

  const box = (name: string, w: number, h: number, d: number, x: number, z: number, color: string) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), std(color)); m.name = name; m.position.set(x, h / 2, z); g.add(m); return m;
  };
  box('Inverter1', 1.6, 2.2, 3, -12, -30, '#cfd8e6'); box('Inverter2', 1.6, 2.2, 3, -12, 6, '#cfd8e6');
  box('MainStation', 14, 4, 9, 30, 14, '#b9c0cc'); box('ControlRoom', 10, 3.4, 7, 30, -12, '#c9ccd2');
  box('Electrical box', 6, 2.6, 2.6, 50, -22, '#aab4c3'); box('Electrical box.001', 6, 2.6, 2.6, 50, -17, '#aab4c3'); // BESS containers
  const mast = box('WeatherStation', 0.6, 5, 0.6, 18, 22, '#e5e7eb'); mast.name = 'WeatherStation';

  const towers = new THREE.Group(); towers.name = 'Empty';
  [[24, -50], [34, -50], [44, -50], [54, -50]].forEach(([x, z], i) => {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.4, 12, 6), std('#7d8794')); t.name = `Tower.${i}`; t.position.set(x, 6, z); towers.add(t);
  });
  g.add(towers);

  const fences = new THREE.Group(); fences.name = 'Fence Segment';
  const fenceMat = std('#6b7280');
  const side = (len: number, x: number, z: number, rotY: number) => { const f = new THREE.Mesh(new THREE.BoxGeometry(len, 1.6, 0.15), fenceMat); f.position.set(x, 0.8, z); f.rotation.y = rotY; f.name = 'Fence'; fences.add(f); };
  side(150, 0, -54, 0); side(150, 0, 54, 0); side(108, -75, 0, Math.PI / 2); side(108, 75, 0, Math.PI / 2);
  g.add(fences);
  return g;
}
