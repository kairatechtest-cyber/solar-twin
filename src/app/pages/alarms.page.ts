import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../shared/icon.component';
import { AckModalComponent } from '../shared/ack-modal.component';
import { AlarmStateComponent, PageHeadComponent, SevComponent } from '../shared/bits';
import { TimePipe } from '../shared/pipes';
import { Api } from '../core/api.service';
import { Store } from '../core/store.service';
import { ToastService } from '../core/toast.service';
import { apiResource } from '../core/resource';
import type { Alarm } from '../core/types';
import { severityColor } from '../core/util';

const PAGE = 100;

@Component({
  selector: 'app-alarms',
  standalone: true,
  imports: [RouterLink, IconComponent, AckModalComponent, AlarmStateComponent, PageHeadComponent, SevComponent, TimePipe],
  template: `
    <div class="page">
      <app-page-head title="Alarms & Events" sub="Acknowledge, filter and export alarm history">
        <button class="btn ghost sm" (click)="exportCsv()"><app-icon name="download" [size]="14" /> Export CSV</button>
      </app-page-head>

      <div class="row" style="margin-bottom:14px">
        <div class="tabs">@for (s of states; track s[0]) { <button class="tab" [class.on]="state() === s[0]" (click)="state.set(s[0])">{{ s[1] }}</button> }</div>
        <div class="tabs">
          <button class="tab" [class.on]="sev() === ''" (click)="sev.set('')">Any severity</button>
          @for (s of sevs; track s) {
            <button class="tab" [class.on]="sev() === s" (click)="sev.set(s)"><i class="dot" [style.background]="color(s)" style="margin-right:6px"></i>{{ s }} ({{ count(s) }})</button>
          }
        </div>
        <div class="search"><app-icon name="search" [size]="14" /><input class="input" placeholder="Search alarms…" (input)="onSearch($any($event.target).value)" /></div>
        <input class="input" style="width:150px" type="date" title="From" (change)="from.set($any($event.target).value)" />
        <input class="input" style="width:150px" type="date" title="To" (change)="to.set($any($event.target).value)" />
      </div>

      <div class="row" style="margin-bottom:10px">
        <button class="btn sm" [disabled]="!store.canOperate() || sel().size === 0" (click)="modal.set([...sel()])">Acknowledge selected ({{ sel().size }})</button>
        <button class="btn sm ghost" [disabled]="!store.canOperate() || ackable().length === 0" (click)="modal.set(ackableIds())">Acknowledge all shown ({{ ackable().length }})</button>
        @if (!store.canOperate()) { <span class="muted">Viewer role: read-only.</span> }
        <span class="sp"></span><span class="muted">{{ rows().length }} of {{ total() }}</span>
      </div>
      @if (res.error()) { <div style="color:var(--red)">{{ res.error() }}</div> }

      <div class="card tbl-wrap"><table>
        <thead><tr>
          <th><input type="checkbox" [checked]="ackable().length > 0 && allSelected()" (change)="toggleAll($any($event.target).checked)" /></th>
          <th>Time</th><th>Severity</th><th>Equipment</th><th>Message</th><th>Value</th><th>State</th><th>Acknowledged by</th><th></th></tr></thead>
        <tbody>
          @if (rows().length === 0) { <tr><td colspan="9" class="muted">No alarms match the current filters.</td></tr> }
          @for (a of rows(); track a.id) {
            <tr [class.unacked-critical]="a.severity === 'critical' && !a.acknowledged && a.active">
              <td><input type="checkbox" [disabled]="a.acknowledged" [checked]="sel().has(a.id)" (change)="toggle(a.id)" /></td>
              <td>{{ a.raisedAt | ftime }}</td><td><app-sev [s]="a.severity" /></td>
              <td><a [routerLink]="['/equipment', a.equipmentTag]">{{ a.equipmentTag }}</a></td>
              <td>{{ a.message }}</td><td class="muted">{{ a.value ?? '-' }}</td><td><app-alarm-state [s]="a.state" /></td>
              <td class="muted">@if (a.ackedBy) { {{ a.ackedBy }} · {{ a.ackedAt | ftime }}@if (a.ackNote) { · "{{ a.ackNote }}" } } @else { - }</td>
              <td><button class="btn sm" [disabled]="!store.canOperate() || a.acknowledged" (click)="modal.set([a.id])">Ack</button></td>
            </tr>
          }
        </tbody>
      </table>
        @if (rows().length < total()) { <div style="text-align:center;padding:10px"><button class="btn ghost sm" (click)="more()">Load more</button></div> }
      </div>

      @if (modal(); as ids) { <app-ack-modal [count]="ids.length" [busy]="busy()" (cancelled)="modal.set(null)" (confirmed)="ack($event)" /> }
    </div>`,
})
export class AlarmsPage {
  store = inject(Store); private api = inject(Api); private toast = inject(ToastService);
  states: [string, string][] = [['', 'All'], ['active', 'Active'], ['acknowledged', 'Acknowledged'], ['resolved', 'Resolved'], ['unacked', 'Unacknowledged']];
  sevs = ['critical', 'warning', 'info'] as const;
  color = (s: 'critical' | 'warning' | 'info') => severityColor[s];

  state = signal('unacked'); sev = signal(''); q = signal(''); from = signal(''); to = signal('');
  sel = signal<Set<number>>(new Set());
  modal = signal<number[] | null>(null);
  busy = signal(false);
  private extra = signal<Alarm[]>([]);
  private timer: any;

  private query = (offset: number) => {
    const p = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
    if (this.state()) p.set('state', this.state()); if (this.sev()) p.set('severity', this.sev()); if (this.q()) p.set('q', this.q());
    if (this.from()) p.set('from', new Date(this.from()).toISOString()); if (this.to()) p.set('to', new Date(this.to() + 'T23:59:59').toISOString());
    return p.toString();
  };
  res = apiResource<{ rows: Alarm[]; total: number }>(() => `/alarms?${this.query(0)}`, { deps: () => this.store.alarmVersion() });
  rows = computed(() => [...(this.res.data()?.rows ?? []), ...this.extra()]);
  total = computed(() => this.res.data()?.total ?? 0);
  ackable = computed(() => this.rows().filter((r) => !r.acknowledged));
  ackableIds = () => this.ackable().map((r) => r.id);
  allSelected = computed(() => this.ackable().every((r) => this.sel().has(r.id)));

  constructor() {
    effect(() => { this.state(); this.sev(); this.q(); this.from(); this.to(); untracked(() => this.sel.set(new Set())); });
    effect(() => { this.res.data(); untracked(() => this.extra.set([])); });
  }
  count(s: 'critical' | 'warning' | 'info') {
    const c = this.store.snapshot()?.alarmCounts; if (!c) return 0;
    return s === 'critical' ? c.unackedCritical : s === 'warning' ? c.unackedWarning : c.unackedInfo;
  }
  onSearch(v: string) { clearTimeout(this.timer); this.timer = setTimeout(() => this.q.set(v), 250); }
  toggle(id: number) { this.sel.update((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  toggleAll(on: boolean) { this.sel.set(on ? new Set(this.ackableIds()) : new Set()); }
  more() { this.api.get<{ rows: Alarm[] }>(`/alarms?${this.query(this.rows().length)}`).subscribe((d) => this.extra.update((e) => [...e, ...d.rows])); }
  exportCsv() {
    this.api.blob(`/alarms/export.csv?${this.query(0)}`).subscribe((blob) => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'alarms.csv'; a.click(); URL.revokeObjectURL(a.href);
    });
  }
  ack(note: string) {
    const ids = this.modal(); if (!ids) return;
    this.busy.set(true);
    this.api.post('/alarms/ack', { ids, note }).subscribe({
      next: (r) => { this.busy.set(false); this.modal.set(null); this.sel.set(new Set()); this.toast.ok(`${r.acknowledged} alarm(s) acknowledged`); },
      error: (e) => { this.busy.set(false); this.toast.error(e.message); },
    });
  }
}
