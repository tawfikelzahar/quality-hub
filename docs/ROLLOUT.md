# تطبيق الترجمة على باقي الصفحات — خطوات ثابتة لكل ملف

الملفات دي جاهزة وتقدر تحطها في الريبو زي ما هي:
- lib/i18n/translations.ts        (جديد)
- lib/i18n/context.tsx            (جديد)
- components/LanguageToggle.tsx   (جديد)
- components/AuthStatus.tsx       (استبدال الملف الحالي بالكامل)
- app/layout.tsx                  (استبدال الملف الحالي بالكامل)
- app/page.tsx                    (استبدال الملف الحالي بالكامل)

الباقي (SPCEngine.tsx, ParetoChart.tsx, DPMOCalculator.tsx, GageRR.tsx,
StabilityStudy.tsx, OEECalculator.tsx, DescriptiveStats.tsx,
app/aql/page.tsx, app/account/page.tsx, app/dashboard/page.tsx,
app/pricing/page.tsx, app/about/page.tsx, app/contact/page.tsx)
كلهم عندهم نفس نمط الـ nav بالظبط، فبتطبّق فيهم نفس 4 تعديلات:

---

## 1) الـ imports (فوق الملف، جنب باقي الـ imports)

```tsx
import LanguageToggle from '@/components/LanguageToggle'
import { useLanguage } from '@/lib/i18n/context'
```

## 2) جوه الكومبوننت (جنب أي `const [theme, setTheme] = usePersistedTheme()` موجود)

```tsx
const { t } = useLanguage()
```

⚠️ **تنبيه واحد مهم:** لو في نفس الملف فيه `.map(t => ...)` بيستخدم `t` كاسم متغير محلي
(زي أي array.map بيسمي العنصر `t`)، لازم تغيّر اسمه (مثلاً `tag` أو `item`) عشان
يتعارضش مع `t` بتاعة الترجمة. افحص الملف بسرعة بحرف `Ctrl+F` على `(t =>` أو `(t)=>`
قبل ما تضيف السطر ده.

## 3) الـ breadcrumb — استبدل النص الثابت بمفتاح الترجمة المناسب

| الملف | القديم | الجديد |
|---|---|---|
| SPCEngine.tsx | `SPC Engine` | `{t('bc_spc')}` |
| ParetoChart.tsx | `Pareto Chart` | `{t('bc_pareto')}` |
| DPMOCalculator.tsx | `DPMO & Sigma Calculator` | `{t('bc_dpmo')}` |
| app/aql/page.tsx | `{messages.appTitle}` | خليها زي ما هي (نص AQL ده جوه سيستم `messages` منفصل — راجع ملاحظة تحت) |
| GageRR.tsx | `Gage R&R` | `{t('bc_gagerr')}` |
| StabilityStudy.tsx | `Stability Study` | `{t('bc_stability')}` |
| OEECalculator.tsx | `OEE Calculator` | `{t('bc_oee')}` |
| DescriptiveStats.tsx | `Descriptive Statistics` | `{t('bc_descriptive')}` |
| app/account/page.tsx | `Account` | `{t('bc_account')}` |
| app/dashboard/page.tsx | `Dashboard` | `{t('bc_dashboard')}` |
| app/pricing/page.tsx | `Pricing` | `{t('bc_pricing')}` |
| app/about/page.tsx | `About` | `{t('bc_about')}` |
| app/contact/page.tsx | `Contact` | `{t('bc_contact')}` |

مثال حقيقي — في `SPCEngine.tsx`:

```diff
  <span className="qh-breadcrumb-sep" style={s.separator}>/</span>
- <span className="qh-breadcrumb" style={s.breadcrumb}>SPC Engine</span>
+ <span className="qh-breadcrumb" style={s.breadcrumb}>{t('bc_spc')}</span>
```

## 4) ضيف زرار اللغة جنب زرار الـ Dark/Light — بنفس النمط في كل الملفات

```diff
  <div className="qh-nav-right" style={s.navRight}>
+   <LanguageToggle theme={theme} />
    <button style={s.themeBtn} onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}>
      {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
    </button>
    <AuthStatus />
    <Link href="/pricing" style={s.ctaBtn}>Get Pro →</Link>
  </div>
```

⚠️ لاحظ هنا كمان: `setTheme(t => ...)` — اسم البارامتر `t` جوه الـ arrow function ده
تعارض مباشر مع `const { t } = useLanguage()`. لازم تغيّره لاسم تاني، مثلاً:

```diff
- onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
+ onClick={() => setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))}
```

**ده موجود في كل ملفات الأدوات تقريبًا** (SPCEngine, ParetoChart, DPMOCalculator,
GageRR, StabilityStudy, OEECalculator, DescriptiveStats, AQL, Account,
Dashboard, Pricing, About, Contact) — لازم يتغيّر في كل واحد فيهم.

## 5) (اختياري) ترجمة زرار "Get Pro →"

```diff
- <Link href="/pricing" style={s.ctaBtn}>Get Pro →</Link>
+ <Link href="/pricing" style={s.ctaBtn}>{t('nav_getpro')} →</Link>
```

---

## ملاحظة عن `lib/aql/messages.ts`

الملف ده أصلاً معمول بنفس فكرة الـ i18n بالظبط (نصوص منفصلة عن الكومبوننت)، لكنه
مبني على افتراض إن الموقع كله إنجليزي. أفضل حل: نسيبه زي ما هو دلوقتي (صفحة AQL
تفضل إنجليزي مؤقتًا) وناخده كمرحلة منفصلة بعد كده، لأنه فيه نصوص ديناميكية
(دوال زي `switchNote(from, to, n)`) محتاجة تتحول لدوال بترجع نص حسب اللغة —
شغل أدق شوية من باقي الصفحات ومحتاج جلسة لوحده.

---

## بعد ما تخلّص التطبيق

1. `npx tsc --noEmit` — تأكد مفيش تعارض أسماء (`t` vs `t` في map/setTheme) فات عليك.
2. جرّب زرار اللغة في كل صفحة، وتأكد إن الاختيار بيفضل متذكور (localStorage `qh-lang`)
   وبينتقل بين الصفحات صح.
3. لسه في نص إضافي جوه كل أداة (labels زي "Data Entry", "Export", رسائل الأخطاء...)
   ده *المرحلة الجاية* — نفس المبدأ بالظبط: نضيف مفاتيح جديدة في `translations.ts`
   ونستبدل بيها، أداة أداة.
