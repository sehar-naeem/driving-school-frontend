import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MyComplaintComponent } from './my-complaint.component';

describe('MyComplaintComponent', () => {
  let component: MyComplaintComponent;
  let fixture: ComponentFixture<MyComplaintComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyComplaintComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MyComplaintComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
