import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { apiBaseUrl } from '../config/api';

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
  private apiBaseUrl = apiBaseUrl();
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
