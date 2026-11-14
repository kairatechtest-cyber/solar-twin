import { Component, computed, inject } from '@angular/core';
import { Store } from '../core/store.service';
import { SceneUi } from '../scene/scene-ui.service';

@Component({
  selector: 'app-loading-overlay',
  standalone: true,
  template: `
    @if (!ready()) {
      <div class="loading"><div class="box">
        <h1>Loading your solar plant</h1>
        <div class="muted">Streaming optimised 3D model and live data…</div>
        <div class="bar"><i [style.width.%]="store.sceneReady() ? 100 : (ui.progress() < 3 ? 3 : ui.progress())"></i></div>
        <div class="steps">
          <span [class.ok]="store.sceneReady()">{{ store.sceneReady() ? '✓' : '○' }} Loading 3D model</span>
          <span [class.ok]="store.connected()">{{ store.connected() ? '✓' : '○' }} Connecting to SCADA</span>
          <span [class.ok]="!!store.snapshot()">{{ store.snapshot() ? '✓' : '○' }} Initialising data</span>
        </div>
      </div></div>
    }`,
})
export class LoadingOverlayComponent {
  store = inject(Store);
  ui = inject(SceneUi);
  ready = computed(() => this.store.sceneReady() && !!this.store.snapshot());
}
