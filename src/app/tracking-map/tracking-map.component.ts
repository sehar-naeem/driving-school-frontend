import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { VehicleService } from '../services/vehicle.service';
import { WebSocketService } from '../services/websocket.service';
import { Vehicle } from '../models/vehicle.model';
import { Subscription } from 'rxjs';

declare var L: any;

@Component({
  selector: 'app-tracking-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tracking-map.component.html',
  styleUrls: ['./tracking-map.component.scss']
})
export class TrackingMapComponent implements OnInit, AfterViewInit, OnDestroy {
  vehicles: Vehicle[] = [];
  map: any;
  markers: Map<string, any> = new Map();
  trails: Map<string, any> = new Map(); // Trail polyline for each vehicle
  
  targetVehicleId: string | null = null;
  private subscriptions: Subscription[] = [];
  private mapLoadAttempts = 0;
  private readonly MAX_MAP_LOAD_ATTEMPTS = 10;

  constructor(
    private vehicleService: VehicleService,
    private wsService: WebSocketService,
    private route: ActivatedRoute
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
      next: (response: any) => {
        console.log('Vehicles loaded:', response);
        this.vehicles = Array.isArray(response) 
          ? response 
          : (response?.vehicles || response?.data || []);
        
        this.updateMarkers();

        // If a target vehicle was requested in query params, focus it
        if (this.targetVehicleId) {
          const target = this.vehicles.find(v => (v.id || v._id)?.toString() === this.targetVehicleId);
          if (target) {
            setTimeout(() => this.focusVehicle(target), 500);
          }
        }
      },
      error: (err) => {
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
      // Default center
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

    // Add new markers
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

  private createMarkerForVehicle(vehicle: Vehicle): any {
    const vehicleId = (vehicle.id || vehicle._id)?.toString();
    if (!vehicleId) return null;

    if (!vehicle.latitude || !vehicle.longitude) return null;

    const lat = Number(vehicle.latitude);
    const lng = Number(vehicle.longitude);

    if (isNaN(lat) || isNaN(lng)) return null;

    const isBusy = vehicle.status === 'busy';
    const markerColor = isBusy ? '#ffc107' : '#28a745';
    const textColor = isBusy ? '#000000' : '#ffffff';

    // Custom HTML Marker Icon
    const customIcon = L.divIcon({
      className: 'custom-leaflet-marker',
      html: `
        <div style="
          background-color: ${markerColor};
          color: ${textColor};
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 3px 8px rgba(0,0,0,0.35);
          border: 2.5px solid #ffffff;
          font-size: 18px;
          cursor: pointer;
        ">
          <i class="bi bi-car-front-fill"></i>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
      popupAnchor: [0, -20]
    });

    const marker = L.marker([lat, lng], { icon: customIcon }).addTo(this.map);
    marker.bindPopup(this.getInfoWindowContent(vehicle));

    this.markers.set(vehicleId, marker);

    // Initialize vehicle movement trail if in use
    if (isBusy && !this.trails.has(vehicleId)) {
      const trail = L.polyline([[lat, lng]], {
        color: '#0d6efd',
        weight: 4,
        opacity: 0.7,
        dashArray: '6, 8'
      }).addTo(this.map);
      this.trails.set(vehicleId, trail);
    }

    return marker;
  }

  getInfoWindowContent(vehicle: Vehicle): string {
    const isBusy = vehicle.status === 'busy';
    const status = isBusy ? 'In Use' : 'Available';
    const statusBg = isBusy ? '#ffc107' : '#28a745';
    const statusText = isBusy ? '#212529' : '#ffffff';
    const instructor = vehicle.current_instructor?.full_name || 'Not Assigned';

    return `
      <div style="padding: 10px; min-width: 230px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <h6 style="margin: 0; font-weight: 700; color: #212529; font-size: 15px;">
            <i class="bi bi-car-front-fill" style="color: #0d6efd;"></i> ${vehicle.model}
          </h6>
          <span style="background: ${statusBg}; color: ${statusText}; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 12px;">
            ${status}
          </span>
        </div>
        <div style="font-size: 13px; color: #495057; line-height: 1.6;">
          <div><strong>Reg Number:</strong> ${vehicle.registration_number}</div>
          <div><strong>Instructor:</strong> ${instructor}</div>
          ${vehicle.time_slot ? `<div><strong>Time Slot:</strong> ${vehicle.time_slot} mins</div>` : ''}
          <div style="margin-top: 4px; font-size: 11px; color: #6c757d;">
            <strong>GPS:</strong> ${Number(vehicle.latitude).toFixed(4)}, ${Number(vehicle.longitude).toFixed(4)}
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
        error: (err) => {
          console.error('❌ WebSocket location update error:', err);
        }
      });
      this.subscriptions.push(locationSub);

      // Subscribe to vehicle updates
      const vehicleSub = this.wsService.onVehicleUpdate().subscribe({
        next: () => {
          console.log('🔄 Vehicle update received, reloading vehicles');
          this.loadVehicles();
        },
        error: (err) => {
          console.error('❌ WebSocket vehicle update error:', err);
        }
      });
      this.subscriptions.push(vehicleSub);
    } catch (error) {
      console.error('❌ Error setting up realtime tracking:', error);
    }
  }

  private handleLocationUpdate(data: any): void {
    const vehicleId = (data.vehicle_id || data.vehicleId || data.id)?.toString();
    if (!vehicleId) return;

    const vehicle = this.vehicles.find(v => 
      (v.id || v._id)?.toString() === vehicleId
    );
    
    if (vehicle) {
      vehicle.latitude = Number(data.latitude);
      vehicle.longitude = Number(data.longitude);
      
      const marker = this.markers.get(vehicleId);
      if (marker && this.map) {
        marker.setLatLng([vehicle.latitude, vehicle.longitude]);
        marker.setPopupContent(this.getInfoWindowContent(vehicle));
        console.log('✅ Marker position updated for vehicle:', vehicleId);
      }

      // Extend movement trail line
      if (this.trails.has(vehicleId)) {
        const trail = this.trails.get(vehicleId);
        trail.addLatLng([vehicle.latitude, vehicle.longitude]);
      } else if (this.map) {
        const trail = L.polyline([[vehicle.latitude, vehicle.longitude]], {
          color: '#0d6efd',
          weight: 4,
          opacity: 0.7,
          dashArray: '6, 8'
        }).addTo(this.map);
        this.trails.set(vehicleId, trail);
      }
    }
  }
}