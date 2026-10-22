-- المرحلة: هوية العميل في التقارير (Pro)
-- شغّل الملف ده مرة واحدة من Supabase Dashboard → SQL Editor → New query → Run
--
-- 1) جدول report_branding: صف واحد لكل مستخدم فيه بيانات "Prepared by"
--    واسم الشركة ومسار لوجو الشركة. منفصل عن profiles عمدًا، لأن profiles
--    مفيهوش UPDATE للمستخدم (عشان محدش يغيّر subscription_status بنفسه).
-- 2) bucket اسمه company-logos للوجوهات، كل مستخدم يكتب في فولدر باسمه بس.

create table if not exists public.report_branding (
  user_id uuid primary key references auth.users(id) on delete cascade,
  prepared_by text,
  job_title text,
  company text,
  logo_path text,
  show_signatures boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.report_branding enable row level security;

grant select, insert, update, delete on public.report_branding to authenticated;

drop policy if exists "branding_select_own" on public.report_branding;
create policy "branding_select_own" on public.report_branding
  for select using (auth.uid() = user_id);

drop policy if exists "branding_insert_own" on public.report_branding;
create policy "branding_insert_own" on public.report_branding
  for insert with check (auth.uid() = user_id);

drop policy if exists "branding_update_own" on public.report_branding;
create policy "branding_update_own" on public.report_branding
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "branding_delete_own" on public.report_branding;
create policy "branding_delete_own" on public.report_branding
  for delete using (auth.uid() = user_id);

-- Storage bucket for company logos (public read: a logo is printed on
-- reports the user hands out anyway; 512 KB max, PNG/JPEG only)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('company-logos', 'company-logos', true, 524288, array['image/png', 'image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = 524288, allowed_mime_types = array['image/png', 'image/jpeg'];

-- Each user may only write inside their own folder: company-logos/<user id>/...
drop policy if exists "logos_insert_own" on storage.objects;
create policy "logos_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'company-logos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "logos_update_own" on storage.objects;
create policy "logos_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'company-logos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "logos_delete_own" on storage.objects;
create policy "logos_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'company-logos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "logos_read_all" on storage.objects;
create policy "logos_read_all" on storage.objects
  for select using (bucket_id = 'company-logos');
