export type Role = 'viewer' | 'operator' | 'admin';
export interface User { id: number; email: string; name: string; role: Role }
export type Status = 'online' | 'warning' | 'fault' | 'offline' | 'stopped';
export type EquipType = 'pvgroup' | 'pvfield' | 'inverter' | 'bess' | 'substation' | 'grid' | 'weather' | 'controlroom';
export type Severity = 'critical' | 'warning' | 'info';

export interface LiveState {
  tag: string; type: EquipType; status: Status;
  powerKw: number; dcVoltage: number; acVoltage: number; currentA: number; tempC: number; efficiency: number;
  ratedKw: number; faultKind: string | null; extra: Record<string, number>;
}
export interface PlantSummary {
  name: string; demo: boolean; powerKw: number; capacityAcKw: number; capacityKwp: number; expectedKw: number;
  poa: number; ghi: number; ambientC: number; moduleTempC: number; windMs: number; energyTodayKwh: number;
  prPct: number; availabilityPct: number; bessSoc: number; bessKw: number; bessMode: number; gridKw: number; auxKw: number; co2Tons: number;
  counts: { online: number; warning: number; offline: number };
}
export interface Flow { pvDcKw: number; invAcKw: number; lossKw: number; toBessKw: number; fromBessKw: number; auxKw: number; toGridKw: number; fromGridKw: number }
export interface TagAlarm { worst: Severity | null; active: number; unacked: number }
export interface AlarmCounts { unackedCritical: number; unackedWarning: number; unackedInfo: number; open: number; byTag: Record<string, TagAlarm> }
export interface Snapshot { ts: number; plant: PlantSummary; flow: Flow; equipment: LiveState[]; alarmCounts: AlarmCounts }

export type AlarmState = 'active' | 'acknowledged' | 'resolved' | 'resolved_unacked';
export interface Alarm {
  id: number; equipmentTag: string; code: string; severity: Severity; message: string; value: string | null;
  state: AlarmState; active: boolean; acknowledged: boolean;
  raisedAt: string; ackedAt: string | null; ackedBy: string | null; ackNote: string | null; clearedAt: string | null;
}
export interface EquipmentDef {
  tag: string; name: string; type: EquipType; parentTag: string | null; ratedKw: number; meta: Record<string, string>; live?: LiveState;
}
export interface Point { t: number; powerKw: number; tempC: number; dcVoltage: number; currentA: number; aux: number }
export interface StringData {
  id: string; index: number; currentA: number; voltageV: number; powerKw: number; tempC: number; status: 'ok' | 'low' | 'open'; deviationPct: number;
  modules: { index: number; voltageV: number; tempC: number; status: 'ok' | 'degraded' | 'hotspot' }[];
}
