import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HabitService } from '../../services/habit.service';
import { ScorecardService, ScorecardEntry } from '../../services/scorecard.service';
import { WeeklyReviewService, WeeklyReview } from '../../services/weekly-review.service';

@Component({
  selector: 'app-workflow',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './workflow.component.html',
  styleUrls: ['../shared/panel.css', './workflow.component.css']
})
export class WorkflowComponent implements OnInit {
  // Data
  habits: any[] = [];
  scorecard: ScorecardEntry[] = [];
  pastReviews: WeeklyReview[] = [];
  streaks: any = {};
  currentWeekStart = '';
  isLoading = true;
  error: string | null = null;

  // Scorecard -> Habit conversion draft (4 Laws)
  draft = { name: '', identity: '', miniVersion: '', cue: '', reward: '', stackedAfter: '', reminderTime: '' };
  draftSource: ScorecardEntry | null = null;
  isCreating = false;
  createMsg: string | null = null;

  // Check-in
  checkingIds = new Set<string>();

  // Review shortcut
  quickWins = '';
  quickMisses = '';
  quickTweak = '';

  constructor(
    private habitService: HabitService,
    private scorecardService: ScorecardService,
    private reviewService: WeeklyReviewService,
    private router: Router
  ) {}

  ngOnInit() {
    this.currentWeekStart = this.getWeekStart(new Date());
    this.loadAll();
  }

  loadAll() {
    this.isLoading = true;
    this.habitService.getHabits().subscribe({
      next: (habits) => {
        this.habits = habits || [];
        this.habits.forEach(h => {
          this.habitService.getStreaks(h._id).subscribe(r => this.streaks[h._id] = r);
        });
        this.loadScorecard();
      },
      error: () => { this.error = 'Could not load habits'; this.isLoading = false; }
    });
  }

  loadScorecard() {
    this.scorecardService.list().subscribe({
      next: (entries) => {
        this.scorecard = entries || [];
        this.reviewService.list().subscribe({
          next: (reviews) => { this.pastReviews = reviews || []; this.isLoading = false; },
          error: () => this.isLoading = false
        });
      },
      error: () => this.isLoading = false
    });
  }

  // Scorecard helpers
  byRating(r: string) { return this.scorecard.filter(e => e.rating === r); }

  convert(entry: ScorecardEntry) {
    this.draftSource = entry;
    // Pre-fill using the scorecard text — negative habits become "avoid" habits, positive become identities to reinforce
    const isNegative = entry.rating === 'negative';
    this.draft = {
      name: entry.text.length > 40 ? entry.text.slice(0, 40) : entry.text,
      identity: isNegative ? 'I am someone who avoids ' + entry.text.toLowerCase() : 'I am someone who ' + entry.text.toLowerCase(),
      miniVersion: isNegative ? 'Pause 10 seconds before ' + entry.text.toLowerCase() : 'Start with 2 minutes of ' + entry.text.toLowerCase(),
      cue: 'After I [existing habit]',
      reward: isNegative ? 'A clear head' : 'A small win to enjoy',
      stackedAfter: '',
      reminderTime: ''
    };
    document.getElementById('step-design')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  clearDraft() { this.draft = { name: '', identity: '', miniVersion: '', cue: '', reward: '', stackedAfter: '', reminderTime: '' }; this.draftSource = null; this.createMsg = null; }

  createHabit() {
    if (!this.draft.name.trim() || this.isCreating) return;
    this.isCreating = true;
    this.habitService.addHabit({
      name: this.draft.name.trim(),
      identity: this.draft.identity.trim(),
      miniVersion: this.draft.miniVersion.trim(),
      cue: this.draft.cue.trim(),
      reward: this.draft.reward.trim(),
      stackedAfter: this.draft.stackedAfter || null,
      reminderTime: this.draft.reminderTime || ''
    }).subscribe({
      next: () => {
        this.isCreating = false;
        this.createMsg = `Habit "${this.draft.name}" created — it will appear in Step 3. Check it off today to start your streak.`;
        if (this.draftSource) {
          // remove the source scorecard entry so the list visibly moves forward
          this.scorecardService.remove(this.draftSource._id).subscribe(() => {
            this.scorecard = this.scorecard.filter(e => e._id !== this.draftSource!._id);
          });
        }
        this.loadAll();
        setTimeout(() => this.createMsg = null, 4000);
      },
      error: (err) => { this.isCreating = false; this.createMsg = err.error?.message || 'Could not create habit'; }
    });
  }

  checkIn(id: string) {
    if (this.checkingIds.has(id)) return;
    this.checkingIds.add(id);
    this.habitService.checkInHabit(id).subscribe({
      next: () => { this.checkingIds.delete(id); this.loadAll(); },
      error: () => this.checkingIds.delete(id)
    });
  }

  isAtRisk(id: string) {
    const s = this.streaks[id];
    return s?.missedYesterday && !s?.doneToday;
  }

  getWeekStart(d: Date) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    return date.toISOString().split('T')[0];
  }

  habitCountForRating(rating: string) {
    const map: Record<string, number> = { positive: 0, negative: 0, neutral: 0 };
    this.scorecard.forEach(e => map[e.rating]++);
    return map[rating] || 0;
  }
}
