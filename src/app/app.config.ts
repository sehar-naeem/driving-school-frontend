import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    // Provide router with our routes
    provideRouter(routes),
    
    // Provide HTTP client with auth interceptor
    // This automatically adds JWT token to all API requests
    provideHttpClient(
      withInterceptors([authInterceptor])
    ),
    
    // Import common modules
    importProvidersFrom(
      CommonModule,
      FormsModule
    )
  ]
};