import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private socket?: Socket;
  private readonly SERVER_URL = 'https://driving-school-backend-m80e.onrender.com';

  constructor() {}

  // Connect to WebSocket server
  connect(): void {
    if (!this.socket || !this.socket.connected) {
      this.socket = io(this.SERVER_URL, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5
      });

      this.socket.on('connect', () => {
        console.log('✅ WebSocket connected');
      });

      this.socket.on('disconnect', () => {
        console.log('❌ WebSocket disconnected');
      });

      this.socket.on('error', (error: any) => {
        console.error('WebSocket error:', error);
      });
    }
  }

  // Disconnect from WebSocket server
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  // ========== VEHICLE EVENTS ==========

  // Listen for vehicle location updates
  onLocationUpdate(): Observable<any> {
    return new Observable(observer => {
      this.socket?.on('location:updated', (data: any) => {
        observer.next(data);
      });
    });
  }

  // Listen for vehicle updates
  onVehicleUpdate(): Observable<any> {
    return new Observable(observer => {
      this.socket?.on('vehicle:updated', (data: any) => {
        observer.next(data);
      });
    });
  }

  // ========== ALLOCATION EVENTS ==========

  // Listen for allocation updates
  onAllocationUpdate(): Observable<any> {
    return new Observable(observer => {
      this.socket?.on('allocation:updated', (data: any) => {
        observer.next(data);
      });
    });
  }

  // Listen for new allocations
  onAllocationCreated(): Observable<any> {
    return new Observable(observer => {
      this.socket?.on('allocation:created', (data: any) => {
        observer.next(data);
      });
    });
  }

  // Listen for allocation completion
  onAllocationCompleted(): Observable<any> {
    return new Observable(observer => {
      this.socket?.on('allocation:completed', (data: any) => {
        observer.next(data);
      });
    });
  }

  // Listen for instructor arrival
  onInstructorArrival(): Observable<any> {
    return new Observable(observer => {
      this.socket?.on('instructor:arrived', (data: any) => {
        observer.next(data);
      });
    });
  }

  // Listen for time warnings (10 min, 5 min, etc.)
  onTimeWarning(): Observable<any> {
    return new Observable(observer => {
      this.socket?.on('time:warning', (data: any) => {
        observer.next(data);
      });
    });
  }

  // Listen for delay warnings
  onDelayWarning(): Observable<any> {
    return new Observable(observer => {
      this.socket?.on('delay:warning', (data: any) => {
        observer.next(data);
      });
    });
  }

  // Listen for admin notifications
  onAdminNotification(): Observable<any> {
    return new Observable(observer => {
      this.socket?.on('admin:notification', (data: any) => {
        observer.next(data);
      });
    });
  }

  // Listen for instructor notifications
  onInstructorNotification(): Observable<any> {
    return new Observable(observer => {
      this.socket?.on('instructor:notification', (data: any) => {
        observer.next(data);
      });
    });
  }

  // ========== COMPLAINT EVENTS ==========

  // Listen for complaint updates
  onComplaintUpdate(): Observable<any> {
    return new Observable(observer => {
      this.socket?.on('complaint:updated', (data: any) => {
        observer.next(data);
      });
    });
  }

  // Listen for new complaints
  onComplaintCreated(): Observable<any> {
    return new Observable(observer => {
      this.socket?.on('complaint:created', (data: any) => {
        observer.next(data);
      });
    });
  }

  // Listen for complaint status changes
  onComplaintStatusChanged(): Observable<any> {
    return new Observable(observer => {
      this.socket?.on('complaint:status-changed', (data: any) => {
        observer.next(data);
      });
    });
  }

  // ========== EMIT EVENTS ==========

  // Emit location update (from instructor app)
  emitLocationUpdate(data: { vehicle_id: string; latitude: number; longitude: number }): void {
    this.socket?.emit('location:update', data);
  }

  // Emit instructor arrival
  emitInstructorArrival(allocationId: string): void {
    this.socket?.emit('instructor:arrival', { allocation_id: allocationId });
  }

  // Emit notification acknowledgment
  emitNotificationAck(notificationId: string): void {
    this.socket?.emit('notification:acknowledged', { notification_id: notificationId });
  }
}