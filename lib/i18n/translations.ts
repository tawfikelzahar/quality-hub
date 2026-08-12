// ─────────────────────────────────────────────────────────────────────────
// Quality Hub — i18n dictionary
// ─────────────────────────────────────────────────────────────────────────
// Technical/industry terms (Cp, Cpk, Ppk, DPMO, Nelson Rules, AQL, Gage R&R,
// ISO 2859-1, AIAG, ICH Q1E, etc.) are intentionally left in English in
// BOTH languages — that's the convention quality engineers actually use,
// and translating them would make the tool harder to use, not easier.
//
// Only UI copy (nav, headings, descriptions, buttons, labels) is translated.
//
// Add new keys here as more pages get translated. Keep `en` and `ar` in
// sync — every key in one must exist in the other, or `t()` silently falls
// back to English for missing keys.
// ─────────────────────────────────────────────────────────────────────────

export const translations = {
  en: {
    // ── Shared nav (used across landing + tool pages) ──
    nav_tools: 'Tools',
    nav_pricing: 'Pricing',
    nav_about: 'About',
    nav_contact: 'Contact',
    nav_getpro: 'Get Pro',
    nav_signin: 'Sign In',
    nav_signout: 'Sign Out',

    // ── Tool-page breadcrumbs (next to the σ logo in every tool's nav) ──
    bc_spc: 'SPC Engine',
    bc_pareto: 'Pareto Chart',
    bc_dpmo: 'DPMO & Sigma',
    bc_aql: 'AQL Sampling Plan Calculator',
    bc_gagerr: 'Gage R&R',
    bc_stability: 'Stability Study',
    bc_oee: 'OEE Calculator',
    bc_descriptive: 'Descriptive Statistics',
    bc_account: 'Account',
    bc_dashboard: 'Dashboard',
    bc_pricing: 'Pricing',
    bc_about: 'About',
    bc_contact: 'Contact',

    // ── Landing hero ──
    hero_badge: 'Free to start · No installation required',
    hero_title_1: "The quality engineer's",
    hero_title_2: 'complete toolkit',
    hero_sub:
      'SPC, Pareto analysis, Six Sigma calculations, AQL sampling plans & capability studies — directly in your browser. No Minitab license. No learning curve.',
    hero_cta_explore: 'Explore the Toolkit',
    hero_cta_pricing: 'See Pricing',

    pill_1: 'X̄-R & I-MR Charts',
    pill_2: 'Pareto Analysis',
    pill_3: 'DPMO & Sigma Level',
    pill_4: 'AQL Sampling Plans',
    pill_5: 'All 8 Nelson Rules',
    pill_6: 'Cp · Cpk · Pp · Ppk',

    // ── Tools section ──
    tools_label: 'The Toolkit',
    tools_h1: 'Everything a quality engineer',
    tools_h2: 'needs — in one place',
    tools_sub: 'Tools that rival enterprise software, built for engineers who value their time.',

    badge_live: 'Live',
    badge_soon: 'Coming Soon',
    open_tool: 'Open Tool →',

    spc_title: 'SPC Engine',
    spc_desc: 'X̄&R · I-MR · Nelson Rules · Anderson-Darling · Cp · Cpk · Pp · Ppk · Sigma Level · PPM · Attribute Charts',

    pareto_title: 'Pareto Chart',
    pareto_desc: 'Vital Few / Useful Many analysis · CSV & Excel import · Live cumulative % tracking',

    dpmo_title: 'DPMO & Sigma Calculator',
    dpmo_desc: 'Defects Per Million Opportunities · Process Sigma Level · Multi-process comparison',

    aql_title: 'AQL Sampling Plan Calculator',
    aql_desc: 'ISO 2859-1 / ANSI ASQ Z1.4 · Code Letter & Ac/Re lookup · Normal / Tightened / Reduced',

    gagerr_title: 'Gage R&R Study',
    gagerr_desc: 'AIAG Average & Range method · %Study Variation · NDC · Range & X̄ charts',

    stability_title: 'Stability Study',
    stability_desc: 'ICH Q1E shelf-life estimation · Multi-batch regression · Poolability test',

    oee_title: 'OEE Calculator',
    oee_desc: 'Availability × Performance × Quality · Six Big Losses · World-class benchmark',

    fmea_title: 'FMEA Builder',
    fmea_desc: 'Process & Design FMEA · RPN calculation · Risk matrix · Export to Excel',

    // ── Footer ──
    footer_about: 'About',
    footer_contact: 'Contact',
    footer_rights: 'All rights reserved.',
  },

  ar: {
    // ── Shared nav ──
    nav_tools: 'الأدوات',
    nav_pricing: 'الأسعار',
    nav_about: 'عن الموقع',
    nav_contact: 'تواصل معنا',
    nav_getpro: 'اشترك في Pro',
    nav_signin: 'تسجيل الدخول',
    nav_signout: 'تسجيل الخروج',

    // ── Tool-page breadcrumbs ──
    bc_spc: 'SPC Engine',
    bc_pareto: 'مخطط Pareto',
    bc_dpmo: 'DPMO & Sigma',
    bc_aql: 'حاسبة خطة عينات AQL',
    bc_gagerr: 'Gage R&R',
    bc_stability: 'دراسة الاستقرار',
    bc_oee: 'حاسبة OEE',
    bc_descriptive: 'الإحصاء الوصفي',
    bc_account: 'الحساب',
    bc_dashboard: 'لوحة التحكم',
    bc_pricing: 'الأسعار',
    bc_about: 'عن الموقع',
    bc_contact: 'تواصل معنا',

    // ── Landing hero ──
    hero_badge: 'مجاني للبدء · بدون أي تثبيت',
    hero_title_1: 'الحقيبة الكاملة',
    hero_title_2: 'لمهندس الجودة',
    hero_sub:
      'SPC، تحليل باريتو، حسابات Six Sigma، خطط عينات AQL ودراسات القدرة — كل ذلك مباشرة من المتصفح. بدون ترخيص Minitab. وبدون تعقيد.',
    hero_cta_explore: 'استكشف الأدوات',
    hero_cta_pricing: 'شاهد الأسعار',

    pill_1: 'X̄-R & I-MR Charts',
    pill_2: 'تحليل Pareto',
    pill_3: 'DPMO & Sigma Level',
    pill_4: 'خطط عينات AQL',
    pill_5: 'جميع قواعد Nelson الثمانية',
    pill_6: 'Cp · Cpk · Pp · Ppk',

    // ── Tools section ──
    tools_label: 'الأدوات',
    tools_h1: 'كل ما يحتاجه مهندس الجودة',
    tools_h2: 'في مكان واحد',
    tools_sub: 'أدوات تنافس البرامج المدفوعة الضخمة، مبنية للمهندسين الذين يقدّرون وقتهم.',

    badge_live: 'متاح الآن',
    badge_soon: 'قريبًا',
    open_tool: 'افتح الأداة ←',

    spc_title: 'SPC Engine',
    spc_desc: 'X̄&R · I-MR · Nelson Rules · Anderson-Darling · Cp · Cpk · Pp · Ppk · Sigma Level · PPM · Attribute Charts',

    pareto_title: 'مخطط Pareto',
    pareto_desc: 'تحليل Vital Few / Useful Many · استيراد من CSV و Excel · نسبة تراكمية مباشرة',

    dpmo_title: 'حاسبة DPMO & Sigma',
    dpmo_desc: 'Defects Per Million Opportunities · Process Sigma Level · مقارنة بين أكثر من عملية',

    aql_title: 'حاسبة خطة عينات AQL',
    aql_desc: 'ISO 2859-1 / ANSI ASQ Z1.4 · استخراج Code Letter و Ac/Re · Normal / Tightened / Reduced',

    gagerr_title: 'دراسة Gage R&R',
    gagerr_desc: 'AIAG Average & Range method · %Study Variation · NDC · Range & X̄ charts',

    stability_title: 'دراسة الاستقرار (Stability Study)',
    stability_desc: 'حساب مدة الصلاحية بمعيار ICH Q1E · انحدار على أكثر من Batch · اختبار Poolability',

    oee_title: 'حاسبة OEE',
    oee_desc: 'Availability × Performance × Quality · Six Big Losses · مقارنة بالمعايير العالمية',

    fmea_title: 'أداة FMEA',
    fmea_desc: 'Process & Design FMEA · حساب RPN · مصفوفة المخاطر · تصدير إلى Excel',

    // ── Footer ──
    footer_about: 'عن الموقع',
    footer_contact: 'تواصل معنا',
    footer_rights: 'جميع الحقوق محفوظة.',
  },
} as const;

export type Lang = keyof typeof translations;
export type Dict = { readonly [K in keyof typeof translations['en']]: string };
export type TKey = keyof Dict;
