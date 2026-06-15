import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';


export const routes: Routes = [
  // Default route - redirects to login
  { 
    path: '', 
    redirectTo: '/login', 
    pathMatch: 'full' 
  },

  // Login route (public - no guard)
  {
    path: 'login',
    loadComponent: () => import('./login/login.component')
      .then(m => m.LoginComponent)
  },

  // ADMIN ROUTES (Protected by authGuard + adminGuard)
  {
    path: 'admin',
    canActivate: [authGuard],
    children: [
      // Default admin route redirects to dashboard
      { 
        path: '', 
        redirectTo: 'dashboard', 
        pathMatch: 'full' 
      },
      // Admin Dashboard
      {
        path: 'dashboard',
        loadComponent: () => import('./admin-dashboard/admin-dashboard.component')
          .then(m => m.AdminDashboardComponent)
      },
      // Vehicle Management - View all vehicles
      {
        path: 'vehicles',
        loadComponent: () => import('./vehicle-management/vehicle-management.component')
          .then(m => m.VehicleManagementComponent)
      },
      // Register new vehicle
      {
        path: 'register-vehicle',
        loadComponent: () => import('./register-vehicle/register-vehicle.component')
          .then(m => m.RegisterVehicleComponent)
      },
      // Instructor List - View all instructors
      {
        path: 'instructors',
        loadComponent: () => import('./instructor-list/instructor-list.component')
          .then(m => m.InstructorListComponent)
      },
      // Register new instructor
      {
        path: 'register-instructor',
        loadComponent: () => import('./register-instructor/register-instructor.component')
          .then(m => m.RegisterInstructorComponent)
      },
      // Complaints Management - Admin view
      {
        path: 'complaints',
        loadComponent: () => import('./complaints-admin/complaints-admin.component')
          .then(m => m.ComplaintsAdminComponent)
      },
      // Google Maps Tracking - Real-time vehicle tracking
      {
        path: 'tracking',
        loadComponent: () => import('./tracking-map/tracking-map.component')
          .then(m => m.TrackingMapComponent)
      }
    ]
  },

  // INSTRUCTOR ROUTES (Protected by authGuard + instructorGuard)
  {
    path: 'instructor',
    canActivate: [authGuard],
    children: [
      // Default instructor route redirects to dashboard
      { 
        path: '', 
        redirectTo: 'dashboard', 
        pathMatch: 'full' 
      },
      // Instructor Dashboard
      {
        path: 'dashboard',
        loadComponent: () => import('./instructor-dashboard/instructor-dashboard.component')
          .then(m => m.InstructorDashboardComponent)
      },
      // File a new complaint
      {
        path: 'file-complaint',
        loadComponent: () => import('./file-component/file-component.component')
          .then(m => m.FileComplaintComponent)
      },
      // View my complaints
      {
        path: 'my-complaints',
        loadComponent: () => import('./my-complaint/my-complaint.component')
          .then(m => m.MyComplaintsComponent)
      }
    ]
  },


  // Wildcard route - redirects to login for any unknown path
  { 
    path: '**', 
    redirectTo: '/login' 
  }
];