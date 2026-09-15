import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class HabitService {
  private apiBaseUrl = window.location.port === '4200' ? 'http://localhost:3000/api' : '/api';
  private url = `${this.apiBaseUrl}/habits`;
  private checkInUrl = `${this.apiBaseUrl}/checkins`;

  constructor(private httpClient: HttpClient) { }

  getHabits() {
    return this.httpClient.get(this.url);
  }
  addHabit(habit: any) {
    return this.httpClient.post(this.url, habit);
  }
  updateHabit(id: string, habit: any) {
    return this.httpClient.put(`${this.url}/${id}`, habit);
  }
  deleteHabit(id: string) {
    return this.httpClient.delete(`${this.url}/${id}`);
  }
  checkInHabit(id: string) {
    return this.httpClient.post(`${this.checkInUrl}/${id}`, {});
  }
  getStreaks(id: string) {
    return this.httpClient.get(`${this.checkInUrl}/streaks/${id}`);
  }
  getHistory(id: string, days = 90) {
    const safeDays = Math.min(Math.max(days, 1), 365);
    return this.httpClient.get(`${this.checkInUrl}/history/${id}?days=${safeDays}`);
  }
  getTrend(weeks = 12) {
    const safeWeeks = Math.min(Math.max(weeks, 1), 52);
    return this.httpClient.get(`${this.checkInUrl}/trend?weeks=${safeWeeks}`);
  }
  getStacks() {
    return this.httpClient.get(`${this.url}/stacks`);
  }
  getIdentityStats(id: string) {
    return this.httpClient.get(`${this.url}/${id}/identity-stats`);
  }
}
