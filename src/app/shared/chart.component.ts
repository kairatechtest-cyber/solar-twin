import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, effect, inject, input, output, viewChild } from '@angular/core';
import * as echarts from 'echarts/core';
import { LineChart, BarChart, PieChart, SankeyChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([LineChart, BarChart, PieChart, SankeyChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

export const axisStyle = {
  axisLine: { lineStyle: { color: '#1c2b52' } },
  axisLabel: { color: '#8ea0c9' },
  splitLine: { lineStyle: { color: '#14224a' } },
};

/** Thin ECharts wrapper. `height` is a minimum; inside a stretching flex card the chart grows to fill the card. */
@Component({
  selector: 'app-chart',
  standalone: true,
  template: `<div class="chart-wrap" [style.min-height.px]="height()"><div #el class="chart-el"></div>@if (empty()) {<div class="chart-empty">No data yet</div>}</div>`,
  styles: [`
    :host { display: flex; flex: 1 1 auto; min-width: 0; }
    .chart-wrap { position: relative; flex: 1; width: 100%; }
    .chart-el { position: absolute; inset: 0; }
  `],
})
export class ChartComponent implements AfterViewInit, OnDestroy {
  option = input.required<any>();
  height = input(240);
  empty = input(false);
  chartClick = output<any>();

  private el = viewChild.required<ElementRef<HTMLDivElement>>('el');
  private zone = inject(NgZone);
  private chart?: echarts.ECharts;
  private ro?: ResizeObserver;

  constructor() { effect(() => this.apply(this.option())); }

  ngAfterViewInit() {
    this.zone.runOutsideAngular(() => {
      const c = echarts.init(this.el().nativeElement, undefined, { renderer: 'canvas' });
      this.chart = c;
      c.on('click', (p: any) => this.zone.run(() => this.chartClick.emit(p)));
      this.ro = new ResizeObserver(() => { if (!c.isDisposed()) c.resize(); });
      this.ro.observe(this.el().nativeElement);
    });
    this.apply(this.option());
  }

  private apply(o: any) {
    if (!this.chart) return;
    this.zone.runOutsideAngular(() => this.chart!.setOption({ backgroundColor: 'transparent', animation: false, ...o }, true));
  }

  ngOnDestroy() { this.ro?.disconnect(); this.chart?.dispose(); }
}
