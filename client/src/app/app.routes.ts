import { Routes } from '@angular/router';
import { HabitListComponent } from './components/habit-list/habit-list.component';
import { ScorecardComponent } from './components/scorecard/scorecard.component';
import { WeeklyReviewComponent } from './components/weekly-review/weekly-review.component';
import { TrendComponent } from './components/trend/trend.component';
import { SettingsComponent } from './components/settings/settings.component';
import { WorkflowComponent } from './components/workflow/workflow.component';

/**
 * Pure-offline routing: no login, no guards, no server. The app opens straight into the
 * workflow; old login/register deep links (e.g. from a previous install) land there too.
 */
export const routes: Routes = [
  { path: 'workflow', component: WorkflowComponent },
  { path: 'habits', component: HabitListComponent },
  { path: 'scorecard', component: ScorecardComponent },
  { path: 'weekly-review', component: WeeklyReviewComponent },
  { path: 'trends', component: TrendComponent },
  { path: 'settings', component: SettingsComponent },
  { path: '', pathMatch: 'full', redirectTo: 'workflow' },
  { path: 'login', redirectTo: 'workflow' },
  { path: 'register', redirectTo: 'workflow' },
  { path: '**', redirectTo: 'workflow' }
];
