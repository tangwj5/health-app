export type Gender = 'male' | 'female'
export type GoalType = 'cut' | 'bulk' | 'maintain'
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'

export interface Profile {
  id: string
  auth_user_id: string
  slot: 1 | 2
  display_name: string
  gender: Gender
  birth_year: number
  height_cm: number
  activity_level: ActivityLevel
  goal: GoalType
  weight_kg: number
  calorie_target: number
  protein_target: number
  created_at: string
}

export interface Food {
  id: string
  barcode: string | null
  name: string
  name_zh: string | null
  brand: string | null
  serving_size_g: number
  serving_unit: string
  calories_per_serving: number
  protein_per_serving: number
  carbs_per_serving: number
  fat_per_serving: number
  fiber_per_serving: number
  is_custom: boolean
  created_by: string | null
  source: 'off' | 'custom'
}

export interface MealEntry {
  id: string
  profile_id: string
  log_date: string
  meal_type: MealType
  food_id: string
  food: Food
  quantity: number
  quantity_unit: 'serving' | 'g'
  calories: number
  protein: number
  carbs: number
  fat: number
  notes: string | null
  created_at: string
}

export interface MealPreset {
  id: string
  profile_id: string
  name: string
  items: MealPresetItem[]
  created_at: string
}

export interface MealPresetItem {
  id: string
  preset_id: string
  food_id: string
  food: Food
  quantity: number
  quantity_unit: 'serving' | 'g'
}

export interface DayNutrition {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export interface OFFProduct {
  product_name: string
  product_name_zh?: string
  brands?: string
  nutriments: {
    'energy-kcal_100g'?: number
    'energy-kcal_serving'?: number
    proteins_100g?: number
    proteins_serving?: number
    carbohydrates_100g?: number
    carbohydrates_serving?: number
    fat_100g?: number
    fat_serving?: number
    fiber_100g?: number
    fiber_serving?: number
  }
  serving_size?: string
  serving_quantity?: number
  code?: string
}
