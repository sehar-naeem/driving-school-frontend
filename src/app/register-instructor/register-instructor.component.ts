import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { UserService } from '../services/user.service';
import { RegisterInstructorRequest } from '../models/user.model';

@Component({
  selector: 'app-register-instructor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './register-instructor.component.html',
  styleUrls: ['./register-instructor.component.scss']
})
export class RegisterInstructorComponent {

  formData: RegisterInstructorRequest = {
    username: '',
    password: '',
    full_name: '',
    email: '',
    phone: ''
  };

  confirmPassword: string = '';
  loading: boolean = false;
  error: string = '';
  showPassword: boolean = false;

  constructor(
    private userService: UserService,
    private router: Router
  ) {}

  onSubmit(): void {
    if (this.loading) return;

    // 🔐 Validation
    if (
      !this.formData.username ||
      !this.formData.password ||
      !this.formData.full_name ||
      !this.formData.email
    ) {
      this.error = 'Please fill in all required fields';
      return;
    }

    if (this.formData.password !== this.confirmPassword) {
      this.error = 'Passwords do not match';
      return;
    }

    if (this.formData.password.length < 6) {
      this.error = 'Password must be at least 6 characters';
      return;
    }

    this.loading = true;
    this.error = '';

    this.userService.registerInstructor(this.formData).subscribe({
      next: () => {
        alert('Instructor registered successfully!');
        this.router.navigate(['/admin/instructors']);
      },
      error: (err) => {
        console.error(err);
        this.error = err?.error?.message || 'Failed to register instructor';
        this.loading = false;
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/admin/instructors']);
  }
}
