import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export type ScorecardRating = 'positive' | 'negative' | 'neutral';

export interface ScorecardEntry {
  _id: string;
  text: string;
  rating: ScorecardRating;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class ScorecardService {
  private apiBaseUrl = window.location.port === '4200' ? 'http://localhost:3000/api' : '/api';
  private url = `${this.apiBaseUrl}/scorecard`;

  constructor(private httpClient: HttpClient) { }

  list() {
    return this.httpClient.get<ScorecardEntry[]>(this.url);
  }

  add(text: string, rating: ScorecardRating) {
    return this.httpClient.post<ScorecardEntry>(this.url, { text, rating });
  }

  remove(id: string) {
    return this.httpClient.delete(`${this.url}/${id}`);
  }
}
