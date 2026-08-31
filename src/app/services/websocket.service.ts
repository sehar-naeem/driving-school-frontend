import { Injectable, NgZone } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private socket?: Socket;
  private readonly SERVER_URL = 'https://driving-school-backend-m80e.onrender.com';

  // Centralized RxJS Subjects for resilient event streaming
  private locationUpdateSubject = new Subject<any>();
  private vehicleUpdateSubject = new Subject<any>();
  private allocationUpdateSubject = new Subject<any>();
  private allocationCreatedSubject = new Subject<any>();
  private allocationCompletedSubject = new Subject<any>();
  private allocationDeclinedSubject = new Subject<any>();
  private instructorArrivalSubject = new Subject<any>();
  private timeWarningSubject = new Subject<any>();
  private delayWarningSubject = new Subject<any>();
  private adminNotificationSubject = new Subject<any>();
  private instructorNotificationSubject = new Subject<any>();
  private complaintUpdateSubject = new Subject<any>();
  private complaintCreatedSubject = new Subject<any>();
  private complaintStatusChangedSubject = new Subject<any>();
  private extensionRequestedSubject = new Subject<any>();
  private extensionRespondedSubject = new Subject<any>();
  private instructorOnWaySubject = new Subject<any>();
  private vehicleParkedSubject = new Subject<any>();

  constructor(private ngZone: NgZone) {
    this.connect();
  }

  // Connect to WebSocket server and register all listeners
  connect(): void {
    if (!this.socket || !this.socket.connected) {
      this.socket = io(this.SERVER_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 10
      });

      this.socket.on('connect', () => {
        console.log('✅ WebSocket connected to server:', this.SERVER_URL);
      });

      this.socket.on('disconnect', () => {
        console.log('❌ WebSocket disconnected');
      });

      this.socket.on('error', (error: any) => {
        console.error('WebSocket error:', error);
      });

      // Stream events into Subjects inside Angular zone
      this.socket.on('location:updated', (data: any) => this.ngZone.run(() => this.locationUpdateSubject.next(data)));
      this.socket.on('location:update', (data: any) => this.ngZone.run(() => this.locationUpdateSubject.next(data)));
      this.socket.on('vehicle:updated', (data: any) => this.ngZone.run(() => this.vehicleUpdateSubject.next(data)));
      this.socket.on('allocation:updated', (data: any) => this.ngZone.run(() => this.allocationUpdateSubject.next(data)));
      this.socket.on('allocation:created', (data: any) => this.ngZone.run(() => this.allocationCreatedSubject.next(data)));
      this.socket.on('allocation:completed', (data: any) => this.ngZone.run(() => this.allocationCompletedSubject.next(data)));
      this.socket.on('allocation:declined', (data: any) => this.ngZone.run(() => this.allocationDeclinedSubject.next(data)));
      this.socket.on('instructor:arrived', (data: any) => this.ngZone.run(() => this.instructorArrivalSubject.next(data)));
      this.socket.on('time:warning', (data: any) => this.ngZone.run(() => this.timeWarningSubject.next(data)));
      this.socket.on('delay:warning', (data: any) => this.ngZone.run(() => this.delayWarningSubject.next(data)));
      this.socket.on('admin:notification', (data: any) => this.ngZone.run(() => this.adminNotificationSubject.next(data)));
      this.socket.on('instructor:notification', (data: any) => this.ngZone.run(() => this.instructorNotificationSubject.next(data)));
      this.socket.on('complaint:updated', (data: any) => this.ngZone.run(() => this.complaintUpdateSubject.next(data)));
      this.socket.on('complaint:created', (data: any) => this.ngZone.run(() => this.complaintCreatedSubject.next(data)));
      this.socket.on('complaint:status-changed', (data: any) => this.ngZone.run(() => this.complaintStatusChangedSubject.next(data)));
      
      // Extension & Parking
      this.socket.on('extension:requested', (data: any) => {
        console.log('⚡ Socket event received: extension:requested', data);
        this.ngZone.run(() => this.extensionRequestedSubject.next(data));
      });
      this.socket.on('extension:request', (data: any) => {
        console.log('⚡ Socket event received: extension:request', data);
        this.ngZone.run(() => this.extensionRequestedSubject.next(data));
      });
      this.socket.on('extension:responded', (data: any) => {
        console.log('⚡ Socket event received: extension:responded', data);
        this.ngZone.run(() => this.extensionRespondedSubject.next(data));
      });
      this.socket.on('extension:respond', (data: any) => {
        console.log('⚡ Socket event received: extension:respond', data);
        this.ngZone.run(() => this.extensionRespondedSubject.next(data));
      });
      this.socket.on('instructor:on_way', (data: any) => {
        console.log('⚡ Socket event received: instructor:on_way', data);
        this.ngZone.run(() => this.instructorOnWaySubject.next(data));
      });
      this.socket.on('vehicle:parked', (data: any) => {
        console.log('⚡ Socket event received: vehicle:parked', data);
        this.ngZone.run(() => this.vehicleParkedSubject.next(data));
      });
    }
  }

  // Disconnect from WebSocket server
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  // ========== VEHICLE OBSERVABLES ==========
  onLocationUpdate(): Observable<any> {
    return this.locationUpdateSubject.asObservable();
  }

  onVehicleUpdate(): Observable<any> {
    return this.vehicleUpdateSubject.asObservable();
  }

  // ========== ALLOCATION OBSERVABLES ==========
  onAllocationUpdate(): Observable<any> {
    return this.allocationUpdateSubject.asObservable();
  }

  onAllocationCreated(): Observable<any> {
    return this.allocationCreatedSubject.asObservable();
  }

  onAllocationCompleted(): Observable<any> {
    return this.allocationCompletedSubject.asObservable();
  }

  onAllocationDeclined(): Observable<any> {
    return this.allocationDeclinedSubject.asObservable();
  }

  onInstructorArrival(): Observable<any> {
    return this.instructorArrivalSubject.asObservable();
  }

  onTimeWarning(): Observable<any> {
    return this.timeWarningSubject.asObservable();
  }

  onDelayWarning(): Observable<any> {
    return this.delayWarningSubject.asObservable();
  }

  onAdminNotification(): Observable<any> {
    return this.adminNotificationSubject.asObservable();
  }

  onInstructorNotification(): Observable<any> {
    return this.instructorNotificationSubject.asObservable();
  }

  // ========== COMPLAINT OBSERVABLES ==========
  onComplaintUpdate(): Observable<any> {
    return this.complaintUpdateSubject.asObservable();
  }

  onComplaintCreated(): Observable<any> {
    return this.complaintCreatedSubject.asObservable();
  }

  onComplaintStatusChanged(): Observable<any> {
    return this.complaintStatusChangedSubject.asObservable();
  }

  // ========== EXTENSION & PARKING OBSERVABLES ==========
  onExtensionRequested(): Observable<any> {
    return this.extensionRequestedSubject.asObservable();
  }

  onExtensionResponded(): Observable<any> {
    return this.extensionRespondedSubject.asObservable();
  }

  onInstructorOnWay(): Observable<any> {
    return this.instructorOnWaySubject.asObservable();
  }

  onVehicleParked(): Observable<any> {
    return this.vehicleParkedSubject.asObservable();
  }

  // ========== EMITTERS ==========
  emitLocationUpdate(data: { vehicle_id: string; latitude: number; longitude: number }): void {
    this.connect();
    this.socket?.emit('location:update', data);
  }

  emitInstructorOnWay(data: any): void {
    this.connect();
    this.socket?.emit('instructor:on_way', data);
  }

  emitAllocationDeclined(data: any): void {
    this.connect();
    this.socket?.emit('allocation:declined', data);
  }

  emitInstructorArrival(allocationId: string): void {
    this.connect();
    this.socket?.emit('instructor:arrival', { allocation_id: allocationId });
  }

  emitNotificationAck(notificationId: string): void {
    this.connect();
    this.socket?.emit('notification:acknowledged', { notification_id: notificationId });
  }

  emitExtensionRequest(data: any): void {
    this.connect();
    this.socket?.emit('extension:request', data);
  }

  emitExtensionResponse(data: any): void {
    this.connect();
    this.socket?.emit('extension:respond', data);
  }

  emitVehicleParked(data: any): void {
    this.connect();
    this.socket?.emit('vehicle:park', data);
  }
}