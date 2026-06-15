export interface User {
  _id?: string;          // MongoDB _id (optional for compatibility)
  id: string;            // Main identifier we'll use
  username: string;
  password?: string;
  full_name: string;
  email: string;
  phone?: string;
  role: 'admin' | 'instructor' | 'student';
  status: 'active' | 'inactive';
  created_at?: Date;
  createdAt?: Date;
}

export interface RegisterInstructorRequest {
  username: string;
  password: string;
  full_name: string;
  email: string;
  phone?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  user: User;
}