-- المرحلة: سجل استخدام مزايا Pro (عشان سياسة الاسترجاع)
-- شغّل الملف ده مرة واحدة من Supabase Dashboard → SQL Editor → New query → Run
--
-- سياسة الاسترجاع (/refund-policy): استرداد كامل خلال 7 أيام لو المشترك
-- مستخدمش أي ميزة Pro. الجدول ده بيسجل الاستخدام عشان الأدمن يشوفه:
--   pdf    تنزيل تقرير PDF        (lib/pdf/reportDesign.ts → finalizeReport)
--   excel  تنزيل تقرير Excel      (lib/excelReport.ts → download)
--   save   حفظ مشروع               (app/api/saved-analyses)
--   gage   Gage R&R على داتا المستخدم (app/api/gage-rr، مش الدراسة النموذجية)
-- و AI Insights متسجلة أصلًا في ai_insight_usage (006).
--
-- المستخدم يقدر يضيف صفوف لنفسه بس، ومفيش SELECT ولا UPDATE ولا DELETE،
-- يعني محدش يقدر يمسح سجله. القراية للأدمن بس من خلال admin_user_usage.
-- آمن تشغيله أكتر من مرة.

create table if not exists public.pro_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null check (feature in ('pdf', 'excel', 'save', 'gage')),
  tool text not null check (char_length(tool) between 1 and 80),
  created_at timestamptz not null default now()
);

create index if not exists pro_usage_user_time_idx
  on public.pro_usage (user_id, created_at desc);

alter table public.pro_usage enable row level security;

revoke all on public.pro_usage from anon, authenticated;
grant insert on public.pro_usage to authenticated;

drop policy if exists "pro_usage_insert_own" on public.pro_usage;
create policy "pro_usage_insert_own"
  on public.pro_usage for insert
  to authenticated
  with check (auth.uid() = user_id);

-- استخدام مزايا Pro لمستخدم واحد، مجمّع حسب الميزة والأداة (للأدمن بس)
create or replace function public.admin_user_usage(target uuid)
returns table (
  feature text,
  tool text,
  uses bigint,
  first_at timestamptz,
  last_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
  select u.feature, u.tool, count(*)::bigint, min(u.created_at), max(u.created_at)
  from (
    select p.feature, p.tool, p.created_at from public.pro_usage p where p.user_id = target
    union all
    select 'ai'::text, a.tool, a.created_at from public.ai_insight_usage a where a.user_id = target
  ) u
  group by u.feature, u.tool
  order by max(u.created_at) desc;
end;
$$;

revoke all on function public.admin_user_usage(uuid) from public, anon;
grant execute on function public.admin_user_usage(uuid) to authenticated;
