-- المرحلة: AI Insights — جدول تتبع الاستخدام (rate limiting)
-- شغّل الملف ده مرة واحدة من Supabase Dashboard → SQL Editor → New query → Run
--
-- كل مرة مستخدم Pro يطلب تحليل AI ناجح، بنسجل صف هنا.
-- الـ API route بيعد صفوف آخر 24 ساعة قبل ما يكلم Claude،
-- ولو المستخدم وصل للحد اليومي بيرجعله رسالة إنه يستنى.

create table if not exists public.ai_insight_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tool text not null,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now()
);

create index if not exists ai_insight_usage_user_time_idx
  on public.ai_insight_usage (user_id, created_at desc);

alter table public.ai_insight_usage enable row level security;

-- زي جدول profiles: الـ RLS Policy لوحدها مش كفاية، لازم GRANT كمان.
-- عمدًا مفيش UPDATE ولا DELETE، عشان محدش يقدر يمسح سجل استخدامه
-- ويتخطى الحد اليومي.
grant select, insert on public.ai_insight_usage to authenticated;

create policy "ai_usage_select_own"
  on public.ai_insight_usage for select
  using (auth.uid() = user_id);

create policy "ai_usage_insert_own"
  on public.ai_insight_usage for insert
  with check (auth.uid() = user_id);
