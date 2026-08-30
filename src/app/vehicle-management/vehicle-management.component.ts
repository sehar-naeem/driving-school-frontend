import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { VehicleService } from '../services/vehicle.service';
import { UserService } from '../services/user.service';
import { WebSocketService } from '../services/websocket.service';
import { VehicleTimerService, TimerNotification } from '../services/vehicle-timer.service';
import { Vehicle, VehicleCreateRequest } from '../models/vehicle.model';
import { User } from '../models/user.model';
import { Subscription, interval } from 'rxjs';

@Component({
  selector: 'app-vehicle-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './vehicle-management.component.html',
  styleUrls: ['./vehicle-management.component.scss']
})
export class VehicleManagementComponent implements OnInit, OnDestroy {
  activeTab: 'vacant' | 'busy' = 'vacant';
  vacantVehicles: Vehicle[] = [];
  busyVehicles: Vehicle[] = [];
  instructors: User[] = [];
  
  // Timer subscriptions
  private timerSubscription?: Subscription;
  private checkTimerInterval?: Subscription;
  private notificationSubscription?: Subscription;
  private wsSubscriptions: Subscription[] = [];
  
  // Allocate Modal
  showAllocateModal = false;
  selectedVehicle: Vehicle | null = null;
  allocationData = {
    instructor_id: null as any,
    time_slot: 35
  };

  // Warning Modal (5 / 10 mins remaining)
  showWarningModal = false;
  activeWarning: TimerNotification | null = null;

  // Time Expired Action Modal (0 mins remaining)
  showExpiredModal = false;
  activeExpired: TimerNotification | null = null;

  // Live Extension Request Modal (From Instructor)
  showAdminExtensionModal = false;
  incomingExtension: any = null;
  adminReplyMessage: string = 'Approved. Please complete the lesson and return to school as early as possible.';
  adminReplyMinutes: number = 15;

  // Register Modal
  showRegisterModal = false;
  registerLoading = false;
  registerError = '';
  registerFormData: VehicleCreateRequest = {
    registration_number: '',
    model: '',
    manufacturer: '',
    year: new Date().getFullYear(),
    color: ''
  };

  // Edit Modal
  showEditModal = false;
  editLoading = false;
  editError = '';
  selectedEditVehicle: Vehicle | null = null;
  editFormData: any = {
    registration_number: '',
    model: '',
    manufacturer: '',
    year: new Date().getFullYear(),
    color: '',
    status: 'vacant'
  };

  constructor(
    private vehicleService: VehicleService,
    private userService: UserService,
    private timerService: VehicleTimerService,
    private wsService: WebSocketService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadVehicles();
    this.loadInstructors();
    this.requestNotificationPermission();
    this.setupWebSocketListeners();
    
    // Real-time updates
    this.vehicleService.vehicles$.subscribe(() => {
      this.loadVehicles();
    });

    // Subscribe to timer updates
    this.timerSubscription = this.timerService.timers$.subscribe(() => {
      // Component will re-render remaining times
    });

    // Subscribe to timer warnings and expiry notifications
    this.notificationSubscription = this.timerService.notifications$.subscribe(notification => {
      if (notification.type === 'warning_5min' || notification.type === 'warning_10min') {
        this.activeWarning = notification;
        this.showWarningModal = true;
        this.showNotification(`⚠️ Warning: ${notification.message}`, 'warning');
      } else if (notification.type === 'expired') {
        this.activeExpired = notification;
        this.showExpiredModal = true;
        this.showNotification(`⏰ Time Expired: ${notification.message}`, 'error');
      }
    });

    // Check for expired timers every 2 seconds
    this.checkTimerInterval = interval(2000).subscribe(() => {
      this.checkExpiredTimers();
    });
  }

  ngOnDestroy(): void {
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
    }
    if (this.notificationSubscription) {
      this.notificationSubscription.unsubscribe();
    }
    if (this.checkTimerInterval) {
      this.checkTimerInterval.unsubscribe();
    }
    this.wsSubscriptions.forEach(s => s.unsubscribe());
  }

  private setupWebSocketListeners(): void {
    this.wsService.connect();

    // Listen for extension requests from instructors
    const extReqSub = this.wsService.onExtensionRequested().subscribe((data: any) => {
      console.log('🔔 Extension requested by instructor:', data);
      this.incomingExtension = data;
      this.showAdminExtensionModal = true;
      this.showNotification(`⏱️ Extension Request: Instructor ${data.instructor} requested +${data.minutes} mins for ${data.registration_number}`, 'info');
    });
    this.wsSubscriptions.push(extReqSub);

    // Listen for instructor on way updates
    const onWaySub = this.wsService.onInstructorOnWay().subscribe((data: any) => {
      console.log('🚀 Instructor on way:', data);
      this.showNotification(`🚀 Instructor ${data.instructor} acknowledged allocation and is on the way with ${data.registration_number}!`, 'success');
      this.loadVehicles();
    });
    this.wsSubscriptions.push(onWaySub);

    // Listen for parked vehicle reports
    const parkedSub = this.wsService.onVehicleParked().subscribe((data: any) => {
      console.log('🅿️ Vehicle reported parked:', data);
      this.showNotification(`🅿️ Vehicle ${data.registration_number} reported parked by Instructor ${data.instructor} (Lat: ${Number(data.latitude).toFixed(4)}, Lng: ${Number(data.longitude).toFixed(4)})`, 'success');
      this.loadVehicles();
    });
    this.wsSubscriptions.push(parkedSub);
  }

  loadVehicles(): void {
    this.vehicleService.getVacantVehicles().subscribe({
      next: (vehicles) => {
        this.vacantVehicles = vehicles;
      },
      error: (err) => {
        console.error('Error loading vacant vehicles:', err);
      }
    });

    this.vehicleService.getBusyVehicles().subscribe({
      next: (vehicles) => {
        this.busyVehicles = vehicles;
        this.initializeTimers();
      },
      error: (err) => {
        console.error('Error loading busy vehicles:', err);
      }
    });
  }

  loadInstructors(): void {
    this.userService.getAllInstructors().subscribe({
      next: (instructors: User[]) => {
        this.instructors = instructors.filter((i: User) => i.status === 'active');
      },
      error: (err: any) => {
        console.error('Error loading instructors:', err);
      }
    });
  }

  /**
   * Filter out instructors who are already driving / assigned to a busy vehicle
   */
  get availableInstructors(): User[] {
    const busyInstructorIds = new Set<string>();

    this.busyVehicles.forEach((v: Vehicle) => {
      if (v.current_instructor_id) {
        busyInstructorIds.add(v.current_instructor_id.toString());
      }
      if (v.current_instructor && (v.current_instructor._id || (v.current_instructor as any).id)) {
        busyInstructorIds.add((v.current_instructor._id || (v.current_instructor as any).id).toString());
      }
    });

    return this.instructors.filter((i: User) => {
      const id = (i._id || i.id)?.toString();
      if (!id) return true;
      return !busyInstructorIds.has(id) && !i.is_busy;
    });
  }

  /**
   * Initialize timers for all busy vehicles
   */
  initializeTimers(): void {
    this.busyVehicles.forEach((vehicle: Vehicle) => {
      const vehicleId = (vehicle._id || vehicle.id)?.toString();
      if (!vehicleId) return;
      
      if (!this.timerService.hasTimer(vehicleId)) {
        const remaining = this.calculateRemainingMinutes(vehicle);
        if (remaining > 0) {
          const instructorName = vehicle.current_instructor?.full_name || '';
          this.timerService.startTimer(
            vehicleId,
            vehicle.registration_number,
            remaining,
            vehicle.model,
            instructorName
          );
        }
      }
    });
  }

  calculateRemainingMinutes(vehicle: Vehicle): number {
    if (!vehicle.session_start || !vehicle.time_slot) return 0;
    
    const startTime = new Date(vehicle.session_start).getTime();
    const currentTime = new Date().getTime();
    const elapsedMinutes = Math.floor((currentTime - startTime) / 60000);
    const remainingMinutes = vehicle.time_slot - elapsedMinutes;
    
    return Math.max(0, remainingMinutes);
  }

  checkExpiredTimers(): void {
    this.busyVehicles.forEach(vehicle => {
      const vehicleId = (vehicle._id || vehicle.id)?.toString();
      if (!vehicleId) return;
      
      if (this.timerService.isTimerExpired(vehicleId)) {
        // Handled via notification stream
      }
    });
  }

  getRemainingTime(vehicle: Vehicle): string {
    const vehicleId = (vehicle._id || vehicle.id)?.toString();
    if (!vehicleId) return 'N/A';
    
    const timerInfo = this.timerService.getTimerInfo(vehicleId);
    if (timerInfo.remaining !== '0s') {
      return timerInfo.remaining;
    }

    if (!vehicle.session_start || !vehicle.time_slot) return 'N/A';
    
    const startTime = new Date(vehicle.session_start).getTime();
    const currentTime = new Date().getTime();
    const elapsedMinutes = Math.floor((currentTime - startTime) / 60000);
    const remainingMinutes = vehicle.time_slot - elapsedMinutes;
    
    if (remainingMinutes <= 0) return 'Expired';
    
    const hours = Math.floor(remainingMinutes / 60);
    const minutes = remainingMinutes % 60;
    
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  // ===== LIVE EXTENSION REQUEST ACTIONS (ADMIN) =====
  approveIncomingExtension(): void {
    if (!this.incomingExtension) return;
    const vehicleId = this.incomingExtension.vehicle_id;
    const extraMinutes = Number(this.adminReplyMinutes) || Number(this.incomingExtension.minutes) || 15;

    this.vehicleService.respondExtension(vehicleId, {
      approved: true,
      additional_minutes: extraMinutes,
      message: this.adminReplyMessage || `Approved +${extraMinutes} minutes by Admin`
    }).subscribe({
      next: () => {
        this.timerService.extendTimer(vehicleId, extraMinutes);
        this.wsService.emitExtensionResponse({
          vehicle_id: vehicleId,
          approved: true,
          additional_minutes: extraMinutes,
          message: this.adminReplyMessage
        });
        this.showNotification(`✅ Extension of +${extraMinutes} mins approved for ${this.incomingExtension.registration_number}`, 'success');
        this.closeAdminExtensionModal();
        this.loadVehicles();
      },
      error: (err: any) => {
        console.error('Approve error:', err);
        alert('Failed to approve extension: ' + (err.error?.message || 'Server error'));
      }
    });
  }

  declineIncomingExtension(): void {
    if (!this.incomingExtension) return;
    const vehicleId = this.incomingExtension.vehicle_id;

    this.vehicleService.respondExtension(vehicleId, {
      approved: false,
      message: this.adminReplyMessage || 'Extension declined by Admin. Please return to school immediately.'
    }).subscribe({
      next: () => {
        this.wsService.emitExtensionResponse({
          vehicle_id: vehicleId,
          approved: false,
          message: this.adminReplyMessage || 'Extension declined by Admin'
        });
        this.showNotification(`Extension declined for ${this.incomingExtension.registration_number}`, 'info');
        this.closeAdminExtensionModal();
      },
      error: (err: any) => {
        console.error('Decline error:', err);
      }
    });
  }

  closeAdminExtensionModal(): void {
    this.showAdminExtensionModal = false;
    this.incomingExtension = null;
  }

  // ===== WARNING MODAL ACTIONS =====
  checkWarningOnMap(): void {
    const vehicleId = this.activeWarning?.vehicleId;
    this.closeWarningModal();
    if (vehicleId) {
      this.router.navigate(['/admin/tracking-map'], { queryParams: { vehicleId } });
    }
  }

  closeWarningModal(): void {
    this.showWarningModal = false;
    this.activeWarning = null;
  }

  // ===== EXPIRED MODAL ACTIONS =====
  releaseExpiredVehicle(): void {
    if (!this.activeExpired) return;
    const vehicleId = this.activeExpired.vehicleId;
    this.closeExpiredModal();
    this.releaseVehicle(vehicleId);
  }

  extendExpiredVehicle(minutes: number = 15): void {
    if (!this.activeExpired) return;
    const vehicleId = this.activeExpired.vehicleId;
    this.vehicleService.respondExtension(vehicleId, { approved: true, additional_minutes: minutes }).subscribe({
      next: () => {
        this.timerService.extendTimer(vehicleId, minutes);
        this.showNotification(`Vehicle session extended by ${minutes} minutes!`, 'success');
        this.closeExpiredModal();
        this.loadVehicles();
      }
    });
  }

  closeExpiredModal(): void {
    this.showExpiredModal = false;
    this.activeExpired = null;
  }

  // ===== REGISTER VEHICLE MODAL =====
  openRegisterModal(): void {
    this.registerFormData = {
      registration_number: '',
      model: '',
      manufacturer: '',
      year: new Date().getFullYear(),
      color: ''
    };
    this.registerError = '';
    this.showRegisterModal = true;
  }

  closeRegisterModal(): void {
    this.showRegisterModal = false;
    this.registerError = '';
  }

  registerVehicle(): void {
    if (!this.registerFormData.registration_number || !this.registerFormData.model || 
        !this.registerFormData.manufacturer || !this.registerFormData.year || 
        !this.registerFormData.color) {
      this.registerError = 'Please fill in all required fields';
      return;
    }

    this.registerLoading = true;
    this.registerError = '';

    this.vehicleService.createVehicle(this.registerFormData).subscribe({
      next: () => {
        this.showNotification('Vehicle registered successfully!', 'success');
        this.closeRegisterModal();
        this.loadVehicles();
        this.registerLoading = false;
      },
      error: (err) => {
        console.error('Registration error:', err);
        this.registerError = err.error?.message || 'Failed to register vehicle';
        this.registerLoading = false;
      }
    });
  }

  // ===== EDIT VEHICLE MODAL =====
  openEditModal(vehicle: Vehicle): void {
    this.selectedEditVehicle = vehicle;
    this.editFormData = {
      registration_number: vehicle.registration_number,
      model: vehicle.model,
      manufacturer: vehicle.manufacturer,
      year: vehicle.year,
      color: vehicle.color,
      status: vehicle.status
    };
    this.editError = '';
    this.showEditModal = true;
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.selectedEditVehicle = null;
    this.editError = '';
  }

  updateVehicle(): void {
    if (!this.selectedEditVehicle) return;

    if (!this.editFormData.model || !this.editFormData.manufacturer || 
        !this.editFormData.year || !this.editFormData.color) {
      this.editError = 'Please fill in all required fields';
      return;
    }

    this.editLoading = true;
    this.editError = '';

    const vehicleId = this.selectedEditVehicle._id || this.selectedEditVehicle.id;
    if (!vehicleId) {
      this.editError = 'Invalid vehicle ID';
      this.editLoading = false;
      return;
    }

    const updateData = {
      model: this.editFormData.model,
      manufacturer: this.editFormData.manufacturer,
      year: this.editFormData.year,
      color: this.editFormData.color,
      status: this.editFormData.status
    };

    this.vehicleService.updateVehicle(vehicleId, updateData).subscribe({
      next: () => {
        this.showNotification('Vehicle updated successfully!', 'success');
        this.closeEditModal();
        this.loadVehicles();
        this.editLoading = false;
      },
      error: (err) => {
        console.error('Update error:', err);
        this.editError = err.error?.message || 'Failed to update vehicle';
        this.editLoading = false;
      }
    });
  }

  // ===== DELETE VEHICLE =====
  deleteVehicle(vehicle: Vehicle): void {
    if (!confirm(`Are you sure you want to delete ${vehicle.model} (${vehicle.registration_number})? This action cannot be undone.`)) {
      return;
    }

    const vehicleId = vehicle._id || vehicle.id;
    if (!vehicleId) {
      this.showNotification('Invalid vehicle ID', 'error');
      return;
    }

    this.vehicleService.deleteVehicle(vehicleId).subscribe({
      next: () => {
        this.showNotification('Vehicle deleted successfully!', 'success');
        this.loadVehicles();
      },
      error: (err) => {
        console.error('Delete error:', err);
        this.showNotification('Failed to delete vehicle: ' + (err?.error?.message || 'Unknown error'), 'error');
      }
    });
  }

  // ===== ALLOCATE VEHICLE MODAL =====
  openAllocateModal(vehicle: Vehicle): void {
    this.selectedVehicle = vehicle;
    this.allocationData = {
      instructor_id: null,
      time_slot: 35
    };
    this.showAllocateModal = true;
  }

  closeAllocateModal(): void {
    this.showAllocateModal = false;
    this.selectedVehicle = null;
  }

  allocateVehicle(): void {
    if (this.selectedVehicle && this.allocationData.instructor_id) {
      const vehicleId = (this.selectedVehicle._id || this.selectedVehicle.id)?.toString() || '';
      
      this.vehicleService.allocateVehicle({
        vehicle_id: vehicleId,
        instructor_id: this.allocationData.instructor_id,
        time_slot: this.allocationData.time_slot
      }).subscribe({
        next: () => {
          const instructorName = this.instructors.find(i => (i._id || i.id)?.toString() === this.allocationData.instructor_id?.toString())?.full_name || '';
          
          this.timerService.startTimer(
            vehicleId,
            this.selectedVehicle!.registration_number,
            this.allocationData.time_slot,
            this.selectedVehicle!.model,
            instructorName
          );

          this.showNotification(
            `Vehicle allocated successfully! Timer set for ${this.allocationData.time_slot} minutes`,
            'success'
          );
          
          this.closeAllocateModal();
          this.loadVehicles();
          this.loadInstructors();
        },
        error: (err) => {
          console.error('Allocation error:', err);
          this.showNotification('Failed to allocate vehicle: ' + (err?.error?.message || 'Unknown error'), 'error');
        }
      });
    }
  }

  // ===== RELEASE VEHICLE =====
  releaseVehicle(vehicleId: string): void {
    if (!vehicleId) return;

    if (confirm('Are you sure you want to release this vehicle?')) {
      const id = vehicleId.toString();
      this.timerService.stopTimer(id);
      
      this.vehicleService.releaseVehicle(id).subscribe({
        next: () => {
          this.showNotification('Vehicle released successfully!', 'success');
          this.loadVehicles();
          this.loadInstructors();
        },
        error: (err) => {
          console.error('Release error:', err);
          this.showNotification('Failed to release vehicle: ' + (err?.error?.message || 'Unknown error'), 'error');
        }
      });
    }
  }

  /**
   * Request notification permission
   */
  requestNotificationPermission(): void {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          console.log('Notification permission granted');
        }
      });
    }
  }

  /**
   * Show notification
   */
  private showNotification(message: string, type: 'info' | 'success' | 'warning' | 'error'): void {
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // Browser desktop notification if permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('Driving School Management', {
          body: message,
          icon: '/favicon.ico'
        });
      } catch (e) {
        // Fallback
      }
    }
  }
}