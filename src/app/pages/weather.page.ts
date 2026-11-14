import { Component, computed, inject } from '@angular/core';
import { MultiLineComponent, Ser } from '../shared/charts';
import { MetricGridComponent, PageHeadComponent, StatusComponent } from '../shared/bits';
import { FmtPipe } from '../shared/pipes';
import { Store } from '../core/store.service';
import { apiResource } from '../core/resource';
import { metricsFor } from '../core/metrics';

@Component({
  selector: 'app-weather',
  standalone: true,
  imports: [MultiLineComponent, MetricGridComponent, PageHeadComponent, StatusComponent, FmtPipe],
  template: `
    <div class="page">
      @if (ws(); as w) {
        <app-page-head title="Weather Station" sub="Irradiance, temperatures and wind at the plant"><app-status [status]="w.status" /></app-page-head>
        <div class="grid weather-top">
          <div class="card" style="text-align:center">
            <h2>Wind</h2>
            <svg viewBox="0 0 120 120" width="150" height="150">
              <circle cx="60" cy="60" r="52" fill="none" stroke="#2a3d73" stroke-width="2" />
              <text x="60" y="20" text-anchor="middle" fill="#8ea0c9" font-size="10">N</text><text x="104" y="64" text-anchor="middle" fill="#8ea0c9" font-size="10">E</text>
              <text x="60" y="112" text-anchor="middle" fill="#8ea0c9" font-size="10">S</text><text x="16" y="64" text-anchor="middle" fill="#8ea0c9" font-size="10">W</text>
              <g [attr.transform]="'rotate(' + (w.extra['windDir'] ?? 0) + ' 60 60)'"><path d="M60 22 L67 62 L60 56 L53 62 Z" fill="#22d3ee" /></g>
              <text x="60" y="80" text-anchor="middle" fill="#e6edff" font-size="14" font-weight="700">{{ w.extra['windMs'] | fmt:1 }}</text>
              <text x="60" y="92" text-anchor="middle" fill="#8ea0c9" font-size="9">m/s</text>
            </svg>
            <div class="muted">from {{ w.extra['windDir'] | fmt:0 }}°</div>
          </div>
          <div class="card"><h2>Live readings</h2><app-metric-grid [items]="metrics()" [cols]="4" /></div>
        </div>
        <div class="grid g2e mt">
          <div class="card"><h2>Irradiance — today</h2><app-multi-line [series]="irr()" [height]="240" /></div>
          <div class="card"><h2>Temperatures — today</h2><app-multi-line [series]="temp()" [height]="240" /></div>
        </div>
        <div class="card mt"><h2>Wind speed — today</h2><app-multi-line [series]="wind()" [height]="200" /></div>
      } @else { <div class="muted">Loading…</div> }
    </div>`,
})
export class WeatherPage {
  private store = inject(Store);
  ws = computed(() => this.store.snapshot()?.equipment.find((e) => e.type === 'weather'));
  metrics = computed(() => (this.ws() ? metricsFor(this.ws()!) : []));
  private trend = apiResource<any>(() => '/analytics/trends?series=poa,ghi,ambientC,moduleC,windMs&range=today', { every: 60_000 });
  private mk = (key: string, name: string, color: string, unit: string, area = false): Ser =>
    ({ name, unit, color, area, data: (this.trend.data()?.rows ?? []).map((r: any) => [r.t, r[key]] as [number, number]) });
  irr = computed(() => [this.mk('poa', 'POA', '#f59e0b', 'W/m²', true), this.mk('ghi', 'GHI', '#22d3ee', 'W/m²')]);
  temp = computed(() => [this.mk('ambientC', 'Ambient', '#22c55e', '°C'), this.mk('moduleC', 'Module', '#ef4444', '°C')]);
  wind = computed(() => [this.mk('windMs', 'Wind speed', '#a78bfa', 'm/s', true)]);
}
