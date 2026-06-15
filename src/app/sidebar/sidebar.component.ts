import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { User } from '../models/user.model';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit {
  @Input() isCollapsed = false;
  @Output() collapseChange = new EventEmitter<boolean>();

  currentUser: User | null = null;
  isAdmin = false;

  adminMenuItems = [
    { icon: 'bi-speedometer2', label: 'Dashboard', route: '/admin/dashboard', badge: null },
    { icon: 'bi-people-fill', label: 'Instructors', route: '/admin/instructors', badge: null },
    { icon: 'bi-car-front-fill', label: 'Vehicles', route: '/admin/vehicles', badge: null },
    { icon: 'bi-geo-alt-fill', label: 'Live Tracking', route: '/admin/tracking', badge: null },
    { icon: 'bi-chat-dots-fill', label: 'Complaints', route: '/admin/complaints', badge: '3' }
  ];

  instructorMenuItems = [
    { icon: 'bi-speedometer2', label: 'Dashboard', route: '/instructor/dashboard', badge: null },
    { icon: 'bi-exclamation-circle-fill', label: 'File Complaint', route: '/instructor/file-complaint', badge: null },
    { icon: 'bi-list-check', label: 'My Complaints', route: '/instructor/my-complaints', badge: null }
  ];

  constructor(public authService: AuthService) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      this.isAdmin = this.authService.isAdmin();
    });
  }

  get menuItems() {
    return this.isAdmin ? this.adminMenuItems : this.instructorMenuItems;
  }

  // Toggle sidebar collapse/expand
  toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;
    this.collapseChange.emit(this.isCollapsed);
    console.log('Sidebar toggled:', this.isCollapsed); // For debugging
  }

  logout(): void {
    this.authService.logout();
  }
}