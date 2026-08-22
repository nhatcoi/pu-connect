import { create } from 'zustand'
import { AuthSlice, createAuthSlice } from './slices/auth-slice'
import { FeedSlice, createFeedSlice } from './slices/feed-slice'
import { DocumentSlice, createDocumentSlice } from './slices/document-slice'
import { CourseSlice, createCourseSlice } from './slices/course-slice'
import { StudyGroupSlice, createStudyGroupSlice } from './slices/study-group-slice'
import { CampusSlice, createCampusSlice } from './slices/campus-slice'

export type AppStore = AuthSlice &
  FeedSlice &
  DocumentSlice &
  CourseSlice &
  StudyGroupSlice &
  CampusSlice

export const useAppStore = create<AppStore>()((...a) => ({
  ...createAuthSlice(...a),
  ...createFeedSlice(...a),
  ...createDocumentSlice(...a),
  ...createCourseSlice(...a),
  ...createStudyGroupSlice(...a),
  ...createCampusSlice(...a)
}))
