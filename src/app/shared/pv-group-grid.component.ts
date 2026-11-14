import { Component, computed, inject, input, output } from '@angular/core';
import { Store } from '../core/store.service';
import { severityColor, statusColor } from '../core/util';
import { FmtPipe } from './pipes';

/** Grid of PV group tiles (live kW + performance ratio); border = alarm severity or status. */
@Component({
  selector: 'app-pv-group-grid',
  standalone: true,
  imports: [FmtPipe],
  template: `
    <div class="pvgrid">
      @for (g of tiles(); track g.tag) {
        <div class="pvtile" [class.sel]="selected() === g.tag" [style.border-left-color]="g.color" (click)="picked.emit(g.tag)" [title]="g.tag + ' · ' + (g.s?.status ?? '')">
          <b>{{ g.tag }}</b>
          <div class="v">{{ g.s?.powerKw | fmt:1 }} <span class="muted" style="font-size:11px">kW</span></div>
          <div class="s">PR {{ g.s?.efficiency | fmt:0 }} % · {{ g.s?.extra?.['stringsFaulty'] ?? 0 }} fault</div>
        </div>
      }
    </div>`,
})
export class PvGroupGridComponent {
  private store = inject(Store);
  field = input('ALL');
  selected = input<string | null>(null);
  picked = output<string>();
  tiles = computed(() => {
    const live = this.store.live(); const by = this.store.snapshot()?.alarmCounts?.byTag ?? {};
    return this.store.defs().filter((d) => d.type === 'pvgroup' && (this.field() === 'ALL' || d.parentTag === this.field())).map((g) => {
      const s = live.get(g.tag); const a = by[g.tag];
      return { tag: g.tag, s, color: a?.worst ? severityColor[a.worst] : s ? statusColor[s.status] : '#64748b' };
    });
  });
}
