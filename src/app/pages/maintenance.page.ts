import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../shared/icon.component';
import { PageHeadComponent } from '../shared/bits';
import { Api } from '../core/api.service';
import { Store } from '../core/store.service';
import { ToastService } from '../core/toast.service';
import { apiResource } from '../core/resource';

interface Task { id: number; equipmentTag: string | null; title: string; kind: string; priority: string; status: string; dueDate: string | null; assignedTo: string | null; notes: string | null }
const today = () => new Date().toISOString().slice(0, 10);

@Component({
  selector: 'app-maintenance',
  standalone: true,
  imports: [FormsModule, IconComponent, PageHeadComponent],
  template: `
    <div class="page">
      <app-page-head title="Maintenance" sub="Preventive, corrective and inspection work orders">
        <button class="btn sm" [disabled]="!store.canOperate()" (click)="show.set(true)"><app-icon name="plus" [size]="14" /> New task</button>
      </app-page-head>

      <div class="grid g4" style="margin-bottom:14px">
        @for (c of counters(); track c.label) { <div class="card"><div class="muted">{{ c.label }}</div><div class="big" [style.color]="c.color">{{ c.value }}</div></div> }
      </div>

      <div class="tabs" style="margin-bottom:12px">@for (s of statuses; track s[0]) { <button class="tab" [class.on]="status() === s[0]" (click)="status.set(s[0])">{{ s[1] }}</button> }</div>

      <div class="card tbl-wrap"><table>
        <thead><tr><th>Task</th><th>Equipment</th><th>Type</th><th>Priority</th><th>Due</th><th>Assigned</th><th>Status</th><th></th></tr></thead>
        <tbody>
          @if (rows().length === 0) { <tr><td colspan="8" class="muted">No tasks.</td></tr> }
          @for (t of rows(); track t.id) {
            <tr>
              <td>{{ t.title }}@if (t.notes) { <div class="muted" style="font-size:12px">{{ t.notes }}</div> }</td>
              <td class="mono">{{ t.equipmentTag ?? '-' }}</td><td>{{ t.kind }}</td><td [class]="'prio-' + t.priority">{{ t.priority }}</td>
              <td [style.color]="overdue(t) ? 'var(--red)' : ''">{{ t.dueDate ? t.dueDate.slice(0, 10) : '-' }}{{ overdue(t) ? ' (overdue)' : '' }}</td>
              <td>{{ t.assignedTo ?? '-' }}</td><td>{{ t.status.replace('_', ' ') }}</td>
              <td><div class="row" style="flex-wrap:nowrap">
                @if (t.status === 'open') { <button class="btn sm ghost" [disabled]="!store.canOperate()" (click)="patch(t.id, { status: 'in_progress' })">Start</button> }
                @if (t.status !== 'done') { <button class="btn sm" [disabled]="!store.canOperate()" (click)="patch(t.id, { status: 'done' })">Complete</button> }
                @else { <button class="btn sm ghost" [disabled]="!store.canOperate()" (click)="patch(t.id, { status: 'open' })">Reopen</button> }
              </div></td>
            </tr>
          }
        </tbody>
      </table></div>

      @if (show()) {
        <div class="modal-bg" (click)="show.set(false)"><div class="modal" (click)="$event.stopPropagation()">
          <h2>New maintenance task</h2>
          <div class="grid" style="gap:8px">
            <input class="input" placeholder="Title" [(ngModel)]="f.title" autofocus />
            <select class="input" [(ngModel)]="f.equipmentTag"><option value="">— equipment (optional) —</option>@for (d of store.defs(); track d.tag) { <option [value]="d.tag">{{ d.tag }} — {{ d.name }}</option> }</select>
            <div class="row">
              <select class="input" style="flex:1" [(ngModel)]="f.kind"><option>preventive</option><option>corrective</option><option>inspection</option></select>
              <select class="input" style="flex:1" [(ngModel)]="f.priority"><option>low</option><option>medium</option><option>high</option></select>
            </div>
            <div class="row"><input class="input" style="flex:1" type="date" [(ngModel)]="f.dueDate" /><input class="input" style="flex:1" placeholder="Assigned to" [(ngModel)]="f.assignedTo" /></div>
            <input class="input" placeholder="Notes" [(ngModel)]="f.notes" />
          </div>
          <div class="row" style="margin-top:14px;justify-content:flex-end"><button class="btn ghost" (click)="show.set(false)">Cancel</button><button class="btn" [disabled]="f.title.length < 3" (click)="create()">Create</button></div>
        </div></div>
      }
    </div>`,
})
export class MaintenancePage {
  store = inject(Store); private api = inject(Api); private toast = inject(ToastService);
  statuses: [string, string][] = [['', 'All'], ['open', 'Open'], ['in_progress', 'In progress'], ['done', 'Done']];
  status = signal(''); show = signal(false); private rev = signal(0);
  all = apiResource<Task[]>(() => '/maintenance', { deps: () => this.rev() });
  rows = computed(() => (this.all.data() ?? []).filter((t) => !this.status() || t.status === this.status()));
  f = { equipmentTag: '', title: '', kind: 'preventive', priority: 'medium', dueDate: today(), assignedTo: '', notes: '' };

  overdue = (t: Task) => t.status !== 'done' && !!t.dueDate && t.dueDate.slice(0, 10) < today();
  counters = computed(() => {
    const a = this.all.data() ?? []; const n = (s: string) => a.filter((t) => t.status === s).length;
    return [{ label: 'Open', value: n('open'), color: '#3b82f6' }, { label: 'In progress', value: n('in_progress'), color: '#f59e0b' },
      { label: 'Overdue', value: a.filter((t) => this.overdue(t)).length, color: '#ef4444' }, { label: 'Done', value: n('done'), color: '#22c55e' }];
  });
  patch(id: number, body: object) {
    this.api.patch(`/maintenance/${id}`, body).subscribe({ next: () => this.rev.update((v) => v + 1), error: (e) => this.toast.error(e.message) });
  }
  create() {
    const b = { ...this.f, equipmentTag: this.f.equipmentTag || null, assignedTo: this.f.assignedTo || null, notes: this.f.notes || null };
    this.api.post('/maintenance', b).subscribe({
      next: () => { this.show.set(false); this.f.title = ''; this.f.notes = ''; this.rev.update((v) => v + 1); this.toast.ok('Task created'); },
      error: (e) => this.toast.error(e.message),
    });
  }
}
