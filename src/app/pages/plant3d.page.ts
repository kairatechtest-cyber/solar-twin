import { Component, DestroyRef, computed, inject } from '@angular/core';
import { PlantSceneComponent } from '../scene/plant-scene.component';
import { SceneUi } from '../scene/scene-ui.service';
import { LoadingOverlayComponent } from '../shared/loading-overlay.component';
import { PvGroupGridComponent } from '../shared/pv-group-grid.component';
import { SectionPanelComponent } from '../shared/section-panel.component';
import { AlarmChipComponent, PageHeadComponent } from '../shared/bits';
import { Store } from '../core/store.service';
import { SECTIONS, sectionAlarm, sectionValue } from '../core/metrics';

/** Plant 3D View: model with pointers + PV groups grid (left), Plant Sections + selected section data (right). */
@Component({
  selector: 'app-plant3d',
  standalone: true,
  imports: [PlantSceneComponent, LoadingOverlayComponent, PvGroupGridComponent, SectionPanelComponent, AlarmChipComponent, PageHeadComponent],
  template: `
    <div class="page wide">
      <app-page-head title="Plant 3D View" sub="Click a pointer, a plant section or a PV group to see its data" />
      <div class="p3d">
        <div class="p3d-main">
          <div class="p3d-view">
            <app-plant-scene [clearOnMiss]="false" />
            <app-loading-overlay />
            <div class="overlay hint">Drag to orbit · scroll to zoom · right-drag to pan</div>
          </div>
          <div class="card"><h2>PV groups</h2><app-pv-group-grid [selected]="store.selectedTag()" (picked)="select($event)" /></div>
        </div>
        <div class="p3d-side">
          <div class="card">
            <h2>Plant sections</h2>
            @for (r of rows(); track r.s.tag) {
              <div class="sec-row" [class.sel]="store.selectedTag() === r.s.tag" (click)="select(r.s.tag)">
                <span>{{ r.s.label }}</span>
                <app-alarm-chip [color]="r.a.color" [label]="r.a.label" [unacked]="r.a.unacked" />
                <b class="mono" style="font-size:12px">{{ r.v }}</b>
              </div>
            }
          </div>
          <div class="card"><app-section-panel [tag]="store.selectedTag()" /></div>
        </div>
      </div>
    </div>`,
})
export class Plant3dPage {
  store = inject(Store); private ui = inject(SceneUi);
  rows = computed(() => {
    const counts = this.store.snapshot()?.alarmCounts; const defs = this.store.defs(); const live = this.store.live();
    return SECTIONS.map((s) => ({ s, a: sectionAlarm(counts, defs, s.tag), v: sectionValue(live.get(s.tag)) }));
  });
  constructor() {
    this.store.sceneReady.set(false);
    this.ui.reset(true);
    if (!this.store.selectedTag()) this.store.select('SS-1'); // never show an empty data panel
    inject(DestroyRef).onDestroy(() => this.store.sceneReady.set(false));
  }
  select(tag: string) { this.store.select(tag); this.ui.focusTag(tag); }
}
