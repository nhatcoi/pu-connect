import { StateCreator } from 'zustand'
import type { CampusEvent } from '@pu/schemas'

export interface CampusSlice {
  campusEvents: CampusEvent[]
  setCampusEvents: (events: CampusEvent[]) => void
  addCampusEvent: (event: CampusEvent) => void
}

export const createCampusSlice: StateCreator<CampusSlice, [], [], CampusSlice> = (set) => ({
  campusEvents: [],
  setCampusEvents: (campusEvents) => set({ campusEvents }),
  addCampusEvent: (event) =>
    set((state) => ({ campusEvents: [event, ...state.campusEvents] }))
})
