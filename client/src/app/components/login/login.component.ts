import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './auth-form.css'
})
export class LoginComponent {
  email = '';
  password = '';
  error: string | null = null;
  isSubmitting = false;

  constructor(private authService: AuthService, private router: Router) { }

  submit() {
    if (!this.email.trim() || !this.password || this.isSubmitting) return;

    this.isSubmitting = true;
    this.error = null;

    this.authService.login(this.email.trim(), this.password).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.router.navigate(['/habits']);
      },
      error: (err) => {
        this.isSubmitting = false;
        this.error = err.error?.message || 'Could not log in';
      }
    });
  }
}
