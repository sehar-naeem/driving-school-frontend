import { Component, Output, EventEmitter, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { User } from '../models/user.model';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent implements OnInit {
  @Output() toggleSidebar = new EventEmitter<void>();
  
  currentUser: User | null = null;
  showProfileMenu = false;
  notificationCount = 2;
  isScrolled = false;
  currentRoute = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Subscribe to current user
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });

    // Subscribe to route changes
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event) => {
      this.currentRoute = event.urlAfterRedirects;
    });

    // Set initial route
    this.currentRoute = this.router.url;
  }

  getUserInitial(): string {
    if (!this.currentUser?.full_name) {
      return 'U';
    }
    return this.currentUser.full_name.charAt(0).toUpperCase();
  }

  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    this.isScrolled = window.pageYOffset > 20;
  }

  // Handle click outside to close dropdown
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.profile-dropdown')) {
      this.showProfileMenu = false;
    }
  }

  toggleProfile(): void {
    this.showProfileMenu = !this.showProfileMenu;
  }

  toggleNotifications(): void {
    // TODO: Implement notification panel
  }

  getCurrentPageTitle(): string {
    const routeMap: { [key: string]: string } = {
      '/admin/dashboard': 'Dashboard',
      '/admin/vehicles': 'Vehicle Management',
      '/admin/instructors': 'Instructors',
      '/admin/students': 'Students',
      '/admin/tracking': 'Live Tracking',
      '/admin/complaints': 'Complaints Management',
      '/admin/reports': 'Reports & Analytics',
      '/admin/settings': 'Settings',
      '/instructor/dashboard': 'Instructor Dashboard',
      '/instructor/schedule': 'My Schedule',
      '/instructor/students': 'My Students',
      '/student/dashboard': 'Student Dashboard',
      '/student/lessons': 'My Lessons',
      '/file-complaint': 'File Complaint',
      '/my-complaint': 'My Complaints'
    };

    // Try exact match first
    if (routeMap[this.currentRoute]) {
      return routeMap[this.currentRoute];
    }

    // Try to match the base path
    for (const route in routeMap) {
      if (this.currentRoute.startsWith(route)) {
        return routeMap[route];
      }
    }

    return 'Dashboard';
  }

  getBreadcrumb(): string {
    return this.getCurrentPageTitle();
  }

  logout(): void {
    this.showProfileMenu = false;
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}