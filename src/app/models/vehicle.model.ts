export interface Vehicle {
  _id: string; // MongoDB uses _id
  id?: string; // Added for backward compatibility (auto-populated from _id)
  registration_number: string;
  model: string;
  manufacturer: string;
  year: number;
  color: string;
  status: 'vacant' | 'busy' | 'maintenance';
  current_instructor_id?: string | null;
  current_instructor?: {
    _id: string;
    full_name: string;
    email: string;
    phone?: string;
  };
  time_slot?: number | null;
  session_start?: Date | null;
  latitude?: number | null;
  longitude?: number | null;
  last_location_update?: Date;
  is_parked?: boolean;
  parked_at?: Date | null;
  instructor_status?: 'assigned' | 'on_way' | 'in_lesson' | 'parked' | null;
  instructor_acknowledged_at?: Date | null;
  extension_request?: {
    minutes?: number;
    reason?: string;
    requested_at?: Date;
    status?: 'pending' | 'approved' | 'rejected' | null;
    admin_minutes?: number;
    admin_message?: string;
    dismissed_by_instructor?: boolean;
  } | null;
  last_event?: {
    event_type?: 'lesson_started' | 'allocation_declined' | null;
    instructor?: string;
    reason?: string;
    timestamp?: Date;
    dismissed_by_admin?: boolean;
  } | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface VehicleCreateRequest {
  registration_number: string;
  model: string;
  manufacturer: string;
  year: number;
  color: string;
}

export interface VehicleAllocationRequest {
  vehicle_id: string;
  instructor_id: string;
  time_slot: number;
}