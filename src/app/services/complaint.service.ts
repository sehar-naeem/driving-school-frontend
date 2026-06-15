import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Complaint, ComplaintCreateRequest } from '../models/complaint.model';

@Injectable({
  providedIn: 'root'
})
export class ComplaintService {
  private readonly API_URL = 'https://driving-school-backend-m80e.onrender.com/api/complaints';
  private complaintsSubject = new BehaviorSubject<Complaint[]>([]);
  public complaints$ = this.complaintsSubject.asObservable();

  constructor(private http: HttpClient) {}

  loadComplaints(): void {
    this.getAllComplaints().subscribe(
      complaints => this.complaintsSubject.next(complaints)
    );
  }

  getAllComplaints(): Observable<Complaint[]> {
    return this.http.get<any>(this.API_URL).pipe(
      map(response => {
        // Handle both array and object responses
        return Array.isArray(response) 
          ? response 
          : (response?.complaints || response?.data || []);
      }),
      tap(complaints => this.complaintsSubject.next(complaints))
    );
  }

  getMyComplaints(): Observable<Complaint[]> {
    return this.http.get<any>(`${this.API_URL}/my-complaints`).pipe(
      map(response => {
        // Handle both array and object responses
        return Array.isArray(response) 
          ? response 
          : (response?.complaints || response?.data || []);
      })
    );
  }

  createComplaint(data: ComplaintCreateRequest): Observable<Complaint> {
    return this.http.post<any>(this.API_URL, data).pipe(
      map(response => response?.complaint || response?.data || response),
      tap(() => this.loadComplaints())
    );
  }

  updateComplaintStatus(id: number, status: string, adminResponse?: string): Observable<Complaint> {
    return this.http.patch<any>(`${this.API_URL}/${id}/status`, { 
      status, 
      admin_response: adminResponse 
    }).pipe(
      map(response => response?.complaint || response?.data || response),
      tap(() => this.loadComplaints())
    );
  }

  deleteComplaint(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${id}`).pipe(
      tap(() => this.loadComplaints())
    );
  }
}