'use client'

import type { Profile } from '@/types'

interface Props {
  profiles: Profile[]
  activeSlot: 1 | 2
  onSwitch: (slot: 1 | 2) => void
}

const SLOT_STYLES: Record<number, { active: string; dot: string }> = {
  1: { active: 'bg-white text-green-600 shadow-sm', dot: 'text-green-600' },
  2: { active: 'bg-blue-50 text-blue-600 shadow-sm', dot: 'text-blue-600' },
}

export function PersonSwitcher({ profiles, activeSlot, onSwitch }: Props) {
  if (profiles.length === 0) return null

  return (
    <div className="flex bg-gray-100 rounded-full p-1 gap-1">
      {profiles.map(p => {
        const isActive = activeSlot === p.slot
        const styles = SLOT_STYLES[p.slot] ?? SLOT_STYLES[1]
        return (
          <button
            key={p.slot}
            onClick={() => onSwitch(p.slot as 1 | 2)}
            className={`flex-1 py-1.5 px-4 rounded-full text-sm font-medium transition-all flex items-center justify-center gap-1 ${
              isActive ? styles.active : 'text-gray-500'
            }`}
          >
            {isActive && (
              <span className={`text-[10px] leading-none ${styles.dot}`}>●</span>
            )}
            {p.display_name}
          </button>
        )
      })}
    </div>
  )
}
