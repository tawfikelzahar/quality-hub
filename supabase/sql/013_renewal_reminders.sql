-- المرحلة: إيميلات التذكير بالتجديد (قبل انتهاء Pro بـ 7 أيام وقبلها بيوم)
-- شغّل الملف ده مرة واحدة من Supabase Dashboard → SQL Editor → New query → Run
-- (لازم يكون 012_payments.sql اتشغّل قبله)
--
-- الفكرة:
-- 1) renewal_reminders: صف لكل تذكير اتبعت (المستخدم + تاريخ الانتهاء + النوع).
--    الصف ده هو اللي بيمنع إن نفس التذكير يتبعت مرتين. ولما المشترك يجدد
--    تاريخ الانتهاء بيتغير، فيتبعتله تذكير جديد قبل التاريخ الجديد.
-- 2) reminders_claim: بتتنفذ مرة كل يوم من الموقع (app/api/cron/renewal-reminders).
--    بتجيب المشتركين اللي باقتهم هتنتهي خلال 7 أيام وتحجز لهم التذكير:
--      باقي يوم أو أقل (بتوقيت القاهرة) → تذكير "1d"
--      باقي من يومين لـ 7 أيام          → تذكير "7d"
--    التذكير للي دفع قبل كده بس (Pro المتفعّلة يدويًا من غير دفع مبيتبعتلهاش).
-- 3) reminders_finish: بعد محاولة الإرسال. لو الإيميل اتبعت بتسجّل وقت الإرسال،
--    ولو فشل بتلغي الحجز عشان يتجرب تاني في اليوم اللي بعده.
--
-- الدوال بتطلب نفس السر بتاع الدفع (PAYMENTS_DB_SECRET)، فمفيش حاجة جديدة
-- تتحط في Supabase. آمن تشغيله أكتر من مرة.

-- ── 1) جدول التذكيرات ────────────────────────────────────────────────────
create table if not exists public.renewal_reminders (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  pro_until timestamptz not null,
  kind text not null check (kind in ('7d', '1d')),
  email text,
  claimed_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (user_id, pro_until, kind)
);
create index if not exists renewal_reminders_time_idx on public.renewal_reminders (claimed_at desc);

alter table public.renewal_reminders enable row level security;
revoke all on public.renewal_reminders from anon, authenticated;

-- ── 2) حجز التذكيرات المستحقة ────────────────────────────────────────────
-- بترجع قائمة JSON: [{ id, email, name, lang, kind, pro_until, founding }]
create or replace function public.reminders_claim(secret text, max_rows integer default 40)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, auth
as $$
declare
  result jsonb;
begin
  if not public.payments_secret_ok(secret) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  with due as (
    select d.user_id, d.pro_until, d.kind
    from (
      select p.id as user_id, p.pro_until,
             case when ((p.pro_until at time zone 'Africa/Cairo')::date - (now() at time zone 'Africa/Cairo')::date) <= 1
                  then '1d' else '7d' end as kind
      from public.profiles p
      where p.subscription_status = 'pro'
        and p.pro_until is not null
        and p.pro_until > now()
        and ((p.pro_until at time zone 'Africa/Cairo')::date - (now() at time zone 'Africa/Cairo')::date) <= 7
        and exists (select 1 from public.payments y where y.user_id = p.id and y.status = 'paid')
    ) d
    where not exists (
      select 1 from public.renewal_reminders r
      where r.user_id = d.user_id and r.pro_until = d.pro_until and r.kind = d.kind
        and (r.sent_at is not null or r.claimed_at >= now() - interval '30 minutes')
    )
    order by d.pro_until
    limit least(greatest(coalesce(max_rows, 40), 1), 200)
  ),
  claimed as (
    insert into public.renewal_reminders as r (user_id, pro_until, kind, email)
    select d.user_id, d.pro_until, d.kind, lower(u.email)
    from due d
    join auth.users u on u.id = d.user_id
    where u.email is not null
    on conflict (user_id, pro_until, kind) do update
      set claimed_at = now(), email = excluded.email
      where r.sent_at is null and r.claimed_at < now() - interval '30 minutes'
    returning r.id, r.user_id, r.pro_until, r.kind, r.email
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'email', c.email,
    'name', (
      select coalesce(
        nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
        nullif(trim(u.raw_user_meta_data->>'name'), '')
      ) from auth.users u where u.id = c.user_id
    ),
    'lang', coalesce((
      select y.lang from public.payments y
      where y.user_id = c.user_id and y.status = 'paid'
      order by y.paid_at desc nulls last limit 1
    ), 'ar'),
    'kind', c.kind,
    'pro_until', c.pro_until,
    'founding', exists (
      select 1 from public.payments y
      where y.user_id = c.user_id and y.status = 'paid' and y.founding
    )
  ) order by c.pro_until), '[]'::jsonb)
  into result
  from claimed c;

  return result;
end;
$$;

-- ── 3) نتيجة الإرسال ─────────────────────────────────────────────────────
create or replace function public.reminders_finish(secret text, p_id bigint, p_sent boolean)
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
  if coalesce(p_sent, false) then
    update public.renewal_reminders set sent_at = now() where id = p_id and sent_at is null;
  else
    delete from public.renewal_reminders where id = p_id and sent_at is null;
  end if;
end;
$$;

-- الصلاحيات: زي دوال الدفع، بتتكلم من السيرفر بمفتاح anon والسر هو الحماية
revoke all on function public.reminders_claim(text, integer) from public;
revoke all on function public.reminders_finish(text, bigint, boolean) from public;

grant execute on function public.reminders_claim(text, integer) to anon, authenticated;
grant execute on function public.reminders_finish(text, bigint, boolean) to anon, authenticated;

-- ── للمتابعة ─────────────────────────────────────────────────────────────
-- تشوف آخر التذكيرات اللي اتبعتت:
--   select email, kind, pro_until, sent_at from public.renewal_reminders order by claimed_at desc limit 50;
