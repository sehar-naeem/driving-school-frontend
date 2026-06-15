import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { UserService } from '../services/user.service';
import { User } from '../models/user.model';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-instructor-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './instructor-list.component.html',
  styleUrls: ['./instructor-list.component.scss']
})
export class InstructorListComponent implements OnInit {

  instructors: User[] = [];
  filteredInstructors: User[] = [];
  searchTerm: string = '';
  
  // Edit Modal Properties
  showEditModal: boolean = false;
  selectedInstructor: User | null = null;
  editForm: Partial<User> = {};

  constructor(private userService: UserService) {}

  ngOnInit(): void {
    this.loadInstructors();
  }

  loadInstructors(): void {
    this.userService.getAllInstructors().subscribe({
      next: (instructors) => {
        console.log('INSTRUCTORS FROM API:', instructors);
        console.log('COUNT:', instructors.length);
        
        this.instructors = instructors;
        this.filteredInstructors = instructors;
      },
      error: (err) => {
        console.error('API ERROR:', err);
      }
    });
  }

  searchInstructors(): void {
    const term = this.searchTerm.trim().toLowerCase();

    if (!term) {
      this.filteredInstructors = [...this.instructors];
      return;
    }

    this.filteredInstructors = this.instructors.filter(i =>
      (i.full_name ?? '').toLowerCase().includes(term) ||
      (i.email ?? '').toLowerCase().includes(term) ||
      (i.username ?? '').toLowerCase().includes(term)
    );
  }

  // ✅ NEW: Open Edit Modal
  openEditModal(instructor: User): void {
    this.selectedInstructor = instructor;
    this.editForm = {
      full_name: instructor.full_name,
      email: instructor.email,
      username: instructor.username,
      phone: instructor.phone
    };
    this.showEditModal = true;
  }

  // ✅ NEW: Close Edit Modal
  closeEditModal(): void {
    this.showEditModal = false;
    this.selectedInstructor = null;
    this.editForm = {};
  }

  // ✅ NEW: Update Instructor
  updateInstructor(): void {
    if (!this.selectedInstructor) return;

    // Validate required fields
    if (!this.editForm.full_name?.trim() || !this.editForm.email?.trim()) {
      alert('Name and Email are required!');
      return;
    }

    this.userService.updateInstructor(this.selectedInstructor.id, this.editForm).subscribe({
      next: () => {
        alert('Instructor updated successfully!');
        this.closeEditModal();
        this.loadInstructors();
      },
      error: (err) => {
        alert('Failed to update instructor: ' + (err?.error?.message || 'Unknown error'));
      }
    });
  }

  toggleStatus(instructor: User): void {
    this.userService.toggleInstructorStatus(instructor.id).subscribe({
      next: () => this.loadInstructors(),
      error: (err) => {
        alert('Failed to update status: ' + (err?.error?.message || 'Unknown error'));
      }
    });
  }

  deleteInstructor(instructor: User): void {
    if (!confirm(`Are you sure you want to delete ${instructor.full_name}?`)) {
      return;
    }

    this.userService.deleteInstructor(instructor.id).subscribe({
      next: () => this.loadInstructors(),
      error: (err) => {
        alert('Failed to delete instructor: ' + (err?.error?.message || 'Unknown error'));
      }
    });
  }
}