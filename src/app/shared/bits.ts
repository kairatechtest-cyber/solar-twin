import { Component, computed, input } from '@angular/core';
import { IconComponent } from './icon.component';
import type { AlarmState, Severity, Status } from '../core/types';
import { severityColor, statusColor } from '../core/util';

@Component({
  selector: 'app-kpi',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="card kpi" [style.--accent]="color()">
      <div class="ico" [style.color]="color()"><app-icon [name]="icon()" [size]="22" /></div>
      <div class="kpi-body">
        <div class="l">{{ label() }}</div>
        <div class="v">{{ value() }} <span class="u">{{ unit() }}</span></div>
        @if (sub()) { <div class="l sub">{{ sub() }}</div> }
      </div>
    </div>`,
  styles: [`:host { display: block; }`],
})
export class KpiComponent {
  icon = input.required<string>(); label = input.required<string>(); value = input.required<string>();
  unit = input(''); sub = input(''); color = input('#22d3ee');
}

@Component({
  selector: 'app-ring',
  standalone: true,
  template: `
    <div class="ringbox">
      <div class="ring" [style.background]="bg()"><div class="ring-in"><b>{{ value() }}</b></div></div>
      <div class="muted ring-l">{{ label() }}</div>
    </div>`,
})
export class RingComponent {
  pct = input(0); value = input.required<string>(); label = input.required<string>(); color = input('#22d3ee');
  bg = computed(() => `conic-gradient(${this.color()} ${Math.max(0, Math.min(100, this.pct() || 0)) * 3.6}deg, #14224a 0)`);
}

@Component({
  selector: 'app-alarm-chip',
  standalone: true,
  template: `<span class="pill" [style.border-color]="color() + '88'"><i class="dot" [class.pulse]="unacked() > 0" [style.background]="color()"></i>{{ label() }}@if (unacked() > 0) { <b [style.color]="color()"> ·{{ unacked() }}</b> }</span>`,
})
export class AlarmChipComponent {
  color = input.required<string>(); label = input.required<string>(); unacked = input(0);
}

@Component({
  selector: 'app-metric-grid',
  standalone: true,
  template: `
    <div class="mgrid" [style.grid-template-columns]="'repeat(' + cols() + ', 1fr)'">
      @for (m of items(); track m.label) {
        <div class="mtile"><div class="muted">{{ m.label }}</div><div class="mv">{{ m.value }} <span class="muted">{{ m.unit }}</span></div></div>
      }
    </div>`,
})
export class MetricGridComponent {
  items = input.required<{ label: string; value: string; unit?: string }[]>(); cols = input(2);
}

@Component({
  selector: 'app-status',
  standalone: true,
  template: `<span class="pill"><i class="dot" [style.background]="color()"></i>{{ status() }}</span>`,
})
export class StatusComponent {
  status = input.required<Status>();
  color = computed(() => statusColor[this.status()] ?? '#64748b');
}

@Component({
  selector: 'app-sev',
  standalone: true,
  template: `<span class="sev"><i class="dot" [style.background]="color()"></i>{{ text() }}</span>`,
})
export class SevComponent {
  s = input.required<Severity>();
  color = computed(() => severityColor[this.s()]);
  text = computed(() => this.s()[0].toUpperCase() + this.s().slice(1));
}

const LABELS: Record<AlarmState, string> = { active: 'Active', acknowledged: 'Acknowledged', resolved: 'Resolved', resolved_unacked: 'Resolved · unacked' };
@Component({
  selector: 'app-alarm-state',
  standalone: true,
  template: `<span [class]="'st-' + s()">{{ label() }}</span>`,
})
export class AlarmStateComponent {
  s = input.required<AlarmState>();
  label = computed(() => LABELS[this.s()]);
}

/** Page title with optional subtitle and a right-aligned action slot. */
@Component({
  selector: 'app-page-head',
  standalone: true,
  template: `<div class="page-head"><div><h1>{{ title() }}</h1>@if (sub()) {<div class="muted">{{ sub() }}</div>}</div><div class="sp"></div><div class="row"><ng-content /></div></div>`,
})
export class PageHeadComponent { title = input.required<string>(); sub = input(''); }
