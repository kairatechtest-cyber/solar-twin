import type { Status, Severity } from './types';

export const fmt = (v: number | undefined | null, d = 1) =>
  v === undefined || v === null || Number.isNaN(v) ? '-' : v.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d });
export const fmtTime = (iso: string | number | null | undefined) =>
  iso ? new Date(iso).toLocaleString([], { hour12: false, month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-';

export const statusColor: Record<Status, string> = { online: '#22c55e', warning: '#f59e0b', fault: '#ef4444', offline: '#64748b', stopped: '#94a3b8' };
export const modeName = (m: number) => ['Idle', 'Charging', 'Discharging'][m] ?? 'Idle';
export const severityColor: Record<Severity, string> = { critical: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };

let ctx: AudioContext | null = null;
export function beep() {
  try {
    ctx ??= new AudioContext();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'square'; o.frequency.value = 880; g.gain.value = 0.04;
    o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.25);
  } catch { /* audio not available */ }
}

export function downloadCsv(name: string, rows: (string | number | null | undefined)[][]) {
  const blob = new Blob([rows.map((r) => r.map((c) => (c ?? '')).join(',')).join('\n')], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
