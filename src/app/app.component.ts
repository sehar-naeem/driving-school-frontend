import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { SidebarComponent } from './sidebar/sidebar.component';
import { NavbarComponent } from './navbar/navbar.component';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, 
    RouterOutlet, 
    SidebarComponent, 
    NavbarComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'Driving School Management System';
  
  // Controls whether to show sidebar and navbar
  showLayout = false;
  
  // Controls sidebar collapse state
  sidebarCollapsed = false;

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Check initial route
    this.checkRoute(this.router.url);
    
    // Listen to route changes
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event) => {
      this.checkRoute(event.urlAfterRedirects);
    });
  }

  // Check if current route should show layout
  private checkRoute(url: string): void {
    // Hide layout on login and register pages
    const publicRoutes = ['/login', '/register', '/'];
    this.showLayout = !publicRoutes.some(route => url === route || url.startsWith(route + '?'));
    
    // If not on public route, check if user is authenticated
    if (this.showLayout && !this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
    }
  }

  // Toggle sidebar collapse/expand
  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    console.log('App component - Sidebar collapsed:', this.sidebarCollapsed);
  }

  // Handle collapse change from sidebar toggle button
  onSidebarCollapseChange(collapsed: boolean): void {
    this.sidebarCollapsed = collapsed;
    console.log('Sidebar collapse changed from sidebar:', collapsed);
  }
}