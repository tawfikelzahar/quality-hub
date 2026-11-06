-- المرحلة: لوحة الإدارة (/admin)
-- شغّل الملف ده مرة واحدة من Supabase Dashboard → SQL Editor → New query → Run
--
-- 1) profiles.pro_until: تاريخ انتهاء البرو. فاضي (null) = برو من غير تاريخ انتهاء
--    (زي حساب الاختبار الحالي). لو التاريخ عدّى، الموقع بيعامل الحساب كـ free
--    تلقائيًا (lib/plan.ts) من غير ما حد يعمل حاجة.
-- 2) admins: إيميلات الأدمن. مفيش أي GRANT عليه، يعني محدش يقدر يقراه أو يعدّله
--    من الموقع. التعديل بس من هنا (SQL Editor).
-- 3) admin_log: سجل كل عملية بيعملها الأدمن (تفعيل/إلغاء برو، إعادة إيميل الترحيب).
--    برضه مفيش GRANT عليه، والقراية بس من خلال الدوال اللي تحت.
-- 4) دوال admin_*: كل دالة بتتأكد إن اللي بيكلمها أدمن قبل ما ترجع أي إيميلات
--    أو تغيّر أي حاجة. كده الموقع مش محتاج مفتاح Supabase السري (service role) خالص.
--
-- آمن تشغيله أكتر من مرة.

-- ── 1) تاريخ انتهاء البرو ────────────────────────────────────────────────
alter table public.profiles add column if not exists pro_until timestamptz;

-- ── 2) الأدمن ────────────────────────────────────────────────────────────
create table if not exists public.admins (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

insert into public.admins (email) values ('tawfik.elzahar1@gmail.com')
on conflict (email) do nothing;

-- ── 3) سجل العمليات ──────────────────────────────────────────────────────
create table if not exists public.admin_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  admin_email text not null,
  action text not null,
  target_user_id uuid,
  target_email text,
  details jsonb not null default '{}'::jsonb
);
create index if not exists admin_log_time_idx on public.admin_log (created_at desc);
alter table public.admin_log enable row level security;
revoke all on public.admin_log from anon, authenticated;

-- ── 4) الدوال ────────────────────────────────────────────────────────────

-- هل المستخدم الحالي أدمن؟ (إيميل مؤكد وموجود في جدول admins)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from auth.users u
    join public.admins a on a.email = lower(u.email)
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
  );
$$;

-- إيميل الأدمن الحالي (للسجل)
create or replace function public.admin_current_email()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select lower(email) from auth.users where id = auth.uid();
$$;

-- كل المستخدمين (أو مستخدم واحد لو اتبعت only_id)
create or replace function public.admin_list_users(only_id uuid default null)
returns table (
  id uuid,
  email text,
  full_name text,
  provider text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed boolean,
  subscription_status text,
  pro_until timestamptz,
  welcome_sent_at text
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
  select
    u.id,
    u.email::text,
    coalesce(
      nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(u.raw_user_meta_data->>'name'), ''),
      nullif(trim(concat_ws(' ', u.raw_user_meta_data->>'first_name', u.raw_user_meta_data->>'last_name')), '')
    )::text,
    coalesce(u.raw_app_meta_data->>'provider', 'email')::text,
    u.created_at,
    u.last_sign_in_at,
    (u.email_confirmed_at is not null),
    coalesce(p.subscription_status, 'free')::text,
    p.pro_until,
    (u.raw_user_meta_data->>'welcome_sent_at')::text
  from auth.users u
  left join public.profiles p on p.id = u.id
  where only_id is null or u.id = only_id
  order by u.created_at desc;
end;
$$;

-- تغيير خطة مستخدم: new_status = 'pro' أو 'free'
--   pro + until فاضي  → برو من غير تاريخ انتهاء
--   pro + until       → برو لحد التاريخ ده (لازم يكون في المستقبل)
--   free              → يرجع مجاني ويتمسح تاريخ الانتهاء
create or replace function public.admin_set_plan(
  target uuid,
  new_status text,
  until timestamptz default null,
  note text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = public, auth
as $$
declare
  target_email text;
  old_status text;
  old_until timestamptz;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if new_status not in ('pro', 'free') then
    raise exception 'invalid status' using errcode = '22023';
  end if;
  if new_status = 'pro' and until is not null and until <= now() then
    raise exception 'end date must be in the future' using errcode = '22023';
  end if;

  select u.email into target_email from auth.users u where u.id = target;
  if target_email is null then
    raise exception 'user not found' using errcode = 'P0002';
  end if;

  select p.subscription_status, p.pro_until into old_status, old_until
  from public.profiles p where p.id = target;

  insert into public.profiles (id, subscription_status, pro_until, updated_at)
  values (target, new_status, case when new_status = 'pro' then until end, now())
  on conflict (id) do update
    set subscription_status = excluded.subscription_status,
        pro_until = excluded.pro_until,
        updated_at = now();

  insert into public.admin_log (admin_email, action, target_user_id, target_email, details)
  values (
    public.admin_current_email(),
    case when new_status = 'pro' then 'set_pro' else 'set_free' end,
    target,
    target_email,
    jsonb_build_object(
      'from_status', coalesce(old_status, 'free'),
      'from_until', old_until,
      'until', case when new_status = 'pro' then until end,
      'note', nullif(trim(coalesce(note, '')), '')
    )
  );
end;
$$;

-- تسجيل عملية من الموقع نفسه (زي إعادة إيميل الترحيب)
create or replace function public.admin_log_event(
  action text,
  target uuid default null,
  details jsonb default '{}'::jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if action not in ('resend_welcome', 'export_users') then
    raise exception 'invalid action' using errcode = '22023';
  end if;
  insert into public.admin_log (admin_email, action, target_user_id, target_email, details)
  values (
    public.admin_current_email(),
    action,
    target,
    (select u.email from auth.users u where u.id = target),
    coalesce(details, '{}'::jsonb)
  );
end;
$$;

-- آخر العمليات
create or replace function public.admin_get_log(max_rows integer default 100)
returns table (
  id bigint,
  created_at timestamptz,
  admin_email text,
  action text,
  target_user_id uuid,
  target_email text,
  details jsonb
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
  select l.id, l.created_at, l.admin_email, l.action, l.target_user_id, l.target_email, l.details
  from public.admin_log l
  order by l.created_at desc
  limit least(greatest(coalesce(max_rows, 100), 1), 500);
end;
$$;

-- الصلاحيات: المسجلين بس يقدروا يكلموا الدوال (والدوال نفسها بتتأكد من الأدمن)
revoke all on function public.is_admin() from public, anon;
revoke all on function public.admin_current_email() from public, anon, authenticated;
revoke all on function public.admin_list_users(uuid) from public, anon;
revoke all on function public.admin_set_plan(uuid, text, timestamptz, text) from public, anon;
revoke all on function public.admin_log_event(text, uuid, jsonb) from public, anon;
revoke all on function public.admin_get_log(integer) from public, anon;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.admin_list_users(uuid) to authenticated;
grant execute on function public.admin_set_plan(uuid, text, timestamptz, text) to authenticated;
grant execute on function public.admin_log_event(text, uuid, jsonb) to authenticated;
grant execute on function public.admin_get_log(integer) to authenticated;
