import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ReportService } from '../services/report.service';
import { UserService } from '../services/user.service';
import { VehicleService } from '../services/vehicle.service';
import { 
  AdminReportResponse, 
  ReportSummary, 
  InstructorPerformance, 
  VehiclePerformance, 
  LessonLog 
} from '../models/report.model';
import { User } from '../models/user.model';
import { Vehicle } from '../models/vehicle.model';

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-reports.component.html',
  styleUrls: ['./admin-reports.component.scss']
})
export class AdminReportsComponent implements OnInit {
  loading: boolean = true;
  error: string = '';

  activeTab: 'instructors' | 'vehicles' | 'logs' = 'instructors';

  // Filter models
  selectedMonth: string = 'all';
  selectedInstructor: string = 'all';
  selectedVehicle: string = 'all';
  selectedStatus: string = 'all';
  searchTerm: string = '';

  // Dropdown lists
  availableMonths: string[] = [];
  instructors: User[] = [];
  vehicles: Vehicle[] = [];

  // Report Data
  summary: ReportSummary = {
    total_allocations: 0,
    started_count: 0,
    completed_count: 0,
    declined_count: 0,
    pending_count: 0,
    acceptance_rate: 0,
    decline_rate: 0,
    extension_requests: 0,
    extensions_approved: 0,
    extensions_rejected: 0,
    total_training_minutes: 0,
    total_training_hours: '0.0'
  };

  instructorBreakdown: InstructorPerformance[] = [];
  vehicleBreakdown: VehiclePerformance[] = [];
  allLogs: LessonLog[] = [];

  // Modal Details
  selectedLog: LessonLog | null = null;
  showLogModal: boolean = false;

  constructor(
    private reportService: ReportService,
    private userService: UserService,
    private vehicleService: VehicleService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadFilterOptions();
    this.loadReports();
  }

  loadFilterOptions(): void {
    this.userService.getAllInstructors().subscribe({
      next: (instructors: User[]) => {
        this.instructors = instructors || [];
      },
      error: () => {}
    });

    this.vehicleService.getAllVehicles().subscribe({
      next: (vehicles: Vehicle[]) => {
        this.vehicles = Array.isArray(vehicles) ? vehicles : [];
      },
      error: () => {}
    });
  }

  loadReports(): void {
    this.loading = true;
    this.error = '';

    const filters = {
      month: this.selectedMonth,
      instructor_id: this.selectedInstructor,
      vehicle_id: this.selectedVehicle,
      status: this.selectedStatus
    };

    this.reportService.getAdminReports(filters).subscribe({
      next: (res: AdminReportResponse) => {
        this.loading = false;
        this.summary = res.summary || this.summary;
        this.instructorBreakdown = res.instructor_breakdown || [];
        this.vehicleBreakdown = res.vehicle_breakdown || [];
        this.allLogs = res.logs || [];
        if (res.available_months && res.available_months.length > 0) {
          this.availableMonths = res.available_months;
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loading = false;
        console.error('Failed to load admin reports:', err);
        this.error = 'Failed to load report data from server: ' + (err?.error?.message || err?.message || 'Server error');
        this.cdr.detectChanges();
      }
    });
  }

  onFilterChange(): void {
    this.loadReports();
  }

  resetFilters(): void {
    this.selectedMonth = 'all';
    this.selectedInstructor = 'all';
    this.selectedVehicle = 'all';
    this.selectedStatus = 'all';
    this.searchTerm = '';
    this.loadReports();
  }

  get filteredLogs(): LessonLog[] {
    if (!this.searchTerm.trim()) {
      return this.allLogs;
    }
    const term = this.searchTerm.toLowerCase();
    return this.allLogs.filter(log => 
      log.instructor_name?.toLowerCase().includes(term) ||
      log.vehicle_model?.toLowerCase().includes(term) ||
      log.registration_number?.toLowerCase().includes(term) ||
      log.status?.toLowerCase().includes(term) ||
      log.declined_reason?.toLowerCase().includes(term)
    );
  }

  openLogDetails(log: LessonLog): void {
    this.selectedLog = log;
    this.showLogModal = true;
  }

  closeLogDetails(): void {
    this.selectedLog = null;
    this.showLogModal = false;
  }

  exportCsv(): void {
    const filename = `driving-school-admin-report-${this.selectedMonth || 'all'}.csv`;
    this.reportService.exportLogsToCsv(this.filteredLogs, filename);
  }

  printReport(): void {
    window.print();
  }

  formatMonthLabel(monthKey: string): string {
    if (!monthKey || monthKey === 'all') return 'All Months';
    const [year, month] = monthKey.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  }
}
