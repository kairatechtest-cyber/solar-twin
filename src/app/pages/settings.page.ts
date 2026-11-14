import { Component, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PageHeadComponent } from '../shared/bits';
import { TimePipe } from '../shared/pipes';
import { Api } from '../core/api.service';
import { Store } from '../core/store.service';
import { ToastService } from '../core/toast.service';
import { apiResource } from '../core/resource';

const LABELS: [string, string][] = [
  ['inverterWarnC', 'Inverter temp warning (°C)'], ['inverterCritC', 'Inverter temp critical (°C)'],
  ['transformerWarnC', 'Transformer oil warning (°C)'], ['transformerCritC', 'Transformer oil critical (°C)'],
  ['bessWarnC', 'BESS temp warning (°C)'], ['bessCritC', 'BESS temp critical (°C)'], ['bessLowSoc', 'BESS low SOC notice (%)'],
  ['windInfoMs', 'High wind notice (m/s)'], ['lowPerfPct', 'PV group low performance ratio (%)'],
];

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, PageHeadComponent, TimePipe],
  template: `
    <div class="page">
      <app-page-head title="Settings" sub="Alarm limits, audit trail and demo tools" />
      <div class="tabs" style="margin-bottom:14px">
        @for (t of tabs; track t[0]) { <button class="tab" [class.on]="tab() === t[0]" (click)="tab.set(t[0])">{{ t[1] }}</button> }
      </div>

      @if (tab() === 'general') {
        <div class="card" style="max-width:520px">
          <div class="kv">
            <span class="muted">User</span><b>{{ store.user()?.email }}</b><span class="muted">Role</span><b>{{ store.user()?.role }}</b>
            <span class="muted">Live connection</span><b>{{ store.connected() ? 'Online' : 'Offline' }}</b><span class="muted">Data source</span><b>Simulator (DEMO)</b><span class="muted">Frontend</span><b>Angular</b>
          </div>
          <label class="row" style="margin-top:14px"><input type="checkbox" [checked]="store.sound()" (change)="store.setSound(!store.sound())" /> Audible beep on new critical alarms (this browser)</label>
        </div>
      }

      @if (tab() === 'thresholds') {
        <div class="card" style="max-width:520px">
          @for (l of labels; track l[0]) {
            <label style="display:block;margin-bottom:10px">{{ l[1] }}
              <input class="input" type="number" [disabled]="!store.isAdmin()" [ngModel]="thr()[l[0]]" (ngModelChange)="setThr(l[0], $event)" /></label>
          }
          <button class="btn" [disabled]="!store.isAdmin()" (click)="save()">Save changes</button>
          @if (!store.isAdmin()) { <span class="muted"> Admin role required.</span> }
        </div>
      }

      @if (tab() === 'audit') {
        <div class="card tbl-wrap">
          @if (!store.canOperate()) { <span class="muted">Operator or admin role required.</span> } @else {
            <table><thead><tr><th>Time</th><th>User</th><th>Action</th><th>Target</th><th>Detail</th></tr></thead>
              <tbody>@for (a of audit.data() ?? []; track a.id) { <tr><td>{{ a.ts | ftime }}</td><td>{{ a.userEmail }}</td><td>{{ a.action }}</td><td>{{ a.target ?? '-' }}</td><td class="muted">{{ a.detail ?? '' }}</td></tr> }</tbody></table>
          }
        </div>
      }

      @if (tab() === 'sim') {
        <div class="card" style="max-width:520px">
          <p class="muted">Raise a simulated fault to try the alarm workflow. Admin only; no real equipment involved.</p>
          <div class="row">
            <input class="input" style="width:120px" [(ngModel)]="injTag" />
            <select class="input" style="width:170px" [(ngModel)]="injKind">@for (k of kinds; track k) { <option>{{ k }}</option> }</select>
            <button class="btn" [disabled]="!store.isAdmin()" (click)="injectFault()">Inject fault</button>
          </div>
        </div>
      }
    </div>`,
})
export class SettingsPage {
  store = inject(Store); private api = inject(Api); private toast = inject(ToastService);
  tabs: [string, string][] = [['general', 'General'], ['thresholds', 'Alarm thresholds'], ['audit', 'Audit log'], ['sim', 'Simulation tools']];
  labels = LABELS;
  kinds = ['overtemp', 'comm', 'grid', 'shading', 'stringopen', 'besstemp', 'bessfault', 'oilhigh', 'highwind', 'gridloss'];
  tab = signal('general');
  thr = signal<Record<string, number>>({});
  injTag = 'PV-05'; injKind = 'shading';

  private cfg = apiResource<{ thresholds: Record<string, number> }>(() => '/settings');
  audit = apiResource<any[]>(() => (this.tab() === 'audit' && this.store.canOperate() ? '/audit?limit=100' : null));

  constructor() {
    // copy loaded thresholds into the editable signal once they arrive
    effect(() => { const d = this.cfg.data(); if (d) untracked(() => this.thr.set({ ...d.thresholds })); });
  }
  setThr(k: string, v: number) { this.thr.update((t) => ({ ...t, [k]: Number(v) })); }
  save() { this.api.put('/settings', { thresholds: this.thr() }).subscribe({ next: () => this.toast.ok('Thresholds saved'), error: (e) => this.toast.error(e.message) }); }
  injectFault() {
    this.api.post('/sim/inject', { tag: this.injTag, kind: this.injKind, seconds: 90 }).subscribe({
      next: () => this.toast.ok(`Injected simulated "${this.injKind}" on ${this.injTag}`), error: (e) => this.toast.error(e.message) });
  }
}
