import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { VehicleService } from '../services/vehicle.service';
import { ComplaintService } from '../services/complaint.service';
import { AuthService } from '../services/auth.service';
import { Vehicle } from '../models/vehicle.model';
import { Complaint } from '../models/complaint.model';
import { User } from '../models/user.model';

@Component({
  selector: 'app-instructor-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './instructor-dashboard.component.html',
  styleUrls: ['./instructor-dashboard.component.scss']
})
export class InstructorDashboardComponent implements OnInit {

  currentUser: User | null = null;

  // Current vehicle allocated to this instructor
  currentVehicle: Vehicle | null = null;

  // Recent complaints filed by this instructor
  myComplaints: Complaint[] = [];

  // Statistics for dashboard cards
  stats = {
    currentlyAllocated: false,
    totalComplaints: 0,
    pendingComplaints: 0,
    resolvedComplaints: 0
  };

  constructor(
    private vehicleService: VehicleService,
    private complaintService: ComplaintService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    if (!this.currentUser) return;

    // Load current vehicle allocation
    this.vehicleService.getAllVehicles().subscribe(vehicles => {
      this.currentVehicle = vehicles.find(v =>
        v.current_instructor_id?.toString() === this.currentUser!.id && v.status === 'busy'
      ) || null;

      this.stats.currentlyAllocated = !!this.currentVehicle;
    });

    // Load instructor's complaints
    this.complaintService.getMyComplaints().subscribe(complaints => {
      this.myComplaints = complaints.slice(0, 5);
      this.stats.totalComplaints = complaints.length;
      this.stats.pendingComplaints = complaints.filter(c => c.status === 'pending').length;
      this.stats.resolvedComplaints = complaints.filter(c => c.status === 'resolved').length;
    });
  }

  getRemainingTime(): string {
    if (!this.currentVehicle?.session_start || !this.currentVehicle?.time_slot) {
      return 'N/A';
    }

    const startTime = new Date(this.currentVehicle.session_start).getTime();
    const currentTime = new Date().getTime();
    const elapsedMinutes = Math.floor((currentTime - startTime) / 60000);
    const remainingMinutes = this.currentVehicle.time_slot - elapsedMinutes;

    if (remainingMinutes <= 0) return 'Expired';

    const hours = Math.floor(remainingMinutes / 60);
    const minutes = remainingMinutes % 60;

    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }
}