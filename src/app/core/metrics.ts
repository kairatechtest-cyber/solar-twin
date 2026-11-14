import type { AlarmCounts, EquipmentDef, EquipType, LiveState, Severity } from './types';
import { fmt, severityColor, statusColor } from './util';

export interface Metric { label: string; value: string; unit?: string }
const m = (label: string, v: number | undefined, d = 1, unit?: string): Metric => ({ label, value: fmt(v, d), unit });
const MODE = ['Idle', 'Charging', 'Discharging'];
const SETMODE = ['Auto', 'Charge', 'Discharge', 'Idle'];

export function metricsFor(s: LiveState): Metric[] {
  const x = s.extra;
  switch (s.type) {
    case 'pvgroup': return [m('DC power', s.powerKw, 1, 'kW'), m('Performance ratio', s.efficiency, 1, '%'), m('DC voltage', s.dcVoltage, 0, 'V'), m('DC current', s.currentA, 1, 'A'),
      m('Module temp', s.tempC, 1, '°C'), { label: 'Faulty strings', value: `${x.stringsFaulty ?? 0} / ${x.strings ?? 0}` }, m('Soiling loss', x.soilingPct, 1, '%')];
    case 'pvfield': return [m('DC power', s.powerKw, 1, 'kW'), m('Capacity', x.kWp, 0, 'kWp'), m('Performance ratio', s.efficiency, 1, '%'), m('DC voltage', s.dcVoltage, 0, 'V'),
      m('DC current', s.currentA, 0, 'A'), { label: 'Faulty strings', value: String(x.stringsFaulty ?? 0) }];
    case 'inverter': return [m('AC power', s.powerKw, 1, 'kW'), m('DC power', x.dcPowerKw, 1, 'kW'), m('Efficiency', s.efficiency, 1, '%'), m('DC voltage', s.dcVoltage, 0, 'V'),
      m('DC current', s.currentA, 1, 'A'), m('AC voltage', s.acVoltage, 0, 'V'), m('AC current', x.acCurrentA, 1, 'A'), m('Frequency', x.freqHz, 2, 'Hz'),
      m('Power factor', x.pf, 2), m('Temperature', s.tempC, 1, '°C'), m('Energy today', x.energyTodayKwh, 0, 'kWh'), { label: 'Clipping', value: x.clipping ? 'Yes' : 'No' }];
    case 'bess': return [m('State of charge', x.soc, 1, '%'), m('Power', s.powerKw, 1, 'kW'), { label: 'State', value: MODE[x.mode ?? 0] }, { label: 'Control mode', value: SETMODE[x.setMode ?? 0] },
      m('State of health', x.soh, 1, '%'), m('Voltage', x.voltage, 0, 'V'), m('Temperature', s.tempC, 1, '°C'), m('Cycles', x.cycles, 1),
      m('Available energy', x.availableKwh, 0, 'kWh'), m('Charged today', x.chargedTodayKwh, 0, 'kWh'), m('Discharged today', x.dischargedTodayKwh, 0, 'kWh')];
    case 'substation': return [m(s.powerKw >= 0 ? 'Export power' : 'Import power', Math.abs(s.powerKw), 1, 'kW'), m('Transformer load', x.loadPct, 1, '%'), m('Oil temperature', s.tempC, 1, '°C'),
      m('HV voltage', x.voltageKv, 2, 'kV'), m('Frequency', x.frequencyHz, 2, 'Hz'), m('Power factor', x.pf, 2), { label: 'Main breaker', value: x.breaker ? 'Closed' : 'OPEN' }];
    case 'grid': return [m(s.powerKw >= 0 ? 'Export power' : 'Import power', Math.abs(s.powerKw), 1, 'kW'), m('Voltage', x.voltageKv, 2, 'kV'), m('Frequency', x.frequencyHz, 2, 'Hz'),
      m('Power factor', x.pf, 2), m('Exported today', x.exportTodayKwh, 0, 'kWh'), m('Imported today', x.importTodayKwh, 1, 'kWh'), { label: 'Grid', value: x.available ? 'Available' : 'UNAVAILABLE' }];
    case 'weather': return [m('POA irradiance', x.poa, 0, 'W/m²'), m('GHI', x.ghi, 0, 'W/m²'), m('Ambient temp', x.ambientC, 1, '°C'), m('Module temp', x.moduleTempC, 1, '°C'),
      m('Wind speed', x.windMs, 1, 'm/s'), m('Wind direction', x.windDir, 0, '°'), m('Humidity', x.humidity, 0, '%'), m('Pressure', x.pressure, 0, 'hPa')];
    case 'controlroom': return [{ label: 'PLCs online', value: `${x.plcOnline} / ${x.plcTotal}` }, m('Network latency', x.latencyMs, 0, 'ms'), m('UPS charge', x.upsPct, 0, '%'), m('SCADA CPU', x.cpuPct, 0, '%'), m('Room temp', s.tempC, 1, '°C')];
  }
}

/** What the section trend chart should plot, by equipment type. */
export function trendFor(type: EquipType): { key: 'powerKw' | 'tempC' | 'aux'; name: string; unit: string }[] {
  if (type === 'weather') return [{ key: 'aux', name: 'POA irradiance', unit: 'W/m²' }];
  if (type === 'bess') return [{ key: 'powerKw', name: 'Power', unit: 'kW' }, { key: 'aux', name: 'SOC', unit: '%' }];
  if (type === 'controlroom') return [{ key: 'tempC', name: 'Room temp', unit: '°C' }];
  return [{ key: 'powerKw', name: 'Power', unit: 'kW' }];
}

export interface Section { tag: string; label: string; to: string; path: string; params: Record<string, string> }
const RAW_SECTIONS: { tag: string; label: string; to: string }[] = [
  { tag: 'FLD-A', label: 'PV Field A', to: '/pv-field?tag=FLD-A' }, { tag: 'FLD-B', label: 'PV Field B', to: '/pv-field?tag=FLD-B' },
  { tag: 'INV-01', label: 'Inverter Station 1', to: '/inverters?tag=INV-01' }, { tag: 'INV-02', label: 'Inverter Station 2', to: '/inverters?tag=INV-02' },
  { tag: 'BESS-1', label: 'BESS', to: '/bess' }, { tag: 'SS-1', label: 'Main Substation', to: '/substation' }, { tag: 'GRID-1', label: 'Grid Connection', to: '/substation' },
  { tag: 'WS-1', label: 'Weather Station', to: '/weather' }, { tag: 'CR-1', label: 'Control Room', to: '/equipment/CR-1' },
];
export const SECTIONS: Section[] = RAW_SECTIONS.map((x) => {
  const [path, q] = x.to.split('?');
  return { ...x, path, params: Object.fromEntries(new URLSearchParams(q ?? '')) };
});

export function sectionValue(s?: LiveState): string {
  if (!s) return '-';
  switch (s.type) {
    case 'pvfield': return `${fmt(s.powerKw, 0)} kW DC`;
    case 'inverter': return `${fmt(s.powerKw, 0)} kW AC`;
    case 'bess': return `${fmt(s.extra.soc, 0)} % · ${fmt(s.powerKw, 0)} kW`;
    case 'substation': return `${fmt(s.powerKw, 0)} kW`;
    case 'grid': return `${fmt(s.extra.frequencyHz, 2)} Hz`;
    case 'weather': return `${fmt(s.extra.poa, 0)} W/m²`;
    case 'controlroom': return `PLC ${s.extra.plcOnline}/${s.extra.plcTotal}`;
    default: return `${fmt(s.powerKw, 1)} kW`;
  }
}

export function descendants(defs: EquipmentDef[], tag: string): string[] {
  const out: string[] = []; const stack = [tag];
  while (stack.length) { const t = stack.pop()!; for (const d of defs) if (d.parentTag === t) { out.push(d.tag); stack.push(d.tag); } }
  return out;
}

/** Equipment that belongs to a plant section. A PV field includes its PV groups; every other section is just itself
 *  (the hierarchy nests everything under the substation, which must not make it "own" the whole plant's alarms). */
export function memberTags(defs: EquipmentDef[], tag: string): string[] {
  const d = defs.find((x) => x.tag === tag);
  return d?.type === 'pvfield' ? [tag, ...descendants(defs, tag)] : [tag];
}

const RANK: Record<Severity, number> = { critical: 3, warning: 2, info: 1 };
/** Worst active alarm for a section (its own tag + everything below it, e.g. a PV field -> its PV groups). */
export function sectionAlarm(counts: AlarmCounts | undefined, defs: EquipmentDef[], tag: string) {
  let worst: Severity | null = null; let active = 0; let unacked = 0;
  for (const t of memberTags(defs, tag)) {
    const a = counts?.byTag?.[t]; if (!a) continue;
    active += a.active; unacked += a.unacked;
    if (a.worst && (!worst || RANK[a.worst] > RANK[worst])) worst = a.worst;
  }
  return { worst, active, unacked, color: worst ? severityColor[worst] : '#22c55e', label: worst ? worst[0].toUpperCase() + worst.slice(1) : 'Normal' };
}

export const dotColor = (s: LiveState | undefined, worst: Severity | null) => (worst ? severityColor[worst] : s ? statusColor[s.status] : '#64748b');
