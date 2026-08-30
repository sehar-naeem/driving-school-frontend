import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { SidebarComponent } from './sidebar/sidebar.component';
import { NavbarComponent } from './navbar/navbar.component';
import { AuthService } from './services/auth.service';
import { WebSocketService } from './services/websocket.service';
import { VehicleService } from './services/vehicle.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    RouterOutlet, 
    SidebarComponent, 
    NavbarComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'Driving School Management System';
  
  // Controls whether to show sidebar and navbar
  showLayout = false;
  
  // Controls sidebar collapse state
  sidebarCollapsed = false;

  // Global Admin Live Extension Modal (Appears on ANY page when instructor requests extra time)
  showGlobalExtensionModal = false;
  globalExtensionRequest: any = null;
  adminReplyMinutes = 15;
  adminReplyMessage = 'Approved. Please complete the lesson and return to school as early as you can.';
  adminResponding = false;

  private subscriptions: Subscription[] = [];

  constructor(
    private router: Router,
    private authService: AuthService,
    private wsService: WebSocketService,
    private vehicleService: VehicleService
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

    this.setupGlobalWebSocket();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
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

  private setupGlobalWebSocket(): void {
    this.wsService.connect();

    // Listen for extension requests from ANY instructor on ANY page
    const extSub = this.wsService.onExtensionRequested().subscribe((data: any) => {
      if (this.authService.isAdmin()) {
        console.log('🔔 Global Admin Notification - Extension requested:', data);
        this.globalExtensionRequest = data;
        this.adminReplyMinutes = Number(data.minutes) || 15;
        this.adminReplyMessage = 'Approved. Please complete the lesson and return to school as early as you can.';
        this.showGlobalExtensionModal = true;
      }
    });
    this.subscriptions.push(extSub);
  }

  // Toggle sidebar collapse/expand
  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  // Handle collapse change from sidebar toggle button
  onSidebarCollapseChange(collapsed: boolean): void {
    this.sidebarCollapsed = collapsed;
  }

  // ===== GLOBAL ADMIN EXTENSION ACTIONS =====
  closeGlobalExtensionModal(): void {
    this.showGlobalExtensionModal = false;
    this.globalExtensionRequest = null;
  }

  approveGlobalExtension(): void {
    if (!this.globalExtensionRequest) return;
    const vehicleId = this.globalExtensionRequest.vehicle_id;
    const extraMinutes = Number(this.adminReplyMinutes) || 15;

    this.adminResponding = true;

    this.vehicleService.respondExtension(vehicleId, {
      approved: true,
      additional_minutes: extraMinutes,
      message: this.adminReplyMessage || `Approved +${extraMinutes} minutes by Admin`
    }).subscribe({
      next: () => {
        this.adminResponding = false;
        this.wsService.emitExtensionResponse({
          vehicle_id: vehicleId,
          approved: true,
          additional_minutes: extraMinutes,
          message: this.adminReplyMessage
        });
        alert(`✅ Extension of +${extraMinutes} mins approved for ${this.globalExtensionRequest.registration_number}! Instructor has been notified.`);
        this.closeGlobalExtensionModal();
      },
      error: (err: any) => {
        this.adminResponding = false;
        alert('Failed to approve extension: ' + (err.error?.message || 'Server error'));
      }
    });
  }

  declineGlobalExtension(): void {
    if (!this.globalExtensionRequest) return;
    const vehicleId = this.globalExtensionRequest.vehicle_id;

    this.adminResponding = true;

    this.vehicleService.respondExtension(vehicleId, {
      approved: false,
      message: this.adminReplyMessage || 'Extension declined by Admin. Please return to driving school immediately.'
    }).subscribe({
      next: () => {
        this.adminResponding = false;
        this.wsService.emitExtensionResponse({
          vehicle_id: vehicleId,
          approved: false,
          message: this.adminReplyMessage || 'Extension declined by Admin'
        });
        alert(`Extension declined for ${this.globalExtensionRequest.registration_number}. Instructor has been notified.`);
        this.closeGlobalExtensionModal();
      },
      error: (err: any) => {
        this.adminResponding = false;
        alert('Error declining extension: ' + (err.error?.message || 'Server error'));
      }
    });
  }
}