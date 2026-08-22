import { Injectable, NotFoundException } from '@nestjs/common'
import type { Course, CreateCourseInput } from '@pu/schemas'

@Injectable()
export class CoursesService {
  private courses: Course[] = []

  async findAll(departmentId?: string): Promise<Course[]> {
    if (departmentId) {
      return this.courses.filter((c) => c.departmentId === departmentId)
    }
    return this.courses
  }

  async findOne(id: string): Promise<Course> {
    const course = this.courses.find((c) => c.id === id || c.code.toLowerCase() === id.toLowerCase())
    if (!course) {
      throw new NotFoundException(`Course ${id} not found`)
    }
    return course
  }

  async create(data: CreateCourseInput): Promise<Course> {
    const newCourse: Course = {
      id: `course_${Date.now()}`,
      code: data.code.toUpperCase(),
      name: data.name,
      credits: data.credits,
      departmentId: data.departmentId,
      departmentName: data.departmentId,
      semester: 'Học kỳ hiện tại',
      description: data.description,
      documentCount: 0,
      postCount: 0,
      rating: 5.0
    }

    this.courses.unshift(newCourse)
    return newCourse
  }
}
