import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { Alarm, EquipmentDef, Snapshot, User } from './types';

/** Global app state (signals). The WebSocket feed (SocketService) writes `snapshot`, `connected` and alarm events. */
@Injectable({ providedIn: 'root' })
export class Store {
  private router = inject(Router);
  private saved = (() => { try { return JSON.parse(localStorage.getItem('st_auth') ?? 'null'); } catch { return null; } })();

  token = signal<string | null>(this.saved?.token ?? null);
  user = signal<User | null>(this.saved?.user ?? null);
  snapshot = signal<Snapshot | null>(null);
  connected = signal(false);
  defs = signal<EquipmentDef[]>([]);
  alarmVersion = signal(0);
  lastAlarm = signal<{ event: string; alarm: Alarm } | null>(null);
  selectedTag = signal<string | null>(null);
  sceneReady = signal(false);
  sound = signal(localStorage.getItem('st_sound') !== 'off');

  /** tag -> live state */
  live = computed(() => new Map((this.snapshot()?.equipment ?? []).map((e) => [e.tag, e] as const)));
  plant = computed(() => this.snapshot()?.plant ?? null);
  unacked = computed(() => { const c = this.snapshot()?.alarmCounts; return c ? c.unackedCritical + c.unackedWarning + c.unackedInfo : 0; });
  canOperate = computed(() => this.user()?.role !== 'viewer');
  isAdmin = computed(() => this.user()?.role === 'admin');

  setAuth(token: string, user: User) {
    localStorage.setItem('st_auth', JSON.stringify({ token, user }));
    this.token.set(token); this.user.set(user);
  }
  logout() {
    localStorage.removeItem('st_auth');
    this.token.set(null); this.user.set(null); this.snapshot.set(null); this.connected.set(false);
    this.router.navigateByUrl('/login');
  }
  setSound(v: boolean) { localStorage.setItem('st_sound', v ? 'on' : 'off'); this.sound.set(v); }
  select(tag: string | null) { this.selectedTag.set(tag); }
  onAlarm(e: { event: string; alarm: Alarm }) { this.alarmVersion.update((v) => v + 1); this.lastAlarm.set(e); }
}
