-- ─────────────────────────────────────────────────────────────────────────
-- 014 — رقم الجوال مع كل دفعة
--
-- المشترك بيكتب رقم جواله في صفحة الدفع. قبل الملف ده الرقم كان بيتبعت
-- لـ Paymob بس ومش بيتسجل عندنا. من هنا بيتسجل مع الدفعة عشان نقدر نتواصل
-- مع المشترك (سياسة الخصوصية اتحدثت بنفس المعنى في lib/legal.ts).
--
-- شغّل الملف ده مرة واحدة في Supabase → SQL Editor. تشغيله أكتر من مرة آمن.
-- الموقع شغال عادي قبل وبعد تشغيله: قبل التشغيل الرقم مش بيتسجل وبس.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.payments add column if not exists phone text;

-- تسجيل الرقم على دفعة لسه pending (بيتنادى من السيرفر بعد payments_create)
create or replace function public.payments_set_phone(
  secret text,
  p_id uuid,
  p_phone text
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
  if p_phone is null or p_phone !~ '^\+?[0-9]{8,15}$' then
    return;
  end if;
  update public.payments
  set phone = p_phone
  where id = p_id and status = 'pending';
end;
$$;

-- أرقام الجوال للأدمن بس: رقم كل دفعة، ومعاه صاحبها (بتظهر في /admin وملف الـ Excel)
create or replace function public.admin_payment_phones()
returns table (
  payment_id uuid,
  user_id uuid,
  phone text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
  select p.id, p.user_id, p.phone, p.created_at
  from public.payments p
  where p.phone is not null
  order by p.created_at desc;
end;
$$;

-- الصلاحيات: زي باقي دوال الدفع (السيرفر بمفتاح anon والسر هو الحماية) ودوال الأدمن
revoke all on function public.payments_set_phone(text, uuid, text) from public;
revoke all on function public.admin_payment_phones() from public, anon;

grant execute on function public.payments_set_phone(text, uuid, text) to anon, authenticated;
grant execute on function public.admin_payment_phones() to authenticated;
