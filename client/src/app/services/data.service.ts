import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { LocalStoreService } from './local-store.service';

const local = <T>(work: () => T): Observable<T> => {
  try {
    return of(work());
  } catch (err: any) {
    return throwError(() => ({ error: { message: err?.message || 'Something went wrong' } }));
  }
};

/**
 * Backup export/import - reads and writes the local store directly, so a backup contains
 * everything the app knows: habits, check-ins, the scorecard and weekly reviews.
 */
@Injectable({
  providedIn: 'root'
})
export class DataService {
  constructor(private store: LocalStoreService) {}

  exportData(): Observable<any> {
    return local(() => this.store.exportSnapshot());
  }

  importData(payload: {
    habits: any[];
    checkins: any[];
    scorecard?: any[];
    reviews?: any[];
  }): Observable<{ importedHabits: number; importedCheckins: number }> {
    return local(() => {
      const result = this.store.importSnapshot(payload);
      return {
        importedHabits: result.importedHabits,
        importedCheckins: result.importedCheckins
      };
    });
  }
}
