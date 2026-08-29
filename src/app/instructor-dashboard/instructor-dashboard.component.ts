import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { VehicleService } from '../services/vehicle.service';
import { ComplaintService } from '../services/complaint.service';
import { AuthService } from '../services/auth.service';
import { WebSocketService } from '../services/websocket.service';
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
export class InstructorDashboardComponent implements OnInit, OnDestroy {

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

  // Live GPS Broadcast State
  isSharingGps: boolean = false;
  watchPositionId: number | null = null;
  gpsLatitude: number | null = null;
  gpsLongitude: number | null = null;
  gpsAccuracy: number | null = null;
  gpsSpeed: number | null = null;
  gpsError: string = '';
  lastGpsUpdate: Date | null = null;

  constructor(
    private vehicleService: VehicleService,
    private complaintService: ComplaintService,
    private authService: AuthService,
    private wsService: WebSocketService
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.loadDashboardData();
    this.wsService.connect();
  }

  ngOnDestroy(): void {
    this.stopGpsSharing();
  }

  loadDashboardData(): void {
    if (!this.currentUser) return;

    // Load current vehicle allocation
    this.vehicleService.getAllVehicles().subscribe(vehicles => {
      this.currentVehicle = vehicles.find(v => {
        const instId = v.current_instructor_id?.toString() || (v.current_instructor as any)?._id?.toString() || (v.current_instructor as any)?.id?.toString();
        return instId === this.currentUser!.id && v.status === 'busy';
      }) || null;

      this.stats.currentlyAllocated = !!this.currentVehicle;

      if (this.currentVehicle && this.currentVehicle.latitude && this.currentVehicle.longitude) {
        this.gpsLatitude = Number(this.currentVehicle.latitude);
        this.gpsLongitude = Number(this.currentVehicle.longitude);
      }
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

  // ===== LIVE GPS BROADCASTING =====
  toggleGpsSharing(): void {
    if (this.isSharingGps) {
      this.stopGpsSharing();
    } else {
      this.startGpsSharing();
    }
  }

  startGpsSharing(): void {
    if (!this.currentVehicle) {
      this.gpsError = 'No active vehicle allocated to share location for.';
      return;
    }

    if (!('geolocation' in navigator)) {
      this.gpsError = 'Geolocation is not supported by your browser.';
      return;
    }

    this.gpsError = '';
    this.isSharingGps = true;

    const options: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 10000
    };

    this.watchPositionId = navigator.geolocation.watchPosition(
      (position) => {
        this.handlePositionUpdate(position);
      },
      (error) => {
        console.error('GPS error:', error);
        this.gpsError = `GPS Error: ${error.message}`;
      },
      options
    );
  }

  private handlePositionUpdate(position: GeolocationPosition): void {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;

    this.gpsLatitude = lat;
    this.gpsLongitude = lng;
    this.gpsAccuracy = Math.round(position.coords.accuracy);
    this.gpsSpeed = position.coords.speed ? Math.round(position.coords.speed * 3.6) : null; // km/h
    this.lastGpsUpdate = new Date();
    this.gpsError = '';

    if (!this.currentVehicle) return;

    const vehicleId = (this.currentVehicle._id || this.currentVehicle.id)?.toString();
    if (!vehicleId) return;

    // 1. Emit live WebSocket location update for real-time admin map
    this.wsService.emitLocationUpdate({
      vehicle_id: vehicleId,
      latitude: lat,
      longitude: lng
    });

    // 2. Persist updated coordinates to backend API
    this.vehicleService.updateVehicleLocation(vehicleId, lat, lng).subscribe({
      next: () => {
        console.log(`📍 Live GPS broadcast: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      },
      error: (err) => {
        console.warn('Could not persist location via HTTP:', err);
      }
    });
  }

  stopGpsSharing(): void {
    if (this.watchPositionId !== null) {
      navigator.geolocation.clearWatch(this.watchPositionId);
      this.watchPositionId = null;
    }
    this.isSharingGps = false;
  }
}