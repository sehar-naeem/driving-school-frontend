import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ComplaintService } from '../services/complaint.service';
import { Complaint } from '../models/complaint.model';

@Component({
  selector: 'app-my-complaints',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './my-complaint.component.html',
    styleUrls: ['./my-complaint.component.scss']
  
})
export class MyComplaintsComponent implements OnInit {
  // All complaints filed by current instructor
  complaints: Complaint[] = [];
  
  // Filtered complaints based on selected tab
  filteredComplaints: Complaint[] = [];
  
  // Current filter: 'all', 'pending', 'in_progress', 'resolved'
  activeFilter: string = 'all';
  
  loading = false;

  constructor(private complaintService: ComplaintService) {}

  ngOnInit(): void {
    this.loadComplaints();
  }

  // Load all complaints filed by this instructor
  // API Call: GET /api/complaints/my-complaints
  loadComplaints(): void {
    this.loading = true;
    this.complaintService.getMyComplaints().subscribe({
      next: (complaints) => {
        this.complaints = complaints;
        this.applyFilter();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading complaints:', err);
        this.loading = false;
      }
    });
  }

  // Apply filter based on selected tab
  applyFilter(): void {
    if (this.activeFilter === 'all') {
      this.filteredComplaints = this.complaints;
    } else {
      this.filteredComplaints = this.complaints.filter(
        c => c.status === this.activeFilter
      );
    }
  }

  // Change active filter
  setFilter(filter: string): void {
    this.activeFilter = filter;
    this.applyFilter();
  }

  // Get count for each status
  getCount(status: string): number {
    if (status === 'all') return this.complaints.length;
    return this.complaints.filter(c => c.status === status).length;
  }

  // Get CSS class for priority badge
  getPriorityClass(priority: string): string {
    const classes: any = {
      urgent: 'bg-danger',
      high: 'bg-warning',
      medium: 'bg-info',
      low: 'bg-secondary'
    };
    return classes[priority] || 'bg-secondary';
  }

  // Get CSS class for status badge
  getStatusClass(status: string): string {
    const classes: any = {
      pending: 'bg-warning text-dark',
      in_progress: 'bg-info',
      resolved: 'bg-success',
      closed: 'bg-secondary'
    };
    return classes[status] || 'bg-secondary';
  }
}