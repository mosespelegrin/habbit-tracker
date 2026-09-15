import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './guards/auth.guard';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { HabitListComponent } from './components/habit-list/habit-list.component';
import { ScorecardComponent } from './components/scorecard/scorecard.component';
import { WeeklyReviewComponent } from './components/weekly-review/weekly-review.component';
import { TrendComponent } from './components/trend/trend.component';
import { SettingsComponent } from './components/settings/settings.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  { path: 'register', component: RegisterComponent, canActivate: [guestGuard] },
  { path: 'habits', component: HabitListComponent, canActivate: [authGuard] },
  { path: 'scorecard', component: ScorecardComponent, canActivate: [authGuard] },
  { path: 'weekly-review', component: WeeklyReviewComponent, canActivate: [authGuard] },
  { path: 'trends', component: TrendComponent, canActivate: [authGuard] },
  { path: 'settings', component: SettingsComponent, canActivate: [authGuard] },
  { path: '', pathMatch: 'full', redirectTo: 'habits' },
  { path: '**', redirectTo: 'habits' }
];
