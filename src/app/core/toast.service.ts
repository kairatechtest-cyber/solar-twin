import { Injectable, signal } from '@angular/core';

export interface Toast { id: number; kind: 'ok' | 'error' | 'info'; text: string }

@Injectable({ providedIn: 'root' })
export class ToastService {
  toasts = signal<Toast[]>([]);
  private n = 0;
  show(text: string, kind: Toast['kind'] = 'info', ms = 4000) {
    const id = ++this.n;
    this.toasts.update((t) => [...t, { id, kind, text }]);
    setTimeout(() => this.dismiss(id), ms);
  }
  ok(text: string) { this.show(text, 'ok'); }
  error(text: string) { this.show(text, 'error', 6000); }
  dismiss(id: number) { this.toasts.update((t) => t.filter((x) => x.id !== id)); }
}
