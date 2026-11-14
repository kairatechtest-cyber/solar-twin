import { Component, computed, inject, input, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MultiLineComponent, Ser } from '../shared/charts';
import { AlarmChipComponent, MetricGridComponent, PageHeadComponent, StatusComponent } from '../shared/bits';
import { FmtPipe } from '../shared/pipes';
import { Api } from '../core/api.service';
import { Store } from '../core/store.service';
import { ToastService } from '../core/toast.service';
import { apiResource, queryParam } from '../core/resource';
import { metricsFor, sectionAlarm } from '../core/metrics';
import type { EquipmentDef, Point } from '../core/types';

@Component({
  selector: 'app-inverter-station',
  standalone: true,
  imports: [RouterLink, MultiLineComponent, AlarmChipComponent, MetricGridComponent, StatusComponent],
  template: `
    @if (live(); as l) {
      <div class="card">
        <div class="row">
          <h2 style="margin:0">{{ def().name }}</h2><span class="muted mono">{{ def().tag }}</span><app-status [status]="l.status" />
          <app-alarm-chip [color]="al().color" [label]="al().label" [unacked]="al().unacked" /><span class="sp"></span>
          <a class="btn sm ghost" [routerLink]="['/equipment', def().tag]">Events &amp; details</a>
        </div>
        <div class="grid g2e mt">
          <div>
            <app-metric-grid [items]="metrics()" [cols]="3" />
            <div class="row" style="margin-top:12px">
              @for (c of checks(); track c[0]) { <span class="pill"><i class="dot" [style.background]="c[1] === 'OK' ? 'var(--green)' : 'var(--amber)'"></i>{{ c[0] }}: {{ c[1] }}</span> }
            </div>
            <div class="row" style="margin-top:12px">
              <button class="btn sm" [disabled]="!store.canOperate()" (click)="run('start')">Start</button>
              <button class="btn sm ghost" [disabled]="!store.canOperate()" (click)="run('stop')">Stop</button>
              <button class="btn sm ghost" [disabled]="!store.canOperate()" (click)="run('reset')">Reset fault</button>
              <span class="muted">{{ store.canOperate() ? 'Simulated commands' : 'Operator role required' }}</span>
            </div>
          </div>
          <div>
            <h2>AC power &amp; temperature (30 min)</h2>
            <app-multi-line [series]="series()" [height]="230" />
            <div class="muted" style="font-size:12px">Feeds {{ groups().length }} PV groups ({{ groups()[0]?.tag }}–{{ groups()[groups().length - 1]?.tag }}) · rated {{ def().ratedKw }} kW AC</div>
          </div>
        </div>
      </div>
    }`,
})
export class InverterStationComponent {
  store = inject(Store); private api = inject(Api); private toast = inject(ToastService);
  def = input.required<EquipmentDef>();
  private detail = apiResource<any>(() => `/equipment/${this.def().tag}`, { deps: () => this.store.alarmVersion(), every: 10000 });
  private hist = apiResource<Point[]>(() => `/equipment/${this.def().tag}/history?minutes=30`, { every: 5000 });

  live = computed(() => this.store.live().get(this.def().tag));
  metrics = computed(() => (this.live() ? metricsFor(this.live()!) : []));
  checks = computed(() => Object.entries(this.detail.data()?.checks ?? {}) as [string, string][]);
  al = computed(() => sectionAlarm(this.store.snapshot()?.alarmCounts, this.store.defs(), this.def().tag));
  groups = computed(() => { const d = this.store.defs(); return d.filter((g) => g.type === 'pvgroup' && d.find((f) => f.tag === g.parentTag)?.parentTag === this.def().tag); });
  series = computed<Ser[]>(() => [
    { name: 'AC power', unit: 'kW', color: '#22d3ee', area: true, data: (this.hist.data() ?? []).map((p) => [p.t, +p.powerKw.toFixed(1)] as [number, number]) },
    { name: 'Temperature', unit: '°C', color: '#f59e0b', data: (this.hist.data() ?? []).map((p) => [p.t, +p.tempC.toFixed(1)] as [number, number]) },
  ]);
  run(command: string) {
    if (!confirm(`Send "${command}" to ${this.def().tag}? (Simulation only - no real equipment is affected.)`)) return;
    this.api.post(`/equipment/${this.def().tag}/command`, { command }).subscribe({ next: () => this.toast.ok(`"${command}" sent (simulated)`), error: (e) => this.toast.error(e.message) });
  }
}

@Component({
  selector: 'app-inverters',
  standalone: true,
  imports: [RouterLink, InverterStationComponent, StatusComponent, PageHeadComponent, FmtPipe],
  template: `
    <div class="page">
      <app-page-head title="Inverter Stations" sub="AC conversion, efficiency and temperature per station" />
      <div class="card tbl-wrap" style="margin-bottom:14px"><table>
        <thead><tr><th>Station</th><th>Status</th><th>AC (kW)</th><th>DC (kW)</th><th>Load (%)</th><th>Eff. (%)</th><th>Temp (°C)</th><th>Energy today (kWh)</th></tr></thead>
        <tbody>
          @for (d of invs(); track d.tag) {
            @if (store.live().get(d.tag); as s) {
              <tr><td><a [routerLink]="['/inverters']" [queryParams]="{ tag: d.tag }">{{ d.name }}</a></td><td><app-status [status]="s.status" /></td>
                <td>{{ s.powerKw | fmt:1 }}</td><td>{{ s.extra['dcPowerKw'] | fmt:1 }}</td><td>{{ (s.powerKw / s.ratedKw) * 100 | fmt:0 }}</td>
                <td>{{ s.efficiency | fmt:1 }}</td><td>{{ s.tempC | fmt:1 }}</td><td>{{ s.extra['energyTodayKwh'] | fmt:0 }}</td></tr>
            }
          }
        </tbody>
      </table></div>
      <div class="grid">
        @for (d of shown(); track d.tag) { <app-inverter-station [def]="d" /> }
      </div>
      @if (only()) { <p><a routerLink="/inverters">Show all stations</a></p> }
    </div>`,
})
export class InvertersPage {
  store = inject(Store);
  only = queryParam('tag', '');
  invs = computed(() => this.store.defs().filter((d) => d.type === 'inverter'));
  shown = computed(() => this.invs().filter((d) => !this.only() || d.tag === this.only()));
}
