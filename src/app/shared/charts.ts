import { Component, computed, input } from '@angular/core';
import { ChartComponent, axisStyle } from './chart.component';
import type { Flow } from '../core/types';

export interface Ser { name: string; color: string; data: [number, number | null][]; unit?: string; area?: boolean; dashed?: boolean; step?: boolean; bar?: boolean }

/** Generic time-series chart. Series with different units get their own y axis (max 3). */
@Component({
  selector: 'app-multi-line',
  standalone: true,
  imports: [ChartComponent],
  template: `<app-chart [option]="option()" [height]="height()" [empty]="empty()" />`,
  styles: [`:host { display: flex; flex: 1 1 auto; min-width: 0; }`],
})
export class MultiLineComponent {
  series = input.required<Ser[]>();
  height = input(240);
  empty = computed(() => this.series().length === 0 || this.series().every((s) => s.data.length === 0));
  option = computed(() => {
    const series = this.series();
    const units = [...new Set(series.map((s) => s.unit ?? ''))].slice(0, 3);
    if (units.length === 0) units.push(''); // ECharts crashes on an x-axis without any y-axis
    return {
      grid: { left: 52, right: units.length > 1 ? 52 : 14, top: series.length > 1 ? 46 : 24, bottom: 26 },
      legend: series.length > 1 ? { textStyle: { color: '#8ea0c9' }, top: 0, left: 'center' } : undefined,
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'time', ...axisStyle },
      yAxis: units.map((u, i) => ({ type: 'value', name: u, position: i === 0 ? 'left' : 'right', offset: i === 2 ? 46 : 0, nameTextStyle: { color: '#8ea0c9' }, ...axisStyle, splitLine: i === 0 ? axisStyle.splitLine : { show: false } })),
      series: series.map((s) => ({
        name: s.name, type: s.bar ? 'bar' : 'line', showSymbol: false, smooth: !s.step && !s.bar, step: s.step ? 'end' : undefined,
        yAxisIndex: Math.max(0, units.indexOf(s.unit ?? '')), lineStyle: { color: s.color, width: 2, type: s.dashed ? 'dashed' : 'solid' },
        itemStyle: { color: s.color }, areaStyle: s.area ? { color: s.color + '2e' } : undefined, data: s.data,
      })),
    };
  });
}

/** Sankey energy-flow diagram (kW) from the live flow numbers. */
@Component({
  selector: 'app-energy-flow',
  standalone: true,
  imports: [ChartComponent],
  template: `<app-chart [option]="option()" [height]="height()" [empty]="empty()" />`,
  styles: [`:host { display: flex; flex: 1 1 auto; min-width: 0; }`],
})
export class EnergyFlowComponent {
  flow = input<Flow | undefined | null>(null);
  height = input(280);
  empty = computed(() => { const f = this.flow(); return !f || f.pvDcKw + f.fromGridKw + f.fromBessKw < 0.05; });
  option = computed(() => {
    const f = this.flow(); const links: { source: string; target: string; value: number }[] = [];
    if (f) {
      const add = (source: string, target: string, v: number) => { if (v > 0.05) links.push({ source, target, value: +v.toFixed(1) }); };
      const aux = Math.min(f.auxKw, f.invAcKw);
      add('PV Field', 'Inverters', f.pvDcKw); add('Inverters', 'Conversion loss', f.lossKw); add('Inverters', 'BESS', f.toBessKw);
      add('Inverters', 'Site load', aux); add('Inverters', 'Grid', f.invAcKw - f.toBessKw - aux); add('BESS', 'Grid', f.fromBessKw); add('Grid', 'Site load', f.fromGridKw);
    }
    const colors: Record<string, string> = { 'PV Field': '#f59e0b', Inverters: '#3b82f6', BESS: '#22c55e', Grid: '#22d3ee', 'Site load': '#a78bfa', 'Conversion loss': '#64748b' };
    const names = [...new Set(links.flatMap((l) => [l.source, l.target]))];
    return {
      tooltip: { trigger: 'item', valueFormatter: (v: number) => `${v} kW` },
      series: [{ type: 'sankey', left: 4, right: 70, top: 8, bottom: 8, nodeWidth: 14, nodeGap: 14, emphasis: { focus: 'adjacency' },
        label: { color: '#e6edff', formatter: '{b}' }, lineStyle: { color: 'gradient', opacity: 0.45, curveness: 0.5 },
        data: names.map((n) => ({ name: n, itemStyle: { color: colors[n] } })), links }],
    };
  });
}
