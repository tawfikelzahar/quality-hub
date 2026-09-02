-- المرحلة 4: إضافة أداة 'doe' (Design of Experiments — Full Factorial)
-- لقائمة tool المسموح بيها في saved_analyses.
-- شغّل الملف ده مرة واحدة من Supabase Dashboard → SQL Editor → New query → Run
--
-- لازم يشتغل مع تحديث VALID_TOOLS في app/api/saved-analyses/route.ts —
-- الاتنين لازم يفضلوا متطابقين (تم تحديث الملف ده بالفعل).

alter table public.saved_analyses
  drop constraint if exists saved_analyses_tool_check;

alter table public.saved_analyses
  add constraint saved_analyses_tool_check
  check (tool in ('spc', 'pareto', 'dpmo', 'oee', 'gage_rr', 'stability', 'aql', 'icmsf', 'regression', 'multiregression', 'imr', 'xbar_r', 'xbar_s', 'doe'));
