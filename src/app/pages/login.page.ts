import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Api } from '../core/api.service';
import { Store } from '../core/store.service';
import { IconComponent } from '../shared/icon.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, IconComponent],
  template: `
    <div class="login">
      <div class="hero">
        <div class="brand" style="font-size:22px"><app-icon name="sun" [size]="28" /> SolarTwin</div>
        <div class="muted">Digital Twin &amp; SCADA for Solar Power Plants</div>
        <h1>Smarter Operations.<br />A Brighter Tomorrow.</h1>
        <div class="hero-points">
          <span class="pill"><app-icon name="box" [size]="14" /> Live 3D digital twin</span>
          <span class="pill"><app-icon name="bell" [size]="14" /> Alarm management</span>
          <span class="pill"><app-icon name="trend" [size]="14" /> Trends &amp; KPIs</span>
        </div>
      </div>
      <form class="form" (ngSubmit)="submit()">
        <h1 style="margin:0">Welcome back</h1>
        <div class="muted">Sign in to your SolarTwin account</div>
        <label>Email address<input class="input" type="email" name="email" [(ngModel)]="email" required /></label>
        <label>Password<input class="input" type="password" name="password" [(ngModel)]="password" required autofocus /></label>
        @if (err()) { <div style="color:var(--red)">{{ err() }}</div> }
        <button class="btn" type="submit" [disabled]="busy()">{{ busy() ? 'Signing in…' : 'Sign in' }}</button>
        <div class="demo-box">
          <strong>DEMO build – simulated plant data.</strong> Fill in a demo login:
          <div class="row" style="margin-top:6px">
            <button type="button" class="btn sm ghost" (click)="fill('admin', 'Admin&#64;123')">Admin</button>
            <button type="button" class="btn sm ghost" (click)="fill('operator', 'Operator&#64;123')">Operator</button>
            <button type="button" class="btn sm ghost" (click)="fill('viewer', 'Viewer&#64;123')">Viewer</button>
          </div>
        </div>
      </form>
    </div>`,
})
export class LoginPage {
  private api = inject(Api); private store = inject(Store); private router = inject(Router);
  email = 'operator@solartwin.demo'; password = '';
  err = signal(''); busy = signal(false);

  fill(role: string, _label: string) {
    const pw: Record<string, string> = { admin: 'Admin@123', operator: 'Operator@123', viewer: 'Viewer@123' };
    this.email = `${role}@solartwin.demo`; this.password = pw[role];
  }
  submit() {
    this.busy.set(true); this.err.set('');
    this.api.post('/auth/login', { email: this.email, password: this.password }).subscribe({
      next: (r) => { this.store.setAuth(r.token, r.user); this.busy.set(false); this.router.navigateByUrl('/overview'); },
      error: (e) => { this.err.set(e.message); this.busy.set(false); },
    });
  }
}
