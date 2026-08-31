import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { VehicleService } from '../services/vehicle.service';
import { WebSocketService } from '../services/websocket.service';
import { AuthService } from '../services/auth.service';
import { Vehicle } from '../models/vehicle.model';
import { Subscription } from 'rxjs';

declare var L: any;

@Component({
  selector: 'app-tracking-map',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tracking-map.component.html',
  styleUrls: ['./tracking-map.component.scss']
})
export class TrackingMapComponent implements OnInit, AfterViewInit, OnDestroy {
  vehicles: Vehicle[] = []; // In-use vehicles only
  map: any;
  markers: Map<string, any> = new Map();
  trails: Map<string, any> = new Map();
  
  targetVehicleId: string | null = null;
  private subscriptions: Subscription[] = [];
  private mapLoadAttempts = 0;
  private readonly MAX_MAP_LOAD_ATTEMPTS = 10;

  // Live Extension Modal for Admin
  showExtensionModal: boolean = false;
  activeExtensionRequest: any = null;
  adminReplyMinutes: number = 15;
  adminReplyMessage: string = 'Approved. Please complete the ride and return to school safely as early as you can.';
  adminResponding: boolean = false;

  constructor(
    private vehicleService: VehicleService,
    private wsService: WebSocketService,
    private route: ActivatedRoute,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    // Check if navigated with a specific vehicle to focus
    this.route.queryParams.subscribe(params => {
      if (params['vehicleId']) {
        this.targetVehicleId = params['vehicleId'].toString();
      }
    });

    this.loadVehicles();
    this.setupRealtimeTracking();
  }

  ngAfterViewInit(): void {
    this.initMapWithRetry();
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
    
    // Clear markers & trails
    this.markers.forEach(marker => {
      if (this.map && marker) {
        this.map.removeLayer(marker);
      }
    });
    this.markers.clear();

    this.trails.forEach(trail => {
      if (this.map && trail) {
        this.map.removeLayer(trail);
      }
    });
    this.trails.clear();
    
    if (this.map) {
      this.map.remove();
    }

    // Disconnect WebSocket
    this.wsService.disconnect();
  }

  private initMapWithRetry(): void {
    if (typeof L !== 'undefined') {
      this.initMap();
      return;
    }

    if (this.mapLoadAttempts < this.MAX_MAP_LOAD_ATTEMPTS) {
      this.mapLoadAttempts++;
      console.log(`Waiting for Leaflet Map... Attempt ${this.mapLoadAttempts}`);
      setTimeout(() => this.initMapWithRetry(), 300);
    } else {
      console.error('Leaflet failed to load.');
    }
  }

  loadVehicles(): void {
    const sub = this.vehicleService.getAllVehicles().subscribe({
      next: (response: Vehicle[] | any) => {
        const rawVehicles: Vehicle[] = Array.isArray(response) 
          ? response 
          : (response?.vehicles || response?.data || []);
        
        // 🔒 ONLY show vehicles that are currently in use / busy on the live tracking map
        this.vehicles = rawVehicles.filter((v: Vehicle) => v.status === 'busy');
        console.log('In-use vehicles loaded for live tracking:', this.vehicles);
        
        this.updateMarkers();

        // If a target vehicle was requested in query params, focus it
        if (this.targetVehicleId) {
          const target = this.vehicles.find((v: Vehicle) => (v.id || v._id)?.toString() === this.targetVehicleId);
          if (target) {
            setTimeout(() => this.focusVehicle(target), 500);
          }
        }
      },
      error: (err: any) => {
        console.error('Error loading vehicles:', err);
      }
    });
    this.subscriptions.push(sub);
  }

  initMap(): void {
    const mapElement = document.getElementById('map');
    if (!mapElement) {
      console.error('Map element not found');
      return;
    }

    try {
      // Default center coordinates
      this.map = L.map('map').setView([33.5651, 73.0169], 13);

      // Add OpenStreetMap tiles (100% Free, no API keys needed)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(this.map);

      console.log('✅ Leaflet Map initialized successfully');
      this.updateMarkers();
    } catch (error) {
      console.error('❌ Error initializing Leaflet map:', error);
    }
  }

  updateMarkers(): void {
    if (!this.map || typeof L === 'undefined') {
      return;
    }

    // Clear existing markers
    this.markers.forEach(marker => {
      this.map.removeLayer(marker);
    });
    this.markers.clear();

    const bounds: any[] = [];

    // Add new markers for active in-use vehicles only
    this.vehicles.forEach(vehicle => {
      const marker = this.createMarkerForVehicle(vehicle);
      if (marker) {
        bounds.push([Number(vehicle.latitude), Number(vehicle.longitude)]);
      }
    });

    // Auto fit bounds if vehicles exist and no specific vehicle is targeted
    if (bounds.length > 0 && !this.targetVehicleId) {
      try {
        if (bounds.length === 1) {
          this.map.setView(bounds[0], 15);
        } else {
          this.map.fitBounds(bounds, { padding: [50, 50] });
        }
      } catch (e) {
        console.warn('Could not fit bounds:', e);
      }
    }
  }

  isPendingAcceptance(vehicle: Vehicle): boolean {
    return !vehicle.is_parked && (!vehicle.session_start || vehicle.instructor_status === 'assigned');
  }

  private createMarkerForVehicle(vehicle: Vehicle): any {
    const vehicleId = (vehicle.id || vehicle._id)?.toString();
    if (!vehicleId) return null;

    const isPending = this.isPendingAcceptance(vehicle);
    const isParked = vehicle.is_parked;

    // Use garage base coordinates if pending acceptance or if coordinates are missing
    const lat = isPending ? 33.5651 : (Number(vehicle.latitude) || 33.5651);
    const lng = isPending ? 73.0169 : (Number(vehicle.longitude) || 73.0169);

    if (isNaN(lat) || isNaN(lng)) return null;

    let markerColor = '#ffc107'; // Amber for driving
    let iconClass = 'bi-car-front-fill';

    if (isPending) {
      markerColor = '#6f42c1'; // Purple for pending in garage
      iconClass = 'bi-hourglass-split';
    } else if (isParked) {
      markerColor = '#0dcaf0'; // Cyan for parked
      iconClass = 'bi-p-circle-fill';
    }

    // Custom HTML Marker Icon
    const customIcon = L.divIcon({
      className: 'custom-leaflet-marker',
      html: `
        <div style="
          background-color: ${markerColor};
          color: #ffffff;
          width: 42px;
          height: 42px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 10px rgba(0,0,0,0.4);
          border: 3px solid #ffffff;
          font-size: 20px;
          cursor: pointer;
        ">
          <i class="bi ${iconClass}"></i>
        </div>
      `,
      iconSize: [42, 42],
      iconAnchor: [21, 21],
      popupAnchor: [0, -22]
    });

    const marker = L.marker([lat, lng], { icon: customIcon }).addTo(this.map);
    marker.bindPopup(this.getInfoWindowContent(vehicle));

    this.markers.set(vehicleId, marker);

    // Initialize vehicle movement trail (only if active on road)
    if (!isPending && !this.trails.has(vehicleId)) {
      const trail = L.polyline([[lat, lng]], {
        color: '#0d6efd',
        weight: 4,
        opacity: 0.8,
        dashArray: '6, 8'
      }).addTo(this.map);
      this.trails.set(vehicleId, trail);
    }

    return marker;
  }

  getInstructorName(vehicle: Vehicle): string {
    if (!vehicle) return 'Assigned Instructor';
    if (vehicle.current_instructor && vehicle.current_instructor.full_name) {
      return vehicle.current_instructor.full_name;
    }
    if (typeof vehicle.current_instructor_id === 'object' && (vehicle.current_instructor_id as any)?.full_name) {
      return (vehicle.current_instructor_id as any).full_name;
    }
    return 'Assigned Instructor';
  }

  getInfoWindowContent(vehicle: Vehicle): string {
    const isPending = this.isPendingAcceptance(vehicle);
    const isParked = vehicle.is_parked;

    let statusText = 'In Use (On Road)';
    let statusBg = '#ffc107';
    let statusColor = '#000000';

    if (isPending) {
      statusText = '⏳ Pending (In Garage)';
      statusBg = '#6f42c1';
      statusColor = '#ffffff';
    } else if (isParked) {
      statusText = '🅿️ Parked & Completed';
      statusBg = '#0dcaf0';
      statusColor = '#000000';
    }

    const instructor = this.getInstructorName(vehicle);
    const lat = isPending ? '33.56510' : Number(vehicle.latitude || 33.5651).toFixed(5);
    const lng = isPending ? '73.01690' : Number(vehicle.longitude || 73.0169).toFixed(5);

    return `
      <div style="padding: 10px; min-width: 260px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <h6 style="margin: 0; font-weight: 700; color: #212529; font-size: 16px;">
            <i class="bi bi-car-front-fill" style="color: #0d6efd;"></i> ${vehicle.model}
          </h6>
          <span style="background: ${statusBg}; color: ${statusColor}; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 12px;">
            ${statusText}
          </span>
        </div>
        
        <div style="font-size: 13px; color: #495057; line-height: 1.6;">
          <div><strong>Registration:</strong> <span style="font-family: monospace; font-weight: 600;">${vehicle.registration_number}</span></div>
          <div><strong>Instructor:</strong> <span style="font-weight: 600; color: #0d6efd;">${instructor}</span></div>
          ${vehicle.time_slot ? `<div><strong>Time Slot:</strong> ${vehicle.time_slot} minutes</div>` : ''}
        </div>

        <div style="background: #f0f7ff; border: 1.5px solid #0d6efd; border-radius: 8px; padding: 8px 10px; margin-top: 10px;">
          <div style="font-weight: 700; color: #0d6efd; font-size: 12px; margin-bottom: 2px;">
            <i class="bi ${isPending ? 'bi-house-door-fill' : 'bi-geo-alt-fill text-danger'} me-1"></i>${isPending ? 'LOCATION / STATUS:' : 'CURRENT VEHICLE LOCATION:'}
          </div>
          <div style="font-size: 13px; font-weight: 700; font-family: monospace; color: #1e293b;">
            ${isPending ? '🏫 In Garage (Driving School Bay)' : 'Lat: ' + lat + ' | Lng: ' + lng}
          </div>
        </div>
      </div>
    `;
  }

  focusVehicle(vehicle: Vehicle): void {
    if (!this.map || !vehicle.latitude || !vehicle.longitude) return;

    const lat = Number(vehicle.latitude);
    const lng = Number(vehicle.longitude);
    this.map.setView([lat, lng], 16, { animate: true });

    const vehicleId = (vehicle.id || vehicle._id)?.toString();
    if (vehicleId && this.markers.has(vehicleId)) {
      const marker = this.markers.get(vehicleId);
      marker.openPopup();
    }
  }

  setupRealtimeTracking(): void {
    try {
      this.wsService.connect();
      
      // Subscribe to location updates
      const locationSub = this.wsService.onLocationUpdate().subscribe({
        next: (data: any) => {
          console.log('📍 Real-time location update received:', data);
          this.handleLocationUpdate(data);
        },
        error: (err: any) => {
          console.error('❌ WebSocket location update error:', err);
        }
      });
      this.subscriptions.push(locationSub);

      // Subscribe to vehicle updates
      const vehicleSub = this.wsService.onVehicleUpdate().subscribe({
        next: () => {
          console.log('🔄 Vehicle update received, reloading in-use vehicles');
          this.loadVehicles();
        },
        error: (err: any) => {
          console.error('❌ WebSocket vehicle update error:', err);
        }
      });
      this.subscriptions.push(vehicleSub);

      // Subscribe to parked reports
      const parkedSub = this.wsService.onVehicleParked().subscribe({
        next: (data: any) => {
          console.log('🅿️ Vehicle reported parked:', data);
          this.loadVehicles();
        }
      });
      this.subscriptions.push(parkedSub);

      // 🔔 Subscribe to live extension requests from instructors (Admins only)
      const extSub = this.wsService.onExtensionRequested().subscribe({
        next: (data: any) => {
          if (this.authService.isAdmin()) {
            console.log('🔔 Live extension requested on map (Admin):', data);
            this.activeExtensionRequest = data;
            this.adminReplyMinutes = Number(data.minutes) || 15;
            this.adminReplyMessage = 'Approved. Please complete the ride and return to school safely as early as you can.';
            this.showExtensionModal = true;
          }
          this.loadVehicles();
        }
      });
      this.subscriptions.push(extSub);

    } catch (error) {
      console.error('❌ Error setting up realtime tracking:', error);
    }
  }

  private handleLocationUpdate(data: any): void {
    const vehicleId = (data.vehicle_id || data.vehicleId || data.id)?.toString();
    if (!vehicleId) return;

    const vehicle = this.vehicles.find((v: Vehicle) => 
      (v.id || v._id)?.toString() === vehicleId
    );
    
    if (vehicle) {
      vehicle.latitude = Number(data.latitude);
      vehicle.longitude = Number(data.longitude);
      
      const marker = this.markers.get(vehicleId);
      if (marker && this.map) {
        marker.setLatLng([vehicle.latitude, vehicle.longitude]);
        marker.setPopupContent(this.getInfoWindowContent(vehicle));
        console.log('✅ Marker position updated for in-use vehicle:', vehicleId);
      }

      // Extend movement trail line
      if (this.trails.has(vehicleId)) {
        const trail = this.trails.get(vehicleId);
        trail.addLatLng([vehicle.latitude, vehicle.longitude]);
      } else if (this.map) {
        const trail = L.polyline([[vehicle.latitude, vehicle.longitude]], {
          color: '#0d6efd',
          weight: 4,
          opacity: 0.8,
          dashArray: '6, 8'
        }).addTo(this.map);
        this.trails.set(vehicleId, trail);
      }
    }
  }

  // ===== ADMIN EXTENSION MODAL ACTIONS =====
  openReviewExtensionModal(vehicle: Vehicle): void {
    if (!this.authService.isAdmin()) {
      alert('Only administrators can review and respond to extension requests.');
      return;
    }

    const vehicleId = (vehicle.id || vehicle._id)?.toString();
    this.activeExtensionRequest = {
      vehicle_id: vehicleId,
      registration_number: vehicle.registration_number,
      model: vehicle.model,
      instructor: this.getInstructorName(vehicle),
      minutes: vehicle.extension_request?.minutes || 15,
      reason: vehicle.extension_request?.reason || 'Instructor requested extra lesson time',
      latitude: vehicle.latitude,
      longitude: vehicle.longitude
    };
    this.adminReplyMinutes = Number(this.activeExtensionRequest.minutes) || 15;
    this.adminReplyMessage = 'Approved. Please complete the ride and return to school safely as early as you can.';
    this.showExtensionModal = true;
  }

  closeExtensionModal(): void {
    this.showExtensionModal = false;
    this.activeExtensionRequest = null;
  }

  approveExtension(): void {
    if (!this.activeExtensionRequest) return;
    const vehicleId = this.activeExtensionRequest.vehicle_id;
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
        alert(`✅ Extension of +${extraMinutes} mins approved for ${this.activeExtensionRequest.registration_number}! Instructor notified.`);
        this.closeExtensionModal();
        this.loadVehicles();
      },
      error: (err: any) => {
        this.adminResponding = false;
        alert('Failed to approve extension: ' + (err.error?.message || 'Server error'));
      }
    });
  }

  declineExtension(): void {
    if (!this.activeExtensionRequest) return;
    const vehicleId = this.activeExtensionRequest.vehicle_id;

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
        alert(`Extension declined for ${this.activeExtensionRequest.registration_number}. Instructor notified.`);
        this.closeExtensionModal();
        this.loadVehicles();
      },
      error: (err: any) => {
        this.adminResponding = false;
        alert('Error declining extension: ' + (err.error?.message || 'Server error'));
      }
    });
  }
}