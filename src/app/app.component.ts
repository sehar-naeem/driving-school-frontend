import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
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

  // Global Admin Live Lesson Started Modal (Appears on ANY page when instructor acknowledges)
  showLessonStartedModal = false;
  lessonStartedData: any = null;

  // Global Admin Live Allocation Declined Modal (Appears on ANY page when instructor declines)
  showAllocationDeclinedModal = false;
  allocationDeclinedData: any = null;

  private subscriptions: Subscription[] = [];

  constructor(
    private router: Router,
    private authService: AuthService,
    private wsService: WebSocketService,
    private vehicleService: VehicleService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
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
    this.startPendingExtensionWatcher();
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
    } else if (this.showLayout && this.authService.isAdmin()) {
      this.checkPendingExtensions();
    }
  }

  private setupGlobalWebSocket(): void {
    this.wsService.connect();

    // 1. Listen for extension requests from ANY instructor on ANY page
    const extSub = this.wsService.onExtensionRequested().subscribe((data: any) => {
      this.ngZone.run(() => {
        const userStr = typeof localStorage !== 'undefined' ? localStorage.getItem('user') : null;
        const user = userStr ? JSON.parse(userStr) : this.authService.getCurrentUser();
        const isAdminUser = user?.role === 'admin' || this.authService.isAdmin();

        if (isAdminUser) {
          console.log('🔔 Global Admin Notification - Extension requested:', data);
          this.globalExtensionRequest = data;
          this.adminReplyMinutes = Number(data.minutes) || 15;
          this.adminReplyMessage = 'Approved. Please complete the lesson and return to school as early as you can.';
          this.showGlobalExtensionModal = true;
          this.cdr.detectChanges();
        }
      });
    });
    this.subscriptions.push(extSub);

    // 2. Listen for Lesson Started / Instructor On The Way on ANY page
    const lessonSub = this.wsService.onInstructorOnWay().subscribe((data: any) => {
      this.ngZone.run(() => {
        const userStr = typeof localStorage !== 'undefined' ? localStorage.getItem('user') : null;
        const user = userStr ? JSON.parse(userStr) : this.authService.getCurrentUser();
        const isAdminUser = user?.role === 'admin' || this.authService.isAdmin();

        if (isAdminUser) {
          console.log('🚗 Global Admin Notification - Lesson Started / On Way:', data);
          this.lessonStartedData = data;
          this.showLessonStartedModal = true;
          this.cdr.detectChanges();
        }
      });
    });
    this.subscriptions.push(lessonSub);

    // 3. Listen for Allocation Declined by Instructor on ANY page
    const declineSub = this.wsService.onAllocationDeclined().subscribe((data: any) => {
      this.ngZone.run(() => {
        const userStr = typeof localStorage !== 'undefined' ? localStorage.getItem('user') : null;
        const user = userStr ? JSON.parse(userStr) : this.authService.getCurrentUser();
        const isAdminUser = user?.role === 'admin' || this.authService.isAdmin();

        if (isAdminUser) {
          console.log('⚠️ Global Admin Notification - Allocation Declined:', data);
          this.allocationDeclinedData = data;
          this.showAllocationDeclinedModal = true;
          this.cdr.detectChanges();
        }
      });
    });
    this.subscriptions.push(declineSub);
  }

  /**
   * Watch for pending extensions and undismissed vehicle events every 2.5 seconds for Admins
   * Guarantees 100% reliable popups regardless of WebSocket state
   */
  private startPendingExtensionWatcher(): void {
    const interval = setInterval(() => {
      if (this.showLayout && this.authService.isAdmin()) {
        this.checkAdminNotifications();
      }
    }, 2500);

    this.subscriptions.push({
      unsubscribe: () => clearInterval(interval)
    } as any);
  }

  private checkAdminNotifications(): void {
    if (!this.authService.isAdmin()) return;

    this.vehicleService.getAllVehicles().subscribe({
      next: (response: any) => {
        const vehicles: any[] = Array.isArray(response) ? response : (response?.vehicles || response?.data || []);

        // 1. Check for pending extension requests
        if (!this.showGlobalExtensionModal) {
          const pendingVehicle = vehicles.find(v => v.extension_request?.status === 'pending' && !v.is_parked);
          if (pendingVehicle) {
            const instructorName = pendingVehicle.current_instructor?.full_name || (typeof pendingVehicle.current_instructor_id === 'object' ? pendingVehicle.current_instructor_id?.full_name : null) || 'Assigned Instructor';
            this.globalExtensionRequest = {
              vehicle_id: pendingVehicle._id || pendingVehicle.id,
              registration_number: pendingVehicle.registration_number,
              model: pendingVehicle.model,
              instructor: instructorName,
              minutes: pendingVehicle.extension_request?.minutes || 15,
              reason: pendingVehicle.extension_request?.reason || 'Instructor requested extra lesson time',
              latitude: pendingVehicle.latitude,
              longitude: pendingVehicle.longitude
            };
            this.adminReplyMinutes = Number(pendingVehicle.extension_request?.minutes) || 15;
            this.adminReplyMessage = 'Approved. Please complete the lesson and return to school as early as you can.';
            this.showGlobalExtensionModal = true;
            this.cdr.detectChanges();
            return;
          }
        }

        // 2. Check for undismissed Lesson Started events
        if (!this.showLessonStartedModal && !this.showAllocationDeclinedModal && !this.showGlobalExtensionModal) {
          const lessonStartedVehicle = vehicles.find(v => v.last_event?.event_type === 'lesson_started' && v.last_event?.dismissed_by_admin === false);
          if (lessonStartedVehicle) {
            console.log('🚗 Server persistent event detected: Lesson Started for', lessonStartedVehicle.registration_number);
            this.lessonStartedData = {
              vehicle_id: lessonStartedVehicle._id || lessonStartedVehicle.id,
              registration_number: lessonStartedVehicle.registration_number,
              model: lessonStartedVehicle.model,
              instructor: lessonStartedVehicle.last_event.instructor || 'Instructor',
              time_slot: lessonStartedVehicle.time_slot || 35,
              latitude: lessonStartedVehicle.latitude,
              longitude: lessonStartedVehicle.longitude
            };
            this.showLessonStartedModal = true;
            this.cdr.detectChanges();
            return;
          }
        }

        // 3. Check for undismissed Allocation Declined events
        if (!this.showAllocationDeclinedModal && !this.showLessonStartedModal && !this.showGlobalExtensionModal) {
          const declinedVehicle = vehicles.find(v => v.last_event?.event_type === 'allocation_declined' && v.last_event?.dismissed_by_admin === false);
          if (declinedVehicle) {
            console.log('⚠️ Server persistent event detected: Allocation Declined for', declinedVehicle.registration_number);
            this.allocationDeclinedData = {
              vehicle_id: declinedVehicle._id || declinedVehicle.id,
              registration_number: declinedVehicle.registration_number,
              model: declinedVehicle.model,
              instructor: declinedVehicle.last_event.instructor || 'Instructor',
              reason: declinedVehicle.last_event.reason || 'Instructor is unavailable'
            };
            this.showAllocationDeclinedModal = true;
            this.cdr.detectChanges();
            return;
          }
        }
      },
      error: () => {}
    });
  }

  private checkPendingExtensions(): void {
    this.checkAdminNotifications();
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
    this.cdr.detectChanges();
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

  // ===== GLOBAL LESSON STARTED MODAL ACTIONS =====
  closeLessonStartedModal(): void {
    const vehicleId = (this.lessonStartedData?.vehicle_id || this.lessonStartedData?.id)?.toString();
    if (vehicleId) {
      this.vehicleService.dismissVehicleEvent(vehicleId).subscribe({ error: () => {} });
    }
    this.showLessonStartedModal = false;
    this.lessonStartedData = null;
    this.cdr.detectChanges();
  }

  trackLessonOnMap(): void {
    const vehicleId = (this.lessonStartedData?.vehicle_id || this.lessonStartedData?.id)?.toString();
    this.closeLessonStartedModal();
    if (vehicleId) {
      this.router.navigate(['/admin/tracking'], { queryParams: { vehicleId } });
    } else {
      this.router.navigate(['/admin/tracking']);
    }
  }

  // ===== GLOBAL ALLOCATION DECLINED MODAL ACTIONS =====
  closeAllocationDeclinedModal(): void {
    const vehicleId = (this.allocationDeclinedData?.vehicle_id || this.allocationDeclinedData?.id)?.toString();
    if (vehicleId) {
      this.vehicleService.dismissVehicleEvent(vehicleId).subscribe({ error: () => {} });
    }
    this.showAllocationDeclinedModal = false;
    this.allocationDeclinedData = null;
    this.cdr.detectChanges();
  }

  reallocateVehicle(): void {
    const vId = (this.allocationDeclinedData?.vehicle_id || this.allocationDeclinedData?.id)?.toString();
    this.closeAllocationDeclinedModal();
    this.router.navigate(['/admin/vehicles'], { queryParams: { reallocate: vId || 'any', t: Date.now() } });
  }
}