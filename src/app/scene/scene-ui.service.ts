import { Injectable, signal } from '@angular/core';

export type ViewMode = 'normal' | 'thermal' | 'power';

/** UI state of the 3D scene (shared between the scene component and the pages' control panels). */
@Injectable({ providedIn: 'root' })
export class SceneUi {
  view = signal<ViewMode>('normal');
  hidden = signal<Set<string>>(new Set());
  pointers = signal(true);
  layers = signal<{ id: string; label: string; count: number }[]>([]);
  meshNames = signal<string[]>([]);
  stats = signal({ calls: 0, triangles: 0, geometries: 0, textures: 0 });
  progress = signal(0);
  focus = signal<{ tag: string; n: number } | null>(null);

  toggleLayer(id: string) {
    this.hidden.update((h) => { const n = new Set(h); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  focusTag(tag: string) { this.focus.update((f) => ({ tag, n: (f?.n ?? 0) + 1 })); }
  reset(pointers = true) { this.view.set('normal'); this.hidden.set(new Set()); this.pointers.set(pointers); this.progress.set(0); this.focus.set(null); }
}
