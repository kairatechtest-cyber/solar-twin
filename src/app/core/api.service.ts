import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { Store } from './store.service';

/** Adds the JWT to /api calls, logs out on 401 and turns server errors into plain `Error(message)`. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const store = inject(Store);
  const token = store.token();
  const r = token && req.url.startsWith('/api') ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(r).pipe(catchError((e: HttpErrorResponse) => {
    if (e.status === 401 && token) store.logout();
    const msg = (e.error && typeof e.error === 'object' && e.error.error) || e.message || 'Request failed';
    return throwError(() => new Error(msg));
  }));
};

@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);
  get<T = any>(path: string): Observable<T> { return this.http.get<T>('/api' + path); }
  post<T = any>(path: string, body: unknown): Observable<T> { return this.http.post<T>('/api' + path, body); }
  put<T = any>(path: string, body: unknown): Observable<T> { return this.http.put<T>('/api' + path, body); }
  patch<T = any>(path: string, body: unknown): Observable<T> { return this.http.patch<T>('/api' + path, body); }
  blob(path: string): Observable<Blob> { return this.http.get('/api' + path, { responseType: 'blob' }); }
}
