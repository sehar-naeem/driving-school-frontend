import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { User, RegisterInstructorRequest } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  private readonly API_URL = 'https://driving-school-backend-m80e.onrender.com/api/users';

  constructor(private http: HttpClient) {}

  /** ✅ GET ALL INSTRUCTORS */
  getAllInstructors(): Observable<User[]> {
    return this.http.get<any>(`${this.API_URL}/instructors`)
      .pipe(
        map(response => response?.instructors || [])
      );
  }

  /** ✅ GET INSTRUCTOR BY ID - ACCEPTS STRING */
  getInstructorById(id: string): Observable<User> {
    return this.http.get<any>(`${this.API_URL}/instructors/${id}`)
      .pipe(
        map(res => res?.instructor ?? res)
      );
  }

  /** ✅ REGISTER INSTRUCTOR */
  registerInstructor(data: RegisterInstructorRequest): Observable<User> {
    return this.http.post<any>(`${this.API_URL}/instructors`, data)
      .pipe(
        map(res => res?.instructor ?? res)
      );
  }

  /** ✅ UPDATE INSTRUCTOR - FIXED TO SEND ALL FIELDS */
  updateInstructor(id: string, data: Partial<User>): Observable<User> {
    // Remove any undefined or null values, but keep empty strings
    const cleanData = Object.entries(data).reduce((acc, [key, value]) => {
      if (value !== undefined && value !== null) {
        acc[key] = value;
      }
      return acc;
    }, {} as any);

    console.log('Sending update request with data:', cleanData);

    return this.http.put<any>(`${this.API_URL}/instructors/${id}`, cleanData)
      .pipe(
        map(res => {
          console.log('Update response from backend:', res);
          return res?.instructor ?? res;
        })
      );
  }

  /** ✅ DELETE INSTRUCTOR - ACCEPTS STRING */
  deleteInstructor(id: string): Observable<void> {
    return this.http.delete<any>(`${this.API_URL}/instructors/${id}`)
      .pipe(
        map(() => void 0)
      );
  }

  /** ✅ TOGGLE STATUS - ACCEPTS STRING */
  toggleInstructorStatus(id: string): Observable<User> {
    return this.http.patch<any>(`${this.API_URL}/instructors/${id}/toggle-status`, {})
      .pipe(
        map(res => res?.instructor ?? res)
      );
  }
}