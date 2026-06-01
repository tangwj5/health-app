'use client'

import { useState } from 'react'
import { Plus, Copy, ChevronDown, ChevronUp, Trash2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { MealEntry, MealType } from '@/types'

interface Props {
  mealType: MealType
  label: string
  entries: MealEntry[]
  profileId: string
  selectedDate: string
  onDelete: (id: string) => void
  onEdit: (entry: MealEntry) => void
  onCopyYesterday: () => void
  onAddEntry: () => void
  onRefresh: () => void
}

const MEAL_ICONS: Record<MealType, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snack: '🍎',
}

export function MealSection({
  mealType, label, entries, onDelete, onEdit, onCopyYesterday, onAddEntry
}: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [copying, setCopying] = useState(false)

  const total = entries.reduce((sum, e) => sum + e.calories, 0)

  async function handleCopyYesterday() {
    setCopying(true)
    await onCopyYesterday()
    setCopying(false)
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
      {/* Meal header */}
      <div className="flex items-center px-4 py-3 gap-2">
        <span className="text-lg">{MEAL_ICONS[mealType]}</span>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex-1 flex items-center gap-2 text-left"
        >
          <span className="font-semibold text-gray-700">{label}</span>
          <span className="text-sm text-gray-400">{Math.round(total)} kcal</span>
          {collapsed
            ? <ChevronDown className="h-4 w-4 text-gray-300 ml-auto" />
            : <ChevronUp className="h-4 w-4 text-gray-300 ml-auto" />
          }
        </button>
      </div>

      {!collapsed && (
        <>
          {/* Food entries */}
          {entries.length > 0 && (
            <div className="border-t divide-y">
              {entries.map(entry => (
                <FoodEntryRow key={entry.id} entry={entry} onDelete={() => onDelete(entry.id)} onEdit={() => onEdit(entry)} />
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="border-t px-4 py-2 flex gap-2">
            <Button
              size="sm"
              onClick={onAddEntry}
              className="flex-1 bg-green-500 hover:bg-green-600 h-8 text-xs gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              新增食物
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyYesterday}
              disabled={copying}
              className="h-8 text-xs gap-1 text-gray-500"
            >
              <Copy className="h-3.5 w-3.5" />
              {copying ? '複製中...' : '複製昨日'}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function FoodEntryRow({ entry, onDelete, onEdit }: { entry: MealEntry; onDelete: () => void; onEdit: () => void }) {
  const food = entry.food
  const quantityLabel = entry.quantity_unit === 'g'
    ? `${entry.quantity}g`
    : `${entry.quantity} ${food.serving_unit}`

  return (
    <div className="flex items-center px-4 py-2.5 gap-2">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">
          {food.name_zh || food.name}
        </p>
        <p className="text-xs text-gray-400">{quantityLabel}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold text-gray-700">{Math.round(entry.calories)}</p>
        <p className="text-xs text-gray-400">kcal</p>
      </div>
      {food.is_custom && (
        <button onClick={onEdit} className="p-1 text-gray-400 hover:text-blue-500">
          <Pencil className="h-4 w-4" />
        </button>
      )}
      <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-500">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}
