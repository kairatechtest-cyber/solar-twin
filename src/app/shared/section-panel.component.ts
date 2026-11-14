import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { MultiLineComponent, Ser } from './charts';
import { AlarmChipComponent, MetricGridComponent, SevComponent, StatusComponent } from './bits';
import { TimePipe } from './pipes';
import { Store } from '../core/store.service';
import { apiResource } from '../core/resource';
import { SECTIONS, memberTags, metricsFor, sectionAlarm, trendFor } from '../core/metrics';
import type { Alarm, Point } from '../core/types';

const COLORS = ['#22d3ee', '#22c55e', '#f59e0b'];

/** Data panel for whatever plant section / PV group / equipment is selected. */
@Component({
  selector: 'app-section-panel',
  standalone: true,
  imports: [MultiLineComponent, AlarmChipComponent, MetricGridComponent, SevComponent, StatusComponent, TimePipe],
  template: `
    @if (live(); as l) {
      <div class="row"><h2 style="margin:0">{{ def()?.name }}</h2><span class="muted mono">{{ tag() }}</span><span class="sp"></span><app-status [status]="l.status" /></div>
      <div class="row" style="margin:8px 0">
        <app-alarm-chip [color]="al().color" [label]="al().label" [unacked]="al().unacked" />
        <span class="muted">{{ al().active }} active alarm{{ al().active === 1 ? '' : 's' }}</span>
      </div>
      <app-metric-grid [items]="metrics()" />
      <h2 style="margin-top:12px">Last 30 minutes</h2>
      <div class="mini-chart"><app-multi-line [series]="series()" [height]="150" /></div>
      <h2>Active alarms</h2>
      @if (alarms().length === 0) { <div class="muted">No active alarms.</div> }
      @for (a of alarms(); track a.id) {
        <div class="row" style="font-size:13px;padding:3px 0"><app-sev [s]="a.severity" /><span class="mono">{{ a.equipmentTag }}</span><span>{{ a.message }}</span><span class="sp"></span><span class="muted">{{ a.raisedAt | ftime }}</span></div>
      }
      <button class="btn sm ghost" style="margin-top:10px" (click)="open()">Open full page →</button>
    } @else {
      <div class="muted" style="padding:16px">Select a plant section, a pointer in the 3D view, or a PV group to see its data.</div>
    }`,
})
export class SectionPanelComponent {
  private store = inject(Store);
  private router = inject(Router);
  tag = input<string | null>(null);

  private hist = apiResource<Point[]>(() => (this.tag() ? `/equipment/${this.tag()}/history?minutes=30` : null), { every: 5000 });
  private cur = apiResource<{ rows: Alarm[] }>(() => (this.tag() ? '/alarms?state=current&limit=100' : null), { deps: () => this.store.alarmVersion(), every: 15000 });

  def = computed(() => this.store.defs().find((d) => d.tag === this.tag()));
  live = computed(() => (this.tag() ? this.store.live().get(this.tag()!) : undefined));
  metrics = computed(() => (this.live() ? metricsFor(this.live()!) : []));
  al = computed(() => sectionAlarm(this.store.snapshot()?.alarmCounts, this.store.defs(), this.tag() ?? ''));
  series = computed<Ser[]>(() => {
    const l = this.live(); if (!l) return [];
    return trendFor(l.type).map((t, i) => ({ name: t.name, unit: t.unit, color: COLORS[i], area: i === 0,
      data: (this.hist.data() ?? []).map((p) => [p.t, +p[t.key].toFixed(2)] as [number, number]) }));
  });
  alarms = computed(() => {
    const tags = new Set(memberTags(this.store.defs(), this.tag() ?? ''));
    return (this.cur.data()?.rows ?? []).filter((a) => tags.has(a.equipmentTag)).slice(0, 5);
  });

  open() {
    const t = this.tag(); if (!t) return;
    const sec = SECTIONS.find((s) => s.tag === t);
    if (sec) this.router.navigate([sec.path], { queryParams: sec.params });
    else if (this.def()?.type === 'pvgroup') this.router.navigate(['/pv-group'], { queryParams: { tag: t } });
    else this.router.navigate(['/equipment', t]);
  }
}
