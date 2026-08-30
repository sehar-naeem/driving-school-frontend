import { Injectable } from '@angular/core';
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

  constructor() {
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

      // Stream events into Subjects
      this.socket.on('location:updated', (data: any) => this.locationUpdateSubject.next(data));
      this.socket.on('location:update', (data: any) => this.locationUpdateSubject.next(data));
      this.socket.on('vehicle:updated', (data: any) => this.vehicleUpdateSubject.next(data));
      this.socket.on('allocation:updated', (data: any) => this.allocationUpdateSubject.next(data));
      this.socket.on('allocation:created', (data: any) => this.allocationCreatedSubject.next(data));
      this.socket.on('allocation:completed', (data: any) => this.allocationCompletedSubject.next(data));
      this.socket.on('instructor:arrived', (data: any) => this.instructorArrivalSubject.next(data));
      this.socket.on('time:warning', (data: any) => this.timeWarningSubject.next(data));
      this.socket.on('delay:warning', (data: any) => this.delayWarningSubject.next(data));
      this.socket.on('admin:notification', (data: any) => this.adminNotificationSubject.next(data));
      this.socket.on('instructor:notification', (data: any) => this.instructorNotificationSubject.next(data));
      this.socket.on('complaint:updated', (data: any) => this.complaintUpdateSubject.next(data));
      this.socket.on('complaint:created', (data: any) => this.complaintCreatedSubject.next(data));
      this.socket.on('complaint:status-changed', (data: any) => this.complaintStatusChangedSubject.next(data));
      
      // Extension & Parking
      this.socket.on('extension:requested', (data: any) => {
        console.log('⚡ Socket event received: extension:requested', data);
        this.extensionRequestedSubject.next(data);
      });
      this.socket.on('extension:request', (data: any) => {
        console.log('⚡ Socket event received: extension:request', data);
        this.extensionRequestedSubject.next(data);
      });
      this.socket.on('extension:responded', (data: any) => {
        console.log('⚡ Socket event received: extension:responded', data);
        this.extensionRespondedSubject.next(data);
      });
      this.socket.on('extension:respond', (data: any) => {
        console.log('⚡ Socket event received: extension:respond', data);
        this.extensionRespondedSubject.next(data);
      });
      this.socket.on('instructor:on_way', (data: any) => this.instructorOnWaySubject.next(data));
      this.socket.on('vehicle:parked', (data: any) => this.vehicleParkedSubject.next(data));
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