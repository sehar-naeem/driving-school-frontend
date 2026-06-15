import { Injectable } from '@angular/core';
import { BehaviorSubject, interval, Subscription } from 'rxjs';

export interface VehicleTimer {
  vehicleId: number;
  registrationNo: string;
  busyUntil: Date;
  remainingMinutes: number;
  subscription?: Subscription;
}

@Injectable({
  providedIn: 'root'
})
export class VehicleTimerService {
  private timers = new Map<number, VehicleTimer>();
  private timersSubject = new BehaviorSubject<VehicleTimer[]>([]);
  public timers$ = this.timersSubject.asObservable();

  constructor() {
    // Check timers every second
    interval(1000).subscribe(() => {
      this.updateAllTimers();
    });
  }

  /**
   * Start timer for a busy vehicle
   * @param vehicleId - Vehicle ID
   * @param registrationNo - Vehicle registration number
   * @param durationMinutes - How many minutes the vehicle will be busy
   */
  startTimer(vehicleId: number, registrationNo: string, durationMinutes: number): void {
    // Calculate when the vehicle should be released
    const busyUntil = new Date();
    busyUntil.setMinutes(busyUntil.getMinutes() + durationMinutes);

    const timer: VehicleTimer = {
      vehicleId,
      registrationNo,
      busyUntil,
      remainingMinutes: durationMinutes
    };

    this.timers.set(vehicleId, timer);
    this.emitTimers();

    console.log(`✅ Timer started for vehicle ${registrationNo}: ${durationMinutes} minutes`);
    console.log(`⏰ Will expire at: ${busyUntil.toLocaleTimeString()}`);
  }

  /**
   * Stop timer for a vehicle (manual release)
   */
  stopTimer(vehicleId: number): void {
    const timer = this.timers.get(vehicleId);
    if (timer?.subscription) {
      timer.subscription.unsubscribe();
    }
    this.timers.delete(vehicleId);
    this.emitTimers();
    console.log(`⏹️ Timer stopped for vehicle ID: ${vehicleId}`);
  }

  /**
   * Get remaining time for a specific vehicle in minutes
   */
  getRemainingTime(vehicleId: number): number {
    const timer = this.timers.get(vehicleId);
    if (!timer) return 0;

    const now = new Date().getTime();
    const busy = timer.busyUntil.getTime();
    const remainingMs = busy - now;
    
    return Math.max(0, Math.ceil(remainingMs / 60000)); // Convert to minutes
  }

  /**
   * Check if vehicle timer has expired
   */
  isTimerExpired(vehicleId: number): boolean {
    const timer = this.timers.get(vehicleId);
    if (!timer) return false;

    return new Date().getTime() >= timer.busyUntil.getTime();
  }

  /**
   * Get all active timers
   */
  getAllTimers(): VehicleTimer[] {
    return Array.from(this.timers.values());
  }

  /**
   * Format remaining time as "Xh Ym" or "Xm Ys"
   */
  formatRemainingTime(vehicleId: number): string {
    const timer = this.timers.get(vehicleId);
    if (!timer) return '0s';

    const now = new Date().getTime();
    const busy = timer.busyUntil.getTime();
    const remainingMs = busy - now;

    if (remainingMs <= 0) return 'Expired';

    const totalSeconds = Math.floor(remainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Update all timers and check for expired ones
   */
  private updateAllTimers(): void {
    const expiredVehicles: number[] = [];

    this.timers.forEach((timer, vehicleId) => {
      const remaining = this.getRemainingTime(vehicleId);
      timer.remainingMinutes = remaining;

      if (remaining <= 0 && !this.isAlreadyExpired(vehicleId)) {
        expiredVehicles.push(vehicleId);
      }
    });

    // Emit updated timers
    if (expiredVehicles.length > 0 || this.timers.size > 0) {
      this.emitTimers();
    }

    // Handle expired vehicles
    if (expiredVehicles.length > 0) {
      this.handleExpiredVehicles(expiredVehicles);
    }
  }

  private expiredVehicles = new Set<number>();

  /**
   * Check if vehicle has already been marked as expired
   */
  private isAlreadyExpired(vehicleId: number): boolean {
    return this.expiredVehicles.has(vehicleId);
  }

  /**
   * Handle expired vehicle timers
   */
  private handleExpiredVehicles(vehicleIds: number[]): void {
    vehicleIds.forEach(vehicleId => {
      const timer = this.timers.get(vehicleId);
      if (timer && !this.expiredVehicles.has(vehicleId)) {
        console.log(`⏰ Timer expired for vehicle: ${timer.registrationNo}`);
        
        // Mark as expired to prevent multiple triggers
        this.expiredVehicles.add(vehicleId);
        
        // Emit event for expired vehicle
        this.onTimerExpired(vehicleId, timer.registrationNo);
      }
    });
  }

  /**
   * Callback when timer expires
   */
  private onTimerExpired(vehicleId: number, registrationNo: string): void {
    console.log(`🚗 Vehicle ${registrationNo} (ID: ${vehicleId}) timer has expired!`);
    // The component will handle the actual release
  }

  /**
   * Emit current timers to subscribers
   */
  private emitTimers(): void {
    this.timersSubject.next(Array.from(this.timers.values()));
  }

  /**
   * Clear all timers (useful for testing or reset)
   */
  clearAllTimers(): void {
    this.timers.forEach((timer, vehicleId) => {
      if (timer.subscription) {
        timer.subscription.unsubscribe();
      }
    });
    this.timers.clear();
    this.expiredVehicles.clear();
    this.emitTimers();
    console.log('🧹 All timers cleared');
  }

  /**
   * Get timer info for display
   */
  getTimerInfo(vehicleId: number): { remaining: string; isExpired: boolean } {
    return {
      remaining: this.formatRemainingTime(vehicleId),
      isExpired: this.isTimerExpired(vehicleId)
    };
  }

  /**
   * Check if a timer exists for a vehicle
   */
  hasTimer(vehicleId: number): boolean {
    return this.timers.has(vehicleId);
  }

  /**
   * Get the expiry time for a vehicle
   */
  getExpiryTime(vehicleId: number): Date | null {
    const timer = this.timers.get(vehicleId);
    return timer ? timer.busyUntil : null;
  }

  /**
   * Get remaining seconds for a vehicle
   */
  getRemainingSeconds(vehicleId: number): number {
    const timer = this.timers.get(vehicleId);
    if (!timer) return 0;

    const now = new Date().getTime();
    const busy = timer.busyUntil.getTime();
    const remainingMs = busy - now;
    
    return Math.max(0, Math.floor(remainingMs / 1000));
  }

  /**
   * Extend timer for a vehicle
   */
  extendTimer(vehicleId: number, additionalMinutes: number): boolean {
    const timer = this.timers.get(vehicleId);
    if (!timer) {
      console.error(`Cannot extend timer - no timer found for vehicle ${vehicleId}`);
      return false;
    }

    const newBusyUntil = new Date(timer.busyUntil);
    newBusyUntil.setMinutes(newBusyUntil.getMinutes() + additionalMinutes);
    
    timer.busyUntil = newBusyUntil;
    timer.remainingMinutes = this.getRemainingTime(vehicleId);
    
    console.log(`⏰ Timer extended for vehicle ${timer.registrationNo} by ${additionalMinutes} minutes`);
    console.log(`📅 New expiry time: ${newBusyUntil.toLocaleTimeString()}`);
    
    this.emitTimers();
    return true;
  }
}