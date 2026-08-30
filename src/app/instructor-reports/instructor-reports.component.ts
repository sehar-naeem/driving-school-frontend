import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { VehicleService } from '../services/vehicle.service';
import { ComplaintService } from '../services/complaint.service';
import { WebSocketService } from '../services/websocket.service';
import { User } from '../models/user.model';
import { Vehicle } from '../models/vehicle.model';
import { Complaint } from '../models/complaint.model';
import { Subscription } from 'rxjs';

export interface InstructorSessionRecord {
  id: string;
  vehicleModel: string;
  registrationNumber: string;
  timeSlot: number;
  extraMinutes: number;
  sessionStart?: Date | null;
  sessionEnd?: Date | null;
  isParked: boolean;
  status: string;
  parkedLocation?: { lat: number; lng: number } | null;
}

export interface PersonalActivityItem {
  id: string;
  timestamp: Date;
  title: string;
  description: string;
  type: 'allocation' | 'on_way' | 'extension' | 'parked' | 'complaint';
  badgeClass: string;
  icon: string;
}

@Component({
  selector: 'app-instructor-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './instructor-reports.component.html',
  styleUrls: ['./instructor-reports.component.scss']
})
export class InstructorReportsComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  currentVehicle: Vehicle | null = null;
  myComplaints: Complaint[] = [];
  
  sessionRecords: InstructorSessionRecord[] = [];
  activityLogs: PersonalActivityItem[] = [];

  // Summary KPIs
  totalSessions = 0;
  totalDurationMinutes = 0;
  totalExtensionsCount = 0;
  totalExtraMinutes = 0;
  complianceScore = 100;

  loading = true;
  private subscriptions: Subscription[] = [];

  constructor(
    private authService: AuthService,
    private vehicleService: VehicleService,
    private complaintService: ComplaintService,
    private wsService: WebSocketService
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.loadMyData();
    this.setupWebSocket();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  private getEntityId(entity: any): string {
    if (!entity) return '';
    if (typeof entity === 'string') return entity;
    return (entity._id || entity.id || '').toString();
  }

  loadMyData(): void {
    if (!this.currentUser) return;
    this.loading = true;
    const myId = this.getEntityId(this.currentUser);

    // 1. Load Vehicles to find my allocations
    this.vehicleService.getAllVehicles().subscribe({
      next: (vehicles: Vehicle[]) => {
        // Find my current or past vehicle
        this.currentVehicle = vehicles.find((v: Vehicle) => {
          const vInstId = this.getEntityId(v.current_instructor_id) || this.getEntityId(v.current_instructor);
          return vInstId && myId && vInstId === myId;
        }) || null;

        // 2. Load my complaints
        this.complaintService.getMyComplaints().subscribe({
          next: (complaints: Complaint[]) => {
            this.myComplaints = complaints;
            this.buildPersonalReport(vehicles);
            this.loading = false;
          },
          error: (err: any) => {
            console.error('Error loading complaints:', err);
            this.buildPersonalReport(vehicles);
            this.loading = false;
          }
        });
      },
      error: (err: any) => {
        console.error('Error loading vehicles:', err);
        this.loading = false;
      }
    });
  }

  private buildPersonalReport(allVehicles: Vehicle[]): void {
    const myId = this.getEntityId(this.currentUser);
    const records: InstructorSessionRecord[] = [];
    const logs: PersonalActivityItem[] = [];

    // Filter vehicles allocated to this instructor
    const myVehicles = allVehicles.filter((v: Vehicle) => {
      const vInstId = this.getEntityId(v.current_instructor_id) || this.getEntityId(v.current_instructor);
      return vInstId && myId && vInstId === myId;
    });

    let totalMins = 0;
    let extCount = 0;
    let extraMins = 0;

    myVehicles.forEach((v: Vehicle) => {
      const isParked = !!v.is_parked;
      const vehicleExtMins = v.extension_request?.status === 'approved' || v.extension_request ? (v.extension_request.minutes || 0) : 0;
      
      if (v.extension_request) {
        extCount++;
        extraMins += vehicleExtMins;
      }

      totalMins += (v.time_slot || 45) + vehicleExtMins;

      let parkLoc: { lat: number; lng: number } | null = null;
      if (v.latitude && v.longitude) {
        parkLoc = { lat: Number(v.latitude), lng: Number(v.longitude) };
      }

      records.push({
        id: (v._id || v.id)?.toString() || '',
        vehicleModel: v.model,
        registrationNumber: v.registration_number,
        timeSlot: v.time_slot || 45,
        extraMinutes: vehicleExtMins,
        sessionStart: v.session_start ? new Date(v.session_start) : null,
        sessionEnd: v.parked_at ? new Date(v.parked_at) : null,
        isParked,
        status: isParked ? 'Completed & Parked' : (v.status === 'busy' ? 'In Progress' : 'Allocated'),
        parkedLocation: parkLoc
      });

      // Personal Activity Logs
      if (v.session_start) {
        logs.push({
          id: `alloc-${v._id}`,
          timestamp: new Date(v.session_start),
          title: `Vehicle Assigned: ${v.model} (${v.registration_number})`,
          description: `You were allocated ${v.model} for a ${v.time_slot}-minute driving session.`,
          type: 'allocation',
          badgeClass: 'bg-primary',
          icon: 'bi-car-front-fill'
        });
      }

      if (v.instructor_status === 'on_way' || v.instructor_status === 'in_lesson') {
        logs.push({
          id: `onway-${v._id}`,
          timestamp: v.instructor_acknowledged_at ? new Date(v.instructor_acknowledged_at) : new Date(),
          title: `Lesson Started / On The Way`,
          description: `You acknowledged the vehicle allocation and started the lesson with your student.`,
          type: 'on_way',
          badgeClass: 'bg-success',
          icon: 'bi-send-check-fill'
        });
      }

      if (v.extension_request) {
        logs.push({
          id: `ext-${v._id}`,
          timestamp: v.extension_request.requested_at ? new Date(v.extension_request.requested_at) : new Date(),
          title: `Time Extension Request (+${v.extension_request.minutes}m)`,
          description: `You requested extra time. Reason: "${v.extension_request.reason || 'Extra driving practice'}"`,
          type: 'extension',
          badgeClass: 'bg-warning text-dark',
          icon: 'bi-clock-history'
        });
      }

      if (isParked) {
        logs.push({
          id: `parked-${v._id}`,
          timestamp: v.parked_at ? new Date(v.parked_at) : new Date(),
          title: `Vehicle Safely Parked & Session Concluded`,
          description: `You reported ${v.model} (${v.registration_number}) parked at driving school grounds.`,
          type: 'parked',
          badgeClass: 'bg-info text-dark',
          icon: 'bi-p-circle-fill'
        });
      }
    });

    // Complaints in activity logs
    this.myComplaints.forEach((c: Complaint) => {
      logs.push({
        id: `comp-${c._id || c.id}`,
        timestamp: c.createdAt ? new Date(c.createdAt) : new Date(),
        title: `Complaint Submitted: ${c.title || 'Vehicle Report'}`,
        description: `${c.description || 'Issue submitted to school administration.'}`,
        type: 'complaint',
        badgeClass: 'bg-danger',
        icon: 'bi-exclamation-triangle-fill'
      });
    });

    // Sort logs descending
    logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    this.sessionRecords = records;
    this.activityLogs = logs;
    this.totalSessions = records.length;
    this.totalDurationMinutes = totalMins;
    this.totalExtensionsCount = extCount;
    this.totalExtraMinutes = extraMins;

    // Calculate personal compliance score (100% minus 5% per pending complaint)
    const penalty = this.myComplaints.length * 5;
    this.complianceScore = Math.max(85, 100 - penalty);
  }

  private setupWebSocket(): void {
    this.wsService.connect();

    const updateSub = this.wsService.onVehicleUpdate().subscribe(() => {
      this.loadMyData();
    });
    this.subscriptions.push(updateSub);

    const extRespSub = this.wsService.onExtensionResponded().subscribe(() => {
      this.loadMyData();
    });
    this.subscriptions.push(extRespSub);
  }

  printReport(): void {
    window.print();
  }
}
