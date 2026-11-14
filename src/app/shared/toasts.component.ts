import { Component, inject } from '@angular/core';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-toasts',
  standalone: true,
  template: `
    <div class="toasts">
      @for (t of toast.toasts(); track t.id) {
        <div class="toast" [class]="'toast ' + t.kind" (click)="toast.dismiss(t.id)">{{ t.text }}</div>
      }
    </div>`,
})
export class ToastsComponent { toast = inject(ToastService); }
