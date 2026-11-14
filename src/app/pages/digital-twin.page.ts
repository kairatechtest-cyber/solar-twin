import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PlantSceneComponent } from '../scene/plant-scene.component';
import { SceneUi, ViewMode } from '../scene/scene-ui.service';
import { LoadingOverlayComponent } from '../shared/loading-overlay.component';
import { MetricGridComponent } from '../shared/bits';
import { Store } from '../core/store.service';
import { metricsFor } from '../core/metrics';
import { statusColor } from '../core/util';
import type { EquipmentDef } from '../core/types';

/** One node of the plant hierarchy tree (renders its own children recursively). */
@Component({
  selector: 'app-tree-node',
  standalone: true,
  template: `
    <div class="tree-row" [class.sel]="store.selectedTag() === def().tag" [style.padding-left.px]="depth() * 12" (click)="pick()">
      <span class="tw" (click)="toggle($event)">{{ kids().length ? (open() ? '▾' : '▸') : '' }}</span>
      <i class="dot" [style.background]="color()"></i> {{ def().name }}
    </div>
    @if (open()) { @for (k of kids(); track k.tag) { <app-tree-node [def]="k" [depth]="depth() + 1" /> } }`,
})
export class TreeNodeComponent {
  store = inject(Store); private ui = inject(SceneUi);
  def = input.required<EquipmentDef>(); depth = input(0);
  open = signal(true);
  kids = computed(() => this.store.defs().filter((d) => d.parentTag === this.def().tag));
  color = computed(() => { const s = this.store.live().get(this.def().tag); return s ? statusColor[s.status] : '#64748b'; });
  constructor() { this.open.set(this.depth() < 2); }
  toggle(e: Event) { e.stopPropagation(); this.open.update((v) => !v); }
  pick() { this.store.select(this.def().tag); this.ui.focusTag(this.def().tag); }
}

/** Full-screen digital twin: view modes, layers, hierarchy tree, section pointers and a live equipment card. */
@Component({
  selector: 'app-digital-twin',
  standalone: true,
  imports: [PlantSceneComponent, LoadingOverlayComponent, MetricGridComponent, TreeNodeComponent],
  template: `
    <div class="view3d">
      <app-plant-scene [debug]="debug" />
      <app-loading-overlay />

      <div class="overlay tree"><strong>Plant hierarchy</strong>
        @for (r of roots(); track r.tag) { <app-tree-node [def]="r" [depth]="0" /> }
      </div>

      @if (sel(); as s) {
        <div class="overlay infocard" style="top:auto;bottom:14px">
          <div class="row"><strong>{{ nameOf(s.tag) }}</strong><span class="sp"></span><span class="muted mono">{{ s.tag }}</span></div>
          <div style="margin:8px 0"><app-metric-grid [items]="metrics()" /></div>
          <button class="btn sm" style="width:100%" (click)="details(s.tag)">View details</button>
        </div>
      }

      <div class="overlay layers">
        <strong>View</strong>
        @for (v of views; track v.id) {
          <label><input type="radio" name="view" [checked]="ui.view() === v.id" (change)="ui.view.set(v.id)" /> {{ v.label }}</label>
        }
        <label style="margin-top:6px"><input type="checkbox" [checked]="ui.pointers()" (change)="ui.pointers.set(!ui.pointers())" /> Section pointers</label>
        @if (ui.layers().length > 0) {
          <strong style="display:block;margin-top:10px">Layers</strong>
          @for (l of ui.layers(); track l.id) {
            <label><input type="checkbox" [checked]="!ui.hidden().has(l.id)" (change)="ui.toggleLayer(l.id)" /> {{ l.label }}</label>
          }
        }
        @if (debug) {
          <div class="mono muted" style="font-size:11px;margin-top:10px">
            draw calls {{ ui.stats().calls }}<br />triangles {{ ui.stats().triangles }}<br />geometries {{ ui.stats().geometries }}<br />textures {{ ui.stats().textures }}
            <details><summary>{{ ui.meshNames().length }} meshes</summary>@for (n of ui.meshNames(); track $index) {<div>{{ n }}</div>}</details>
          </div>
        }
      </div>
    </div>`,
})
export class DigitalTwinPage {
  store = inject(Store); ui = inject(SceneUi); private router = inject(Router);
  debug = new URLSearchParams(location.search).has('debug');
  views: { id: ViewMode; label: string }[] = [{ id: 'normal', label: 'Normal' }, { id: 'thermal', label: 'Thermal' }, { id: 'power', label: 'Power output' }];
  roots = computed(() => this.store.defs().filter((d) => d.parentTag === null));
  sel = computed(() => { const t = this.store.selectedTag(); return t ? this.store.live().get(t) : undefined; });
  metrics = computed(() => (this.sel() ? metricsFor(this.sel()!).slice(0, 6) : []));
  nameOf = (tag: string) => this.store.defs().find((d) => d.tag === tag)?.name ?? tag;

  constructor() {
    this.store.sceneReady.set(false);
    this.ui.reset(true);
    inject(DestroyRef).onDestroy(() => this.store.sceneReady.set(false));
  }
  details(tag: string) { this.router.navigate(['/equipment', tag]); }
}
