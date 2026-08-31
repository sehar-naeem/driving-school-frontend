import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { VehicleService } from '../services/vehicle.service';
import { ComplaintService } from '../services/complaint.service';
import { AuthService } from '../services/auth.service';
import { WebSocketService } from '../services/websocket.service';
import { Vehicle } from '../models/vehicle.model';
import { Complaint } from '../models/complaint.model';
import { User } from '../models/user.model';
import { interval, Subscription } from 'rxjs';

@Component({
  selector: 'app-instructor-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
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

  // New Allocation Modal / Notification for Instructor
  showNewAllocationModal: boolean = false;
  hasDismissedNewAllocation: boolean = false;

  // Popups and Modals for Instructor
  showWarningModal: boolean = false;
  warningModalDismissed: boolean = false;

  showExpiredModal: boolean = false;
  expiredModalDismissed: boolean = false;

  // Extension Request Modal & State
  showExtensionModal: boolean = false;
  extensionMinutes: number = 15;
  extensionReason: string = 'Traffic delay on the road';
  extensionLoading: boolean = false;
  extensionPending: boolean = false;
  extensionMessage: string = '';

  // Admin Extension Response Notice Modal
  showExtensionResultModal: boolean = false;
  extensionResultType: 'approved' | 'declined' = 'approved';
  extensionResultData: { minutes: number; message: string } = { minutes: 15, message: '' };

  // Parked Report Modal & State
  showParkedModal: boolean = false;
  parkedNote: string = 'Car parked safely at the driving school parking lot.';
  parkedLoading: boolean = false;
  isCarReportedParked: boolean = false;

  private timerInterval?: Subscription;
  private wsSubscriptions: Subscription[] = [];

  constructor(
    private vehicleService: VehicleService,
    private complaintService: ComplaintService,
    private authService: AuthService,
    private wsService: WebSocketService
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.loadDashboardData();
    this.setupWebSocketListeners();

    // Check timer every second for accurate countdown & popups
    this.timerInterval = interval(1000).subscribe(() => {
      this.checkSessionTimers();
    });
  }

  ngOnDestroy(): void {
    this.stopGpsSharing();
    if (this.timerInterval) {
      this.timerInterval.unsubscribe();
    }
    this.wsSubscriptions.forEach(sub => sub.unsubscribe());
  }

  private getEntityId(entity: any): string {
    if (!entity) return '';
    if (typeof entity === 'string') return entity;
    return (entity._id || entity.id || '').toString();
  }

  loadDashboardData(): void {
    if (!this.currentUser) return;
    const currentInstructorId = this.getEntityId(this.currentUser);

    // Load current vehicle allocation with robust ID matching
    this.vehicleService.getAllVehicles().subscribe((vehicles: Vehicle[]) => {
      this.currentVehicle = vehicles.find((v: Vehicle) => {
        if (v.status !== 'busy') return false;
        const vInstId = this.getEntityId(v.current_instructor_id) || this.getEntityId(v.current_instructor);
        return vInstId && currentInstructorId && vInstId === currentInstructorId;
      }) || null;

      this.stats.currentlyAllocated = !!this.currentVehicle;

      if (this.currentVehicle) {
        if (this.currentVehicle.latitude && this.currentVehicle.longitude) {
          this.gpsLatitude = Number(this.currentVehicle.latitude);
          this.gpsLongitude = Number(this.currentVehicle.longitude);
        }
        if (this.currentVehicle.is_parked) {
          this.isCarReportedParked = true;
        }
        if (this.currentVehicle.extension_request?.status === 'pending') {
          this.extensionPending = true;
        }

        // If allocated and not yet acknowledged, show the new allocation popup
        if ((!this.currentVehicle.instructor_status || this.currentVehicle.instructor_status === 'assigned') && !this.hasDismissedNewAllocation) {
          this.showNewAllocationModal = true;
        }
      }
    });

    // Load instructor's complaints
    this.complaintService.getMyComplaints().subscribe((complaints: Complaint[]) => {
      this.myComplaints = complaints.slice(0, 5);
      this.stats.totalComplaints = complaints.length;
      this.stats.pendingComplaints = complaints.filter((c: Complaint) => c.status === 'pending').length;
      this.stats.resolvedComplaints = complaints.filter((c: Complaint) => c.status === 'resolved').length;
    });
  }

  private setupWebSocketListeners(): void {
    this.wsService.connect();

    // Listen for live vehicle allocation events from Admin
    const allocSub = this.wsService.onAllocationCreated().subscribe((data: any) => {
      const currentInstructorId = this.getEntityId(this.currentUser);
      const targetInstId = this.getEntityId(data?.instructor_id) || this.getEntityId(data?.vehicle?.current_instructor_id);
      if (targetInstId && currentInstructorId && targetInstId === currentInstructorId) {
        this.showNewAllocationModal = true;
        this.hasDismissedNewAllocation = false;
        this.loadDashboardData();
      }
    });
    this.wsSubscriptions.push(allocSub);

    // Listen for extension response from Admin
    const extRespSub = this.wsService.onExtensionResponded().subscribe((data: any) => {
      const vehicleId = this.getEntityId(this.currentVehicle);
      const dataVehicleId = (data?.vehicle_id || data?.vehicleId || data?.id)?.toString();

      console.log('⚡ Extension response received on instructor dashboard:', data);

      if (!vehicleId || !dataVehicleId || dataVehicleId === vehicleId) {
        this.extensionPending = false;
        this.showExtensionModal = false;

        const isApproved = data.approved === true;
        const extraMins = data.additional_minutes || 15;

        if (isApproved) {
          this.extensionResultType = 'approved';
          this.extensionResultData = {
            minutes: extraMins,
            message: data.message || 'Approved. Please complete the lesson and return safely.'
          };
          this.showExtensionResultModal = true;
          this.warningModalDismissed = false;
          this.expiredModalDismissed = false;
          this.showExpiredModal = false;
          this.showWarningModal = false;
        } else {
          this.extensionResultType = 'declined';
          this.extensionResultData = {
            minutes: 0,
            message: data.message || 'Extension request declined by Admin. Please return to the school immediately.'
          };
          this.showExtensionResultModal = true;
        }
        this.loadDashboardData();
      }
    });
    this.wsSubscriptions.push(extRespSub);
  }

  getRemainingSeconds(): number {
    if (!this.currentVehicle?.session_start || !this.currentVehicle?.time_slot || this.isCarReportedParked || this.currentVehicle?.is_parked) {
      return 0;
    }
    const startTime = new Date(this.currentVehicle.session_start).getTime();
    const currentTime = new Date().getTime();
    const durationMs = this.currentVehicle.time_slot * 60000;
    const remainingMs = (startTime + durationMs) - currentTime;
    return Math.max(0, Math.floor(remainingMs / 1000));
  }

  get isExtensionPending(): boolean {
    return this.extensionPending || (this.currentVehicle?.extension_request?.status === 'pending');
  }

  getRemainingTime(): string {
    if (this.isCarReportedParked || this.currentVehicle?.is_parked) {
      return 'Completed & Parked';
    }

    if (!this.currentVehicle?.session_start || !this.currentVehicle?.time_slot) {
      return 'N/A';
    }

    const remainingSec = this.getRemainingSeconds();
    if (remainingSec <= 0) return 'Expired (00:00)';

    const hours = Math.floor(remainingSec / 3600);
    const minutes = Math.floor((remainingSec % 3600) / 60);
    const seconds = remainingSec % 60;

    const pad = (n: number) => n.toString().padStart(2, '0');

    if (hours > 0) {
      return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
    }
    return `${pad(minutes)}m ${pad(seconds)}s`;
  }

  /**
   * Monitor timer to trigger 5-minute warning and expired popup
   */
  private checkSessionTimers(): void {
    if (!this.currentVehicle || this.isCarReportedParked || this.currentVehicle.is_parked) {
      this.showWarningModal = false;
      this.showExpiredModal = false;
      return;
    }

    const remainingSec = this.getRemainingSeconds();
    const totalSlot = this.currentVehicle.time_slot || 35;
    const isTestSlot = totalSlot === 1;

    // 1. Check for 5-minute warning (or 30s in test mode)
    const is5MinWarning = !isTestSlot && remainingSec <= 300 && remainingSec > 0;
    const isTestWarning = isTestSlot && remainingSec <= 30 && remainingSec > 0;

    if ((is5MinWarning || isTestWarning) && !this.warningModalDismissed && !this.showWarningModal && !this.showExtensionResultModal) {
      this.showWarningModal = true;
    }

    // 2. Check for Expired (0 seconds remaining)
    if (remainingSec <= 0 && !this.expiredModalDismissed && !this.showExpiredModal && !this.showExtensionResultModal && !this.isCarReportedParked) {
      this.showWarningModal = false;
      this.showExpiredModal = true;
    }
  }

  // ===== INSTRUCTOR ALLOCATION ACKNOWLEDGMENT =====
  acknowledgeAndStartLesson(): void {
    if (!this.currentVehicle) return;
    const vehicleId = this.getEntityId(this.currentVehicle);
    if (!vehicleId) return;

    this.vehicleService.acknowledgeAllocation(vehicleId, {
      status: 'on_way',
      latitude: this.gpsLatitude || undefined,
      longitude: this.gpsLongitude || undefined
    }).subscribe({
      next: () => {
        this.showNewAllocationModal = false;
        this.hasDismissedNewAllocation = true;
        if (this.currentVehicle) {
          this.currentVehicle.instructor_status = 'on_way';
        }
        // Start GPS sharing automatically
        this.startGpsSharing();
        this.wsService.emitInstructorOnWay({
          vehicle_id: vehicleId,
          registration_number: this.currentVehicle!.registration_number,
          instructor: this.currentUser?.full_name,
          latitude: this.gpsLatitude,
          longitude: this.gpsLongitude
        });
        alert(`🚀 Confirmed! Admin notified that you are on your way with ${this.currentVehicle!.model} (${this.currentVehicle!.registration_number}). Live GPS tracking started!`);
        this.loadDashboardData();
      },
      error: (err) => {
        console.error('Error acknowledging allocation:', err);
        this.showNewAllocationModal = false;
      }
    });
  }

  declineAllocation(): void {
    if (!this.currentVehicle) {
      this.showNewAllocationModal = false;
      return;
    }
    const vehicleId = this.getEntityId(this.currentVehicle);
    if (!vehicleId) {
      this.showNewAllocationModal = false;
      return;
    }

    this.vehicleService.declineAllocation(vehicleId, {
      reason: 'Instructor is unavailable / declined lesson'
    }).subscribe({
      next: () => {
        this.showNewAllocationModal = false;
        this.hasDismissedNewAllocation = true;
        this.currentVehicle = null;
        alert('Allocation declined. Vehicle has been released back to vacant for Admin to re-allocate.');
        this.loadDashboardData();
      },
      error: (err) => {
        console.error('Error declining allocation:', err);
        this.showNewAllocationModal = false;
        this.loadDashboardData();
      }
    });
  }

  dismissNewAllocationModal(): void {
    this.declineAllocation();
  }

  dismissWarningModal(): void {
    this.showWarningModal = false;
    this.warningModalDismissed = true;
  }

  dismissExpiredModal(): void {
    this.showExpiredModal = false;
    this.expiredModalDismissed = true;
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
      maximumAge: 3000,
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
    this.gpsSpeed = position.coords.speed ? Math.round(position.coords.speed * 3.6) : null;
    this.lastGpsUpdate = new Date();
    this.gpsError = '';

    if (!this.currentVehicle) return;

    const vehicleId = this.getEntityId(this.currentVehicle);
    if (!vehicleId) return;

    // 1. Emit live WebSocket location update for real-time admin map
    this.wsService.emitLocationUpdate({
      vehicle_id: vehicleId,
      latitude: lat,
      longitude: lng
    });

    // 2. Persist updated coordinates to backend API
    this.vehicleService.updateVehicleLocation(vehicleId, lat, lng).subscribe({
      next: () => {},
      error: (err) => console.warn('Location persist error:', err)
    });
  }

  stopGpsSharing(): void {
    if (this.watchPositionId !== null) {
      navigator.geolocation.clearWatch(this.watchPositionId);
      this.watchPositionId = null;
    }
    this.isSharingGps = false;
  }

  // ===== REQUEST TIME EXTENSION =====
  openExtensionModal(): void {
    this.showWarningModal = false;
    this.showExpiredModal = false;
    this.showExtensionModal = true;
    this.extensionMessage = '';
  }

  closeExtensionModal(): void {
    this.showExtensionModal = false;
  }

  submitExtensionRequest(): void {
    if (!this.currentVehicle) return;

    if (this.extensionPending || this.currentVehicle.extension_request?.status === 'pending') {
      alert('An extension request is already submitted and awaiting Admin approval.');
      return;
    }

    const vehicleId = this.getEntityId(this.currentVehicle);
    if (!vehicleId) return;

    this.extensionLoading = true;
    this.extensionMessage = '';

    const payload = {
      minutes: Number(this.extensionMinutes),
      reason: this.extensionReason,
      latitude: this.gpsLatitude || undefined,
      longitude: this.gpsLongitude || undefined
    };

    this.vehicleService.requestExtension(vehicleId, payload).subscribe({
      next: () => {
        this.extensionLoading = false;
        this.extensionPending = true;
        if (this.currentVehicle) {
          this.currentVehicle.extension_request = {
            minutes: Number(this.extensionMinutes),
            reason: this.extensionReason,
            requested_at: new Date(),
            status: 'pending'
          };
        }
        this.extensionMessage = '✅ Extension request submitted! Waiting for Admin live approval...';
        this.wsService.emitExtensionRequest({
          vehicle_id: vehicleId,
          registration_number: this.currentVehicle!.registration_number,
          model: this.currentVehicle!.model,
          instructor: this.currentUser?.full_name,
          minutes: this.extensionMinutes,
          reason: this.extensionReason,
          latitude: this.gpsLatitude,
          longitude: this.gpsLongitude
        });
      },
      error: (err: any) => {
        this.extensionLoading = false;
        this.extensionMessage = '❌ Error submitting request: ' + (err.error?.message || 'Server error');
      }
    });
  }

  // ===== REPORT CAR PARKED =====
  openParkedModal(): void {
    this.showWarningModal = false;
    this.showExpiredModal = false;
    this.showExtensionModal = false;
    this.showParkedModal = true;
  }

  closeParkedModal(): void {
    this.showParkedModal = false;
  }

  closeExtensionResultModal(): void {
    this.showExtensionResultModal = false;
  }

  submitParkedReport(): void {
    if (!this.currentVehicle) return;

    const vehicleId = this.getEntityId(this.currentVehicle);
    if (!vehicleId) return;

    this.parkedLoading = true;

    const payload = {
      latitude: this.gpsLatitude || 33.5651,
      longitude: this.gpsLongitude || 73.0169,
      note: this.parkedNote
    };

    this.vehicleService.reportParked(vehicleId, payload).subscribe({
      next: () => {
        this.parkedLoading = false;
        this.isCarReportedParked = true;
        this.closeParkedModal();
        this.showWarningModal = false;
        this.showExpiredModal = false;
        this.showExtensionModal = false;
        this.showExtensionResultModal = false;
        this.warningModalDismissed = true;
        this.expiredModalDismissed = true;
        this.stopGpsSharing();
        this.wsService.emitVehicleParked({
          vehicle_id: vehicleId,
          registration_number: this.currentVehicle!.registration_number,
          instructor: this.currentUser?.full_name,
          latitude: payload.latitude,
          longitude: payload.longitude,
          note: this.parkedNote
        });
        alert('✅ Vehicle successfully reported as parked and secured. Admin has been notified!');
        this.loadDashboardData();
      },
      error: (err) => {
        this.parkedLoading = false;
        alert('❌ Error reporting parked car: ' + (err.error?.message || 'Server error'));
      }
    });
  }
}