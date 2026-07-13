import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HabitService } from '../../services/habit.service';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-habit-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './habit-list.component.html',
  styleUrl: './habit-list.component.css',
  animations: [
    trigger('habitAnimation', [
      transition('void => *', [
        style({ opacity: 0, transform: 'translateY(8px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition('* => void', [
        animate('250ms ease-in', style({ opacity: 0, transform: 'translateX(-20px)' }))
      ])
    ])
  ]
})
export class HabitListComponent implements OnInit {

  habits: any[] = [];
  newHabitName: string = '';
  streaks: { [habitId: string]: number } = {};

  constructor(private habitService: HabitService) { }

  ngOnInit() {
    this.loadHabits();
  }

  loadHabits() {
    this.habitService.getHabits().subscribe((data: any) => {
      this.habits = data;
      this.habits.forEach((habit) => {
        this.habitService.getStreaks(habit._id).subscribe((result: any) => {
          this.streaks[habit._id] = result.streak;
        });
      });
    });
  }

  addHabit() {
    if (!this.newHabitName.trim()) return;
    this.habitService.addHabit({ name: this.newHabitName }).subscribe(() => {
      this.newHabitName = '';
      this.loadHabits();
    });
  }

  checkIn(habitId: string) {
    this.habitService.checkInHabit(habitId).subscribe({
      next: () => this.loadHabits(),
      error: (err) => alert(err.error?.message || 'Something went wrong')
    });
  }

  deleteHabit(habitId: string) {
    this.habitService.deleteHabit(habitId).subscribe(() => {
      this.loadHabits();
    });
  }
}