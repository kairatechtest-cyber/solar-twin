import { Component, computed, inject } from '@angular/core';
import { MultiLineComponent, Ser } from '../shared/charts';
import { AlarmChipComponent, MetricGridComponent, PageHeadComponent, StatusComponent } from '../shared/bits';
import { Store } from '../core/store.service';
import { apiResource } from '../core/resource';
import { metricsFor, sectionAlarm } from '../core/metrics';
import { fmt } from '../core/util';

/** Single-line diagram with live values; animated dashes = power flowing. */
@Component({
  selector: 'app-sld',
  standalone: true,
  template: `
    <svg class="sld" viewBox="0 0 860 300" style="width:100%">
      <path [class]="wire(i1()?.powerKw)" d="M130 50 H200 V120" /><path [class]="wire(i2()?.powerKw)" d="M130 150 H200 V120" />
      <path [class]="wire(1)" d="M200 120 H300" /><path [class]="wire(b()?.powerKw)" d="M250 120 V230 H300" />
      <path [class]="wire(1)" d="M410 120 H470" /><path [class]="wire(grid())" d="M590 120 H650" /><path [class]="wire(grid())" d="M750 120 H800" />

      <g><rect class="box" x="20" y="27" width="110" height="46" rx="8" /><text x="75" y="46" text-anchor="middle">PV Field A</text><text class="lbl" x="75" y="62" text-anchor="middle">{{ t('FLD-A', 'powerKw') }} kW DC</text></g>
      <g><rect class="box" x="20" y="127" width="110" height="46" rx="8" /><text x="75" y="146" text-anchor="middle">PV Field B</text><text class="lbl" x="75" y="162" text-anchor="middle">{{ t('FLD-B', 'powerKw') }} kW DC</text></g>
      <g><rect class="box" x="160" y="70" width="80" height="46" rx="8" /><text x="200" y="89" text-anchor="middle">Inverters</text><text class="lbl" x="200" y="105" text-anchor="middle">{{ f(store.plant()?.powerKw) }} kW AC</text></g>
      <g><rect class="box" x="300" y="97" width="110" height="46" rx="8" /><text x="355" y="116" text-anchor="middle">LV bus 0.4 kV</text><text class="lbl" x="355" y="132" text-anchor="middle">{{ f(i1()?.acVoltage || i2()?.acVoltage) }} V</text></g>
      <g><rect class="box" x="300" y="207" width="110" height="46" rx="8" /><text x="355" y="226" text-anchor="middle">BESS</text><text class="lbl" x="355" y="242" text-anchor="middle">{{ f(b()?.extra?.['soc']) }} % · {{ f(b()?.powerKw) }} kW</text></g>
      <g><rect class="box" x="470" y="97" width="120" height="46" rx="8" /><text x="530" y="116" text-anchor="middle">Transformer</text><text class="lbl" x="530" y="132" text-anchor="middle">{{ f(ss()?.extra?.['loadPct']) }} % · {{ f(ss()?.tempC) }} °C</text></g>
      <g><rect x="612" y="110" width="14" height="20" rx="2" [attr.fill]="ss()?.extra?.['breaker'] ? '#22c55e' : '#ef4444'" /><text class="lbl" x="619" y="150" text-anchor="middle">{{ ss()?.extra?.['breaker'] ? 'CB closed' : 'CB OPEN' }}</text></g>
      <g><rect class="box" x="650" y="97" width="100" height="46" rx="8" /><text x="700" y="116" text-anchor="middle">HV bus 11 kV</text><text class="lbl" x="700" y="132" text-anchor="middle">{{ fmt(ss()?.extra?.['voltageKv'], 2) }} kV</text></g>
      <g><rect class="box" x="800" y="97" width="50" height="46" rx="8" /><text x="825" y="116" text-anchor="middle">Grid</text><text class="lbl" x="825" y="132" text-anchor="middle">{{ fmt(gr()?.extra?.['frequencyHz'], 2) }}</text></g>
    </svg>`,
})
export class SldComponent {
  store = inject(Store);
  i1 = computed(() => this.store.live().get('INV-01')); i2 = computed(() => this.store.live().get('INV-02'));
  b = computed(() => this.store.live().get('BESS-1')); ss = computed(() => this.store.live().get('SS-1')); gr = computed(() => this.store.live().get('GRID-1'));
  grid = computed(() => this.store.plant()?.gridKw);
  wire = (v?: number | null) => 'wire' + (Math.abs(v ?? 0) > 0 ? ' flow' : '');
  f = (v?: number | null) => fmt(v, 0);
  fmt = fmt;
  t = (tag: string, k: 'powerKw') => fmt(this.store.live().get(tag)?.[k], 0);
}

@Component({
  selector: 'app-substation',
  standalone: true,
  imports: [SldComponent, MultiLineComponent, AlarmChipComponent, MetricGridComponent, PageHeadComponent, StatusComponent],
  template: `
    <div class="page">
      <app-page-head title="Substation & Grid" sub="Main station, transformer and utility connection" />
      <div class="card"><h2>Single-line diagram (live)</h2><app-sld /></div>
      @if (ss(); as s) { @if (gr(); as g) {
        <div class="grid g2e mt">
          <div class="card"><div class="row"><h2 style="margin:0">Main substation</h2><app-status [status]="s.status" /><app-alarm-chip [color]="a1().color" [label]="a1().label" [unacked]="a1().unacked" /></div>
            <div style="margin-top:10px"><app-metric-grid [items]="m1()" [cols]="3" /></div></div>
          <div class="card"><div class="row"><h2 style="margin:0">Grid connection</h2><app-status [status]="g.status" /><app-alarm-chip [color]="a2().color" [label]="a2().label" [unacked]="a2().unacked" /></div>
            <div style="margin-top:10px"><app-metric-grid [items]="m2()" [cols]="3" /></div></div>
        </div>
      } }
      <div class="card mt"><h2>Grid exchange — today</h2><app-multi-line [series]="series()" [height]="260" /></div>
    </div>`,
})
export class SubstationPage {
  store = inject(Store);
  ss = computed(() => this.store.live().get('SS-1')); gr = computed(() => this.store.live().get('GRID-1'));
  m1 = computed(() => (this.ss() ? metricsFor(this.ss()!) : [])); m2 = computed(() => (this.gr() ? metricsFor(this.gr()!) : []));
  a1 = computed(() => sectionAlarm(this.store.snapshot()?.alarmCounts, this.store.defs(), 'SS-1'));
  a2 = computed(() => sectionAlarm(this.store.snapshot()?.alarmCounts, this.store.defs(), 'GRID-1'));
  private trend = apiResource<any>(() => '/analytics/trends?series=gridKw,powerKw&range=today', { every: 60_000 });
  series = computed<Ser[]>(() => [
    { name: 'Grid (+export / −import)', unit: 'kW', color: '#22d3ee', area: true, data: (this.trend.data()?.rows ?? []).map((r: any) => [r.t, r.gridKw] as [number, number]) },
    { name: 'PV AC output', unit: 'kW', color: '#f59e0b', dashed: true, data: (this.trend.data()?.rows ?? []).map((r: any) => [r.t, r.powerKw] as [number, number]) },
  ]);
}
