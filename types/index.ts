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
  target_weight_kg: number | null
  weekly_target_rate: number | null
  calendar_token: string | null
  created_at: string
}

export interface BodyMetric {
  id: string
  profile_id: string
  recorded_at: string
  weight_kg: number | null
  body_fat_pct: number | null
  muscle_kg: number | null
  visceral_fat: number | null
  is_first_of_day: boolean
  note: string | null
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
  sugar_per_serving: number
  trans_fat_per_serving: number
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
  sugar: number
  trans_fat: number
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

export type ExerciseType = 'walking' | 'strength'
export type Intensity = 'easy' | 'moderate' | 'hard'

export interface Exercise {
  id: string
  profile_id: string
  recorded_at: string
  exercise_type: ExerciseType
  body_parts: string[]
  intensity: Intensity
  duration_min: number
  calories_est: number
  note: string | null
  created_at: string
}

export interface Habit {
  id: string
  profile_id: string
  name: string
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface HabitLog {
  id: string
  habit_id: string
  profile_id: string
  logged_date: string
  created_at: string
}

export interface TrackerItem {
  id: string
  profile_id: string
  name: string
  category: string
  interval_days: number | null
  note: string | null
  is_active: boolean
  is_pinned: boolean
  sort_order: number
  created_at: string
}

export interface TrackerLog {
  id: string
  item_id: string
  profile_id: string
  completed_at: string
  note: string | null
  created_at: string
}

export interface DayNutrition {
  calories: number
  protein: number
  carbs: number
  fat: number
  sugar: number
  trans_fat: number
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
    sugars_100g?: number
    sugars_serving?: number
    'trans-fat_100g'?: number
    'trans-fat_serving'?: number
  }
  serving_size?: string
  serving_quantity?: number
  code?: string
}
