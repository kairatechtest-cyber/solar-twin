import { Component, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IconComponent } from '../shared/icon.component';
import { Store } from '../core/store.service';
import { Api } from '../core/api.service';
import { SocketService } from '../core/socket.service';

interface NavItem { to: string; label: string; icon: string; alarm?: boolean; external?: boolean; }

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  template: `
    <div class="shell" [class.collapsed]="collapsed()">
      @if (menu()) { <div class="backdrop" (click)="menu.set(false)"></div> }

      <aside class="sidebar" [class.open]="menu()">
        <div class="brand"><app-icon name="sun" [size]="24" /><span class="nav-t">SolarTwin</span></div>
        @for (i of main; track i.label) {
          @if (i.external) {
            <a class="nav nav-external" [href]="i.to"(click)="menu.set(false)" [title]="i.label">
              <app-icon [name]="i.icon" /><span class="nav-t">{{ i.label }}
                </span>
          </a>
          } @else {
          <a class="nav" [routerLink]="i.to" routerLinkActive="active" (click)="menu.set(false)" [title]="i.label">
            <app-icon [name]="i.icon" /><span class="nav-t">{{ i.label }}</span>
          </a>
        }
      }

        <div class="navgroup">Analysis</div>
        @for (i of analysis; track i.to) {
          <a class="nav" [routerLink]="i.to" routerLinkActive="active" (click)="menu.set(false)" [title]="i.label">
            <app-icon [name]="i.icon" /><span class="nav-t">{{ i.label }}</span>
            @if (i.alarm && store.unacked() > 0) { <span class="badge nav-badge" [class.blink]="critical()">{{ store.unacked() }}</span> }
          </a>
        }
        <div class="sp"></div>
        <a class="nav" routerLink="/settings" routerLinkActive="active" (click)="menu.set(false)" title="Settings"><app-icon name="cog" /><span class="nav-t">Settings</span></a>
        <button class="nav" (click)="store.logout()" title="Sign out"><app-icon name="logout" /><span class="nav-t">Sign out</span></button>
      </aside>

      <header class="topbar">
        <button class="icon-btn menu-btn" (click)="menu.set(true)" aria-label="Menu"><app-icon name="menu" [size]="20" /></button>
        <button class="icon-btn collapse-btn" (click)="toggleCollapse()" aria-label="Collapse sidebar"><app-icon [name]="collapsed() ? 'expand' : 'collapse'" [size]="18" /></button>
        <strong class="hide-sm">{{ store.plant()?.name ?? 'Connecting…' }}</strong>
        <span class="pill demo-chip">DEMO DATA</span>
        <span class="pill"><i class="dot" [style.background]="store.connected() ? 'var(--green)' : 'var(--red)'"></i>{{ store.connected() ? 'Live' : 'Reconnecting…' }}</span>
        <span class="sp"></span>
        <a routerLink="/alarms" class="pill alarm-pill" title="Unacknowledged alarms"><app-icon name="bell" [size]="14" /> {{ store.unacked() }} unacked @if (critical()) { <span class="badge blink">!</span> }</a>
        <span class="muted mono hide-sm">{{ clock() }}</span>
        <span class="pill hide-sm">{{ store.user()?.name }} · {{ store.user()?.role }}</span>
      </header>

      <main class="main"><router-outlet /></main>
    </div>`,
     styles: [`	 
    .nav-external {	 
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);	 
      margin-bottom: 4px;	 
      transition: background-color 0.2s ease, color 0.2s ease;	 
    }	 
    .nav-external:hover {	 
      background-color: rgba(245, 158, 11, 0.15); /* Distinct amber/gold tint */	 
      color: #fbbf24;	 
    }	 
  `]
})

export class ShellComponent {
  store = inject(Store);
  private api = inject(Api);
  private socket = inject(SocketService);

  menu = signal(false);
  collapsed = signal(localStorage.getItem('st_collapsed') === '1');
  clock = signal(new Date().toLocaleString([], { hour12: false }));
  critical = () => (this.store.snapshot()?.alarmCounts.unackedCritical ?? 0) > 0;

  main: NavItem[] = [
    { to: 'https://dashboard.kaira-technologies.com/dashboard', label: 'Main Dashboard', icon: 'arrow', external: true },
    { to: '/overview', label: 'Overview', icon: 'grid' },
    { to: '/plant-3d', label: 'Plant 3D View', icon: 'box' },
    { to: '/digital-twin', label: '3D Digital Twin', icon: 'layers' },
    { to: '/pv-field', label: 'PV Field', icon: 'sun' },
    { to: '/pv-group', label: 'PV Group', icon: 'pv' },
    { to: '/inverters', label: 'Inverter Stations', icon: 'cpu' },
    { to: '/strings', label: 'Strings & Modules', icon: 'strings' },
    { to: '/bess', label: 'BESS', icon: 'battery' },
    { to: '/substation', label: 'Substation & Grid', icon: 'zap' },
    { to: '/weather', label: 'Weather', icon: 'cloud' },
  ];
  analysis: NavItem[] = [
    { to: '/alarms', label: 'Alarms', icon: 'bell', alarm: true },
    { to: '/trends', label: 'Trends', icon: 'trend' },
    { to: '/reports', label: 'Reports & KPIs', icon: 'file' },
    { to: '/maintenance', label: 'Maintenance', icon: 'wrench' },
  ];

  constructor() {
    const t = setInterval(() => this.clock.set(new Date().toLocaleString([], { hour12: false })), 1000);
    inject(DestroyRef).onDestroy(() => { clearInterval(t); this.socket.stop(); });
    effect(() => {
      if (!this.store.token()) return;
      untracked(() => {
        this.socket.start();
        this.api.get('/equipment').subscribe({ next: (d) => this.store.defs.set(d), error: () => {} });
        this.api.get('/snapshot').subscribe({ next: (s) => { if (s) this.store.snapshot.set(s); }, error: () => {} });
      });
    });
  }

  toggleCollapse() { this.collapsed.update((v) => !v); localStorage.setItem('st_collapsed', this.collapsed() ? '1' : '0'); }
}
