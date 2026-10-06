import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

const userTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getToken();

  // The server computes "today", streaks and trends in the user's timezone, so tell it which one.
  const headers: Record<string, string> = { 'X-Timezone': userTimeZone() };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const authedReq = req.clone({ setHeaders: headers });

  return next(authedReq).pipe(
    catchError((error) => {
      if (error.status === 401 && authService.isAuthenticated()) {
        authService.logout();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
