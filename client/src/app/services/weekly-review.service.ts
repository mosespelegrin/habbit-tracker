import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface WeeklyReview {
  weekStart: string;
  wins: string;
  misses: string;
  tweak: string;
}

@Injectable({
  providedIn: 'root'
})
export class WeeklyReviewService {
  private apiBaseUrl = window.location.port === '4200' ? 'http://localhost:3000/api' : '/api';
  private url = `${this.apiBaseUrl}/weekly-reviews`;

  constructor(private httpClient: HttpClient) { }

  list() {
    return this.httpClient.get<WeeklyReview[]>(this.url);
  }

  get(weekStart: string) {
    return this.httpClient.get<WeeklyReview>(`${this.url}/${weekStart}`);
  }

  save(weekStart: string, review: Partial<WeeklyReview>) {
    return this.httpClient.put<WeeklyReview>(`${this.url}/${weekStart}`, review);
  }
}
