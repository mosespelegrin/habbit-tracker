import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ScorecardService, ScorecardEntry, ScorecardRating } from '../../services/scorecard.service';

@Component({
  selector: 'app-scorecard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './scorecard.component.html',
  styleUrls: ['../shared/panel.css', './scorecard.component.css']
})
export class ScorecardComponent implements OnInit {
  entries: ScorecardEntry[] = [];
  newText = '';
  newRating: ScorecardRating = 'neutral';
  isLoading = true;
  isAdding = false;
  error: string | null = null;

  constructor(private scorecardService: ScorecardService) { }

  ngOnInit() {
    this.load();
  }

  load() {
    this.isLoading = true;
    this.scorecardService.list().subscribe({
      next: (entries) => {
        this.entries = entries;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.error = 'Could not load your scorecard';
      }
    });
  }

  add() {
    if (!this.newText.trim() || this.isAdding) return;

    this.isAdding = true;
    this.scorecardService.add(this.newText.trim(), this.newRating).subscribe({
      next: (entry) => {
        this.isAdding = false;
        this.newText = '';
        this.entries = [...this.entries, entry];
      },
      error: (err) => {
        this.isAdding = false;
        this.error = err.error?.message || 'Could not add entry';
      }
    });
  }

  remove(id: string) {
    this.scorecardService.remove(id).subscribe(() => {
      this.entries = this.entries.filter((entry) => entry._id !== id);
    });
  }

  byRating(rating: ScorecardRating) {
    return this.entries.filter((entry) => entry.rating === rating);
  }
}
