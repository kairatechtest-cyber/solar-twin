import { Injectable, inject } from '@angular/core';
import { Store } from './store.service';
import { environment } from '../../environments/environment';
import { beep } from './util';

/** One shared WebSocket with auto-reconnect (exponential backoff). Started/stopped by the shell. */
@Injectable({ providedIn: 'root' })
export class SocketService {
  private store = inject(Store);
  private ws: WebSocket | null = null;
  private timer: any;
  private retry = 0;
  private stopped = true;

  start() {
    if (!this.stopped) return;
    this.stopped = false; this.retry = 0; this.connect();
  }
  stop() {
    this.stopped = true; clearTimeout(this.timer); this.ws?.close(); this.ws = null;
  }

  private connect() {
    const token = this.store.token();
    if (!token || this.stopped) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const base = environment.wsUrl || `${proto}://${location.host}/ws`;
    const ws = new WebSocket(`${base}?token=${encodeURIComponent(token)}`);
    this.ws = ws;
    ws.onopen = () => { this.retry = 0; this.store.connected.set(true); };
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.type === 'snapshot') this.store.snapshot.set(msg.data);
      else if (msg.type === 'alarm') {
        this.store.onAlarm(msg);
        if (msg.event === 'raised' && msg.alarm.severity === 'critical' && this.store.sound()) beep();
      }
    };
    ws.onclose = () => {
      this.store.connected.set(false);
      if (!this.stopped) this.timer = setTimeout(() => this.connect(), Math.min(15000, 1000 * 2 ** this.retry++));
    };
  }
}
