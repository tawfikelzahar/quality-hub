-- المرحلة 1: subscription_status
-- شغّل الملف ده مرة واحدة من Supabase Dashboard → SQL Editor → New query → Run
-- (المشروع ده مبيستخدمش Supabase CLI migrations، فالتشغيل بيتم يدويًا زي باقي الجداول)

-- جدول profiles: صف واحد لكل مستخدم، منفصل عن auth.users
-- (متعملوش تعديل في auth.users مباشرة، ده جدول Supabase الداخلي)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  subscription_status text not null default 'free' check (subscription_status in ('free', 'pro')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- مهم: الـ RLS Policy لوحدها مش كفاية. لازم GRANT أساسي على الجدول
-- الأول، وإلا هتطلع رسالة "permission denied for table profiles"
-- حتى لو الـ Policy مظبوطة صح. (اتعرفنا على ده بالتجربة الفعلية.)
grant select on public.profiles to authenticated;

-- المستخدم يقدر يشوف الصف بتاعه بس (عشان الـ hook يقرا حالته)
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

-- ملحوظة مهمة: عمدًا مفيش INSERT/UPDATE policy للمستخدم العادي.
-- التعديل الوحيد المسموح بيه هيكون عن طريق service role key
-- (من الـ webhook بتاع Lemon Squeezy في المرحلة 6)، عشان محدش
-- يقدر يغيّر حالته لـ "pro" بنفسه من الـ client.

-- إنشاء صف profile تلقائيًا لما يوزر جديد يسجل (Google أو Email)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, subscription_status)
  values (new.id, 'free')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- عشان المستخدمين اللي أصلاً مسجلين قبل الـ trigger ده، نعمل backfill:
insert into public.profiles (id, subscription_status)
select id, 'free' from auth.users
on conflict (id) do nothing;
