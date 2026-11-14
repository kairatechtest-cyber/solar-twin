import { computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Api } from './api.service';

/** Signal for one query-string parameter of the current route (e.g. ?tag=PV-03). */
export function queryParam(name: string, fallback: string) {
  const route = inject(ActivatedRoute);
  const qp = toSignal(route.queryParamMap, { initialValue: route.snapshot.queryParamMap });
  return computed(() => qp().get(name) ?? fallback);
}
/** Merge query-string parameters into the current URL (keeps the page, updates the signals above). */
export function setQuery(router: Router, route: ActivatedRoute, params: Record<string, string | null>) {
  router.navigate([], { relativeTo: route, queryParams: params, queryParamsHandling: 'merge' });
}

/**
 * Fetch + optional polling, re-run whenever the signals read inside `path` / `deps` change.
 * Must be called in an injection context (field initialiser or constructor).
 *   const gen = apiResource<Gen>(() => '/analytics/generation?range=' + this.range(), { every: 60000 });
 *   gen.data()  gen.error()
 */
export function apiResource<T = any>(path: () => string | null, opts: { every?: number; deps?: () => unknown } = {}) {
  const api = inject(Api);
  const data = signal<T | null>(null);
  const error = signal('');
  effect((onCleanup) => {
    const p = path();
    opts.deps?.();
    untracked(() => {
      if (!p) { data.set(null); return; }
      let on = true;
      const load = () => api.get<T>(p).subscribe({
        next: (d) => { if (on) { data.set(d); error.set(''); } },
        error: (e) => { console.error('[api]', p, e.message); if (on) error.set(e.message); },
      });
      load();
      const t = opts.every ? setInterval(load, opts.every) : undefined;
      onCleanup(() => { on = false; if (t) clearInterval(t); });
    });
  });
  return { data, error };
}
