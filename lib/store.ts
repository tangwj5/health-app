import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { format } from 'date-fns'
import type { Profile } from '@/types'

interface AppStore {
  activeSlot: 1 | 2
  profiles: Profile[]
  selectedDate: string
  setActiveSlot: (slot: 1 | 2) => void
  setProfiles: (profiles: Profile[]) => void
  setSelectedDate: (date: string) => void
  activeProfile: () => Profile | undefined
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      activeSlot: 1,
      profiles: [],
      selectedDate: format(new Date(), 'yyyy-MM-dd'),
      setActiveSlot: (slot) => set({ activeSlot: slot }),
      setProfiles: (profiles) => set({ profiles }),
      setSelectedDate: (date) => set({ selectedDate: date }),
      activeProfile: () => get().profiles.find(p => p.slot === get().activeSlot),
    }),
    {
      name: 'health-app-store',
      partialize: (state) => ({ activeSlot: state.activeSlot }),
    }
  )
)
