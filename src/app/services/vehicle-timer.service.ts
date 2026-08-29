import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject, interval, Subscription } from 'rxjs';

export interface VehicleTimer {
  vehicleId: string;
  registrationNo: string;
  model?: string;
  instructorName?: string;
  busyUntil: Date;
  timeSlotMinutes: number;
  remainingMinutes: number;
  subscription?: Subscription;
}

export interface TimerNotification {
  vehicleId: string;
  registrationNo: string;
  model?: string;
  instructorName?: string;
  minutesRemaining: number;
  type: 'warning_10min' | 'warning_5min' | 'expired';
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class VehicleTimerService {
  private timers = new Map<string, VehicleTimer>();
  private timersSubject = new BehaviorSubject<VehicleTimer[]>([]);
  public timers$ = this.timersSubject.asObservable();

  // Notification Streams
  private notificationSubject = new Subject<TimerNotification>();
  public notifications$ = this.notificationSubject.asObservable();

  private warnedVehicles = new Map<string, Set<string>>(); // vehicleId -> Set of triggered alert types

  constructor() {
    // Check timers every second
    interval(1000).subscribe(() => {
      this.updateAllTimers();
    });
  }

  /**
   * Start timer for a busy vehicle
   */
  startTimer(
    vehicleId: string, 
    registrationNo: string, 
    durationMinutes: number, 
    model: string = '', 
    instructorName: string = ''
  ): void {
    const id = vehicleId.toString();
    const busyUntil = new Date();
    busyUntil.setMinutes(busyUntil.getMinutes() + durationMinutes);

    const timer: VehicleTimer = {
      vehicleId: id,
      registrationNo,
      model,
      instructorName,
      busyUntil,
      timeSlotMinutes: durationMinutes,
      remainingMinutes: durationMinutes
    };

    this.timers.set(id, timer);
    this.warnedVehicles.set(id, new Set<string>());
    this.emitTimers();

    console.log(`✅ Timer started for vehicle ${registrationNo} (${id}): ${durationMinutes} mins. Expire at: ${busyUntil.toLocaleTimeString()}`);
  }

  /**
   * Stop timer for a vehicle (release)
   */
  stopTimer(vehicleId: string): void {
    const id = vehicleId.toString();
    const timer = this.timers.get(id);
    if (timer?.subscription) {
      timer.subscription.unsubscribe();
    }
    this.timers.delete(id);
    this.warnedVehicles.delete(id);
    this.emitTimers();
    console.log(`⏹️ Timer stopped for vehicle ID: ${id}`);
  }

  /**
   * Get remaining seconds
   */
  getRemainingSeconds(vehicleId: string): number {
    const id = vehicleId.toString();
    const timer = this.timers.get(id);
    if (!timer) return 0;

    const now = new Date().getTime();
    const busy = timer.busyUntil.getTime();
    const remainingMs = busy - now;
    
    return Math.max(0, Math.floor(remainingMs / 1000));
  }

  /**
   * Get remaining minutes
   */
  getRemainingMinutes(vehicleId: string): number {
    const remainingSec = this.getRemainingSeconds(vehicleId);
    return Math.ceil(remainingSec / 60);
  }

  /**
   * Check if vehicle timer has expired
   */
  isTimerExpired(vehicleId: string): boolean {
    const id = vehicleId.toString();
    const timer = this.timers.get(id);
    if (!timer) return false;

    return new Date().getTime() >= timer.busyUntil.getTime();
  }

  /**
   * Format remaining time for UI
   */
  formatRemainingTime(vehicleId: string): string {
    const id = vehicleId.toString();
    const timer = this.timers.get(id);
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
   * Update all timers and trigger warning / expiry notifications
   */
  private updateAllTimers(): void {
    if (this.timers.size === 0) return;

    this.timers.forEach((timer, id) => {
      const remainingSec = this.getRemainingSeconds(id);
      const remainingMin = Math.ceil(remainingSec / 60);
      timer.remainingMinutes = remainingMin;

      const warnings = this.warnedVehicles.get(id) || new Set<string>();

      // 1. Check for 10-Minute Warning (for sessions > 15 mins)
      if (timer.timeSlotMinutes > 15 && remainingSec <= 600 && remainingSec > 300 && !warnings.has('warning_10min')) {
        warnings.add('warning_10min');
        this.notificationSubject.next({
          vehicleId: id,
          registrationNo: timer.registrationNo,
          model: timer.model,
          instructorName: timer.instructorName,
          minutesRemaining: 10,
          type: 'warning_10min',
          message: `Vehicle ${timer.registrationNo} has 10 minutes remaining.`
        });
      }

      // 2. Check for 5-Minute Warning (or 30-sec warning for 1-minute test slots)
      const isShortSlot = timer.timeSlotMinutes === 1;
      const is5MinTrigger = !isShortSlot && remainingSec <= 300 && remainingSec > 0;
      const isShortSlotTrigger = isShortSlot && remainingSec <= 30 && remainingSec > 0;

      if ((is5MinTrigger || isShortSlotTrigger) && !warnings.has('warning_5min')) {
        warnings.add('warning_5min');
        const displayMin = isShortSlot ? 0.5 : 5;
        this.notificationSubject.next({
          vehicleId: id,
          registrationNo: timer.registrationNo,
          model: timer.model,
          instructorName: timer.instructorName,
          minutesRemaining: displayMin,
          type: 'warning_5min',
          message: `Vehicle ${timer.registrationNo} has only ${isShortSlot ? '30 seconds' : '5 minutes'} left.`
        });
      }

      // 3. Check for Time Expired (0 remaining)
      if (remainingSec <= 0 && !warnings.has('expired')) {
        warnings.add('expired');
        this.notificationSubject.next({
          vehicleId: id,
          registrationNo: timer.registrationNo,
          model: timer.model,
          instructorName: timer.instructorName,
          minutesRemaining: 0,
          type: 'expired',
          message: `Session time expired for vehicle ${timer.registrationNo}.`
        });
      }

      this.warnedVehicles.set(id, warnings);
    });

    this.emitTimers();
  }

  /**
   * Extend timer by additional minutes
   */
  extendTimer(vehicleId: string, additionalMinutes: number): boolean {
    const id = vehicleId.toString();
    const timer = this.timers.get(id);
    if (!timer) return false;

    const newBusyUntil = new Date(Math.max(timer.busyUntil.getTime(), new Date().getTime()));
    newBusyUntil.setMinutes(newBusyUntil.getMinutes() + additionalMinutes);

    timer.busyUntil = newBusyUntil;
    timer.timeSlotMinutes += additionalMinutes;
    timer.remainingMinutes = this.getRemainingMinutes(id);

    // Reset warnings
    this.warnedVehicles.set(id, new Set<string>());
    this.emitTimers();
    console.log(`⏰ Timer extended for ${timer.registrationNo} by ${additionalMinutes} mins`);
    return true;
  }

  getTimerInfo(vehicleId: string): { remaining: string; isExpired: boolean } {
    const id = vehicleId.toString();
    return {
      remaining: this.formatRemainingTime(id),
      isExpired: this.isTimerExpired(id)
    };
  }

  hasTimer(vehicleId: string): boolean {
    return this.timers.has(vehicleId.toString());
  }

  private emitTimers(): void {
    this.timersSubject.next(Array.from(this.timers.values()));
  }
}