import { StateCreator } from 'zustand'
import type { Course } from '@pu/schemas'

export interface CourseSlice {
  courses: Course[]
  setCourses: (courses: Course[]) => void
}

export const createCourseSlice: StateCreator<CourseSlice, [], [], CourseSlice> = (set) => ({
  courses: [],
  setCourses: (courses) => set({ courses })
})
