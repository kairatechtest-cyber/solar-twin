import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Store } from './store.service';

export const authGuard: CanActivateFn = () => (inject(Store).token() ? true : inject(Router).parseUrl('/login'));
