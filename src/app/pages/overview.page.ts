import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { KpiComponent, RingComponent, AlarmChipComponent, SevComponent, PageHeadComponent } from '../shared/bits';
import { EnergyFlowComponent, MultiLineComponent, Ser } from '../shared/charts';
import { AckModalComponent } from '../shared/ack-modal.component';
import { FmtPipe, ModePipe, TimePipe } from '../shared/pipes';
import { Api } from '../core/api.service';
import { Store } from '../core/store.service';
import { ToastService } from '../core/toast.service';
import { apiResource } from '../core/resource';
import { SECTIONS, sectionAlarm, sectionValue } from '../core/metrics';
import type { Alarm } from '../core/types';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [RouterLink, KpiComponent, RingComponent, AlarmChipComponent, SevComponent, PageHeadComponent, MultiLineComponent, EnergyFlowComponent, AckModalComponent, FmtPipe, ModePipe, TimePipe],
  template: `
    <div class="page">
      <app-page-head title="Overview" sub="Live plant performance, energy flow and alarms" />

      <div class="grid g4">
        <app-kpi icon="zap" label="Active power" [value]="p()?.powerKw | fmt:0" unit="kW" [sub]="powerSub()" />
        <app-kpi icon="sun" label="POA irradiance" [value]="p()?.poa | fmt:0" unit="W/m²" color="#f59e0b" [sub]="'GHI ' + (p()?.ghi | fmt:0) + ' W/m²'" />
        <app-kpi icon="gauge" label="Energy today" [value]="p()?.energyTodayKwh | fmt:0" unit="kWh" color="#22c55e" [sub]="'CO₂ avoided ≈ ' + (p()?.co2Tons | fmt:2) + ' t'" />
        <app-kpi icon="battery" label="BESS SOC" [value]="p()?.bessSoc | fmt:0" unit="%" color="#a78bfa" [sub]="(p()?.bessMode | mode) + ' · ' + (abs(p()?.bessKw) | fmt:0) + ' kW'" />
      </div>

      <div class="card mt">
        <div class="grid g5">
          <app-ring [pct]="powerPct()" [value]="(p()?.powerKw | fmt:0) + ' kW'" label="Active power" />
          <app-ring [pct]="p()?.prPct ?? 0" [value]="(p()?.prPct | fmt:1) + ' %'" label="Performance ratio" color="#22c55e" />
          <app-ring [pct]="p()?.availabilityPct ?? 0" [value]="(p()?.availabilityPct | fmt:1) + ' %'" label="Availability (today)" color="#3b82f6" />
          <app-ring [pct]="((p()?.poa ?? 0) / 1200) * 100" [value]="p()?.poa | fmt:0" label="POA irradiance (W/m²)" color="#f59e0b" />
          <app-ring [pct]="p()?.bessSoc ?? 0" [value]="(p()?.bessSoc | fmt:0) + ' %'" [label]="'BESS · ' + (p()?.bessMode | mode)" color="#a78bfa" />
        </div>
      </div>

      <div class="grid g2e mt">
        <div class="card"><h2>Plant active power — today</h2><app-multi-line [series]="power()" [height]="250" /></div>
        <div class="card"><h2>Plane-of-array irradiance — today</h2><app-multi-line [series]="poa()" [height]="250" /></div>
      </div>

      <div class="grid g3e mt">
        <div class="card">
          <h2>Energy flow (kW)</h2>
          <app-energy-flow [flow]="store.snapshot()?.flow" [height]="300" />
          <div class="muted" style="font-size:12px">Grid: {{ abs(p()?.gridKw) | fmt:0 }} kW {{ (p()?.gridKw ?? 0) >= 0 ? 'export' : 'import' }} · site load {{ p()?.auxKw | fmt:0 }} kW</div>
        </div>

        <div class="card">
          <h2>Plant sections</h2>
          <div class="tbl-wrap"><table>
            <thead><tr><th>Section</th><th>Alarm status</th><th>Value</th></tr></thead>
            <tbody>
              @for (r of sections(); track r.s.tag) {
                <tr>
                  <td><a [routerLink]="r.s.path" [queryParams]="r.s.params">{{ r.s.label }}</a></td>
                  <td><app-alarm-chip [color]="r.a.color" [label]="r.a.label" [unacked]="r.a.unacked" /></td>
                  <td class="mono">{{ r.v }}</td>
                </tr>
              }
            </tbody>
          </table></div>
        </div>

        <div class="card">
          <div class="row"><h2 style="margin:0">Active alarms ({{ cur.data()?.total ?? 0 }})</h2><span class="sp"></span><a routerLink="/alarms" class="muted">All →</a></div>
          @if (alarms().length === 0) { <div class="muted" style="margin-top:10px">No active alarms.</div> }
          @for (a of alarms(); track a.id) {
            <div class="row alarm-row" [class.unacked-critical]="a.severity === 'critical' && !a.acknowledged">
              <app-sev [s]="a.severity" />
              <div style="flex:1;min-width:120px">
                <a [routerLink]="['/equipment', a.equipmentTag]" class="mono">{{ a.equipmentTag }}</a> {{ a.message }}@if (a.value) {<span class="muted"> ({{ a.value }})</span>}
                <div class="muted" style="font-size:11px">{{ a.raisedAt | ftime }}@if (a.acknowledged) { · ack {{ a.ackedBy }} }</div>
              </div>
              <button class="btn sm" [disabled]="!store.canOperate() || a.acknowledged" (click)="ackId.set(a.id)">{{ a.acknowledged ? 'Acked' : 'Ack' }}</button>
            </div>
          }
        </div>
      </div>

      @if (ackId() !== null) { <app-ack-modal [count]="1" [busy]="busy()" (cancelled)="ackId.set(null)" (confirmed)="ack($event)" /> }
    </div>`,
})
export class OverviewPage {
  store = inject(Store); private api = inject(Api); private toast = inject(ToastService);
  gen = apiResource<any>(() => '/analytics/generation?range=today', { every: 60_000 });
  cur = apiResource<{ rows: Alarm[]; total: number }>(() => '/alarms?state=current&limit=8', { deps: () => this.store.alarmVersion(), every: 20_000 });
  ackId = signal<number | null>(null);
  busy = signal(false);
  p = this.store.plant;
  abs = (v?: number | null) => Math.abs(v ?? 0);

  powerPct = computed(() => { const p = this.p(); return p ? (p.powerKw / p.capacityAcKw) * 100 : 0; });
  powerSub = computed(() => { const p = this.p(); return p ? `${((p.powerKw / p.capacityAcKw) * 100).toFixed(0)} % of ${p.capacityAcKw.toFixed(0)} kW AC` : ''; });
  alarms = computed(() => this.cur.data()?.rows ?? []);
  power = computed<Ser[]>(() => [
    { name: 'Active power', unit: 'kW', color: '#22d3ee', area: true, data: (this.gen.data()?.points ?? []).map((x: any) => [x.t, +x.powerKw.toFixed(1)] as [number, number]) },
    { name: 'Expected', unit: 'kW', color: '#8ea0c9', dashed: true, data: (this.gen.data()?.points ?? []).map((x: any) => [x.t, +x.expectedKw.toFixed(1)] as [number, number]) },
  ]);
  poa = computed<Ser[]>(() => [{ name: 'POA irradiance', unit: 'W/m²', color: '#f59e0b', area: true, data: (this.gen.data()?.points ?? []).map((x: any) => [x.t, Math.round(x.poa)] as [number, number]) }]);
  sections = computed(() => {
    const counts = this.store.snapshot()?.alarmCounts; const defs = this.store.defs(); const live = this.store.live();
    return SECTIONS.map((s) => ({ s, a: sectionAlarm(counts, defs, s.tag), v: sectionValue(live.get(s.tag)) }));
  });

  ack(note: string) {
    const id = this.ackId(); if (id === null) return;
    this.busy.set(true);
    this.api.post('/alarms/ack', { ids: [id], note }).subscribe({
      next: () => { this.ackId.set(null); this.busy.set(false); this.toast.ok('Alarm acknowledged'); },
      error: (e) => { this.busy.set(false); this.toast.error(e.message); },
    });
  }
}
