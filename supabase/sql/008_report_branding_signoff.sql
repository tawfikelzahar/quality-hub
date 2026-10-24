-- هوية التقارير: خانة "Approved by" بقت مستقلة عن "Prepared by"
-- شغّل الملف ده مرة واحدة من Supabase Dashboard → SQL Editor → New query → Run
--
-- show_signatures  = خانة توقيع "Prepared by" (زي ما هي)
-- show_approved    = خانة توقيع "Approved by" (جديدة) — بتاخد نفس قيمة
--                    show_signatures للمستخدمين الحاليين عشان تقاريرهم ما تتغيرش

alter table public.report_branding
  add column if not exists show_approved boolean;

update public.report_branding
  set show_approved = show_signatures
  where show_approved is null;

alter table public.report_branding
  alter column show_approved set default true,
  alter column show_approved set not null;
