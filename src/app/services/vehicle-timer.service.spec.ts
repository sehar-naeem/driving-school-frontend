import { TestBed } from '@angular/core/testing';

import { VehicleTimerService } from './vehicle-timer.service';

describe('VehicleTimerService', () => {
  let service: VehicleTimerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(VehicleTimerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
