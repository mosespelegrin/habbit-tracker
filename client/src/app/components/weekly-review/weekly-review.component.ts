import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WeeklyReviewService, WeeklyReview } from '../../services/weekly-review.service';

const toDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const mondayOf = (date: Date): Date => {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
};

@Component({
  selector: 'app-weekly-review',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './weekly-review.component.html',
  styleUrls: ['../shared/panel.css', './weekly-review.component.css']
})
export class WeeklyReviewComponent implements OnInit {
  currentWeekStart = toDateKey(mondayOf(new Date()));
  wins = '';
  misses = '';
  tweak = '';

  pastReviews: WeeklyReview[] = [];
  isLoading = true;
  isSaving = false;
  savedMessage: string | null = null;
  error: string | null = null;

  constructor(private weeklyReviewService: WeeklyReviewService) { }

  ngOnInit() {
    this.isLoading = true;

    this.weeklyReviewService.get(this.currentWeekStart).subscribe({
      next: (review) => {
        this.wins = review.wins || '';
        this.misses = review.misses || '';
        this.tweak = review.tweak || '';
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.error = 'Could not load this week\'s review';
      }
    });

    this.weeklyReviewService.list().subscribe((reviews) => {
      this.pastReviews = reviews.filter((review) => review.weekStart !== this.currentWeekStart);
    });
  }

  save() {
    if (this.isSaving) return;

    this.isSaving = true;
    this.savedMessage = null;
    this.error = null;

    this.weeklyReviewService.save(this.currentWeekStart, {
      wins: this.wins.trim(),
      misses: this.misses.trim(),
      tweak: this.tweak.trim()
    }).subscribe({
      next: () => {
        this.isSaving = false;
        this.savedMessage = 'Saved';
      },
      error: (err) => {
        this.isSaving = false;
        this.error = err.error?.message || 'Could not save your review';
      }
    });
  }
}
