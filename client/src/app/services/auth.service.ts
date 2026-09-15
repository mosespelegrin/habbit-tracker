import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

const TOKEN_KEY = 'habitTrackerToken';
const EMAIL_KEY = 'habitTrackerEmail';

interface AuthResponse {
  token: string;
  email: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiBaseUrl = window.location.port === '4200' ? 'http://localhost:3000/api' : '/api';
  private url = `${this.apiBaseUrl}/auth`;

  readonly email = signal<string | null>(this.safeGet(EMAIL_KEY));
  readonly isAuthenticated = signal<boolean>(!!this.safeGet(TOKEN_KEY));

  constructor(private httpClient: HttpClient) { }

  register(email: string, password: string): Observable<AuthResponse> {
    return this.httpClient.post<AuthResponse>(`${this.url}/register`, { email, password }).pipe(
      tap((response) => this.setSession(response))
    );
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.httpClient.post<AuthResponse>(`${this.url}/login`, { email, password }).pipe(
      tap((response) => this.setSession(response))
    );
  }

  logout() {
    this.safeRemove(TOKEN_KEY);
    this.safeRemove(EMAIL_KEY);
    this.email.set(null);
    this.isAuthenticated.set(false);
  }

  getToken(): string | null {
    return this.safeGet(TOKEN_KEY);
  }

  private setSession(response: AuthResponse) {
    this.safeSet(TOKEN_KEY, response.token);
    this.safeSet(EMAIL_KEY, response.email);
    this.email.set(response.email);
    this.isAuthenticated.set(true);
  }

  private safeGet(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private safeSet(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // localStorage unavailable - session just won't persist across reloads
    }
  }

  private safeRemove(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      // no-op
    }
  }
}
