import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { Vehicle, VehicleCreateRequest, VehicleAllocationRequest } from '../models/vehicle.model';

@Injectable({
  providedIn: 'root'
})
export class VehicleService {
  private readonly API_URL = 'https://driving-school-backend-m80e.onrender.com/api/vehicles';
  private vehiclesSubject = new BehaviorSubject<Vehicle[]>([]);
  public vehicles$ = this.vehiclesSubject.asObservable();

  constructor(private http: HttpClient) {}

  loadVehicles(): void {
    this.http.get<any>(this.API_URL).pipe(
      map(response => response?.vehicles || response || [])
    ).subscribe(
      vehicles => this.vehiclesSubject.next(vehicles)
    );
  }

  private normalizeVehicle(v: any): Vehicle {
    const currentInst = v.current_instructor || (typeof v.current_instructor_id === 'object' ? v.current_instructor_id : null);
    return {
      ...v,
      id: v._id || v.id,
      current_instructor: currentInst,
      current_instructor_id: (typeof v.current_instructor_id === 'object' ? v.current_instructor_id?._id : v.current_instructor_id) || (currentInst?._id || currentInst?.id)
    };
  }

  getAllVehicles(): Observable<Vehicle[]> {
    return this.http.get<any>(this.API_URL).pipe(
      map(response => {
        const vehicles = response?.vehicles || response || [];
        return vehicles.map((v: any) => this.normalizeVehicle(v));
      }),
      tap(vehicles => this.vehiclesSubject.next(vehicles))
    );
  }

  getVehicleById(id: string): Observable<Vehicle> {
    return this.http.get<any>(`${this.API_URL}/${id}`).pipe(
      map(response => this.normalizeVehicle(response?.vehicle || response))
    );
  }

  getVacantVehicles(): Observable<Vehicle[]> {
    return this.http.get<any>(`${this.API_URL}/status/vacant`).pipe(
      map(response => {
        const vehicles = response?.vehicles || response || [];
        return vehicles.map((v: any) => this.normalizeVehicle(v));
      })
    );
  }

  getBusyVehicles(): Observable<Vehicle[]> {
    return this.http.get<any>(`${this.API_URL}/status/busy`).pipe(
      map(response => {
        const vehicles = response?.vehicles || response || [];
        return vehicles.map((v: any) => this.normalizeVehicle(v));
      })
    );
  }

  createVehicle(data: VehicleCreateRequest): Observable<Vehicle> {
    return this.http.post<any>(this.API_URL, data).pipe(
      map(response => response?.vehicle || response),
      tap(() => this.loadVehicles())
    );
  }

  updateVehicle(id: string, data: Partial<Vehicle>): Observable<Vehicle> {
    return this.http.put<any>(`${this.API_URL}/${id}`, data).pipe(
      map(response => response?.vehicle || response),
      tap(() => this.loadVehicles())
    );
  }

  deleteVehicle(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${id}`).pipe(
      tap(() => this.loadVehicles())
    );
  }

  allocateVehicle(data: VehicleAllocationRequest): Observable<Vehicle> {
    return this.http.post<any>(`${this.API_URL}/allocate`, data).pipe(
      map(response => response?.vehicle || response),
      tap(() => this.loadVehicles())
    );
  }

  releaseVehicle(vehicleId: string): Observable<Vehicle> {
    return this.http.post<any>(`${this.API_URL}/${vehicleId}/release`, {}).pipe(
      map(response => response?.vehicle || response),
      tap(() => this.loadVehicles())
    );
  }

  updateVehicleLocation(vehicleId: string, lat: number, lng: number): Observable<Vehicle> {
    return this.http.patch<any>(`${this.API_URL}/${vehicleId}/location`, { 
      latitude: lat, 
      longitude: lng 
    }).pipe(
      map(response => response?.vehicle || response)
    );
  }

  acknowledgeAllocation(vehicleId: string, data: { status?: string; latitude?: number; longitude?: number }): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/${vehicleId}/acknowledge-allocation`, data).pipe(
      tap(() => this.loadVehicles())
    );
  }

  declineAllocation(vehicleId: string, data?: { reason?: string }): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/${vehicleId}/decline-allocation`, data || {}).pipe(
      tap(() => this.loadVehicles())
    );
  }

  requestExtension(vehicleId: string, data: { minutes: number; reason?: string; latitude?: number; longitude?: number }): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/${vehicleId}/request-extension`, data).pipe(
      tap(() => this.loadVehicles())
    );
  }

  respondExtension(vehicleId: string, data: { approved: boolean; additional_minutes?: number; message?: string }): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/${vehicleId}/respond-extension`, data).pipe(
      tap(() => this.loadVehicles())
    );
  }

  reportParked(vehicleId: string, data: { latitude?: number; longitude?: number; note?: string }): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/${vehicleId}/report-parked`, data).pipe(
      tap(() => this.loadVehicles())
    );
  }

  dismissVehicleEvent(vehicleId: string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/${vehicleId}/dismiss-event`, {});
  }

  dismissExtensionResponse(vehicleId: string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/${vehicleId}/dismiss-extension-response`, {});
  }
}