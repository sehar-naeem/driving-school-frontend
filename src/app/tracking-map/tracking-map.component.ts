import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VehicleService } from '../services/vehicle.service';
import { WebSocketService } from '../services/websocket.service';
import { Vehicle } from '../models/vehicle.model';
import { Subscription } from 'rxjs';

declare var google: any;

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
  infoWindows: Map<string, any> = new Map();
  
  private subscriptions: Subscription[] = [];
  private mapLoadAttempts = 0;
  private readonly MAX_MAP_LOAD_ATTEMPTS = 10;

  constructor(
    private vehicleService: VehicleService,
    private wsService: WebSocketService
  ) {}

  ngOnInit(): void {
    this.loadVehicles();
    this.setupRealtimeTracking();
  }

  ngAfterViewInit(): void {
    this.initMapWithRetry();
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
    
    // Clear markers
    this.markers.forEach(marker => marker.setMap(null));
    this.markers.clear();
    this.infoWindows.clear();
    
    // Disconnect WebSocket
    this.wsService.disconnect();
  }

  private initMapWithRetry(): void {
    if (typeof google !== 'undefined' && google.maps) {
      this.initMap();
      return;
    }

    if (this.mapLoadAttempts < this.MAX_MAP_LOAD_ATTEMPTS) {
      this.mapLoadAttempts++;
      console.log(`Waiting for Google Maps... Attempt ${this.mapLoadAttempts}`);
      setTimeout(() => this.initMapWithRetry(), 500);
    } else {
      console.error('Google Maps failed to load. Please check your API key.');
    }
  }

  loadVehicles(): void {
    const sub = this.vehicleService.getAllVehicles().subscribe({
      next: (response: any) => {
        console.log('Vehicles loaded:', response);
        // Handle both array and object responses
        this.vehicles = Array.isArray(response) 
          ? response 
          : (response?.vehicles || response?.data || []);
        
        this.updateMarkers();
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

    const mapOptions = {
      center: { lat: 33.5651, lng: 73.0169 }, // Rawalpindi coordinates
      zoom: 13,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      zoomControl: true,
      mapTypeControl: true,
      scaleControl: true,
      streetViewControl: false,
      rotateControl: false,
      fullscreenControl: true,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }]
        }
      ]
    };

    try {
      this.map = new google.maps.Map(mapElement, mapOptions);
      console.log('✅ Map initialized successfully');
      
      // Wait for map to be fully loaded
      google.maps.event.addListenerOnce(this.map, 'idle', () => {
        console.log('✅ Map is ready');
        this.updateMarkers();
      });
    } catch (error) {
      console.error('❌ Error initializing map:', error);
    }
  }

  updateMarkers(): void {
    if (!this.map) {
      console.log('⏳ Map not ready yet');
      return;
    }

    // Clear existing markers
    this.markers.forEach(marker => {
      marker.setMap(null);
    });
    this.markers.clear();
    this.infoWindows.forEach(iw => iw.close());
    this.infoWindows.clear();

    console.log('🔄 Updating markers for', this.vehicles.length, 'vehicles');

    // Add new markers
    this.vehicles.forEach(vehicle => {
      this.createMarkerForVehicle(vehicle);
    });

    // Fit map bounds to show all markers
    if (this.markers.size > 0) {
      const bounds = new google.maps.LatLngBounds();
      this.markers.forEach(marker => {
        bounds.extend(marker.getPosition());
      });
      this.map.fitBounds(bounds);
      
      // Don't zoom in too much if there's only one vehicle
      if (this.markers.size === 1) {
        this.map.setZoom(15);
      }
    }

    console.log('✅ Markers updated:', this.markers.size);
  }

  private createMarkerForVehicle(vehicle: Vehicle): void {
    const vehicleId = vehicle.id || vehicle._id;
    if (!vehicleId) {
      console.warn('Vehicle has no ID:', vehicle);
      return;
    }

    // Validate coordinates
    if (!vehicle.latitude || !vehicle.longitude) {
      console.warn('Vehicle has invalid coordinates:', vehicle);
      return;
    }

    const position = { 
      lat: Number(vehicle.latitude), 
      lng: Number(vehicle.longitude) 
    };
    
    // Create custom marker icon
    const markerIcon = {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 14,
      fillColor: vehicle.status === 'busy' ? '#ffc107' : '#28a745',
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 3
    };

    // Create marker
    const marker = new google.maps.Marker({
      position: position,
      map: this.map,
      title: `${vehicle.model} - ${vehicle.registration_number}`,
      icon: markerIcon,
      animation: google.maps.Animation.DROP,
      optimized: true
    });

    // Create info window
    const infoWindow = new google.maps.InfoWindow({
      content: this.getInfoWindowContent(vehicle)
    });

    // Add click listener
    marker.addListener('click', () => {
      // Close all other info windows
      this.infoWindows.forEach(iw => iw.close());
      infoWindow.open(this.map, marker);
    });

    this.markers.set(vehicleId, marker);
    this.infoWindows.set(vehicleId, infoWindow);
  }

  getInfoWindowContent(vehicle: Vehicle): string {
    const status = vehicle.status === 'busy' ? 'In Use' : 'Available';
    const statusColor = vehicle.status === 'busy' ? '#ffc107' : '#28a745';
    const instructor = vehicle.current_instructor?.full_name || 'Not Assigned';

    return `
      <div style="padding: 12px; min-width: 220px; font-family: Arial, sans-serif;">
        <h6 style="margin: 0 0 10px 0; font-weight: 600; color: #333;">
          <i class="bi bi-car-front-fill"></i> ${vehicle.model}
        </h6>
        <p style="margin: 5px 0; font-size: 14px;">
          <strong>Reg:</strong> ${vehicle.registration_number}
        </p>
        <p style="margin: 5px 0; font-size: 14px;">
          <strong>Status:</strong> 
          <span style="color: ${statusColor}; font-weight: 600;">${status}</span>
        </p>
        <p style="margin: 5px 0; font-size: 14px;">
          <strong>Instructor:</strong> ${instructor}
        </p>
        ${vehicle.time_slot ? `
          <p style="margin: 5px 0; font-size: 14px;">
            <strong>Time Slot:</strong> ${vehicle.time_slot} min
          </p>
        ` : ''}
        <p style="margin: 5px 0; font-size: 12px; color: #666;">
          <strong>Location:</strong><br/>
          ${vehicle.latitude.toFixed(4)}, ${vehicle.longitude.toFixed(4)}
        </p>
      </div>
    `;
  }

  setupRealtimeTracking(): void {
    try {
      this.wsService.connect();
      
      // Subscribe to location updates
      const locationSub = this.wsService.onLocationUpdate().subscribe({
        next: (data: any) => {
          console.log('📍 Location update received:', data);
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
    const vehicleId = data.vehicle_id || data.vehicleId || data.id;
    if (!vehicleId) {
      console.warn('Location update has no vehicle ID:', data);
      return;
    }

    // Update vehicle in list
    const vehicle = this.vehicles.find(v => 
      v.id === vehicleId || v._id === vehicleId
    );
    
    if (vehicle) {
      vehicle.latitude = data.latitude;
      vehicle.longitude = data.longitude;
      
      // Update marker position
      const marker = this.markers.get(vehicleId);
      if (marker && this.map) {
        const newPosition = { 
          lat: Number(data.latitude), 
          lng: Number(data.longitude) 
        };
        marker.setPosition(newPosition);
        
        // Update info window content
        const infoWindow = this.infoWindows.get(vehicleId);
        if (infoWindow) {
          infoWindow.setContent(this.getInfoWindowContent(vehicle));
        }
        
        console.log('✅ Marker position updated for vehicle:', vehicleId);
      }
    } else {
      console.warn('Vehicle not found for location update:', vehicleId);
    }
  }
}