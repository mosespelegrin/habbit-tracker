import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PASSWORD_RULES, isPasswordValid } from '../../utils/password-policy';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: '../login/auth-form.css'
})
export class RegisterComponent {
  readonly passwordRules = PASSWORD_RULES;

  email = '';
  password = '';
  confirmPassword = '';
  error: string | null = null;
  isSubmitting = false;

  get passwordValid() {
    return isPasswordValid(this.password, this.email);
  }

  get passwordsMatch() {
    return this.password.length > 0 && this.password === this.confirmPassword;
  }

  submit() {
    if (!this.email.trim() || !this.passwordValid || !this.passwordsMatch || this.isSubmitting) return;

    this.isSubmitting = true;
    this.error = null;

    this.authService.register(this.email.trim(), this.password).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.router.navigate(['/habits']);
      },
      error: (err) => {
        this.isSubmitting = false;
        this.error = err.error?.message || 'Could not create account';
      }
    });
  }

  constructor(private authService: AuthService, private router: Router) { }
}
