import { Routes } from '@angular/router';
import { ShellComponent } from './layout/shell.component';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  // { path: 'login', loadComponent: () => import('./pages/login.page').then((m) => m.LoginPage), title: 'Sign in · SolarTwin' },
  {
    path: '', component: ShellComponent, canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      { path: 'overview', loadComponent: () => import('./pages/overview.page').then((m) => m.OverviewPage), title: 'Overview · SolarTwin' },
      { path: 'plant-3d', loadComponent: () => import('./pages/plant3d.page').then((m) => m.Plant3dPage), title: 'Plant 3D View · SolarTwin' },
      { path: 'digital-twin', loadComponent: () => import('./pages/digital-twin.page').then((m) => m.DigitalTwinPage), title: '3D Digital Twin · SolarTwin' },
      { path: 'pv-field', loadComponent: () => import('./pages/pv-field.page').then((m) => m.PvFieldPage), title: 'PV Field · SolarTwin' },
      { path: 'pv-group', loadComponent: () => import('./pages/pv-group.page').then((m) => m.PvGroupPage), title: 'PV Group · SolarTwin' },
      { path: 'inverters', loadComponent: () => import('./pages/inverters.page').then((m) => m.InvertersPage), title: 'Inverter Stations · SolarTwin' },
      { path: 'strings', loadComponent: () => import('./pages/strings.page').then((m) => m.StringsPage), title: 'Strings & Modules · SolarTwin' },
      { path: 'bess', loadComponent: () => import('./pages/bess.page').then((m) => m.BessPage), title: 'BESS · SolarTwin' },
      { path: 'substation', loadComponent: () => import('./pages/substation.page').then((m) => m.SubstationPage), title: 'Substation & Grid · SolarTwin' },
      { path: 'weather', loadComponent: () => import('./pages/weather.page').then((m) => m.WeatherPage), title: 'Weather · SolarTwin' },
      { path: 'alarms', loadComponent: () => import('./pages/alarms.page').then((m) => m.AlarmsPage), title: 'Alarms · SolarTwin' },
      { path: 'trends', loadComponent: () => import('./pages/trends.page').then((m) => m.TrendsPage), title: 'Trends · SolarTwin' },
      { path: 'reports', loadComponent: () => import('./pages/reports.page').then((m) => m.ReportsPage), title: 'Reports & KPIs · SolarTwin' },
      { path: 'maintenance', loadComponent: () => import('./pages/maintenance.page').then((m) => m.MaintenancePage), title: 'Maintenance · SolarTwin' },
      { path: 'equipment/:tag', loadComponent: () => import('./pages/equipment-detail.page').then((m) => m.EquipmentDetailPage), title: 'Equipment · SolarTwin' },
      { path: 'settings', loadComponent: () => import('./pages/settings.page').then((m) => m.SettingsPage), title: 'Settings · SolarTwin' },
    ],
  },
  { path: '**', redirectTo: '' },
];
