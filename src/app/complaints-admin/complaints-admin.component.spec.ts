import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ComplaintsAdminComponent } from './complaints-admin.component';

describe('ComplaintsAdminComponent', () => {
  let component: ComplaintsAdminComponent;
  let fixture: ComponentFixture<ComplaintsAdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComplaintsAdminComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ComplaintsAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
