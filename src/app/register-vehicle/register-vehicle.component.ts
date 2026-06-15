import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { VehicleService } from '../services/vehicle.service';
import { VehicleCreateRequest } from '../models/vehicle.model';

@Component({
  selector: 'app-register-vehicle',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './register-vehicle.component.html',
 styleUrls:['./register-vehicle.component.scss']
})
export class RegisterVehicleComponent {
  formData: VehicleCreateRequest = {
    registration_number: '',
    model: '',
    manufacturer: '',
    year: new Date().getFullYear(),
    color: ''
  };

  loading = false;
  error = '';

  constructor(
    private vehicleService: VehicleService,
    private router: Router
  ) {}

  onSubmit(): void {
    this.loading = true;
    this.error = '';

    this.vehicleService.createVehicle(this.formData).subscribe({
      next: () => {
        alert('Vehicle registered successfully!');
        this.router.navigate(['/admin/vehicles']);
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to register vehicle';
        this.loading = false;
      },
      complete: () => {
        this.loading = false;
      }
    });
  }
}