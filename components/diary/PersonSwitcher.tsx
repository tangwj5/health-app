'use client'

import type { Profile } from '@/types'

interface Props {
  profiles: Profile[]
  activeSlot: 1 | 2
  onSwitch: (slot: 1 | 2) => void
}

export function PersonSwitcher({ profiles, activeSlot, onSwitch }: Props) {
  if (profiles.length === 0) return null

  return (
    <div className="flex bg-gray-100 rounded-full p-1 gap-1">
      {profiles.map(p => (
        <button
          key={p.slot}
          onClick={() => onSwitch(p.slot as 1 | 2)}
          className={`flex-1 py-1.5 px-4 rounded-full text-sm font-medium transition-all ${
            activeSlot === p.slot
              ? 'bg-white text-green-600 shadow-sm'
              : 'text-gray-500'
          }`}
        >
          {p.display_name}
        </button>
      ))}
    </div>
  )
}
