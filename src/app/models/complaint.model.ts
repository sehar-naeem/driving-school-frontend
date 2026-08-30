import { Vehicle } from "./vehicle.model";
import { User } from "./user.model";

export interface Complaint {
  _id?: string;
  id?: string | number;
  vehicle_id?: any;
  vehicle?: Vehicle;
  instructor_id?: any;
  instructor?: User;
  issue_type?: 'mechanical' | 'maintenance' | 'accident' | 'safety' | 'other' | string;
  title?: string;
  description?: string;
  status?: 'pending' | 'in_progress' | 'resolved' | 'closed' | string;
  priority?: 'low' | 'medium' | 'high' | 'urgent' | string;
  admin_response?: string;
  created_at?: string | Date;
  createdAt?: string | Date;
  resolved_at?: string | Date;
  updatedAt?: string | Date;
}

export interface ComplaintCreateRequest {
  vehicle_id: string | number;
  issue_type: string;
  title: string;
  description: string;
  priority: string;
}