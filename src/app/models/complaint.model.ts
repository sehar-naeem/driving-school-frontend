import { Vehicle } from "./vehicle.model";
import { User } from "./user.model";
export interface Complaint {
  id: number;
  vehicle_id: number;
  vehicle?: Vehicle;
  instructor_id: number;
  instructor?: User;
  issue_type: 'mechanical' | 'maintenance' | 'accident' | 'safety' | 'other';
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  admin_response?: string;
  created_at: string;
  resolved_at?: string;
}

export interface ComplaintCreateRequest {
  vehicle_id: number;
  issue_type: string;
  title: string;
  description: string;
  priority: string;
}