import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AdminReportResponse, InstructorReportResponse, LessonLog } from '../models/report.model';

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  private readonly API_URL = 'https://driving-school-backend-m80e.onrender.com/api/reports';

  constructor(private http: HttpClient) {}

  /**
   * Get comprehensive Admin reports & analytics
   */
  getAdminReports(filters: { month?: string; instructor_id?: string; vehicle_id?: string; status?: string } = {}): Observable<AdminReportResponse> {
    let params = new HttpParams();
    if (filters.month) params = params.set('month', filters.month);
    if (filters.instructor_id) params = params.set('instructor_id', filters.instructor_id);
    if (filters.vehicle_id) params = params.set('vehicle_id', filters.vehicle_id);
    if (filters.status) params = params.set('status', filters.status);

    return this.http.get<AdminReportResponse>(`${this.API_URL}/admin`, { params });
  }

  /**
   * Get personal reports for logged-in instructor
   */
  getInstructorReports(filters: { month?: string; status?: string } = {}): Observable<InstructorReportResponse> {
    let params = new HttpParams();
    if (filters.month) params = params.set('month', filters.month);
    if (filters.status) params = params.set('status', filters.status);

    return this.http.get<InstructorReportResponse>(`${this.API_URL}/instructor`, { params });
  }

  /**
   * Export logs to downloadable CSV format
   */
  exportLogsToCsv(logs: LessonLog[], filename: string = 'driving-school-report.csv'): void {
    if (!logs || logs.length === 0) {
      alert('No records available to export.');
      return;
    }

    const headers = [
      'Date & Time',
      'Instructor Name',
      'Vehicle Model',
      'Registration #',
      'Status',
      'Initial Slot (mins)',
      'Total Duration (mins)',
      'Extensions Count',
      'Extensions Approved',
      'Declined Reason',
      'Parked Notes'
    ];

    const csvRows = [headers.join(',')];

    logs.forEach(log => {
      const dateStr = log.allocated_at ? new Date(log.allocated_at).toLocaleString().replace(/,/g, ' ') : 'N/A';
      const instName = `"${(log.instructor_name || '').replace(/"/g, '""')}"`;
      const model = `"${(log.vehicle_model || '').replace(/"/g, '""')}"`;
      const reg = `"${(log.registration_number || '').replace(/"/g, '""')}"`;
      const status = log.status || 'N/A';
      const initialSlot = log.initial_time_slot || 35;
      const totalDuration = log.total_duration_minutes || initialSlot;
      
      const extCount = log.extensions ? log.extensions.length : 0;
      const extApproved = log.extensions ? log.extensions.filter(e => e.status === 'approved').length : 0;
      const decReason = `"${(log.declined_reason || '').replace(/"/g, '""')}"`;
      const notes = `"${(log.parked_note || '').replace(/"/g, '""')}"`;

      csvRows.push([
        dateStr,
        instName,
        model,
        reg,
        status,
        initialSlot,
        totalDuration,
        extCount,
        extApproved,
        decReason,
        notes
      ].join(','));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
