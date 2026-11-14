import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MultiLineComponent, Ser } from '../shared/charts';
import { AlarmChipComponent, MetricGridComponent, PageHeadComponent, RingComponent, SevComponent, StatusComponent } from '../shared/bits';
import { FmtPipe, ModePipe, TimePipe } from '../shared/pipes';
import { Api } from '../core/api.service';
import { Store } from '../core/store.service';
import { ToastService } from '../core/toast.service';
import { apiResource } from '../core/resource';
import { metricsFor, sectionAlarm } from '../core/metrics';
import type { Alarm, Point } from '../core/types';

@Component({
  selector: 'app-bess',
  standalone: true,
  imports: [RouterLink, MultiLineComponent, AlarmChipComponent, MetricGridComponent, PageHeadComponent, RingComponent, SevComponent, StatusComponent, FmtPipe, ModePipe, TimePipe],
  template: `
    <div class="page">
      @if (s(); as b) {
        <app-page-head title="BESS — Battery Energy Storage" sub="State of charge, power and thermal limits">
          <app-status [status]="b.status" /><app-alarm-chip [color]="al().color" [label]="al().label" [unacked]="al().unacked" />
        </app-page-head>

        <div class="grid bess-top">
          <div class="card" style="text-align:center">
            <div class="bat"><i [style.height.%]="soc()" [style.background]="fill()"></i><b>{{ soc() | fmt:0 }}%</b></div>
            <h2 style="margin-top:14px">{{ b.extra['mode'] | mode }}</h2>
            <div class="muted">{{ abs(b.powerKw) | fmt:0 }} kW · {{ b.extra['availableKwh'] | fmt:0 }} / {{ b.extra['capacityKwh'] | fmt:0 }} kWh</div>
            <div class="tabs" style="margin-top:12px">
              @for (m of modes; track m[0]; let i = $index) {
                <button class="tab" [class.on]="b.extra['setMode'] === i" [disabled]="!store.canOperate()" (click)="set(m[0])">{{ m[1] }}</button>
              }
            </div>
            <div class="muted" style="font-size:12px;margin-top:6px">{{ store.canOperate() ? 'Control mode (simulated)' : 'Operator role required' }}</div>
          </div>
          <div class="card"><h2>Battery data</h2><app-metric-grid [items]="metrics()" [cols]="4" /></div>
        </div>

        <div class="grid g2e mt">
          <div class="card"><h2>SOC and power — today</h2><app-multi-line [series]="today()" [height]="290" /></div>
          <div class="card"><h2>Last 30 minutes</h2><app-multi-line [series]="last30()" [height]="290" /></div>
        </div>

        <div class="grid g2e mt">
          <div class="card">
            <h2>Operating limits</h2>
            <div class="grid g4 center-grid">
              <app-ring [pct]="(b.tempC / 60) * 100" [value]="(b.tempC | fmt:0) + ' °C'" label="Temperature (limit 50 °C)" [color]="tempColor()" />
              <app-ring [pct]="soc()" [value]="(soc() | fmt:0) + ' %'" label="State of charge" [color]="fill()" />
              <app-ring [pct]="(abs(b.powerKw) / b.ratedKw) * 100" [value]="(abs(b.powerKw) | fmt:0) + ' kW'" [label]="'Power (rated ' + b.ratedKw + ' kW)'" color="#22d3ee" />
              <app-ring [pct]="b.extra['soh'] ?? 0" [value]="(b.extra['soh'] | fmt:1) + ' %'" label="State of health" color="#3b82f6" />
            </div>
          </div>
          <div class="card">
            <div class="row"><h2 style="margin:0">Active alarms</h2><span class="sp"></span><a routerLink="/alarms" class="muted">All alarms →</a></div>
            @if (alarms().length === 0) { <div class="muted" style="margin-top:10px">No active BESS alarms.</div> }
            @for (a of alarms(); track a.id) {
              <div class="row alarm-row"><app-sev [s]="a.severity" /><span style="flex:1">{{ a.message }}@if (a.value) {<span class="muted"> ({{ a.value }})</span>}</span>
                <span class="muted">{{ a.raisedAt | ftime }}</span><span [class]="a.acknowledged ? 'st-acknowledged' : 'st-active'">{{ a.acknowledged ? 'Acknowledged' : 'Active' }}</span></div>
            }
          </div>
        </div>
      } @else { <div class="muted">Loading…</div> }
    </div>`,
})
export class BessPage {
  store = inject(Store); private api = inject(Api); private toast = inject(ToastService);
  modes: [string, string][] = [['auto', 'Auto'], ['charge', 'Charge'], ['discharge', 'Discharge'], ['idle', 'Idle']];
  abs = (v?: number | null) => Math.abs(v ?? 0);

  s = computed(() => this.store.snapshot()?.equipment.find((e) => e.type === 'bess'));
  private trend = apiResource<any>(() => '/analytics/trends?series=bessSoc,bessKw&range=today', { every: 60_000 });
  private hist = apiResource<Point[]>(() => (this.s() ? `/equipment/${this.s()!.tag}/history?minutes=30` : null), { every: 5000 });
  private al_ = apiResource<{ rows: Alarm[] }>(() => (this.s() ? `/alarms?state=current&tag=${this.s()!.tag}&limit=8` : null), { deps: () => this.store.alarmVersion(), every: 15000 });

  alarms = computed(() => this.al_.data()?.rows ?? []);
  soc = computed(() => this.s()?.extra['soc'] ?? 0);
  fill = computed(() => (this.soc() < 20 ? '#ef4444' : this.soc() < 40 ? '#f59e0b' : '#22c55e'));
  tempColor = computed(() => { const t = this.s()?.tempC ?? 0; return t >= 50 ? '#ef4444' : t >= 40 ? '#f59e0b' : '#22c55e'; });
  metrics = computed(() => (this.s() ? metricsFor(this.s()!) : []));
  al = computed(() => sectionAlarm(this.store.snapshot()?.alarmCounts, this.store.defs(), this.s()?.tag ?? ''));
  today = computed<Ser[]>(() => [
    { name: 'SOC', unit: '%', color: '#a78bfa', area: true, data: (this.trend.data()?.rows ?? []).map((r: any) => [r.t, r.bessSoc] as [number, number]) },
    { name: 'Power (+discharge / −charge)', unit: 'kW', color: '#22d3ee', data: (this.trend.data()?.rows ?? []).map((r: any) => [r.t, r.bessKw] as [number, number]) },
  ]);
  last30 = computed<Ser[]>(() => [
    { name: 'SOC', unit: '%', color: '#a78bfa', area: true, data: (this.hist.data() ?? []).map((p) => [p.t, +p.aux.toFixed(1)] as [number, number]) },
    { name: 'Power', unit: 'kW', color: '#22d3ee', data: (this.hist.data() ?? []).map((p) => [p.t, +p.powerKw.toFixed(1)] as [number, number]) },
    { name: 'Temperature', unit: '°C', color: '#f59e0b', dashed: true, data: (this.hist.data() ?? []).map((p) => [p.t, +p.tempC.toFixed(1)] as [number, number]) },
  ]);
  set(command: string) {
    const tag = this.s()?.tag; if (!tag) return;
    this.api.post(`/equipment/${tag}/command`, { command }).subscribe({ next: () => this.toast.ok(`BESS mode "${command}" sent (simulated)`), error: (e) => this.toast.error(e.message) });
  }
}
