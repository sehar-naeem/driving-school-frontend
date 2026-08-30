import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService } from '../services/user.service';
import { VehicleService } from '../services/vehicle.service';
import { ComplaintService } from '../services/complaint.service';
import { WebSocketService } from '../services/websocket.service';
import { User } from '../models/user.model';
import { Vehicle } from '../models/vehicle.model';
import { Complaint } from '../models/complaint.model';
import { Subscription } from 'rxjs';

export interface InstructorReport {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  isBusy: boolean;
  activeVehicle?: Vehicle | null;
  totalSessions: number;
  totalDurationMinutes: number;
  extensionsGranted: number;
  extraMinutesTotal: number;
  complaintsFiled: number;
  lastKnownLocation?: { lat: number; lng: number } | null;
  lastParkedAt?: Date | null;
  complianceScore: number;
}

export interface ActivityLogItem {
  id: string;
  timestamp: Date;
  type: 'allocation' | 'on_way' | 'extension_request' | 'extension_approved' | 'parked' | 'complaint';
  title: string;
  description: string;
  instructorName?: string;
  vehicleReg?: string;
  location?: { lat: number; lng: number } | null;
  badgeClass: string;
  icon: string;
}

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-reports.component.html',
  styleUrls: ['./admin-reports.component.scss']
})
export class AdminReportsComponent implements OnInit, OnDestroy {
  instructors: User[] = [];
  vehicles: Vehicle[] = [];
  complaints: Complaint[] = [];
  
  instructorReports: InstructorReport[] = [];
  activityLogs: ActivityLogItem[] = [];
  
  // Search and filter state
  searchQuery: string = '';
  activityFilter: string = 'all';
  
  // Summary Stats
  totalSessionsCount = 0;
  totalExtensionsCount = 0;
  totalExtraMinutes = 0;
  activeInstructorsCount = 0;
  totalComplianceRate = 100;

  loading = true;
  private subscriptions: Subscription[] = [];

  constructor(
    private userService: UserService,
    private vehicleService: VehicleService,
    private complaintService: ComplaintService,
    private wsService: WebSocketService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadAllData();
    this.setupWebSocket();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  private getEntityId(entity: any): string {
    if (!entity) return '';
    if (typeof entity === 'string' || typeof entity === 'number') return entity.toString();
    return (entity._id || entity.id || '').toString();
  }

  loadAllData(): void {
    this.loading = true;

    this.userService.getAllInstructors().subscribe({
      next: (instructors: User[]) => {
        this.instructors = instructors.filter((i: User) => i.status === 'active');
        
        this.vehicleService.getAllVehicles().subscribe({
          next: (vehicles: Vehicle[]) => {
            this.vehicles = vehicles;

            this.complaintService.getAllComplaints().subscribe({
              next: (complaints: Complaint[]) => {
                this.complaints = complaints;
                this.buildReportsAndLogs();
                this.loading = false;
              },
              error: (err: any) => {
                console.error('Error loading complaints:', err);
                this.buildReportsAndLogs();
                this.loading = false;
              }
            });
          },
          error: (err: any) => {
            console.error('Error loading vehicles:', err);
            this.loading = false;
          }
        });
      },
      error: (err: any) => {
        console.error('Error loading instructors:', err);
        this.loading = false;
      }
    });
  }

  private buildReportsAndLogs(): void {
    const reports: InstructorReport[] = [];
    const logs: ActivityLogItem[] = [];

    this.instructors.forEach((instructor: User) => {
      const instId = this.getEntityId(instructor);
      
      // Find current vehicle assigned to this instructor
      const assignedVehicle = this.vehicles.find((v: Vehicle) => {
        const vInstId = this.getEntityId(v.current_instructor_id) || this.getEntityId(v.current_instructor);
        return vInstId && instId && vInstId === instId;
      });

      // Find complaints filed by or against this instructor
      const instComplaints = this.complaints.filter((c: Complaint) => {
        const cInstId = this.getEntityId(c.instructor_id) || this.getEntityId(c.instructor);
        return cInstId && instId && cInstId === instId;
      });

      // Calculate sessions & extensions
      let sessions = 0;
      let totalMinutes = 0;
      let extensions = 0;
      let extraMins = 0;
      let lastLoc: { lat: number; lng: number } | null = null;
      let lastParked: Date | null = null;
      const isBusy = assignedVehicle?.status === 'busy';

      if (assignedVehicle) {
        const vehicleId = this.getEntityId(assignedVehicle);
        sessions += 1;
        totalMinutes += assignedVehicle.time_slot || 45;

        if (assignedVehicle.latitude && assignedVehicle.longitude) {
          lastLoc = {
            lat: Number(assignedVehicle.latitude),
            lng: Number(assignedVehicle.longitude)
          };
        }

        if (assignedVehicle.is_parked && assignedVehicle.parked_at) {
          lastParked = new Date(assignedVehicle.parked_at);
        }

        if (assignedVehicle.extension_request) {
          extensions += 1;
          extraMins += assignedVehicle.extension_request.minutes || 15;
        }

        // Generate activity log items for active vehicle
        if (assignedVehicle.session_start) {
          logs.push({
            id: `alloc-${vehicleId}`,
            timestamp: new Date(assignedVehicle.session_start),
            type: 'allocation',
            title: `Vehicle Allocation: ${assignedVehicle.model}`,
            description: `Allocated ${assignedVehicle.registration_number} to ${instructor.full_name} for ${assignedVehicle.time_slot} minutes session.`,
            instructorName: instructor.full_name,
            vehicleReg: assignedVehicle.registration_number,
            location: lastLoc,
            badgeClass: 'bg-primary',
            icon: 'bi-car-front-fill'
          });
        }

        if (assignedVehicle.instructor_status === 'on_way' || assignedVehicle.instructor_status === 'in_lesson') {
          logs.push({
            id: `onway-${vehicleId}`,
            timestamp: assignedVehicle.instructor_acknowledged_at ? new Date(assignedVehicle.instructor_acknowledged_at) : new Date(),
            type: 'on_way',
            title: `Lesson In Progress`,
            description: `${instructor.full_name} acknowledged allocation and started driving session.`,
            instructorName: instructor.full_name,
            vehicleReg: assignedVehicle.registration_number,
            location: lastLoc,
            badgeClass: 'bg-success',
            icon: 'bi-send-check-fill'
          });
        }

        if (assignedVehicle.is_parked) {
          logs.push({
            id: `parked-${vehicleId}`,
            timestamp: assignedVehicle.parked_at ? new Date(assignedVehicle.parked_at) : new Date(),
            type: 'parked',
            title: `Vehicle Parked & Session Completed`,
            description: `${instructor.full_name} safely parked ${assignedVehicle.registration_number} at driving school grounds.`,
            instructorName: instructor.full_name,
            vehicleReg: assignedVehicle.registration_number,
            location: lastLoc,
            badgeClass: 'bg-info',
            icon: 'bi-p-circle-fill'
          });
        }

        if (assignedVehicle.extension_request) {
          logs.push({
            id: `ext-${vehicleId}`,
            timestamp: assignedVehicle.extension_request.requested_at ? new Date(assignedVehicle.extension_request.requested_at) : new Date(),
            type: 'extension_approved',
            title: `Time Extension (+${assignedVehicle.extension_request.minutes}m)`,
            description: `Session extended for ${instructor.full_name}. Reason: ${assignedVehicle.extension_request.reason || 'Instructor requested extra time'}`,
            instructorName: instructor.full_name,
            vehicleReg: assignedVehicle.registration_number,
            location: lastLoc,
            badgeClass: 'bg-warning text-dark',
            icon: 'bi-clock-history'
          });
        }
      }

      // Add complaints to activity log
      instComplaints.forEach((c: Complaint) => {
        const compId = this.getEntityId(c) || Math.random().toString();
        const dateVal = c.createdAt || c.created_at;
        logs.push({
          id: `comp-${compId}`,
          timestamp: dateVal ? new Date(dateVal) : new Date(),
          type: 'complaint',
          title: `Complaint Filed: ${c.title || 'Vehicle/Lesson issue'}`,
          description: `Filed by ${instructor.full_name}: ${c.description || 'Details reported'}`,
          instructorName: instructor.full_name,
          vehicleReg: c.vehicle ? c.vehicle.registration_number : undefined,
          badgeClass: 'bg-danger',
          icon: 'bi-exclamation-triangle-fill'
        });
      });

      // Calculate compliance score (80-100% based on complaints)
      const penalty = (instComplaints.length * 5);
      const compliance = Math.max(80, 100 - penalty);

      reports.push({
        id: instId || '',
        name: instructor.full_name,
        email: instructor.email,
        phone: instructor.phone || 'N/A',
        status: isBusy ? 'On Road (Driving)' : 'Available',
        isBusy,
        activeVehicle: assignedVehicle,
        totalSessions: sessions,
        totalDurationMinutes: totalMinutes + extraMins,
        extensionsGranted: extensions,
        extraMinutesTotal: extraMins,
        complaintsFiled: instComplaints.length,
        lastKnownLocation: lastLoc,
        lastParkedAt: lastParked,
        complianceScore: compliance
      });
    });

    // Sort logs descending by timestamp
    logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    this.instructorReports = reports;
    this.activityLogs = logs;

    // Calculate aggregate totals
    this.totalSessionsCount = reports.reduce((acc, r) => acc + r.totalSessions, 0);
    this.totalExtensionsCount = reports.reduce((acc, r) => acc + r.extensionsGranted, 0);
    this.totalExtraMinutes = reports.reduce((acc, r) => acc + r.extraMinutesTotal, 0);
    this.activeInstructorsCount = reports.filter(r => r.isBusy).length;
    
    if (reports.length > 0) {
      const sumCompliance = reports.reduce((acc, r) => acc + r.complianceScore, 0);
      this.totalComplianceRate = Math.round(sumCompliance / reports.length);
    }
  }

  private setupWebSocket(): void {
    this.wsService.connect();

    const updateSub = this.wsService.onVehicleUpdate().subscribe(() => {
      this.loadAllData();
    });
    this.subscriptions.push(updateSub);

    const locSub = this.wsService.onLocationUpdate().subscribe((data: any) => {
      const vehicleId = this.getEntityId(data.vehicle_id || data.vehicleId || data.id);
      const report = this.instructorReports.find(r => this.getEntityId(r.activeVehicle) === vehicleId);
      if (report) {
        report.lastKnownLocation = { lat: Number(data.latitude), lng: Number(data.longitude) };
      }
    });
    this.subscriptions.push(locSub);
  }

  get filteredReports(): InstructorReport[] {
    if (!this.searchQuery.trim()) return this.instructorReports;
    const q = this.searchQuery.toLowerCase();
    return this.instructorReports.filter(r => 
      r.name.toLowerCase().includes(q) || 
      r.email.toLowerCase().includes(q) ||
      (r.activeVehicle?.registration_number && r.activeVehicle.registration_number.toLowerCase().includes(q))
    );
  }

  get filteredActivityLogs(): ActivityLogItem[] {
    let list = this.activityLogs;

    if (this.activityFilter !== 'all') {
      list = list.filter(l => l.type === this.activityFilter);
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(l => 
        (l.instructorName && l.instructorName.toLowerCase().includes(q)) ||
        (l.vehicleReg && l.vehicleReg.toLowerCase().includes(q)) ||
        l.title.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q)
      );
    }

    return list;
  }

  navigateToMap(vehicle: any): void {
    const vehicleId = this.getEntityId(vehicle);
    if (vehicleId) {
      this.router.navigate(['/admin/tracking'], { queryParams: { vehicleId } });
    } else {
      this.router.navigate(['/admin/tracking']);
    }
  }

  printReport(): void {
    window.print();
  }
}
