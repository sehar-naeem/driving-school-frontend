export interface ExtensionEntry {
  requested_minutes: number;
  reason?: string;
  requested_at: Date | string;
  status: 'pending' | 'approved' | 'rejected';
  admin_minutes?: number;
  admin_message?: string;
  responded_at?: Date | string;
}

export interface LessonLog {
  _id: string;
  instructor_id: string;
  instructor_name: string;
  instructor_email?: string;
  vehicle_id: string;
  vehicle_model: string;
  registration_number: string;
  status: 'assigned' | 'in_progress' | 'completed' | 'declined' | 'cancelled';
  allocated_at: Date | string;
  started_at?: Date | string | null;
  declined_at?: Date | string | null;
  declined_reason?: string;
  completed_at?: Date | string | null;
  initial_time_slot: number;
  total_duration_minutes: number;
  extensions: ExtensionEntry[];
  parked_note?: string;
  month_key?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface ReportSummary {
  total_allocations?: number;
  total_assigned?: number;
  started_count: number;
  completed_count: number;
  declined_count: number;
  pending_count?: number;
  acceptance_rate: number;
  decline_rate: number;
  extension_requests: number;
  extensions_approved: number;
  extensions_rejected: number;
  total_training_minutes?: number;
  total_training_hours?: string;
  total_minutes?: number;
  total_hours?: string;
}

export interface InstructorPerformance {
  instructor_id: string;
  instructor_name: string;
  instructor_email?: string;
  total_assigned: number;
  started: number;
  completed: number;
  declined: number;
  acceptance_rate: number;
  decline_rate: number;
  extension_requests: number;
  extensions_approved: number;
  extensions_rejected: number;
  total_minutes: number;
  total_hours: string;
}

export interface VehiclePerformance {
  vehicle_id: string;
  model: string;
  registration_number: string;
  total_assigned: number;
  completed_lessons: number;
  declined_count: number;
  total_minutes: number;
  total_hours: string;
}

export interface AdminReportResponse {
  success: boolean;
  summary: ReportSummary;
  instructor_breakdown: InstructorPerformance[];
  vehicle_breakdown: VehiclePerformance[];
  available_months: string[];
  logs: LessonLog[];
}

export interface InstructorReportResponse {
  success: boolean;
  summary: ReportSummary;
  available_months: string[];
  logs: LessonLog[];
}
