-- إضافة أداة 'attribute' (صفحة مخططات الصفات p وnp وc وu)
-- لقائمة tool المسموح بيها في saved_analyses.
-- شغّل الملف ده مرة واحدة من Supabase Dashboard → SQL Editor → New query → Run
--
-- لازم يفضل متطابق مع VALID_TOOLS في app/api/saved-analyses/route.ts
-- (تم تحديث الملف ده بالفعل). لحد ما يتشغل، زرار Save في صفحة
-- مخططات الصفات هيرجع خطأ، وباقي الأدوات شغالة عادي.

alter table public.saved_analyses
  drop constraint if exists saved_analyses_tool_check;

alter table public.saved_analyses
  add constraint saved_analyses_tool_check
  check (tool in ('spc', 'pareto', 'dpmo', 'oee', 'gage_rr', 'stability', 'aql', 'icmsf', 'regression', 'multiregression', 'imr', 'xbar_r', 'xbar_s', 'doe', 'descriptive_stats', 'attribute'));
