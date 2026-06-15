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
  longitude: number;
  last_location_update?: Date;
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