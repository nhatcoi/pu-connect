import { StateCreator } from 'zustand'
import type { StudyGroup } from '@pu/schemas'

export interface StudyGroupSlice {
  studyGroups: StudyGroup[]
  isCreateGroupOpen: boolean
  setStudyGroups: (groups: StudyGroup[]) => void
  setCreateGroupOpen: (open: boolean) => void
  addStudyGroup: (group: StudyGroup) => void
}

export const createStudyGroupSlice: StateCreator<StudyGroupSlice, [], [], StudyGroupSlice> = (set) => ({
  studyGroups: [],
  isCreateGroupOpen: false,
  setStudyGroups: (studyGroups) => set({ studyGroups }),
  setCreateGroupOpen: (isCreateGroupOpen) => set({ isCreateGroupOpen }),
  addStudyGroup: (group) => set((state) => ({ studyGroups: [group, ...state.studyGroups] }))
})
