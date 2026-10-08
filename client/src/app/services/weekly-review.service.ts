import { Injectable } from '@angular/core';
import { Observable, of, throwError, tap } from 'rxjs';
import { LocalStoreService } from './local-store.service';
import type { WeeklyReview } from './local-store.service';
import { SyncService } from './sync.service';

export type { WeeklyReview };

const local = <T>(work: () => T): Observable<T> => {
  try {
    return of(work());
  } catch (err: any) {
    return throwError(() => ({ error: { message: err?.message || 'Something went wrong' } }));
  }
};

/** Weekly wins / misses / one-tweak reviews - fully local, works offline; saves sync in the background. */
@Injectable({
  providedIn: 'root'
})
export class WeeklyReviewService {
  constructor(private store: LocalStoreService, private sync: SyncService) {}

  list(): Observable<WeeklyReview[]> {
    return local(() => this.store.listReviews());
  }

  get(weekStart: string): Observable<WeeklyReview> {
    return local(() => this.store.getReview(weekStart));
  }

  save(weekStart: string, review: Partial<WeeklyReview>): Observable<WeeklyReview> {
    return local(() => this.store.saveReview(weekStart, review)).pipe(
      tap(() => this.sync.notifyChange())
    );
  }
}
