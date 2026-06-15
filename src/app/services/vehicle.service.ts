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

  getAllVehicles(): Observable<Vehicle[]> {
    return this.http.get<any>(this.API_URL).pipe(
      map(response => {
        console.log('getAllVehicles response:', response);
        const vehicles = response?.vehicles || response || [];
        // Add 'id' property for backward compatibility
        return vehicles.map((v: any) => ({ ...v, id: v._id }));
      }),
      tap(vehicles => this.vehiclesSubject.next(vehicles))
    );
  }

  getVehicleById(id: string): Observable<Vehicle> {
    return this.http.get<any>(`${this.API_URL}/${id}`).pipe(
      map(response => response?.vehicle || response)
    );
  }

  // ✅ FIXED: Extract array from response
  getVacantVehicles(): Observable<Vehicle[]> {
    return this.http.get<any>(`${this.API_URL}/status/vacant`).pipe(
      map(response => {
        console.log('Vacant vehicles response:', response);
        return response?.vehicles || response || [];
      })
    );
  }

  // ✅ FIXED: Extract array from response
  getBusyVehicles(): Observable<Vehicle[]> {
    return this.http.get<any>(`${this.API_URL}/status/busy`).pipe(
      map(response => {
        console.log('Busy vehicles response:', response);
        return response?.vehicles || response || [];
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
}