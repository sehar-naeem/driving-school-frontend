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
  latitude: number;
  last_location_update?: Date;
  is_parked?: boolean;
  parked_at?: Date | null;
  extension_request?: {
    minutes?: number;
    reason?: string;
    requested_at?: Date;
    status?: 'pending' | 'approved' | 'rejected' | null;
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