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

  // Tracks previously known vehicle states to detect transitions even if websocket is disconnected
  private knownVehicleStates = new Map<string, { status: string; instructor_status?: string; session_start?: string; instructor?: string; model?: string; reg?: string }>();
  private initialVehiclesScanned = false;

  /**
   * Watch for pending extensions and allocation status changes every 3 seconds for Admins
   * Guarantees popups appear even if websocket reconnects or during page loads
   */
  private startPendingExtensionWatcher(): void {
    const interval = setInterval(() => {
      if (this.showLayout && this.authService.isAdmin()) {
        this.checkAdminLiveEvents();
      }
    }, 3000);

    this.subscriptions.push({
      unsubscribe: () => clearInterval(interval)
    } as any);
  }

  private checkAdminLiveEvents(): void {
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
          }
        }

        // 2. Track transitions between assigned -> on_way (Lesson Started) and assigned -> vacant (Declined)
        if (this.initialVehiclesScanned) {
          vehicles.forEach(v => {
            const vId = (v._id || v.id)?.toString();
            if (!vId) return;

            const prev = this.knownVehicleStates.get(vId);
            const currentInstStatus = v.instructor_status;
            const currentStatus = v.status;
            const instructorName = v.current_instructor?.full_name || (typeof v.current_instructor_id === 'object' ? v.current_instructor_id?.full_name : null) || prev?.instructor || 'Instructor';

            // Transition A: Assigned -> On Way (Lesson Started)
            if (prev && prev.instructor_status === 'assigned' && (currentInstStatus === 'on_way' || currentInstStatus === 'in_lesson' || v.session_start)) {
              if (!this.showLessonStartedModal) {
                console.log('🚗 State transition detected: Lesson Started for', v.registration_number);
                this.lessonStartedData = {
                  vehicle_id: vId,
                  registration_number: v.registration_number,
                  model: v.model,
                  instructor: instructorName,
                  time_slot: v.time_slot || 35,
                  latitude: v.latitude,
                  longitude: v.longitude
                };
                this.showLessonStartedModal = true;
                this.cdr.detectChanges();
              }
            }

            // Transition B: Assigned -> Vacant (Allocation Declined)
            if (prev && prev.instructor_status === 'assigned' && currentStatus === 'vacant' && !v.current_instructor_id) {
              if (!this.showAllocationDeclinedModal) {
                console.log('⚠️ State transition detected: Allocation Declined for', prev.reg);
                this.allocationDeclinedData = {
                  vehicle_id: vId,
                  registration_number: prev.reg || v.registration_number,
                  model: prev.model || v.model,
                  instructor: prev.instructor || 'Instructor'
                };
                this.showAllocationDeclinedModal = true;
                this.cdr.detectChanges();
              }
            }
          });
        }

        // Update known vehicle states
        this.knownVehicleStates.clear();
        vehicles.forEach(v => {
          const vId = (v._id || v.id)?.toString();
          if (vId) {
            const instName = v.current_instructor?.full_name || (typeof v.current_instructor_id === 'object' ? v.current_instructor_id?.full_name : null);
            this.knownVehicleStates.set(vId, {
              status: v.status,
              instructor_status: v.instructor_status,
              session_start: v.session_start,
              instructor: instName,
              model: v.model,
              reg: v.registration_number
            });
          }
        });
        this.initialVehiclesScanned = true;
      },
      error: () => {}
    });
  }

  private checkPendingExtensions(): void {
    this.checkAdminLiveEvents();
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

  // ===== GLOBAL LESSON STARTED MODAL ACTIONS =====
  closeLessonStartedModal(): void {
    this.showLessonStartedModal = false;
    this.lessonStartedData = null;
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
    this.showAllocationDeclinedModal = false;
    this.allocationDeclinedData = null;
  }

  reallocateVehicle(): void {
    this.closeAllocationDeclinedModal();
    this.router.navigate(['/admin/vehicles']);
  }
}