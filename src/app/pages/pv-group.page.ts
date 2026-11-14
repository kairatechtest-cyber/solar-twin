import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ChartComponent, axisStyle } from '../shared/chart.component';
import { PvGroupGridComponent } from '../shared/pv-group-grid.component';
import { SectionPanelComponent } from '../shared/section-panel.component';
import { PageHeadComponent } from '../shared/bits';
import { FmtPipe } from '../shared/pipes';
import { Store } from '../core/store.service';
import { apiResource, queryParam, setQuery } from '../core/resource';
import type { LiveState, StringData } from '../core/types';
import { statusColor } from '../core/util';

@Component({
  selector: 'app-pv-group',
  standalone: true,
  imports: [RouterLink, ChartComponent, PvGroupGridComponent, SectionPanelComponent, PageHeadComponent, FmtPipe],
  template: `
    <div class="page wide">
      <app-page-head title="PV Group" sub="Performance of every PV array group">
        <div class="tabs">
          <button class="tab" [class.on]="field() === 'ALL'" (click)="set({ field: 'ALL' })">All</button>
          @for (f of fields(); track f.tag) { <button class="tab" [class.on]="field() === f.tag" (click)="set({ field: f.tag })">{{ f.name }}</button> }
        </div>
      </app-page-head>

      <div class="p3d">
        <div class="p3d-main">
          <div class="card">
            <div class="stat-strip">
              <div class="mtile"><div class="muted">DC power</div><div class="mv">{{ dc() | fmt:1 }} kW</div></div>
              <div class="mtile"><div class="muted">Avg. performance ratio</div><div class="mv">{{ avgPr() | fmt:1 }} %</div></div>
              <div class="mtile"><div class="muted">Faulty strings</div><div class="mv">{{ faulty() }}</div></div>
              <div class="mtile"><div class="muted">Groups needing attention</div><div class="mv">{{ warn() }} / {{ states().length }}</div></div>
            </div>
            <h2>PV groups (live DC power · performance ratio)</h2>
            <app-pv-group-grid [field]="field()" [selected]="tag()" (picked)="set({ tag: $event })" />
            <div class="muted" style="font-size:12px;margin-top:8px">Border colour: alarm severity if any, otherwise equipment status.</div>
          </div>

          <div class="card">
            <h2>Power and performance ratio by group <span class="muted" style="font-weight:400">(click a bar to select)</span></h2>
            <app-chart [option]="bars()" [height]="260" (chartClick)="barClick($event)" />
          </div>

          <div class="card">
            <div class="row"><h2 style="margin:0">Strings of {{ tag() }}</h2><span class="sp"></span><a class="btn sm ghost" [routerLink]="['/strings']" [queryParams]="{ tag: tag() }">Strings &amp; modules →</a></div>
            <div class="tbl-wrap"><table>
              <thead><tr><th>String</th><th>I (A)</th><th>V</th><th>P (kW)</th><th>Dev. (%)</th><th>Status</th></tr></thead>
              <tbody>
                @for (s of strings.data()?.strings ?? []; track s.id) {
                  <tr><td>{{ s.id }}</td><td>{{ s.currentA | fmt:2 }}</td><td>{{ s.voltageV | fmt:0 }}</td><td>{{ s.powerKw | fmt:2 }}</td><td>{{ s.deviationPct | fmt:0 }}</td>
                    <td [style.color]="stColor[s.status]">{{ s.status }}</td></tr>
                }
              </tbody>
            </table></div>
          </div>
        </div>

        <div class="p3d-side">
          <div class="card"><app-section-panel [tag]="tag()" /></div>
          <div class="card">
            <h2>Performance ranking</h2>
            @for (s of ranked(); track s.tag; let i = $index) {
              <div class="rank-row" [class.sel]="s.tag === tag()" (click)="set({ tag: s.tag })">
                <span class="muted">{{ i + 1 }}</span><b>{{ s.tag }}</b>
                <div class="heat-bar"><i [style.width.%]="s.efficiency > 100 ? 100 : s.efficiency" [style.background]="color(s)"></i></div>
                <span>{{ s.efficiency | fmt:0 }} %</span><span class="muted">{{ s.powerKw | fmt:1 }} kW</span>
              </div>
            }
          </div>
        </div>
      </div>
    </div>`,
})
export class PvGroupPage {
  store = inject(Store); private router = inject(Router); private route = inject(ActivatedRoute);
  tag = queryParam('tag', 'PV-01');
  field = queryParam('field', 'ALL');
  strings = apiResource<{ strings: StringData[] }>(() => `/strings/${this.tag()}`, { every: 5000 });
  stColor: Record<string, string> = { ok: '#22c55e', low: '#f59e0b', open: '#ef4444' };

  fields = computed(() => this.store.defs().filter((d) => d.type === 'pvfield'));
  states = computed(() => {
    const live = this.store.live(); const f = this.field();
    return this.store.defs().filter((d) => d.type === 'pvgroup' && (f === 'ALL' || d.parentTag === f)).map((g) => live.get(g.tag)).filter((s): s is LiveState => !!s);
  });
  dc = computed(() => this.states().reduce((a, s) => a + s.powerKw, 0));
  avgPr = computed(() => (this.states().length ? this.states().reduce((a, s) => a + s.efficiency, 0) / this.states().length : 0));
  faulty = computed(() => this.states().reduce((a, s) => a + (s.extra['stringsFaulty'] ?? 0), 0));
  warn = computed(() => this.states().filter((s) => s.status !== 'online').length);
  ranked = computed(() => [...this.states()].sort((a, b) => b.efficiency - a.efficiency));
  color = (s: LiveState) => statusColor[s.status];

  bars = computed(() => {
    const st = this.states(); const sel = this.tag();
    return {
      grid: { left: 46, right: 46, top: 34, bottom: 28 }, tooltip: { trigger: 'axis' }, legend: { textStyle: { color: '#8ea0c9' }, top: 0, left: 'center' },
      xAxis: { type: 'category', data: st.map((s) => s.tag.slice(3)), ...axisStyle },
      yAxis: [{ type: 'value', name: 'kW', nameTextStyle: { color: '#8ea0c9' }, ...axisStyle }, { type: 'value', name: 'PR %', max: 110, nameTextStyle: { color: '#8ea0c9' }, ...axisStyle, splitLine: { show: false } }],
      series: [
        { name: 'DC power', type: 'bar', data: st.map((s) => ({ value: +s.powerKw.toFixed(1), itemStyle: { color: s.tag === sel ? '#22d3ee' : statusColor[s.status] } })) },
        { name: 'PR', type: 'line', yAxisIndex: 1, showSymbol: true, lineStyle: { color: '#a78bfa' }, itemStyle: { color: '#a78bfa' }, data: st.map((s) => +s.efficiency.toFixed(1)) },
      ],
    };
  });
  set(p: Record<string, string>) { setQuery(this.router, this.route, p); }
  barClick(p: any) { const s = this.states()[p.dataIndex]; if (s) this.set({ tag: s.tag }); }
}
