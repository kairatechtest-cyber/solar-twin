import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../shared/icon.component';
import { MultiLineComponent, Ser } from '../shared/charts';
import { PageHeadComponent } from '../shared/bits';
import { Store } from '../core/store.service';
import { apiResource } from '../core/resource';
import type { Point } from '../core/types';
import { downloadCsv } from '../core/util';

const CATALOG = [
  { key: 'powerKw', label: 'Active power', unit: 'kW', color: '#22d3ee' }, { key: 'expectedKw', label: 'Expected power', unit: 'kW', color: '#8ea0c9' },
  { key: 'poa', label: 'POA irradiance', unit: 'W/m²', color: '#f59e0b' }, { key: 'ghi', label: 'GHI', unit: 'W/m²', color: '#fbbf24' },
  { key: 'ambientC', label: 'Ambient temp', unit: '°C', color: '#22c55e' }, { key: 'moduleC', label: 'Module temp', unit: '°C', color: '#ef4444' },
  { key: 'bessSoc', label: 'BESS SOC', unit: '%', color: '#a78bfa' }, { key: 'bessKw', label: 'BESS power', unit: 'kW', color: '#c084fc' },
  { key: 'gridKw', label: 'Grid power', unit: 'kW', color: '#3b82f6' }, { key: 'windMs', label: 'Wind speed', unit: 'm/s', color: '#14b8a6' },
  { key: 'prPct', label: 'Performance ratio', unit: '%', color: '#84cc16' }, { key: 'availPct', label: 'Availability', unit: '%', color: '#06b6d4' },
];
const LIVE_KEYS: { k: keyof Point; label: string; unit: string }[] = [
  { k: 'powerKw', label: 'Power', unit: 'kW' }, { k: 'tempC', label: 'Temperature', unit: '°C' }, { k: 'dcVoltage', label: 'Voltage', unit: 'V' },
  { k: 'currentA', label: 'Current', unit: 'A' }, { k: 'aux', label: 'Efficiency / SOC / POA', unit: '' },
];

@Component({
  selector: 'app-trends',
  standalone: true,
  imports: [FormsModule, IconComponent, MultiLineComponent, PageHeadComponent],
  template: `
    <div class="page">
      <app-page-head title="Trends" sub="Compare any plant measurements over time">
        <div class="tabs">
          <button class="tab" [class.on]="mode() === 'plant'" (click)="mode.set('plant')">Plant history</button>
          <button class="tab" [class.on]="mode() === 'live'" (click)="mode.set('live')">Equipment (live, 60 min)</button>
        </div>
        <button class="btn ghost sm" (click)="exportCsv()"><app-icon name="download" [size]="14" /> CSV</button>
      </app-page-head>

      <div class="card" style="margin-bottom:14px">
        @if (mode() === 'plant') {
          <div class="row" style="margin-bottom:10px"><span class="muted">Range</span>
            <div class="tabs">@for (r of ranges; track r[0]) { <button class="tab" [class.on]="range() === r[0]" (click)="range.set(r[0])">{{ r[1] }}</button> }</div></div>
          <div class="row">
            @for (c of catalog; track c.key) {
              <button class="btn sm ghost" [style.border-color]="sel().includes(c.key) ? c.color : ''" [style.color]="sel().includes(c.key) ? c.color : ''" (click)="toggle(c.key)">{{ c.label }}</button>
            }
          </div>
          <div class="muted" style="font-size:12px;margin-top:6px">Pick up to 6 series; different units get their own axis (up to 3 shown).</div>
        } @else {
          <div class="row">
            <select class="input" style="width:220px" [(ngModel)]="tag">@for (d of store.defs(); track d.tag) { <option [value]="d.tag">{{ d.tag }} — {{ d.name }}</option> }</select>
            <select class="input" style="width:230px" [(ngModel)]="metric">@for (k of liveKeys; track k.k) { <option [value]="k.k">{{ k.label }}</option> }</select>
          </div>
        }
      </div>
      <div class="card"><app-multi-line [series]="series()" [height]="420" /></div>
    </div>`,
})
export class TrendsPage {
  store = inject(Store);
  catalog = CATALOG; liveKeys = LIVE_KEYS;
  ranges: [string, string][] = [['today', 'Today'], ['24h', '24 h'], ['week', 'Week'], ['month', 'Month'], ['year', 'Year']];
  mode = signal<'plant' | 'live'>('plant');
  range = signal('today');
  sel = signal<string[]>(['powerKw', 'poa']);
  private _tag = signal('INV-01'); private _metric = signal<keyof Point>('powerKw');
  get tag() { return this._tag(); } set tag(v: string) { this._tag.set(v); }
  get metric() { return this._metric(); } set metric(v: keyof Point) { this._metric.set(v); }

  plant = apiResource<any>(() => (this.mode() === 'plant' && this.sel().length ? `/analytics/trends?series=${this.sel().join(',')}&range=${this.range()}` : null), { every: 60_000 });
  live = apiResource<Point[]>(() => (this.mode() === 'live' ? `/equipment/${this._tag()}/history?minutes=60` : null), { every: 5000 });

  series = computed<Ser[]>(() => {
    if (this.mode() === 'live') {
      const m = LIVE_KEYS.find((k) => k.k === this._metric())!;
      return [{ name: `${this._tag()} ${m.label}`, unit: m.unit, color: '#22d3ee', area: true, data: (this.live.data() ?? []).map((p) => [p.t, +(p[m.k] as number).toFixed(2)] as [number, number]) }];
    }
    return this.sel().map((k) => { const c = CATALOG.find((x) => x.key === k)!;
      return { name: c.label, unit: c.unit, color: c.color, data: (this.plant.data()?.rows ?? []).map((r: any) => [r.t, r[k]] as [number, number | null]) }; });
  });

  toggle(k: string) { this.sel.update((s) => (s.includes(k) ? s.filter((x) => x !== k) : s.length >= 6 ? s : [...s, k])); }
  exportCsv() {
    if (this.mode() === 'plant') downloadCsv(`trend_${this.range()}.csv`, [['time', ...this.sel()], ...(this.plant.data()?.rows ?? []).map((r: any) => [new Date(r.t).toISOString(), ...this.sel().map((k) => r[k])])]);
    else downloadCsv(`trend_${this._tag()}_${String(this._metric())}.csv`, [['time', String(this._metric())], ...(this.live.data() ?? []).map((p) => [new Date(p.t).toISOString(), p[this._metric()] as number])]);
  }
}
