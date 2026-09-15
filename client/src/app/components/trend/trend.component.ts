import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HabitService } from '../../services/habit.service';

interface TrendWeek {
  weekStart: string;
  completionRate: number;
}

@Component({
  selector: 'app-trend',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './trend.component.html',
  styleUrls: ['../shared/panel.css', './trend.component.css']
})
export class TrendComponent implements OnInit {
  weeks: TrendWeek[] = [];
  isLoading = true;
  error: string | null = null;

  readonly chartHeight = 140;
  readonly barWidth = 28;
  readonly barGap = 10;

  constructor(private habitService: HabitService) { }

  ngOnInit() {
    this.habitService.getTrend(12).subscribe({
      next: (weeks: any) => {
        this.weeks = weeks;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.error = 'Could not load your completion trend';
      }
    });
  }

  barHeight(rate: number): number {
    return Math.max(2, Math.round((rate / 100) * this.chartHeight));
  }

  get chartWidth(): number {
    return this.weeks.length * (this.barWidth + this.barGap);
  }

  get averageRate(): number {
    if (!this.weeks.length) return 0;
    return Math.round(this.weeks.reduce((sum, week) => sum + week.completionRate, 0) / this.weeks.length);
  }

  get trendDirection(): 'up' | 'down' | 'flat' {
    if (this.weeks.length < 2) return 'flat';
    const firstHalf = this.weeks.slice(0, Math.floor(this.weeks.length / 2));
    const secondHalf = this.weeks.slice(Math.floor(this.weeks.length / 2));
    const avg = (list: TrendWeek[]) => list.reduce((sum, w) => sum + w.completionRate, 0) / (list.length || 1);
    const delta = avg(secondHalf) - avg(firstHalf);
    if (delta > 5) return 'up';
    if (delta < -5) return 'down';
    return 'flat';
  }

  get summary(): string {
    if (!this.weeks.length) return 'No completion data yet.';
    return `Completion rate has averaged ${this.averageRate}% over the last ${this.weeks.length} weeks, trending ${this.trendDirection}.`;
  }

  shortLabel(weekStart: string): string {
    const [, month, day] = weekStart.split('-');
    return `${month}/${day}`;
  }
}
