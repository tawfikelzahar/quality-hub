-- المرحلة: الدفع عن طريق Paymob (دفعة واحدة للمدة، من غير تجديد تلقائي)
-- شغّل الملف ده مرة واحدة من Supabase Dashboard → SQL Editor → New query → Run
--
-- الفكرة:
-- 1) payments: صف لكل محاولة دفع. المستخدم يقدر يقرا صفوفه بس، ومفيش أي
--    INSERT/UPDATE من الموقع مباشرة.
-- 2) كل الكتابة بتتم من دوال payments_* وكل دالة بتطلب "سر" (secret)
--    محفوظ في جدول app_secrets ومحطوط في Vercel باسم PAYMENTS_DB_SECRET.
--    السيرفر بس هو اللي يعرفه، فمحدش يقدر يكلم الدوال دي من المتصفح
--    ويدّي نفسه Pro. كده مش محتاجين مفتاح Supabase السري (service role).
-- 3) payments_confirm بتتنفذ لما Paymob يبلّغ السيرفر إن الدفع تم (بعد
--    التأكد من توقيع HMAC في app/api/paymob/callback): بتعلّم الدفعة paid
--    وتفعّل Pro أو تمدّه. لو اتبعت نفس البلاغ مرتين مبيتحسبش مرتين.
--
-- بعد التشغيل: شغّل الاستعلام اللي في آخر الملف عشان تجيب السر وتحطه في Vercel.
-- آمن تشغيله أكتر من مرة (السر مبيتغيرش لو موجود).

-- ── 1) السر ──────────────────────────────────────────────────────────────
create table if not exists public.app_secrets (
  name text primary key,
  value text not null,
  created_at timestamptz not null default now()
);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;

insert into public.app_secrets (name, value)
values ('payments', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (name) do nothing;

-- ── 2) جدول الدفعات ──────────────────────────────────────────────────────
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  lang text not null default 'ar' check (lang in ('ar', 'en')),
  region text not null check (region in ('eg', 'me')),
  country text,
  plan text not null check (plan in ('monthly', 'quarterly', 'yearly')),
  months integer not null check (months between 1 and 36),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null check (currency in ('EGP', 'USD')),
  founding boolean not null default false,
  mode text not null default 'test' check (mode in ('test', 'live')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
  fail_reason text,
  paymob_intention_id text,
  paymob_order_id bigint,
  paymob_transaction_id bigint,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  pro_from timestamptz,
  pro_until timestamptz
);
create index if not exists payments_user_time_idx on public.payments (user_id, created_at desc);
create index if not exists payments_time_idx on public.payments (created_at desc);

alter table public.payments enable row level security;
revoke all on public.payments from anon, authenticated;
grant select on public.payments to authenticated;

drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own"
  on public.payments for select
  to authenticated
  using (auth.uid() = user_id);

-- ── 3) الدوال (كلها بتطلب السر) ──────────────────────────────────────────
create or replace function public.payments_secret_ok(secret text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(secret, '') <> '' and exists (
    select 1 from public.app_secrets s where s.name = 'payments' and s.value = secret
  );
$$;
revoke all on function public.payments_secret_ok(text) from public, anon, authenticated;

-- دفعة جديدة (pending) قبل ما نفتح صفحة Paymob
create or replace function public.payments_create(
  secret text,
  p_user uuid,
  p_lang text,
  p_region text,
  p_country text,
  p_plan text,
  p_months integer,
  p_amount_cents integer,
  p_currency text,
  p_founding boolean,
  p_mode text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, auth
as $$
declare
  new_id uuid;
  user_email text;
begin
  if not public.payments_secret_ok(secret) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select u.email into user_email from auth.users u where u.id = p_user;
  if user_email is null then
    raise exception 'user not found' using errcode = 'P0002';
  end if;
  insert into public.payments (user_id, email, lang, region, country, plan, months, amount_cents, currency, founding, mode)
  values (p_user, lower(user_email), case when p_lang = 'en' then 'en' else 'ar' end, p_region, nullif(upper(coalesce(p_country, '')), ''),
          p_plan, p_months, p_amount_cents, p_currency, coalesce(p_founding, false), case when p_mode = 'live' then 'live' else 'test' end)
  returning id into new_id;
  return new_id;
end;
$$;

-- ربط الدفعة بأرقام Paymob بعد إنشاء الـ intention
create or replace function public.payments_attach(
  secret text,
  p_id uuid,
  p_intention text,
  p_order bigint
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.payments_secret_ok(secret) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update public.payments
  set paymob_intention_id = p_intention, paymob_order_id = p_order
  where id = p_id and status = 'pending';
end;
$$;

-- نتيجة الدفع من Paymob. بترجع: paid / already / failed / pending / mismatch / not_found
create or replace function public.payments_confirm(
  secret text,
  p_id uuid,
  p_txn bigint,
  p_order bigint,
  p_success boolean,
  p_pending boolean,
  p_amount_cents integer,
  p_currency text,
  p_reason text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, auth
as $$
declare
  pay public.payments%rowtype;
  cur_status text;
  cur_until timestamptz;
  active boolean;
  base timestamptz;
  new_until timestamptz;
  user_name text;
begin
  if not public.payments_secret_ok(secret) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select * into pay from public.payments where id = p_id for update;
  if not found then
    return jsonb_build_object('result', 'not_found');
  end if;
  if pay.status = 'paid' or pay.status = 'refunded' then
    return jsonb_build_object('result', 'already', 'pro_until', pay.pro_until);
  end if;
  if coalesce(p_pending, false) then
    return jsonb_build_object('result', 'pending');
  end if;

  if not coalesce(p_success, false) then
    update public.payments
    set status = 'failed', fail_reason = left(coalesce(p_reason, ''), 300),
        paymob_transaction_id = p_txn, paymob_order_id = coalesce(p_order, paymob_order_id)
    where id = p_id;
    return jsonb_build_object('result', 'failed');
  end if;

  -- المبلغ والعملة لازم يطابقوا اللي السيرفر طلبه
  if p_amount_cents is distinct from pay.amount_cents or upper(coalesce(p_currency, '')) <> pay.currency then
    update public.payments
    set fail_reason = left('amount mismatch: got ' || coalesce(p_amount_cents::text, '?') || ' ' || coalesce(p_currency, '?'), 300),
        paymob_transaction_id = p_txn
    where id = p_id;
    return jsonb_build_object('result', 'mismatch');
  end if;
  if pay.user_id is null then
    return jsonb_build_object('result', 'not_found');
  end if;

  select p.subscription_status, p.pro_until into cur_status, cur_until
  from public.profiles p where p.id = pay.user_id for update;

  active := coalesce(cur_status, 'free') = 'pro' and (cur_until is null or cur_until > now());
  if active and cur_until is null then
    -- Pro من غير تاريخ انتهاء (حساب اختبار): يفضل زي ما هو
    base := now();
    new_until := null;
  elsif active then
    base := cur_until;
    new_until := cur_until + make_interval(months => pay.months);
  else
    base := now();
    new_until := now() + make_interval(months => pay.months);
  end if;

  insert into public.profiles (id, subscription_status, pro_until, updated_at)
  values (pay.user_id, 'pro', new_until, now())
  on conflict (id) do update
    set subscription_status = 'pro', pro_until = excluded.pro_until, updated_at = now();

  update public.payments
  set status = 'paid', paid_at = now(), fail_reason = null,
      paymob_transaction_id = p_txn, paymob_order_id = coalesce(p_order, paymob_order_id),
      pro_from = base, pro_until = new_until
  where id = p_id;

  select coalesce(
    nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(u.raw_user_meta_data->>'name'), '')
  ) into user_name
  from auth.users u where u.id = pay.user_id;

  return jsonb_build_object(
    'result', 'paid',
    'email', pay.email,
    'name', user_name,
    'lang', pay.lang,
    'plan', pay.plan,
    'months', pay.months,
    'amount_cents', pay.amount_cents,
    'currency', pay.currency,
    'pro_until', new_until
  );
end;
$$;

-- آخر الدفعات (للأدمن بس)
create or replace function public.admin_list_payments(max_rows integer default 100)
returns table (
  id uuid,
  created_at timestamptz,
  email text,
  plan text,
  months integer,
  amount_cents integer,
  currency text,
  founding boolean,
  mode text,
  status text,
  fail_reason text,
  country text,
  paymob_transaction_id bigint,
  paid_at timestamptz,
  pro_until timestamptz
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
  select p.id, p.created_at, p.email, p.plan, p.months, p.amount_cents, p.currency, p.founding,
         p.mode, p.status, p.fail_reason, p.country, p.paymob_transaction_id, p.paid_at, p.pro_until
  from public.payments p
  order by p.created_at desc
  limit least(greatest(coalesce(max_rows, 100), 1), 500);
end;
$$;

-- الصلاحيات: دوال الدفع بتتكلم من السيرفر بمفتاح anon العادي، والسر هو الحماية
revoke all on function public.payments_create(text, uuid, text, text, text, text, integer, integer, text, boolean, text) from public;
revoke all on function public.payments_attach(text, uuid, text, bigint) from public;
revoke all on function public.payments_confirm(text, uuid, bigint, bigint, boolean, boolean, integer, text, text) from public;
revoke all on function public.admin_list_payments(integer) from public, anon;

grant execute on function public.payments_create(text, uuid, text, text, text, text, integer, integer, text, boolean, text) to anon, authenticated;
grant execute on function public.payments_attach(text, uuid, text, bigint) to anon, authenticated;
grant execute on function public.payments_confirm(text, uuid, bigint, bigint, boolean, boolean, integer, text, text) to anon, authenticated;
grant execute on function public.admin_list_payments(integer) to authenticated;

-- ── بعد التشغيل ──────────────────────────────────────────────────────────
-- شغّل السطر ده لوحده، وانسخ القيمة وحطها في Vercel باسم PAYMENTS_DB_SECRET:
--   select value from public.app_secrets where name = 'payments';
