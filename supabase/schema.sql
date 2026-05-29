-- =============================================
-- 家庭健康營養管理系統 - 資料庫 Schema
-- 在 Supabase SQL Editor 執行此檔案
-- =============================================

-- 啟用 UUID 擴充
create extension if not exists "uuid-ossp";

-- =============================================
-- 個人檔案（每個帳號最多 2 個）
-- =============================================
create table if not exists profiles (
  id uuid primary key default uuid_generate_v4(),
  auth_user_id uuid references auth.users(id) on delete cascade not null,
  slot smallint not null check (slot in (1, 2)),
  display_name text not null,
  gender text not null check (gender in ('male', 'female')),
  birth_year smallint not null,
  height_cm numeric(5,1) not null,
  activity_level text not null default 'moderate'
    check (activity_level in ('sedentary','light','moderate','active','very_active')),
  goal text not null default 'maintain'
    check (goal in ('cut','bulk','maintain')),
  calorie_target integer not null default 2000,
  protein_target integer not null default 120,
  created_at timestamptz default now(),
  unique(auth_user_id, slot)
);

-- =============================================
-- 食物資料庫（OFF 快取 + 自訂）
-- =============================================
create table if not exists foods (
  id uuid primary key default uuid_generate_v4(),
  barcode text,
  name text not null,
  name_zh text,
  brand text,
  serving_size_g numeric(8,2) not null default 100,
  serving_unit text not null default 'g',
  calories_per_serving numeric(8,2) not null,
  protein_per_serving numeric(8,2) not null default 0,
  carbs_per_serving numeric(8,2) not null default 0,
  fat_per_serving numeric(8,2) not null default 0,
  fiber_per_serving numeric(8,2) not null default 0,
  is_custom boolean not null default false,
  created_by uuid references profiles(id),
  source text not null default 'off' check (source in ('off','custom')),
  created_at timestamptz default now()
);

create index if not exists foods_barcode_idx on foods(barcode) where barcode is not null;
create index if not exists foods_name_idx on foods using gin(to_tsvector('simple', name));

-- =============================================
-- 餐點記錄
-- =============================================
create table if not exists meal_entries (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references profiles(id) on delete cascade not null,
  log_date date not null,
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner','snack')),
  food_id uuid references foods(id) not null,
  quantity numeric(8,2) not null,
  quantity_unit text not null default 'serving' check (quantity_unit in ('serving','g')),
  calories numeric(8,2) not null,
  protein numeric(8,2) not null default 0,
  carbs numeric(8,2) not null default 0,
  fat numeric(8,2) not null default 0,
  notes text,
  created_at timestamptz default now()
);

create index if not exists meal_entries_profile_date_idx on meal_entries(profile_id, log_date);

-- =============================================
-- 常用餐點組合
-- =============================================
create table if not exists meal_presets (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  created_at timestamptz default now()
);

create table if not exists meal_preset_items (
  id uuid primary key default uuid_generate_v4(),
  preset_id uuid references meal_presets(id) on delete cascade not null,
  food_id uuid references foods(id) not null,
  quantity numeric(8,2) not null,
  quantity_unit text not null default 'serving'
);

-- =============================================
-- Row Level Security（讓每個帳號只能看自己的資料）
-- =============================================
alter table profiles enable row level security;
alter table foods enable row level security;
alter table meal_entries enable row level security;
alter table meal_presets enable row level security;
alter table meal_preset_items enable row level security;

-- profiles：只能看自己帳號的
drop policy if exists "profiles_own" on profiles;
create policy "profiles_own" on profiles
  for all using (auth_user_id = auth.uid());

-- foods：可以看所有 OFF 資料，自訂食物只能看自己建的
drop policy if exists "foods_read" on foods;
create policy "foods_read" on foods
  for select using (
    source = 'off' or
    created_by in (
      select id from profiles where auth_user_id = auth.uid()
    )
  );

drop policy if exists "foods_insert" on foods;
create policy "foods_insert" on foods
  for insert with check (
    is_custom = true and
    created_by in (
      select id from profiles where auth_user_id = auth.uid()
    )
  );

drop policy if exists "foods_update" on foods;
create policy "foods_update" on foods
  for update using (
    created_by in (
      select id from profiles where auth_user_id = auth.uid()
    )
  );

-- meal_entries：只能看自己帳號兩個 profile 的記錄
drop policy if exists "meal_entries_own" on meal_entries;
create policy "meal_entries_own" on meal_entries
  for all using (
    profile_id in (
      select id from profiles where auth_user_id = auth.uid()
    )
  );

-- meal_presets
drop policy if exists "meal_presets_own" on meal_presets;
create policy "meal_presets_own" on meal_presets
  for all using (
    profile_id in (
      select id from profiles where auth_user_id = auth.uid()
    )
  );

-- meal_preset_items
drop policy if exists "meal_preset_items_own" on meal_preset_items;
create policy "meal_preset_items_own" on meal_preset_items
  for all using (
    preset_id in (
      select mp.id from meal_presets mp
      join profiles p on mp.profile_id = p.id
      where p.auth_user_id = auth.uid()
    )
  );
