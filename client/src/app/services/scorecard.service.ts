import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { LocalStoreService } from './local-store.service';
import type { ScorecardEntry, ScorecardRating } from './local-store.service';

export type { ScorecardEntry, ScorecardRating };

const local = <T>(work: () => T): Observable<T> => {
  try {
    return of(work());
  } catch (err: any) {
    return throwError(() => ({ error: { message: err?.message || 'Something went wrong' } }));
  }
};

/** Habit Scorecard (+/-/=) - fully local, works offline. */
@Injectable({
  providedIn: 'root'
})
export class ScorecardService {
  constructor(private store: LocalStoreService) {}

  list(): Observable<ScorecardEntry[]> {
    return local(() => this.store.listScorecard());
  }

  add(text: string, rating: ScorecardRating): Observable<ScorecardEntry> {
    return local(() => this.store.addScorecardEntry(text, rating));
  }

  remove(id: string): Observable<ScorecardEntry> {
    return local(() => this.store.removeScorecardEntry(id));
  }
}
