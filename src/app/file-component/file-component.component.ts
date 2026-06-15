import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { VehicleService } from '../services/vehicle.service';
import { ComplaintService } from '../services/complaint.service';
import { Vehicle } from '../models/vehicle.model';

@Component({
  selector: 'app-file-component',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './file-component.component.html',
  styleUrls: ['./file-component.component.scss']
 
})
export class FileComplaintComponent implements OnInit {
  // List of all vehicles to choose from
  vehicles: Vehicle[] = [];
  
  // Form data for complaint
  complaintData = {
    vehicle_id: 0,
    issue_type: '',
    title: '',
    description: '',
    priority: 'medium'
  };

  loading = false;
  error = '';
  successMessage = '';

  constructor(
    private vehicleService: VehicleService,
    private complaintService: ComplaintService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadVehicles();
  }

  // Load all vehicles for dropdown
  // API Call: GET /api/vehicles
  loadVehicles(): void {
    this.vehicleService.getAllVehicles().subscribe({
      next: (vehicles) => {
        this.vehicles = vehicles;
      },
      error: (err) => {
        console.error('Error loading vehicles:', err);
        this.error = 'Failed to load vehicles';
      }
    });
  }

  // Submit complaint form
  // API Call: POST /api/complaints
  onSubmit(): void {
    // Validation
    if (!this.complaintData.vehicle_id) {
      this.error = 'Please select a vehicle';
      return;
    }
    if (!this.complaintData.issue_type) {
      this.error = 'Please select an issue type';
      return;
    }
    if (!this.complaintData.title.trim()) {
      this.error = 'Please enter a title';
      return;
    }
    if (!this.complaintData.description.trim()) {
      this.error = 'Please provide a description';
      return;
    }

    this.loading = true;
    this.error = '';

    // Submit to backend
    this.complaintService.createComplaint(this.complaintData).subscribe({
      next: () => {
        this.successMessage = 'Complaint filed successfully!';
        setTimeout(() => {
          this.router.navigate(['/instructor/my-complaints']);
        }, 1500);
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to file complaint. Please try again.';
        this.loading = false;
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  // Reset form
  resetForm(): void {
    this.complaintData = {
      vehicle_id: 0,
      issue_type: '',
      title: '',
      description: '',
      priority: 'medium'
    };
    this.error = '';
    this.successMessage = '';
  }
}