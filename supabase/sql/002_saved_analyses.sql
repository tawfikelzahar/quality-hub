-- المرحلة 2: saved_analyses (حفظ المشاريع — ميزة Pro-only)
-- شغّل الملف ده مرة واحدة من Supabase Dashboard → SQL Editor → New query → Run

-- جدول واحد عام لكل الأدوات (مش جدول منفصل لكل أداة)، زي ما اتفقنا:
-- كل صف = تحليل واحد محفوظ، بمدخلاته ونتيجته كاملين كـ JSON.
create table if not exists public.saved_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool text not null check (tool in ('spc', 'pareto', 'dpmo', 'oee', 'gage_rr', 'stability', 'aql')),
  name text not null,
  input_data jsonb not null,
  results jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- فهرس عشان "هات كل مشاريع اليوزر ده" يبقى سريع (ده أكتر query هيتكرر)
create index if not exists saved_analyses_user_id_idx on public.saved_analyses(user_id);

alter table public.saved_analyses enable row level security;

-- درس المرحلة 1: الـ GRANT الأساسي لازم يتحط الأول قبل أي Policy،
-- وإلا هتطلع "permission denied" حتى لو الـ Policy مظبوطة صح.
grant select, insert, update, delete on public.saved_analyses to authenticated;

-- كل يوزر يشوف/يعدّل/يحذف بس الصفوف بتاعته هو
create policy "saved_analyses_select_own"
  on public.saved_analyses for select
  using (auth.uid() = user_id);

create policy "saved_analyses_insert_own"
  on public.saved_analyses for insert
  with check (auth.uid() = user_id);

create policy "saved_analyses_update_own"
  on public.saved_analyses for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "saved_analyses_delete_own"
  on public.saved_analyses for delete
  using (auth.uid() = user_id);

-- ملحوظة: فحص "المستخدم Pro فعلاً؟" وحد الـ 50 مشروع مش هنعملهم هنا
-- كـ constraint في قاعدة البيانات — هيتعملوا في الـ API route (الخطوة الجاية)،
-- عشان لو غيّرنا الحد (50) بعدين، نغيّره في مكان واحد بالكود من غير
-- ما نرجع نعدّل SQL على الداتابيز.

-- تحديث updated_at تلقائيًا كل ما الصف يتعدّل
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_saved_analyses_updated_at on public.saved_analyses;
create trigger set_saved_analyses_updated_at
  before update on public.saved_analyses
  for each row execute procedure public.set_updated_at();
