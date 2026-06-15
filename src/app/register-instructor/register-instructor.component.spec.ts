import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RegisterInstructorComponent } from './register-instructor.component';

describe('RegisterInstructorComponent', () => {
  let component: RegisterInstructorComponent;
  let fixture: ComponentFixture<RegisterInstructorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterInstructorComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(RegisterInstructorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
