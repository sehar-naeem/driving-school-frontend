import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ComplaintService } from '../services/complaint.service';
import { Complaint } from '../models/complaint.model';

@Component({
  selector: 'app-complaints-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './complaints-admin.component.html',
  styleUrls: ['./complaints-admin.component.scss']
})
export class ComplaintsAdminComponent implements OnInit {

  complaints: Complaint[] = [];
  filteredComplaints: Complaint[] = [];
  filterStatus: string = 'all';

  showResponseModal = false;
  selectedComplaint: Complaint | null = null;
  adminResponse = '';

  constructor(private complaintService: ComplaintService) {}

  ngOnInit(): void {
    this.loadComplaints();

    this.complaintService.complaints$.subscribe(complaints => {
      this.complaints = complaints;
      this.applyFilter();
    });
  }

  loadComplaints(): void {
    this.complaintService.getAllComplaints().subscribe({
      next: (complaints) => {
        this.complaints = complaints;
        this.applyFilter();
      },
      error: (err) => {
        console.error('Error loading complaints:', err);
        this.complaints = [];
        this.filteredComplaints = [];
      }
    });
  }

  applyFilter(): void {
    if (this.filterStatus === 'all') {
      this.filteredComplaints = [...this.complaints];
    } else {
      this.filteredComplaints = this.complaints.filter(
        c => c.status === this.filterStatus
      );
    }
  }

  // Helper method to get filtered count
  getFilteredCount(status: string): number {
    if (status === 'all') return this.complaints.length;
    return this.complaints.filter(c => c.status === status).length;
  }

  openResponseModal(complaint: Complaint): void {
    this.selectedComplaint = complaint;
    this.adminResponse = complaint.admin_response || '';
    this.showResponseModal = true;
  }

  closeResponseModal(): void {
    this.showResponseModal = false;
    this.selectedComplaint = null;
    this.adminResponse = '';
  }

  updateComplaintStatus(status: string): void {
    if (this.selectedComplaint) {
      this.complaintService.updateComplaintStatus(
        this.selectedComplaint.id,
        status,
        this.adminResponse
      ).subscribe(() => {
        this.closeResponseModal();
        this.loadComplaints();
      });
    }
  }

  deleteComplaint(id: number): void {
    if (confirm('Are you sure you want to delete this complaint?')) {
      this.complaintService.deleteComplaint(id).subscribe(() => {
        this.loadComplaints();
      });
    }
  }

  getPriorityClass(priority: string): string {
    const classes: any = {
      urgent: 'bg-danger',
      high: 'bg-warning',
      medium: 'bg-info',
      low: 'bg-secondary'
    };
    return classes[priority] || 'bg-secondary';
  }

  getStatusClass(status: string): string {
    const classes: any = {
      pending: 'bg-warning',
      in_progress: 'bg-info',
      resolved: 'bg-success',
      closed: 'bg-secondary'
    };
    return classes[status] || 'bg-secondary';
  }
}