/**
 * Maps 3D-model object names -> SCADA tags, groups meshes into toggleable layers, and defines the section "pointers".
 * Written against the Blender outliner of Solar_Pamt.blend:
 *   "Commercial Solar Panel Array", "... Array.001" ... -> PV-01, PV-02 ...      (17 PV groups)
 *   "Inverter1", "Inverter2"                            -> INV-01, INV-02
 *   "MainStation" -> SS-1, "ControlRoom" -> CR-1, "Empty" (grid towers) -> GRID-1
 *   "Electrical box", "Electrical box.001"              -> BESS-1
 *   "WeatherStation"                                    -> WS-1
 *   "Ground", "Fence Segment"                           -> layers only
 * Open the 3D Digital Twin page with ?debug=1 to list every object/mesh name found in the exported GLB, then tweak below.
 */
export interface TagRule { re: RegExp; tag: (m: RegExpMatchArray) => string }
export const TAG_RULES: TagRule[] = [
  { re: /commercial[\s_]*solar[\s_]*panel[\s_]*array(?:[._-]?0*(\d+))?/i, tag: (m) => `PV-${String((m[1] ? +m[1] : 0) + 1).padStart(2, '0')}` },
  { re: /inverter[\s_.-]*0*(\d+)/i, tag: (m) => `INV-${m[1].padStart(2, '0')}` },
  { re: /main[\s_-]*station|substation|switchyard/i, tag: () => 'SS-1' },
  { re: /control[\s_-]*room/i, tag: () => 'CR-1' },
  { re: /^empty(?:[._-]?\d+)?$/i, tag: () => 'GRID-1' }, // the "Empty" with 4 children = transmission towers
  { re: /bess|battery|electrical[\s_.-]*box/i, tag: () => 'BESS-1' },
  { re: /weather|met[\s_-]?station/i, tag: () => 'WS-1' },
];

export interface LayerRule { id: string; label: string; re: RegExp }
export const LAYERS: LayerRule[] = [
  { id: 'panels', label: 'Solar panel arrays', re: /commercial[\s_]*solar[\s_]*panel|panel/i },
  { id: 'inverters', label: 'Inverters', re: /inverter/i },
  { id: 'station', label: 'Main station', re: /main[\s_-]*station|substation/i },
  { id: 'control', label: 'Control room', re: /control[\s_-]*room/i },
  { id: 'towers', label: 'Grid towers', re: /^empty/i },
  { id: 'bess', label: 'BESS', re: /bess|battery|electrical[\s_.-]*box/i },
  { id: 'weather', label: 'Weather station', re: /weather/i },
  { id: 'fences', label: 'Fence', re: /fence/i },
  { id: 'ground', label: 'Ground', re: /^ground|mudground/i },
];

// const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => `PV-${String(a + i).padStart(2, '0')}`);

/** Floating pointers shown in the 3D view. `meshTags` = which tagged meshes the pointer sits on top of.
 *  `anchor` is only a fallback position (offset from another object as a fraction of plant size) used when a model has no mesh for it. */
export interface PointerDef { tag: string; label: string; meshTags?: string[]; anchor?: { tag: string; fx: number; fz: number } }
export const POINTERS: PointerDef[] = [
  // PV field pointers have no meshTags on purpose: they follow the plant topology (the PV groups under the field, backend/src/plant.ts)
  // and sit on the array nearest the middle of the field.
  { tag: 'FLD-A', label: 'PV Field A' },
  { tag: 'FLD-B', label: 'PV Field B' },
  { tag: 'INV-01', label: 'Inverter 1', meshTags: ['INV-01'] },
  { tag: 'INV-02', label: 'Inverter 2', meshTags: ['INV-02'] },
  { tag: 'SS-1', label: 'Main Station', meshTags: ['SS-1'] },
  { tag: 'GRID-1', label: 'Grid towers', meshTags: ['GRID-1'] },
  { tag: 'CR-1', label: 'Control room', meshTags: ['CR-1'] },
  { tag: 'BESS-1', label: 'BESS', meshTags: ['BESS-1'], anchor: { tag: 'CR-1', fx: 0.08, fz: 0.1 } },
  { tag: 'WS-1', label: 'Weather', meshTags: ['WS-1'], anchor: { tag: 'CR-1', fx: -0.08, fz: 0.1 } },
];
