import { Injectable } from '@angular/core';
import { Observable, of, throwError, tap } from 'rxjs';
import { LocalStoreService } from './local-store.service';
import { SyncService } from './sync.service';

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
 * An import also pushes the restored data up to the server on the next sync.
 */
@Injectable({
  providedIn: 'root'
})
export class DataService {
  constructor(private store: LocalStoreService, private sync: SyncService) {}

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
    }).pipe(tap(() => this.sync.notifyChange()));
  }
}
