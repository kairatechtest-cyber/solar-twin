import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-ack-modal',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="modal-bg" (click)="cancelled.emit()">
      <div class="modal" (click)="$event.stopPropagation()">
        <h2>Acknowledge {{ count() }} alarm{{ count() > 1 ? 's' : '' }}</h2>
        <p class="muted">Your name and the time are recorded in the audit log.</p>
        <input class="input" placeholder="Optional note (e.g. technician dispatched)" maxlength="500" [(ngModel)]="note" (keyup.enter)="go()" autofocus />
        <div class="row" style="margin-top:14px;justify-content:flex-end">
          <button class="btn ghost" (click)="cancelled.emit()">Cancel</button>
          <button class="btn" [disabled]="busy()" (click)="go()">Acknowledge</button>
        </div>
      </div>
    </div>`,
})
export class AckModalComponent {
  count = input(1);
  busy = input(false);
  confirmed = output<string>();
  cancelled = output<void>();
  note = '';
  go() { this.confirmed.emit(this.note); }
}
