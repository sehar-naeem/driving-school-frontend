
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { VehicleService } from '../services/vehicle.service';
import { UserService } from '../services/user.service';
import { ComplaintService } from '../services/complaint.service';
import { WebSocketService } from '../services/websocket.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  currentDate = new Date();
  
  stats = {
    totalVehicles: 0,
    vacantVehicles: 0,
    busyVehicles: 0,
    maintenanceVehicles: 0,
    totalInstructors: 0,
    activeInstructors: 0,
    pendingComplaints: 0,
    resolvedComplaints: 0
  };

  recentComplaints: any[] = [];
  activeInstructors: any[] = [];
  
  private subscriptions: Subscription[] = [];

  constructor(
    private vehicleService: VehicleService,
    private userService: UserService,
    private complaintService: ComplaintService,
    private wsService: WebSocketService
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
    this.setupRealtimeUpdates();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.wsService.disconnect();
  }

  loadDashboardData(): void {
    // Load vehicles
    this.vehicleService.getAllVehicles().subscribe(vehicles => {
      this.stats.totalVehicles = vehicles.length;
      this.stats.vacantVehicles = vehicles.filter(v => v.status === 'vacant').length;
      this.stats.busyVehicles = vehicles.filter(v => v.status === 'busy').length;
      this.stats.maintenanceVehicles = vehicles.filter(v => v.status === 'maintenance').length;
    });

    // Load instructors
    this.userService.getAllInstructors().subscribe(instructors => {
      this.stats.totalInstructors = instructors.length;
      this.stats.activeInstructors = instructors.filter(i => i.status === 'active').length;
      
      // Mock active instructors with vehicles
      this.activeInstructors = instructors.slice(0, 4).map(inst => ({
        ...inst,
        isActive: Math.random() > 0.3,
        currentVehicle: Math.random() > 0.5 ? 'ABC-123' : null
      }));
    });

    // Load complaints
    this.complaintService.getAllComplaints().subscribe(complaints => {
      this.stats.pendingComplaints = complaints.filter(c => c.status === 'pending').length;
      this.stats.resolvedComplaints = complaints.filter(c => c.status === 'resolved').length;
      this.recentComplaints = complaints.slice(0, 5);
    });
  }

  setupRealtimeUpdates(): void {
    this.wsService.connect();

    const vehicleSub = this.wsService.onVehicleUpdate().subscribe(() => {
      this.loadDashboardData();
    });

    const complaintSub = this.wsService.onComplaintUpdate().subscribe(() => {
      this.loadDashboardData();
    });

    this.subscriptions.push(vehicleSub, complaintSub);
  }
}
