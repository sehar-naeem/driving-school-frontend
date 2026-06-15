import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAdmin()) {
    return true;
  }

  router.navigate(['/unauthorized']);
  return false;
};

export const instructorGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isInstructor()) {
    return true;
  }

  router.navigate(['/unauthorized']);
  return false;
};