import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ChartComponent, axisStyle } from '../shared/chart.component';
import { KpiComponent, PageHeadComponent } from '../shared/bits';
import { FmtPipe } from '../shared/pipes';
import { Store } from '../core/store.service';
import { apiResource, queryParam, setQuery } from '../core/resource';
import type { StringData } from '../core/types';

const ST_COLOR: Record<string, string> = { ok: '#22c55e', low: '#f59e0b', open: '#ef4444' };

@Component({
  selector: 'app-strings',
  standalone: true,
  imports: [ChartComponent, KpiComponent, PageHeadComponent, FmtPipe],
  template: `
    <div class="page">
      <app-page-head title="Strings & Modules" sub="String currents and module-level temperatures per PV group">
        <select class="input" style="width:200px" [value]="group()" (change)="pickGroup($any($event.target).value)">
          @for (g of groups(); track g.tag) { <option [value]="g.tag" [selected]="g.tag === group()">{{ g.name }} ({{ g.parentTag }})</option> }
        </select>
      </app-page-head>

      <div class="grid g4">
        <app-kpi icon="strings" label="Strings" [value]="'' + strings().length" sub="20 modules × 300 Wp each" />
        <app-kpi icon="alert" label="Faulty strings" [value]="'' + faulty()" [color]="faulty() ? '#f59e0b' : '#22c55e'" sub="< 75 % of group median current" />
        <app-kpi icon="zap" label="String voltage" [value]="strings()[0]?.voltageV | fmt:0" unit="V" color="#3b82f6" />
        <app-kpi icon="gauge" label="Group power" [value]="power() | fmt:1" unit="kW" />
      </div>

      <div class="grid g2e mt">
        <div class="card"><h2>String currents (green ok · amber low · red open)</h2><app-chart [option]="bars()" [height]="240" /></div>
        <div class="card tbl-wrap"><h2>Strings <span class="muted" style="font-weight:400">(click a row for its modules)</span></h2>
          <table>
            <thead><tr><th>String</th><th>I (A)</th><th>V</th><th>P (kW)</th><th>Temp</th><th>Dev. %</th><th>Status</th></tr></thead>
            <tbody>
              @for (s of strings(); track s.id) {
                <tr style="cursor:pointer" [style.background]="chosen()?.id === s.id ? '#0f1a38' : ''" (click)="sel.set(s.index)">
                  <td>{{ s.id }}</td><td>{{ s.currentA | fmt:2 }}</td><td>{{ s.voltageV | fmt:0 }}</td><td>{{ s.powerKw | fmt:2 }}</td><td>{{ s.tempC | fmt:1 }}</td><td>{{ s.deviationPct | fmt:0 }}</td>
                  <td [style.color]="stColor[s.status]">{{ s.status }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      @if (chosen(); as c) {
        <div class="card mt">
          <h2>Modules of {{ c.id }} <span class="muted" style="font-weight:400">(simulated from string data; red = hotspot)</span></h2>
          <div class="modgrid">
            @for (m of c.modules; track m.index) {
              <div class="mod" [style.background]="modColor(m.tempC, m.status)" [title]="'Module ' + m.index + ': ' + (m.voltageV | fmt:1) + ' V, ' + (m.tempC | fmt:1) + ' °C, ' + m.status">{{ m.index }}</div>
            }
          </div>
          <div class="muted" style="font-size:12px;margin-top:6px">Colour = module temperature (cool green → warm orange); hotspot modules are red.</div>
        </div>
      }
    </div>`,
})
export class StringsPage {
  private store = inject(Store); private router = inject(Router); private route = inject(ActivatedRoute);
  group = queryParam('tag', 'PV-01');
  sel = signal(0);
  stColor = ST_COLOR;
  private res = apiResource<{ strings: StringData[] }>(() => `/strings/${this.group()}`, { every: 4000 });

  groups = computed(() => this.store.defs().filter((d) => d.type === 'pvgroup'));
  strings = computed(() => this.res.data()?.strings ?? []);
  faulty = computed(() => this.strings().filter((s) => s.status !== 'ok').length);
  power = computed(() => this.strings().reduce((a, s) => a + s.powerKw, 0));
  chosen = computed(() => this.strings()[Math.min(this.sel(), this.strings().length - 1)]);
  bars = computed(() => {
    const st = this.strings();
    return {
      grid: { left: 44, right: 12, top: 20, bottom: 28 }, tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: st.map((s) => 'S' + (s.index + 1)), ...axisStyle },
      yAxis: { type: 'value', name: 'A', nameTextStyle: { color: '#8ea0c9' }, ...axisStyle },
      series: [{ type: 'bar', data: st.map((s) => ({ value: +s.currentA.toFixed(2), itemStyle: { color: ST_COLOR[s.status] } })) }],
    };
  });
  modColor(t: number, status: string) { return status === 'hotspot' ? '#ef4444' : `hsl(${Math.max(0, 140 - (t - 35) * 4)}, 70%, 50%)`; }
  pickGroup(tag: string) { this.sel.set(0); setQuery(this.router, this.route, { tag }); }
}
