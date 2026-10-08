import { Injectable } from '@angular/core';
import { Observable, of, throwError, tap } from 'rxjs';
import { LocalStoreService, Habit } from './local-store.service';
import { ReminderService } from './reminder.service';
import { SyncService } from './sync.service';

/**
 * Pure-offline habit API. Same method names and shapes as the old HTTP client, but every
 * call is served from LocalStoreService on this device - the app works with no network,
 * no account and no server configured. Local writes also ping SyncService so that, when
 * signed in and online, the change reaches MongoDB in the background.
 */
const local = <T>(work: () => T): Observable<T> => {
  try {
    return of(work());
  } catch (err: any) {
    return throwError(() => ({ error: { message: err?.message || 'Something went wrong' } }));
  }
};

@Injectable({
  providedIn: 'root'
})
export class HabitService {
  constructor(
    private store: LocalStoreService,
    private reminderService: ReminderService,
    private sync: SyncService
  ) {}

  getHabits(): Observable<Habit[]> {
    // Every reload is also the sync point for reminder notifications (unchanged behavior).
    return local(() => this.store.listHabits()).pipe(
      tap((habits) => void this.reminderService.sync(habits || []))
    );
  }

  addHabit(habit: Partial<Habit>): Observable<Habit> {
    return local(() => this.store.createHabit(habit)).pipe(tap(() => this.sync.notifyChange()));
  }

  updateHabit(id: string, habit: Partial<Habit>): Observable<Habit> {
    return local(() => this.store.updateHabit(id, habit)).pipe(tap(() => this.sync.notifyChange()));
  }

  deleteHabit(id: string): Observable<Habit> {
    return local(() => this.store.deleteHabit(id)).pipe(tap(() => this.sync.notifyChange()));
  }

  checkInHabit(id: string): Observable<any> {
    return local(() => this.store.checkIn(id)).pipe(tap(() => this.sync.notifyChange()));
  }

  getStreaks(id: string): Observable<any> {
    return local(() => this.store.streaks(id));
  }

  getHistory(id: string, days = 90): Observable<any> {
    return local(() => this.store.history(id, days));
  }

  getTrend(weeks = 12): Observable<any> {
    return local(() => this.store.trend(weeks));
  }

  getStacks(): Observable<any> {
    return local(() => this.store.stacks());
  }

  getIdentityStats(id: string): Observable<any> {
    return local(() => this.store.identityStats(id));
  }
}
