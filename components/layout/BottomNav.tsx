'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, Search, Activity, ListChecks, Settings } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/diary', label: '飲食日記', icon: BookOpen },
  { href: '/search', label: '搜尋食物', icon: Search },
  { href: '/body', label: '體組成', icon: Activity },
  { href: '/track', label: '追蹤', icon: ListChecks },
  { href: '/settings', label: '設定', icon: Settings },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t z-20">
      <div className="max-w-lg mx-auto flex">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center py-3 gap-0.5 transition-colors ${
                active ? 'text-green-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
