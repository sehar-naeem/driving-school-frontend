import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VehicleService } from '../services/vehicle.service';
import { UserService } from '../services/user.service';
import { VehicleTimerService } from '../services/vehicle-timer.service';
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
  
  // Allocate Modal
  showAllocateModal = false;
  selectedVehicle: Vehicle | null = null;
  allocationData = {
    instructor_id: null as any,
    time_slot: 35
  };

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
    private timerService: VehicleTimerService
  ) {}

  ngOnInit(): void {
    this.loadVehicles();
    this.loadInstructors();
    this.requestNotificationPermission();
    
    // Real-time updates
    this.vehicleService.vehicles$.subscribe(() => {
      this.loadVehicles();
    });

    // Subscribe to timer updates
    this.timerSubscription = this.timerService.timers$.subscribe(() => {
      // Timer updated, component will re-render
    });

    // Check for expired timers every second
    this.checkTimerInterval = interval(1000).subscribe(() => {
      this.checkExpiredTimers();
    });
  }

  ngOnDestroy(): void {
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
    }
    if (this.checkTimerInterval) {
      this.checkTimerInterval.unsubscribe();
    }
  }

  loadVehicles(): void {
    console.log('Loading vehicles...');
    
    this.vehicleService.getVacantVehicles().subscribe({
      next: (vehicles) => {
        console.log('Vacant vehicles loaded:', vehicles);
        this.vacantVehicles = vehicles;
      },
      error: (err) => {
        console.error('Error loading vacant vehicles:', err);
      }
    });

    this.vehicleService.getBusyVehicles().subscribe({
      next: (vehicles) => {
        console.log('Busy vehicles loaded:', vehicles);
        this.busyVehicles = vehicles;
        
        // Start timers for busy vehicles
        this.initializeTimers();
      },
      error: (err) => {
        console.error('Error loading busy vehicles:', err);
      }
    });
  }

  loadInstructors(): void {
    this.userService.getAllInstructors().subscribe({
      next: (instructors) => {
        console.log('Instructors loaded:', instructors);
        this.instructors = instructors.filter(i => i.status === 'active');
      },
      error: (err) => {
        console.error('Error loading instructors:', err);
      }
    });
  }

  /**
   * Initialize timers for all busy vehicles
   */
  initializeTimers(): void {
    this.busyVehicles.forEach(vehicle => {
      const vehicleId = parseInt(vehicle._id || vehicle.id || '0');
      
      // Check if timer already exists
      if (!this.timerService.isTimerExpired(vehicleId)) {
        const remaining = this.calculateRemainingMinutes(vehicle);
        
        if (remaining > 0) {
          this.timerService.startTimer(
            vehicleId,
            vehicle.registration_number,
            remaining
          );
          console.log(`Timer started for ${vehicle.registration_number}: ${remaining} minutes`);
        }
      }
    });
  }

  /**
   * Calculate remaining minutes for a vehicle
   */
  calculateRemainingMinutes(vehicle: Vehicle): number {
    if (!vehicle.session_start || !vehicle.time_slot) return 0;
    
    const startTime = new Date(vehicle.session_start).getTime();
    const currentTime = new Date().getTime();
    const elapsedMinutes = Math.floor((currentTime - startTime) / 60000);
    const remainingMinutes = vehicle.time_slot - elapsedMinutes;
    
    return Math.max(0, remainingMinutes);
  }

  /**
   * Check for expired timers and auto-release vehicles
   */
  checkExpiredTimers(): void {
    this.busyVehicles.forEach(vehicle => {
      const vehicleId = parseInt(vehicle._id || vehicle.id || '0');
      
      if (this.timerService.isTimerExpired(vehicleId)) {
        console.log(`⏰ Timer expired for ${vehicle.registration_number} - Auto-releasing...`);
        this.autoReleaseVehicle(vehicle);
      }
    });
  }

  /**
   * Auto-release vehicle when timer expires
   */
  autoReleaseVehicle(vehicle: Vehicle): void {
    const vehicleId = vehicle._id || vehicle.id;
    if (!vehicleId) return;

    console.log(`Auto-releasing vehicle: ${vehicle.registration_number}`);
    
    // Stop the timer
    this.timerService.stopTimer(parseInt(vehicleId));

    // Release the vehicle
    this.vehicleService.releaseVehicle(vehicleId).subscribe({
      next: (response) => {
        console.log('Vehicle auto-released:', response);
        
        // Show notification
        this.showNotification(
          `⏰ Time's up! Vehicle ${vehicle.registration_number} has been automatically released`,
          'success'
        );
        
        // Reload vehicles
        this.loadVehicles();
      },
      error: (err) => {
        console.error('Auto-release error:', err);
        this.showNotification(
          `Failed to auto-release vehicle ${vehicle.registration_number}`,
          'error'
        );
      }
    });
  }

  /**
   * Get remaining time display for a vehicle
   */
  getRemainingTime(vehicle: Vehicle): string {
    const vehicleId = parseInt(vehicle._id || vehicle.id || '0');
    
    // Try to get from timer service first
    const timerInfo = this.timerService.getTimerInfo(vehicleId);
    if (timerInfo.remaining !== '0s') {
      return timerInfo.remaining;
    }

    // Fallback to calculation
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
      next: (response) => {
        console.log('Vehicle registered:', response);
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
      next: (response) => {
        console.log('Vehicle updated:', response);
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
        console.log('Vehicle deleted');
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
      console.log('Allocating vehicle:', {
        vehicle_id: this.selectedVehicle._id,
        instructor_id: this.allocationData.instructor_id,
        time_slot: this.allocationData.time_slot
      });

      this.vehicleService.allocateVehicle({
        vehicle_id: this.selectedVehicle._id,
        instructor_id: this.allocationData.instructor_id,
        time_slot: this.allocationData.time_slot
      }).subscribe({
        next: (response) => {
          console.log('Vehicle allocated successfully:', response);
          
          // Start timer for allocated vehicle
          const vehicleId = parseInt(this.selectedVehicle!._id || '0');
          this.timerService.startTimer(
            vehicleId,
            this.selectedVehicle!.registration_number,
            this.allocationData.time_slot
          );

          this.showNotification(
            `Vehicle allocated successfully! Timer set for ${this.allocationData.time_slot} minutes`,
            'success'
          );
          
          this.closeAllocateModal();
          this.loadVehicles();
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
    if (confirm('Are you sure you want to release this vehicle?')) {
      console.log('Manually releasing vehicle:', vehicleId);
      
      // Stop timer
      this.timerService.stopTimer(parseInt(vehicleId));
      
      this.vehicleService.releaseVehicle(vehicleId).subscribe({
        next: (response) => {
          console.log('Vehicle released:', response);
          this.showNotification('Vehicle released successfully!', 'success');
          this.loadVehicles();
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
    
    // Browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Vehicle Management', {
        body: message,
        icon: '/assets/icons/car.png',
        badge: '/assets/icons/badge.png'
      });
    }
    
    // Also show alert for now (you can replace with toast notification)
    alert(message);
  }
}