import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

const userTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

/**
 * Attaches the sync JWT (when signed in) and the device timezone. On a 401 the session is simply
 * dropped - there is no login page to send the user to, the app keeps working offline and the
 * Settings sync panel will show "signed out".
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  const headers: Record<string, string> = { 'X-Timezone': userTimeZone() };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const authedReq = req.clone({ setHeaders: headers });

  return next(authedReq).pipe(
    catchError((error) => {
      if (error.status === 401 && authService.isAuthenticated()) {
        authService.logout();
      }
      return throwError(() => error);
    })
  );
};
