import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ChartComponent, axisStyle } from '../shared/chart.component';
import { MultiLineComponent, Ser } from '../shared/charts';
import { KpiComponent, PageHeadComponent, StatusComponent } from '../shared/bits';
import { FmtPipe } from '../shared/pipes';
import { Store } from '../core/store.service';
import { apiResource, queryParam, setQuery } from '../core/resource';
import type { LiveState, Point } from '../core/types';
import { fmt, statusColor } from '../core/util';

@Component({
  selector: 'app-pv-field',
  standalone: true,
  imports: [RouterLink, ChartComponent, MultiLineComponent, KpiComponent, PageHeadComponent, StatusComponent, FmtPipe],
  template: `
    <div class="page">
      <app-page-head title="PV Field" sub="DC side of the plant, by field and PV group">
        <div class="tabs">
          <button class="tab" [class.on]="tag() === 'ALL'" (click)="pick('ALL')">All fields</button>
          @for (f of fields(); track f.tag) { <button class="tab" [class.on]="tag() === f.tag" (click)="pick(f.tag)">{{ f.name }}</button> }
        </div>
      </app-page-head>

      <div class="grid g4">
        <app-kpi icon="zap" label="DC power" [value]="dc() | fmt:1" unit="kW" [sub]="(kWp() | fmt:0) + ' kWp installed · ' + states().length + ' groups'" />
        <app-kpi icon="gauge" label="Performance ratio" [value]="pr() | fmt:1" unit="%" color="#22c55e" />
        <app-kpi icon="sun" label="POA irradiance" [value]="store.plant()?.poa | fmt:0" unit="W/m²" color="#f59e0b" />
        <app-kpi icon="thermo" label="Module temperature" [value]="store.plant()?.moduleTempC | fmt:1" unit="°C" color="#ef4444" [sub]="faulty() + ' faulty string' + (faulty() === 1 ? '' : 's')" />
      </div>

      <div class="grid g2e mt">
        <div class="card"><h2>Power and performance ratio by PV group</h2><app-chart [option]="bars()" [height]="280" /></div>
        <div class="card">
          <h2>{{ tag() === 'ALL' ? 'Select a field to see its trend' : 'Field DC power — last 30 min' }}</h2>
          <app-multi-line [series]="trend()" [height]="280" />
        </div>
      </div>

      <div class="card tbl-wrap mt"><table>
        <thead><tr><th>Group</th><th>Field</th><th>Status</th><th>DC power (kW)</th><th>PR (%)</th><th>Voltage (V)</th><th>Current (A)</th><th>Module temp (°C)</th><th>Faulty strings</th></tr></thead>
        <tbody>
          @for (s of states(); track s.tag) {
            <tr>
              <td><a [routerLink]="['/pv-group']" [queryParams]="{ tag: s.tag }">{{ s.tag }}</a></td><td>{{ fieldOf(s.tag) }}</td><td><app-status [status]="s.status" /></td>
              <td>{{ s.powerKw | fmt:1 }}</td><td>{{ s.efficiency | fmt:1 }}</td><td>{{ s.dcVoltage | fmt:0 }}</td><td>{{ s.currentA | fmt:1 }}</td><td>{{ s.tempC | fmt:1 }}</td>
              <td>{{ s.extra['stringsFaulty'] ?? 0 }} / {{ s.extra['strings'] }}</td>
            </tr>
          }
        </tbody>
      </table></div>
    </div>`,
})
export class PvFieldPage {
  store = inject(Store); private router = inject(Router); private route = inject(ActivatedRoute);
  tag = queryParam('tag', 'ALL');
  private hist = apiResource<Point[]>(() => (this.tag() === 'ALL' ? null : `/equipment/${this.tag()}/history?minutes=30`), { every: 5000 });

  fields = computed(() => this.store.defs().filter((d) => d.type === 'pvfield'));
  groups = computed(() => this.store.defs().filter((d) => d.type === 'pvgroup' && (this.tag() === 'ALL' || d.parentTag === this.tag())));
  states = computed(() => { const live = this.store.live(); return this.groups().map((g) => live.get(g.tag)).filter((s): s is LiveState => !!s); });
  kWp = computed(() => this.groups().reduce((a, g) => a + g.ratedKw, 0));
  dc = computed(() => this.states().reduce((a, s) => a + s.powerKw, 0));
  faulty = computed(() => this.states().reduce((a, s) => a + (s.extra['stringsFaulty'] ?? 0), 0));
  pr = computed(() => { const poa = this.store.plant()?.poa ?? 0; return poa >= 50 && this.kWp() ? (this.dc() / (this.kWp() * (poa / 1000))) * 100 : 0; });
  fieldOf = (tag: string) => this.store.defs().find((d) => d.tag === tag)?.parentTag;

  trend = computed<Ser[]>(() => this.tag() === 'ALL' ? [] : [{ name: 'DC power', unit: 'kW', color: '#22d3ee', area: true, data: (this.hist.data() ?? []).map((p) => [p.t, +p.powerKw.toFixed(1)] as [number, number]) }]);
  bars = computed(() => {
    const st = this.states();
    return {
      grid: { left: 46, right: 46, top: 34, bottom: 28 }, tooltip: { trigger: 'axis' }, legend: { textStyle: { color: '#8ea0c9' }, top: 0, left: 'center' },
      xAxis: { type: 'category', data: st.map((s) => s.tag.slice(3)), ...axisStyle },
      yAxis: [{ type: 'value', name: 'kW', nameTextStyle: { color: '#8ea0c9' }, ...axisStyle }, { type: 'value', name: 'PR %', max: 110, nameTextStyle: { color: '#8ea0c9' }, ...axisStyle, splitLine: { show: false } }],
      series: [
        { name: 'DC power', type: 'bar', data: st.map((s) => ({ value: +s.powerKw.toFixed(1), itemStyle: { color: statusColor[s.status] } })) },
        { name: 'PR', type: 'line', yAxisIndex: 1, showSymbol: true, lineStyle: { color: '#22d3ee' }, itemStyle: { color: '#22d3ee' }, data: st.map((s) => +s.efficiency.toFixed(1)) },
      ],
    };
  });
  pick(t: string) { setQuery(this.router, this.route, { tag: t === 'ALL' ? null : t }); }
  protected readonly fmt = fmt;
}
