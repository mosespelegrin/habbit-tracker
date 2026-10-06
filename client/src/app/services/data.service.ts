import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { apiBaseUrl } from '../config/api';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private apiBaseUrl = apiBaseUrl();
  private url = `${this.apiBaseUrl}/data`;

  constructor(private httpClient: HttpClient) { }

  exportData() {
    return this.httpClient.get(`${this.url}/export`);
  }

  importData(payload: { habits: any[]; checkins: any[] }) {
    return this.httpClient.post<{ importedHabits: number; importedCheckins: number }>(`${this.url}/import`, payload);
  }
}
