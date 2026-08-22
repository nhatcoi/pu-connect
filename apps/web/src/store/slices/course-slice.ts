import { StateCreator } from 'zustand'
import type { Course } from '@pu/schemas'

export interface CourseSlice {
  courses: Course[]
  selectedFaculty: string | null
  setCourses: (courses: Course[]) => void
  setSelectedFaculty: (faculty: string | null) => void
}

export const createCourseSlice: StateCreator<CourseSlice, [], [], CourseSlice> = (set) => ({
  courses: [],
  selectedFaculty: null,
  setCourses: (courses) => set({ courses }),
  setSelectedFaculty: (selectedFaculty) => set({ selectedFaculty })
})
