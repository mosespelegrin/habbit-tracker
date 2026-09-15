import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class HabitService {
 private apiBaseUrl = window.location.port === '4200' ? 'http://localhost:3000/api' : '/api';
 private url = `${this.apiBaseUrl}/habits`;
 private checkInUrl = `${this.apiBaseUrl}/checkins`;


  constructor(private httpClient: HttpClient) { }
  getHabits() {
    return this.withAuthRetry(() => this.httpClient.get(this.url, this.requestOptions()));
  }
  addHabit(habit: any) {
    return this.withAuthRetry(() => this.httpClient.post(this.url, habit, this.requestOptions()));
}
  updateHabit(id: string, habit: any) {
    return this.withAuthRetry(() => this.httpClient.put(`${this.url}/${id}`, habit, this.requestOptions()));
  }
  deleteHabit(id: string) {
    return this.withAuthRetry(() => this.httpClient.delete(`${this.url}/${id}`, this.requestOptions()));
  }
  checkInHabit(id: string) {
    return this.withAuthRetry(() => this.httpClient.post(`${this.checkInUrl}/${id}`, {}, this.requestOptions()));
  }
  getStreaks(id: string) {
    return this.withAuthRetry(() => this.httpClient.get(`${this.checkInUrl}/streaks/${id}`, this.requestOptions()));
  }
  getHistory(id: string, days = 90) {
    const safeDays = Math.min(Math.max(days, 1), 365);
    return this.withAuthRetry(() => this.httpClient.get(`${this.checkInUrl}/history/${id}?days=${safeDays}`, this.requestOptions()));
  }
  getStacks() {
    return this.withAuthRetry(() => this.httpClient.get(`${this.url}/stacks`, this.requestOptions()));
  }
  getIdentityStats(id: string) {
    return this.withAuthRetry(() => this.httpClient.get(`${this.url}/${id}/identity-stats`, this.requestOptions()));
  }

  private requestOptions() {
    const apiKey = localStorage.getItem('habitTrackerApiKey');
    const headers = apiKey ? new HttpHeaders({ 'x-api-key': apiKey }) : undefined;

    return { headers };
  }

  private withAuthRetry<T>(request: () => Observable<T>): Observable<T> {
    return request().pipe(
      catchError((error) => {
        if (error.status !== 401) {
          return throwError(() => error);
        }

        const apiKey = window.prompt('Enter the habit tracker API key');
        if (!apiKey) {
          return throwError(() => error);
        }

        localStorage.setItem('habitTrackerApiKey', apiKey);
        return request().pipe(
          catchError((retryError) => {
            if (retryError.status === 401) {
              localStorage.removeItem('habitTrackerApiKey');
            }

            return throwError(() => retryError);
          })
        );
      })
    );
  }
}
