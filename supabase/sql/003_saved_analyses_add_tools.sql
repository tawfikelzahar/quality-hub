-- المرحلة 3: إضافة أدوات جديدة لقائمة tool المسموح بيها في saved_analyses
-- شغّل الملف ده مرة واحدة من Supabase Dashboard → SQL Editor → New query → Run
--
-- الجدول الأصلي (002_saved_analyses.sql) كان بيسمح بس بـ:
--   'spc', 'pareto', 'dpmo', 'oee', 'gage_rr', 'stability', 'aql'
-- وده كان ناقص 'icmsf' أصلاً (اتضاف في الكود من غير ما الـ constraint يتحدّث)،
-- ودلوقتي بنضيف 'regression' (Simple Linear Regression) و'multiregression'
-- (Multiple Linear Regression) كمان.
--
-- لازم تشتغل مع تحديث VALID_TOOLS في app/api/saved-analyses/route.ts —
-- الاتنين لازم يفضلوا متطابقين، زي التعليق الأصلي بيقول.

alter table public.saved_analyses
  drop constraint if exists saved_analyses_tool_check;

alter table public.saved_analyses
  add constraint saved_analyses_tool_check
  check (tool in ('spc', 'pareto', 'dpmo', 'oee', 'gage_rr', 'stability', 'aql', 'icmsf', 'regression', 'multiregression'));
