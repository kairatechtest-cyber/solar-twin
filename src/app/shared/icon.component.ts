import { Component, computed, input } from '@angular/core';

/** Small stroke-icon set (24x24). Each icon is a list of SVG path strings. */
const ICONS: Record<string, string[]> = {
  grid: ['M4 4h6v6H4z', 'M14 4h6v6h-6z', 'M4 14h6v6H4z', 'M14 14h6v6h-6z'],
  box: ['M12 3l8 4.5v9L12 21l-8-4.5v-9z', 'M12 12l8-4.5', 'M12 12v9', 'M12 12L4 7.5'],
  layers: ['M12 3l9 5-9 5-9-5z', 'M3 12.5l9 5 9-5', 'M3 16.5l9 5 9-5'],
  sun: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M12 2v2', 'M12 20v2', 'M4.9 4.9l1.4 1.4', 'M17.7 17.7l1.4 1.4', 'M2 12h2', 'M20 12h2', 'M4.9 19.1l1.4-1.4', 'M17.7 6.3l1.4-1.4'],
  pv: ['M3 6h18l-2 12H5z', 'M9 6l-1 12', 'M15 6l1 12', 'M4 12h16'],
  cpu: ['M7 7h10v10H7z', 'M10 10h4v4h-4z', 'M9 3v4', 'M15 3v4', 'M9 17v4', 'M15 17v4', 'M3 9h4', 'M3 15h4', 'M17 9h4', 'M17 15h4'],
  strings: ['M4 4h4v6H4z', 'M16 14h4v6h-4z', 'M8 7h4a4 4 0 0 1 4 4v3'],
  battery: ['M3 7h15v10H3z', 'M21 10v4', 'M11 9l-2.5 3.5h3L9.5 15'],
  zap: ['M13 2L4 14h7l-1 8 9-12h-7z'],
  cloud: ['M12 3v1.5', 'M4.6 6.6l1 1', 'M2.5 13H4', 'M19.4 6.6l-1 1', 'M7 13a5 5 0 0 1 10-.5 3.5 3.5 0 0 1 .5 7H8a3.5 3.5 0 0 1-1-6.5z'],
  bell: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'],
  trend: ['M3 17l6-6 4 4 8-8', 'M15 7h6v6'],
  file: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M8 13h8', 'M8 17h8'],
  wrench: ['M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.2-.5-.5-2.2z'],
  cog: ['M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M12 2v3', 'M12 19v3', 'M2 12h3', 'M19 12h3', 'M4.9 4.9l2.1 2.1', 'M17 17l2.1 2.1', 'M4.9 19.1L7 17', 'M17 7l2.1-2.1'],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'],
  search: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'M21 21l-5-5'],
  plus: ['M12 5v14', 'M5 12h14'],
  printer: ['M6 9V3h12v6', 'M6 18H4v-7h16v7h-2', 'M7 14h10v7H7z'],
  gauge: ['M12 14l4-4', 'M3.3 18a9.5 9.5 0 1 1 17.4 0'],
  thermo: ['M14 14V5a2 2 0 0 0-4 0v9a4 4 0 1 0 4 0z'],
  leaf: ['M5 19c0-9 5-14 15-14 0 10-5 15-14 15', 'M5 19l7-7'],
  alert: ['M12 3l10 18H2z', 'M12 10v5', 'M12 18v.5'],
  check: ['M4 12l5 5 11-11'],
  x: ['M6 6l12 12', 'M18 6L6 18'],
  collapse: ['M15 6l-6 6 6 6'],
  expand: ['M9 6l6 6-6 6'],
  wind: ['M3 8h11a3 3 0 1 0-3-3', 'M3 12h16a3 3 0 1 1-3 3', 'M3 16h8'],
  drop: ['M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z'],
  arrow: ['M19 12H5', 'M12 19l-7-7 7-7'],
};

@Component({
  selector: 'app-icon',
  standalone: true,
  template: `<svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">@for (d of paths(); track $index) {<path [attr.d]="d" />}</svg>`,
  styles: [`:host { display: inline-flex; line-height: 0; flex: none; } svg { display: block; }`],
})
export class IconComponent {
  name = input.required<string>();
  size = input(18);
  paths = computed(() => ICONS[this.name()] ?? []);
}
