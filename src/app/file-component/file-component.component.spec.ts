import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FileComponentComponent } from './file-component.component';

describe('FileComponentComponent', () => {
  let component: FileComponentComponent;
  let fixture: ComponentFixture<FileComponentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileComponentComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(FileComponentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
