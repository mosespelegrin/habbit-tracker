import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class HabitService {
 private url = 'http://localhost:3000/api/habits';
 private checkInUrl = 'http://localhost:3000/api/checkins';


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
    return this.httpClient.get(`${this.checkInUrl}/streaks/${id}`, {});
  }

}
