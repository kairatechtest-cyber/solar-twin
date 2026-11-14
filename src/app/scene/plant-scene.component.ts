import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, effect, inject, input, untracked, viewChild } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { Store } from '../core/store.service';
import { SceneUi, ViewMode } from './scene-ui.service';
import { LAYERS, POINTERS, PointerDef, TAG_RULES } from './config';
import { buildProceduralPlant } from './procedural';
import { descendants, memberTags, sectionAlarm, sectionValue } from '../core/metrics';
import type { LiveState } from '../core/types';
import { severityColor, statusColor } from '../core/util';
import { environment } from '../../environments/environment';

/* ------------------------------------------------------------------ preparation (runs once per loaded model) */
interface Prepared {
  root: THREE.Object3D; byTag: Map<string, THREE.Mesh[]>; layers: Map<string, THREE.Object3D[]>;
  pickables: THREE.Mesh[]; meshNames: string[]; box: THREE.Box3;
}
const ancestors = (o: THREE.Object3D, max = 6) => { const n: string[] = []; let p: THREE.Object3D | null = o; while (p && n.length < max) { if (p.name) n.push(p.name); p = p.parent; } return n; };
const tagFor = (names: string[]) => { for (const n of names) for (const r of TAG_RULES) { const m = n.match(r.re); if (m) return r.tag(m); } return null; };
const mats = (m: THREE.Mesh) => (Array.isArray(m.material) ? m.material : [m.material]) as THREE.MeshStandardMaterial[];

function prepare(root: THREE.Object3D): Prepared {
  root.updateMatrixWorld(true);
  const byTag = new Map<string, THREE.Mesh[]>(); const layers = new Map<string, THREE.Object3D[]>();
  const pickables: THREE.Mesh[] = []; const meshNames: string[] = [];
  root.traverse((o) => {
    o.matrixAutoUpdate = false; // the plant is static: skip per-frame matrix recomputation
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshNames.push(mesh.name || '(unnamed)');
    const names = ancestors(mesh);
    const tag = tagFor(names);
    if (tag) {
      mesh.userData['tag'] = tag;
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => m.clone()) : mesh.material.clone();
      mats(mesh).forEach((m) => { if (m.emissive) { m.userData['e0'] = m.emissive.clone(); m.userData['ei0'] = m.emissiveIntensity; } });
      if (!byTag.has(tag)) byTag.set(tag, []);
      byTag.get(tag)!.push(mesh);
      pickables.push(mesh); // only equipment is raycast -> clicking never tests millions of triangles
    }
    mesh.castShadow = false; mesh.receiveShadow = false;
    for (const L of LAYERS) if (names.some((n) => L.re.test(n))) { if (!layers.has(L.id)) layers.set(L.id, []); layers.get(L.id)!.push(mesh); }
  });
  return { root, byTag, layers, pickables, meshNames, box: new THREE.Box3().setFromObject(root) };
}

const C = { warning: new THREE.Color('#f59e0b'), fault: new THREE.Color('#ef4444'), offline: new THREE.Color('#64748b'), sel: new THREE.Color('#22d3ee') };
const heat = (t: number) => new THREE.Color().setHSL(0.62 * (1 - Math.min(1, Math.max(0, t))), 0.9, 0.5);

function applyAppearance(p: Prepared, states: Map<string, LiveState>, selected: string | null, soft: Set<string>, view: ViewMode, hidden: Set<string>) {
  p.byTag.forEach((meshes, tag) => {
    const s = states.get(tag);
    let color: THREE.Color | null = null; let intensity = 0.7;
    if (view === 'thermal' && s) { color = heat((s.tempC - 30) / 50); intensity = 0.9; }
    else if (view === 'power' && s && s.ratedKw > 0) { color = heat(1 - Math.min(1, s.powerKw / s.ratedKw)); intensity = 0.8; }
    else if (s?.status === 'warning') color = C.warning;
    else if (s?.status === 'fault') color = C.fault;
    else if (s?.status === 'offline' || s?.status === 'stopped') { color = C.offline; intensity = 0.3; }
    if (soft.has(tag)) { color = C.sel; intensity = 0.35; }
    if (selected === tag) { color = C.sel; intensity = 0.9; }
    for (const m of meshes) for (const mat of mats(m)) {
      if (!mat.emissive) continue;
      if (color) { mat.emissive.copy(color); mat.emissiveIntensity = intensity; }
      else { mat.emissive.copy(mat.userData['e0'] ?? new THREE.Color(0, 0, 0)); mat.emissiveIntensity = mat.userData['ei0'] ?? 1; }
    }
  });
  p.layers.forEach((objs, id) => objs.forEach((o) => { o.visible = !hidden.has(id); }));
}

interface PointerEl { def: PointerDef; obj: CSS2DObject; ptr: HTMLElement; val: HTMLElement }

/**
 * Three.js plant viewer. Renders only when the camera or data changes (idle = ~0 GPU), drops pixel ratio while orbiting,
 * only raycasts equipment meshes, and loads a small LOD proxy first with the full Meshopt model streaming in behind it.
 * Everything runs outside Angular's zone; signals are written back through zone.run().
 */
@Component({
  selector: 'app-plant-scene',
  standalone: true,
  template: `<div #host class="scene-host"></div>`,
  styles: [`:host { display: block; position: absolute; inset: 0; } .scene-host { position: absolute; inset: 0; overflow: hidden; }`],
})
export class PlantSceneComponent implements AfterViewInit, OnDestroy {
  debug = input(false);
  clearOnMiss = input(true);

  private host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private zone = inject(NgZone);
  private store = inject(Store);
  private ui = inject(SceneUi);

  private renderer!: THREE.WebGLRenderer;
  private labels!: CSS2DRenderer;
  private scene = new THREE.Scene();
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private raycaster = new THREE.Raycaster();
  private ro?: ResizeObserver;
  private raf = 0;
  private statsTimer: any;
  private dirty = true;
  private disposed = false;
  private fitted = false;
  private maxDpr = Math.min(window.devicePixelRatio || 1, 1.5);
  private prepared: Prepared | null = null;
  private pointerEls: PointerEl[] = [];
  private downAt = { x: 0, y: 0 };
  private lastHover = 0;

  constructor() {
    effect(() => {
      this.store.snapshot(); this.store.selectedTag(); this.store.defs(); this.ui.view(); this.ui.hidden(); this.ui.pointers();
      untracked(() => this.refresh());
    });
    effect(() => { const f = this.ui.focus(); if (f) untracked(() => this.focusOn(f.tag)); });
  }

  ngAfterViewInit() {
    this.zone.runOutsideAngular(() => { this.initThree(); this.loop(); void this.loadModels(); });
  }

  /* ---------------------------------------------------------------- setup */
  private initThree() {
    const el = this.host().nativeElement;
    const w = el.clientWidth || 800; const h = el.clientHeight || 500;
    this.renderer = new THREE.WebGLRenderer({ antialias: (window.devicePixelRatio || 1) < 2, powerPreference: 'high-performance', stencil: false, alpha: false });
    this.renderer.setPixelRatio(this.maxDpr); this.renderer.setSize(w, h);
    this.renderer.setClearColor('#0b1020');
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.domElement.style.display = 'block';
    el.appendChild(this.renderer.domElement);

    this.labels = new CSS2DRenderer();
    this.labels.setSize(w, h);
    Object.assign(this.labels.domElement.style, { position: 'absolute', top: '0', left: '0', pointerEvents: 'none' });
    el.appendChild(this.labels.domElement);

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.5, 3000);
    this.camera.position.set(120, 90, 150);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2.05; this.controls.minDistance = 3;
    this.controls.addEventListener('change', () => { this.dirty = true; });
    this.controls.addEventListener('start', () => { this.renderer.setPixelRatio(1); this.dirty = true; });  // cheaper frames while moving
    this.controls.addEventListener('end', () => { this.renderer.setPixelRatio(this.maxDpr); this.dirty = true; });

    this.scene.add(new THREE.HemisphereLight(0xbcd4ff, 0x1b2a1a, 1.15));
    const sun = new THREE.DirectionalLight(0xffffff, 1.7); sun.position.set(80, 140, 60); this.scene.add(sun);

    const cv = this.renderer.domElement;
    cv.addEventListener('pointerdown', (e) => { this.downAt = { x: e.clientX, y: e.clientY }; });
    cv.addEventListener('click', (e) => this.onClick(e));
    cv.addEventListener('pointermove', (e) => this.onHover(e));

    this.ro = new ResizeObserver(() => {
      const W = el.clientWidth; const H = el.clientHeight; if (!W || !H) return;
      this.renderer.setSize(W, H); this.labels.setSize(W, H);
      this.camera.aspect = W / H; this.camera.updateProjectionMatrix(); this.dirty = true;
    });
    this.ro.observe(el);

    if (this.debug()) {
      this.statsTimer = setInterval(() => {
        const i = this.renderer.info;
        this.zone.run(() => this.ui.stats.set({ calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures }));
      }, 1000);
    }
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const moved = this.controls.update();
    if (moved || this.dirty) {
      this.dirty = false;
      this.renderer.render(this.scene, this.camera);
      this.labels.render(this.scene, this.camera);
    }
  };

  /* ---------------------------------------------------------------- model loading */
  private async exists(url: string) {
    if (!url) return false;
    try { const r = await fetch(url, { method: 'HEAD' }); return r.ok && !(r.headers.get('content-type') ?? '').includes('text/html'); } catch { return false; }
  }
  private loadGltf(url: string) {
    return new Promise<THREE.Object3D>((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      loader.load(url, (g) => resolve(g.scene), (ev) => { if (ev.total) this.zone.run(() => this.ui.progress.set(Math.round((ev.loaded / ev.total) * 100))); }, reject);
    });
  }
  private async loadModels() {
    const lodUrl = environment.lodUrl; const fullUrl = environment.modelUrl;
    const [lodOk, fullOk] = await Promise.all([this.exists(lodUrl), this.exists(fullUrl)]);
    if (this.disposed) return;
    if (!lodOk && !fullOk) { this.show(buildProceduralPlant()); return; }
    if (lodOk) { try { const g = await this.loadGltf(lodUrl); if (!this.disposed) this.show(g); } catch (e) { console.warn('[scene] LOD model failed', e); } }
    if (this.disposed) return;
    if (fullOk) {
      if (lodOk) await new Promise((r) => setTimeout(r, 600));
      try { const g = await this.loadGltf(fullUrl); if (!this.disposed) this.show(g); }
      catch (e) { console.error('[scene] full model failed', e); if (!this.prepared && !this.disposed) this.show(buildProceduralPlant()); }
    } else if (!this.prepared) this.show(buildProceduralPlant());
  }

  /** Swap the displayed plant (LOD -> full) and rebuild everything that depends on it. */
  private show(root: THREE.Object3D) {
    this.removeCurrent();
    const prepared = prepare(root);
    this.prepared = prepared;
    this.scene.add(root);
    this.fit();
    this.buildPointers();
    const expected = this.store.defs().filter((d) => d.type === 'pvgroup').length || 18;
    const found = [...prepared.byTag.keys()].filter((t) => t.startsWith('PV-')).length;
    if (found < expected) console.warn(`[scene] only ${found} of ${expected} PV groups found in the model. Re-export/optimise with instancing off (tools/optimize-model.sh) or check the array names with ?debug=1`);
    this.zone.run(() => {
      this.ui.meshNames.set(prepared.meshNames);
      this.ui.layers.set(LAYERS.filter((l) => prepared.layers.has(l.id)).map((l) => ({ id: l.id, label: l.label, count: prepared.layers.get(l.id)!.length })));
      this.store.sceneReady.set(true);
    });
    this.refresh();
  }

  private removeCurrent() {
    if (!this.prepared) return;
    const p = this.prepared;
    this.scene.remove(p.root);
    p.root.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh) return;
      m.geometry.dispose();
      mats(m).forEach((x) => { Object.values(x).forEach((v: any) => v?.isTexture && v.dispose()); x.dispose(); });
    });
    this.clearPointers(); this.prepared = null;
  }

  private fit() {
    if (this.fitted || !this.prepared) return;
    this.fitted = true;
    const box = this.prepared.box;
    const size = box.getSize(new THREE.Vector3()); const c = box.getCenter(new THREE.Vector3());
    const r = Math.max(size.x, size.z, 1);
    this.camera.position.set(c.x + r * 0.7, c.y + r * 0.55, c.z + r * 0.9);
    this.camera.near = Math.max(0.05, r / 800); this.camera.far = r * 12; this.camera.updateProjectionMatrix();
    this.controls.target.copy(c); this.controls.update();
  }

  /* ---------------------------------------------------------------- pointers (HTML labels anchored to the model) */
  private builtFor = -1;

  private clearPointers() {
    for (const pe of this.pointerEls) { this.scene.remove(pe.obj); pe.obj.element.remove(); }
    this.pointerEls = [];
  }

  /** Where a pointer sits: on top of the member mesh nearest to the middle of the section (so it always touches real
   *  geometry), or - when the model has no mesh for it - at an offset from another object. */
  private buildPointers() {
    const p = this.prepared; if (!p) return;
    this.clearPointers();
    const defs = this.store.defs(); this.builtFor = defs.length;
    const size = p.box.getSize(new THREE.Vector3());
    const lift = Math.max(0.4, size.y * 0.03);
    const boxOf = (tag: string) => { const b = new THREE.Box3(); p.byTag.get(tag)?.forEach((m) => b.expandByObject(m)); return b; };

    for (const def of POINTERS) {
      // PV fields follow the topology (their PV groups); other pointers use the mesh tags listed in config.ts
      const tags = def.meshTags ?? memberTags(defs, def.tag).filter((t) => t !== def.tag);
      const members = tags.map((t) => boxOf(t)).filter((b) => !b.isEmpty());
      if (!members.length && !def.anchor) continue; // no mesh to sit on: skip the pointer instead of floating at the plant centre
      let pos: THREE.Vector3;
      if (members.length) {
        const centres = members.map((b) => b.getCenter(new THREE.Vector3()));
        const mid = centres.reduce((a, c) => a.add(c), new THREE.Vector3()).divideScalar(centres.length);
        let best = 0;
        centres.forEach((c, i) => { if (Math.hypot(c.x - mid.x, c.z - mid.z) < Math.hypot(centres[best].x - mid.x, centres[best].z - mid.z)) best = i; });
        pos = new THREE.Vector3(centres[best].x, members[best].max.y + lift, centres[best].z);
      } else {
        const ab = def.anchor ? boxOf(def.anchor.tag) : new THREE.Box3();
        const base = ab.isEmpty() ? p.box : ab; const c = base.getCenter(new THREE.Vector3());
        pos = new THREE.Vector3(c.x + (def.anchor?.fx ?? 0) * size.x, base.max.y + lift, c.z + (def.anchor?.fz ?? 0) * size.z);
      }
      const outer = document.createElement('div'); // CSS2DRenderer owns this element's transform
      outer.innerHTML = '<div class="ptr"><div class="chip"><b></b><small></small></div><div class="stem"></div><div class="tip"></div></div>';
      const ptr = outer.firstElementChild as HTMLElement;
      ptr.querySelector('b')!.textContent = def.label;
      ptr.addEventListener('click', (ev) => { ev.stopPropagation(); this.zone.run(() => this.store.select(def.tag)); });
      const obj = new CSS2DObject(outer); obj.position.copy(pos); this.scene.add(obj);
      this.pointerEls.push({ def, obj, ptr, val: ptr.querySelector('small') as HTMLElement });
      if (this.debug()) console.log('[pointer]', def.tag, 'members:', members.length, 'pos:', pos.toArray().map((n) => +n.toFixed(1)), 'defs:', defs.length);
    }
  }

  private refreshPointers() {
    const live = this.store.live(); const counts = this.store.snapshot()?.alarmCounts; const defs = this.store.defs();
    const sel = this.store.selectedTag(); const show = this.ui.pointers();
    for (const pe of this.pointerEls) {
      const st = live.get(pe.def.tag); const al = sectionAlarm(counts, defs, pe.def.tag);
      pe.ptr.style.setProperty('--c', al.worst ? severityColor[al.worst] : st ? statusColor[st.status] : '#64748b');
      pe.ptr.classList.toggle('sel', sel === pe.def.tag);
      pe.val.textContent = sectionValue(st);
      pe.obj.visible = show;
    }
  }

  /* ---------------------------------------------------------------- appearance / interaction */
  private refresh() {
    if (!this.prepared) return;
    if (this.store.defs().length !== this.builtFor) this.buildPointers(); // equipment list arrived after the model
    const selected = this.store.selectedTag();
    const soft = new Set(selected ? memberTags(this.store.defs(), selected).filter((t) => t !== selected) : []);
    applyAppearance(this.prepared, this.store.live(), selected, soft, this.ui.view(), this.ui.hidden());
    this.refreshPointers();
    this.dirty = true;
  }

  private focusOn(tag: string) {
    const p = this.prepared; if (!p) return;
    let meshes = p.byTag.get(tag);
    if (!meshes?.length) meshes = descendants(this.store.defs(), tag).flatMap((t) => p.byTag.get(t) ?? []);
    if (!meshes.length) return;
    const b = new THREE.Box3(); meshes.forEach((m) => b.expandByObject(m));
    const c = b.getCenter(new THREE.Vector3()); const r = Math.max(b.getSize(new THREE.Vector3()).length() * 2.5, 8);
    this.controls.target.copy(c); this.camera.position.set(c.x + r, c.y + r * 0.7, c.z + r); this.controls.update(); this.dirty = true;
  }

  private pick(e: MouseEvent): string | null {
    if (!this.prepared) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.raycaster.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), this.camera);
    const hit = this.raycaster.intersectObjects(this.prepared.pickables, false)[0];
    return hit ? (hit.object.userData['tag'] as string) : null;
  }

  private onClick(e: MouseEvent) {
    if (Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y) > 4) return; // it was a drag
    const tag = this.pick(e);
    if (tag) this.zone.run(() => this.store.select(tag));
    else if (this.clearOnMiss()) this.zone.run(() => this.store.select(null));
  }

  private onHover(e: PointerEvent) {
    const now = performance.now();
    if (e.buttons || now - this.lastHover < 90) return;
    this.lastHover = now;
    this.renderer.domElement.style.cursor = this.pick(e) ? 'pointer' : 'grab';
  }

  ngOnDestroy() {
    this.disposed = true;
    cancelAnimationFrame(this.raf); clearInterval(this.statsTimer);
    this.ro?.disconnect(); this.controls?.dispose();
    this.removeCurrent();
    this.renderer?.dispose(); this.renderer?.forceContextLoss();
    this.renderer?.domElement.remove(); this.labels?.domElement.remove();
  }
}