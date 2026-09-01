import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ReportService } from '../services/report.service';
import { AuthService } from '../services/auth.service';
import { 
  InstructorReportResponse, 
  ReportSummary, 
  LessonLog 
} from '../models/report.model';
import { User } from '../models/user.model';

@Component({
  selector: 'app-instructor-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './instructor-reports.component.html',
  styleUrls: ['./instructor-reports.component.scss']
})
export class InstructorReportsComponent implements OnInit {
  currentUser: User | null = null;
  loading: boolean = true;
  error: string = '';

  // Filter models
  selectedMonth: string = 'all';
  selectedStatus: string = 'all';
  searchTerm: string = '';

  availableMonths: string[] = [];

  // Summary KPIs
  summary: ReportSummary = {
    total_assigned: 0,
    started_count: 0,
    completed_count: 0,
    declined_count: 0,
    acceptance_rate: 0,
    decline_rate: 0,
    extension_requests: 0,
    extensions_approved: 0,
    extensions_rejected: 0,
    total_minutes: 0,
    total_hours: '0.0'
  };

  myLogs: LessonLog[] = [];

  // Modal Details
  selectedLog: LessonLog | null = null;
  showLogModal: boolean = false;

  constructor(
    private reportService: ReportService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.loadMyReports();
  }

  loadMyReports(): void {
    this.loading = true;
    this.error = '';

    const filters = {
      month: this.selectedMonth,
      status: this.selectedStatus
    };

    this.reportService.getInstructorReports(filters).subscribe({
      next: (res: InstructorReportResponse) => {
        this.loading = false;
        this.summary = res.summary || this.summary;
        this.myLogs = res.logs || [];
        if (res.available_months && res.available_months.length > 0) {
          this.availableMonths = res.available_months;
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loading = false;
        console.error('Failed to load instructor reports:', err);
        this.error = 'Failed to load personal report records: ' + (err?.error?.message || err?.message || 'Server error');
        this.cdr.detectChanges();
      }
    });
  }

  onFilterChange(): void {
    this.loadMyReports();
  }

  resetFilters(): void {
    this.selectedMonth = 'all';
    this.selectedStatus = 'all';
    this.searchTerm = '';
    this.loadMyReports();
  }

  get filteredLogs(): LessonLog[] {
    if (!this.searchTerm.trim()) {
      return this.myLogs;
    }
    const term = this.searchTerm.toLowerCase();
    return this.myLogs.filter(log => 
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
    const filename = `my-instructor-driving-report-${this.selectedMonth || 'all'}.csv`;
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
