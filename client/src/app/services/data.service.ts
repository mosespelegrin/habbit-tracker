import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private apiBaseUrl = window.location.port === '4200' ? 'http://localhost:3000/api' : '/api';
  private url = `${this.apiBaseUrl}/data`;

  constructor(private httpClient: HttpClient) { }

  exportData() {
    return this.httpClient.get(`${this.url}/export`);
  }

  importData(payload: { habits: any[]; checkins: any[] }) {
    return this.httpClient.post<{ importedHabits: number; importedCheckins: number }>(`${this.url}/import`, payload);
  }
}
