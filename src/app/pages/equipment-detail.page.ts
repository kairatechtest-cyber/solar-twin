import { Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MultiLineComponent, Ser } from '../shared/charts';
import { AlarmStateComponent, MetricGridComponent, SevComponent, StatusComponent } from '../shared/bits';
import { FmtPipe, TimePipe } from '../shared/pipes';
import { SceneUi } from '../scene/scene-ui.service';
import { Api } from '../core/api.service';
import { Store } from '../core/store.service';
import { ToastService } from '../core/toast.service';
import { apiResource } from '../core/resource';
import { metricsFor } from '../core/metrics';
import type { Alarm, EquipmentDef, Point } from '../core/types';

type Detail = EquipmentDef & { checks: Record<string, string>; alarms: Alarm[] };

@Component({
  selector: 'app-equipment-detail',
  standalone: true,
  imports: [RouterLink, MultiLineComponent, AlarmStateComponent, MetricGridComponent, SevComponent, StatusComponent, FmtPipe, TimePipe],
  template: `
    <div class="page">
      @if (d(); as dd) { @if (live(); as l) {
        <div class="muted"><a routerLink="/overview">Overview</a> › {{ dd.tag }}</div>
        <div class="row" style="margin:6px 0 14px"><h1 style="margin:0">{{ dd.name }}</h1><app-status [status]="l.status" /><span class="sp"></span>
          <button class="btn ghost sm" (click)="locate()">Locate in 3D</button></div>

        <div class="grid g2">
          <div class="card">
            <app-metric-grid [items]="metrics()" [cols]="4" />
            <div class="tabs" style="margin:12px 0 10px">
              <button class="tab" [class.on]="tab() === 'live'" (click)="tab.set('live')">Live data</button>
              <button class="tab" [class.on]="tab() === 'events'" (click)="tab.set('events')">Events</button>
              <button class="tab" [class.on]="tab() === 'control'" (click)="tab.set('control')">Control</button>
            </div>
            @if (tab() === 'live') {
              <div class="grid g2e"><div><h2>Power (30 min)</h2><app-multi-line [series]="power()" [height]="200" /></div><div><h2>Temperature (30 min)</h2><app-multi-line [series]="temp()" [height]="200" /></div></div>
            }
            @if (tab() === 'events') {
              <div class="tbl-wrap"><table><thead><tr><th>Time</th><th>Severity</th><th>Message</th><th>State</th></tr></thead><tbody>
                @if (dd.alarms.length === 0) { <tr><td colspan="4" class="muted">No events recorded.</td></tr> }
                @for (a of dd.alarms; track a.id) {
                  <tr><td>{{ a.raisedAt | ftime }}</td><td><app-sev [s]="a.severity" /></td><td>{{ a.message }}@if (a.value) {<span class="muted"> ({{ a.value }})</span>}</td><td><app-alarm-state [s]="a.state" /></td></tr>
                }</tbody></table></div>
            }
            @if (tab() === 'control') {
              <p class="muted">All control actions are <b>simulation only</b> in this build and are written to the audit log.</p>
              <div class="row">
                <button class="btn" [disabled]="!canCmd()" (click)="run('start')">Start</button>
                <button class="btn ghost" [disabled]="!canCmd()" (click)="run('stop')">Stop</button>
                <button class="btn ghost" [disabled]="!canCmd()" (click)="run('reset')">Reset fault</button>
              </div>
              @if (!canCmd()) { <p class="muted">{{ dd.type !== 'inverter' ? 'Commands are only available for inverters (BESS modes are on the BESS page).' : 'Operator or admin role required.' }}</p> }
            }
          </div>

          <div>
            <div class="card" style="margin-bottom:14px">
              <h2>Key information</h2>
              <div class="kv">
                <span class="muted">Tag</span><b>{{ dd.tag }}</b><span class="muted">Type</span><b>{{ dd.type }}</b>
                <span class="muted">Rated power</span><b>{{ dd.ratedKw | fmt:0 }} kW</b><span class="muted">Parent</span><b>{{ dd.parentTag ?? '-' }}</b>
                @for (m of metaEntries(); track m[0]) { <span class="muted">{{ m[0] }}</span><b>{{ m[1] }}</b> }
              </div>
            </div>
            @if (checks().length > 0) {
              <div class="card"><h2>Status</h2>
                <div class="kv">@for (c of checks(); track c[0]) { <span class="muted">{{ c[0] }}</span><b [style.color]="c[1] === 'OK' ? 'var(--green)' : 'var(--amber)'">{{ c[1] }}</b> }</div>
              </div>
            }
          </div>
        </div>
      } } @else { <div class="muted">Loading…</div> }
    </div>`,
})
export class EquipmentDetailPage {
  store = inject(Store); private api = inject(Api); private router = inject(Router); private ui = inject(SceneUi); private toast = inject(ToastService);
  tag = input.required<string>();
  tab = signal<'live' | 'events' | 'control'>('live');

  private res = apiResource<Detail>(() => `/equipment/${this.tag()}`, { deps: () => this.store.alarmVersion() });
  private hist = apiResource<Point[]>(() => `/equipment/${this.tag()}/history?minutes=30`, { every: 5000 });
  d = computed(() => this.res.data());
  live = computed(() => this.store.live().get(this.tag()) ?? this.d()?.live);
  metrics = computed(() => (this.live() ? metricsFor(this.live()!) : []));
  metaEntries = computed(() => Object.entries(this.d()?.meta ?? {}));
  checks = computed(() => Object.entries(this.d()?.checks ?? {}));
  canCmd = computed(() => this.store.canOperate() && this.d()?.type === 'inverter');
  private mk = (key: 'powerKw' | 'tempC', name: string, color: string, unit: string): Ser[] =>
    [{ name, unit, color, area: true, data: (this.hist.data() ?? []).map((p) => [p.t, +p[key].toFixed(2)] as [number, number]) }];
  power = computed(() => this.mk('powerKw', 'Power', '#22d3ee', 'kW'));
  temp = computed(() => this.mk('tempC', 'Temperature', '#f59e0b', '°C'));

  locate() { this.store.select(this.tag()); this.ui.focusTag(this.tag()); this.router.navigateByUrl('/plant-3d'); }
  run(command: string) {
    if (!confirm(`Send "${command}" to ${this.tag()}? (Simulation only - no real equipment is affected.)`)) return;
    this.api.post(`/equipment/${this.tag()}/command`, { command }).subscribe({ next: () => this.toast.ok(`"${command}" sent (simulated)`), error: (e) => this.toast.error(e.message) });
  }
}
