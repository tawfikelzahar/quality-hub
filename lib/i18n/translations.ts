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

    // ── About page ──
    about_kicker: 'About Quality Hub',
    about_hero_title_1: 'Built by a Quality Engineer,',
    about_hero_title_2: 'for Quality Engineers.',
    about_origin_p1:
      "Quality Hub started with a simple frustration: quality engineers shouldn't need five different tools, a stack of spreadsheets, and an expensive software license just to run an SPC chart or calculate Cpk.",
    about_origin_p2:
      'After more than 10 years working in manufacturing, quality engineering, and continuous improvement, I built the platform I wished existed — one place for SPC, Process Capability, Pareto Analysis, AQL Sampling, Gage R&R (MSA), and Stability Studies, built to the standards engineers actually work against: ISO 2859-1, AIAG, and ICH Q1E.',
    about_philosophy_heading: 'Our Philosophy',
    about_philosophy_p:
      'Good quality engineering starts with good evidence. Data should help you understand variation. Analysis should support real decisions. And better decisions should lead to better processes.',
    about_step_analyze: 'Analyze',
    about_step_understand: 'Understand',
    about_step_decide: 'Decide',
    about_step_improve: 'Improve',
    about_direct_heading: 'Direct, hands-on, and accountable',
    about_direct_p1:
      "Every tool on Quality Hub is built, tested, and maintained by me — actively used and refined based on real quality engineering work, not handed off to a support team that doesn't understand the field.",
    about_direct_p2:
      "When you reach out, you're talking directly to the person building the platform. Feedback turns into features fast, because there's no layer between your request and the person who can act on it.",
    about_builder_name: 'Tawfik Elzahar',
    about_builder_role: 'Quality Engineer · Founder, Quality Hub',
    about_builder_cta: "If you have questions, feedback, or a feature request, I'd genuinely like to hear from you.",

    // ── Shared contact CTAs (About + Contact pages) ──
    cta_email: 'Email',
    cta_whatsapp: 'WhatsApp',
    cta_linkedin: 'LinkedIn',

    // ── Contact page ──
    contact_hero_title: 'Get in touch',
    contact_hero_sub:
      "Questions, feedback, or a feature request — reach out directly. You'll be talking to the person building Quality Hub, not a support queue.",
    contact_ch_email_title: 'Email',
    contact_ch_email_sub: 'Best for detailed questions, billing, or account issues.',
    contact_ch_email_cta: 'Send an email',
    contact_ch_whatsapp_title: 'WhatsApp',
    contact_ch_whatsapp_sub: 'Best for quick questions before you subscribe.',
    contact_ch_whatsapp_cta: 'Open WhatsApp',
    contact_ch_linkedin_title: 'LinkedIn',
    contact_ch_linkedin_sub: 'Connect, follow updates, or send a message.',
    contact_ch_linkedin_cta: 'View profile',
    contact_footer_prefix: 'Want to know more about the project first?',
    contact_footer_link: 'Read the About page',

    // ── Pricing page ──
    pricing_hero_title: 'Simple, transparent pricing',
    pricing_hero_sub:
      'Start free with the core tools. Upgrade when you need advanced analysis, more exports, and saved projects.',
    pricing_price_label: 'Coming Soon',
    pricing_recommended: 'RECOMMENDED',
    pricing_loading: 'Loading...',

    pricing_free_name: 'Free',
    pricing_free_price: '$0',
    pricing_free_tagline: 'Forever free — no credit card needed',
    pricing_free_bullet_1: 'SPC Engine (I-MR, X̄-R, capability)',
    pricing_free_bullet_2: 'Pareto Chart',
    pricing_free_bullet_3: 'DPMO & Sigma Calculator',
    pricing_free_bullet_4: 'OEE Calculator',
    pricing_free_bullet_5: 'CSV / PNG export (watermarked)',
    pricing_free_cta_dashboard: 'Go to Dashboard',
    pricing_free_cta_start: 'Get Started Free',

    pricing_pro_name: 'Pro',
    pricing_pro_tagline: 'Everything in Free, plus the full toolkit',
    pricing_pro_bullet_1: 'Everything in Free',
    pricing_pro_bullet_2: 'Attribute charts, Nelson Rules & normality tests',
    pricing_pro_bullet_3: 'Gage R&R, Stability Study & AQL Calculator',
    pricing_pro_bullet_4: 'Excel / PDF export — no watermark',
    pricing_pro_bullet_5: 'Save projects, Cloud Sync & Dashboard (up to 50)',
    pricing_pro_cta: 'Upgrade to Pro',

    pricing_table_title: 'Full Feature Comparison',
    pricing_col_feature: 'Feature',
    pricing_col_free: 'Free',
    pricing_col_pro: 'Pro',

    pricing_section_spc: 'SPC Engine',
    pricing_section_other: 'Other Tools',
    pricing_section_export: 'Export & Projects',

    pricing_feat_imr: 'I-MR & X̄-R charts',
    pricing_feat_capability: 'Capability indices (Cp/Cpk/Pp/Ppk)',
    pricing_feat_attribute: 'Attribute charts (p/np/c/u)',
    pricing_feat_nelson: 'Nelson Rule violations',
    pricing_feat_ad: 'Anderson-Darling normality test',
    pricing_feat_dist: 'Distribution / ECDF charts',
    pricing_feat_pareto: 'Pareto Chart',
    pricing_feat_dpmo: 'DPMO & Sigma Calculator',
    pricing_feat_oee: 'OEE Calculator',
    pricing_feat_gagerr: 'Gage R&R (AIAG Average & Range)',
    pricing_feat_stability: 'Stability Study',
    pricing_feat_aql: 'AQL Sampling Plan Calculator',
    pricing_feat_export_csv: 'Export to CSV / PNG',
    pricing_feat_export_excel: 'Export to Excel / PDF',
    pricing_feat_save: 'Save projects & Cloud Sync',
    pricing_feat_dashboard: 'Projects Dashboard',

    pricing_val_watermark: 'With watermark',
    pricing_val_nowatermark: 'No watermark',
    pricing_val_50projects: 'Up to 50 projects',

    pricing_footer_prefix: 'Questions about a plan?',
    pricing_footer_link: 'Visit your account page',
    pricing_footer_suffix: 'for the current status of your plan.',

    // ── Descriptive Statistics tool ──
    ds_data_input: '📋 Data Input',
    ds_placeholder: 'Paste one number per line (or comma/tab separated)\ne.g.\n24.3\n25.1\n25.6\n...',
    ds_valid_value: 'valid value',
    ds_valid_values: 'valid values',
    ds_detected: 'detected',
    ds_upload_csv: '📁 Upload CSV / Excel',
    ds_calculating: 'Calculating…',
    ds_calculate: '▶ Calculate',
    ds_clear_all: '🗑️ Clear All Data',
    ds_export_excel: '📊 Export to Excel',
    ds_export_excel_pro: '🔒 Export to Excel (Pro)',
    ds_empty_state:
      'Paste or upload your measurement data, then hit Calculate to see the full statistical breakdown, histogram, and box plot.',
    ds_histogram_boxplot: '📊 Histogram + Box Plot',
    ds_ad_test_name: 'Anderson-Darling Normality Test',
    ds_ad_normal: 'p ≥ 0.05 — no significant evidence against normality (α = 0.05).',
    ds_ad_not_normal: 'p < 0.05 — data significantly deviates from a normal distribution (α = 0.05).',
    ds_ad_need_8: 'Need at least 8 data points to run the normality test.',
    ds_detailed_stats: 'Detailed Statistics',
    ds_stat_n: 'N',
    ds_stat_mean: 'Mean',
    ds_stat_stdev: 'StDev',
    ds_stat_variance: 'Variance',
    ds_stat_cv: 'CV (%)',
    ds_stat_skewness: 'Skewness',
    ds_stat_kurtosis: 'Kurtosis',
    ds_stat_min: 'Minimum',
    ds_stat_q1: 'Q1',
    ds_stat_median: 'Median',
    ds_stat_q3: 'Q3',
    ds_stat_max: 'Maximum',
    ds_stat_iqr: 'IQR',
    ds_stat_range: 'Range',
    ds_ci_title: '95% Confidence Intervals',
    ds_ci_need_n6: 'Need N ≥ 6',
    ds_range_to: 'to',
    ds_err_min2: 'Need at least 2 valid numeric values.',
    ds_err_calc_failed: 'Calculation failed.',
    ds_err_network: 'Network error while calculating.',
    ds_err_file_read: 'Could not read the uploaded file.',
    ds_frequency: 'Frequency',

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

    // ── About page ──
    about_kicker: 'عن Quality Hub',
    about_hero_title_1: 'بُنيت على يد مهندس جودة،',
    about_hero_title_2: 'لمهندسي الجودة.',
    about_origin_p1:
      'بدأت فكرة Quality Hub من إحباط بسيط: لا ينبغي أن يحتاج مهندس الجودة إلى خمس أدوات مختلفة، وكومة من ملفات الإكسل، ورخصة برنامج باهظة الثمن، لمجرد رسم مخطط SPC أو حساب Cpk.',
    about_origin_p2:
      'بعد أكثر من 10 سنوات من العمل في التصنيع وهندسة الجودة والتحسين المستمر، بنيت المنصة التي كنت أتمنى وجودها — مكان واحد لـ SPC، وتحليل القدرة (Process Capability)، وتحليل باريتو، وعينات AQL، وGage R&R (MSA)، ودراسات الاستقرار، مبنية على المعايير التي يعمل بها المهندس فعليًا: ISO 2859-1، وAIAG، وICH Q1E.',
    about_philosophy_heading: 'فلسفتنا',
    about_philosophy_p:
      'هندسة الجودة الجيدة تبدأ بدليل موثوق. البيانات يجب أن تساعدك على فهم التباين. التحليل يجب أن يدعم قرارات حقيقية. والقرارات الأفضل يجب أن تؤدي إلى عمليات أفضل.',
    about_step_analyze: 'تحليل',
    about_step_understand: 'فهم',
    about_step_decide: 'قرار',
    about_step_improve: 'تحسين',
    about_direct_heading: 'مباشر، عملي، ومسؤول',
    about_direct_p1:
      'كل أداة في Quality Hub مبنية ومُختبرة ومُدارة بمعرفتي الشخصية — تُستخدم وتُطوَّر باستمرار بناءً على عمل حقيقي في هندسة الجودة، وليست موكلة إلى فريق دعم لا يفهم المجال.',
    about_direct_p2:
      'عندما تتواصل معنا، فأنت تتحدث مباشرة مع الشخص الذي يبني المنصة. الملاحظات تتحول إلى ميزات بسرعة، لأنه لا توجد طبقات وسيطة بين طلبك والشخص القادر على تنفيذه.',
    about_builder_name: 'توفيق الزهار',
    about_builder_role: 'مهندس جودة · مؤسس Quality Hub',
    about_builder_cta: 'إذا كانت لديك أسئلة أو ملاحظات أو اقتراح لميزة جديدة، يسعدني أن أسمعها منك.',

    // ── Shared contact CTAs (About + Contact pages) ──
    cta_email: 'البريد الإلكتروني',
    cta_whatsapp: 'WhatsApp',
    cta_linkedin: 'LinkedIn',

    // ── Contact page ──
    contact_hero_title: 'تواصل معنا',
    contact_hero_sub:
      'أسئلة أو ملاحظات أو اقتراح لميزة جديدة — تواصل معنا مباشرة. ستكون تتحدث مع الشخص الذي يبني Quality Hub، وليس مع فريق دعم.',
    contact_ch_email_title: 'البريد الإلكتروني',
    contact_ch_email_sub: 'الأنسب للأسئلة التفصيلية، أو مشكلات الفوترة أو الحساب.',
    contact_ch_email_cta: 'إرسال بريد إلكتروني',
    contact_ch_whatsapp_title: 'WhatsApp',
    contact_ch_whatsapp_sub: 'الأنسب للأسئلة السريعة قبل الاشتراك.',
    contact_ch_whatsapp_cta: 'فتح WhatsApp',
    contact_ch_linkedin_title: 'LinkedIn',
    contact_ch_linkedin_sub: 'تواصل، تابع التحديثات، أو أرسل رسالة.',
    contact_ch_linkedin_cta: 'عرض الملف الشخصي',
    contact_footer_prefix: 'هل ترغب في معرفة المزيد عن المشروع أولًا؟',
    contact_footer_link: 'اقرأ صفحة "عن الموقع"',

    // ── Pricing page ──
    pricing_hero_title: 'أسعار بسيطة وواضحة',
    pricing_hero_sub:
      'ابدأ مجانًا بالأدوات الأساسية. قم بالترقية عندما تحتاج إلى تحليل متقدم، ومزيد من خيارات التصدير، ومشاريع محفوظة.',
    pricing_price_label: 'قريبًا',
    pricing_recommended: 'الأكثر طلبًا',
    pricing_loading: 'جارٍ التحميل...',

    pricing_free_name: 'مجاني',
    pricing_free_price: '0 $',
    pricing_free_tagline: 'مجاني للأبد — بدون بطاقة ائتمان',
    pricing_free_bullet_1: 'SPC Engine (I-MR, X̄-R, القدرة)',
    pricing_free_bullet_2: 'مخطط Pareto',
    pricing_free_bullet_3: 'حاسبة DPMO & Sigma',
    pricing_free_bullet_4: 'حاسبة OEE',
    pricing_free_bullet_5: 'تصدير CSV / PNG (بعلامة مائية)',
    pricing_free_cta_dashboard: 'الذهاب إلى لوحة التحكم',
    pricing_free_cta_start: 'ابدأ مجانًا',

    pricing_pro_name: 'Pro',
    pricing_pro_tagline: 'كل ما في الخطة المجانية، بالإضافة إلى الحقيبة الكاملة',
    pricing_pro_bullet_1: 'كل ما في الخطة المجانية',
    pricing_pro_bullet_2: 'مخططات Attribute، وقواعد Nelson، واختبارات التوزيع الطبيعي',
    pricing_pro_bullet_3: 'Gage R&R، ودراسة الاستقرار، وحاسبة AQL',
    pricing_pro_bullet_4: 'تصدير Excel / PDF — بدون علامة مائية',
    pricing_pro_bullet_5: 'حفظ المشاريع، والمزامنة السحابية، ولوحة التحكم (حتى 50 مشروعًا)',
    pricing_pro_cta: 'الترقية إلى Pro',

    pricing_table_title: 'مقارنة كاملة بين المزايا',
    pricing_col_feature: 'الميزة',
    pricing_col_free: 'مجاني',
    pricing_col_pro: 'Pro',

    pricing_section_spc: 'SPC Engine',
    pricing_section_other: 'أدوات أخرى',
    pricing_section_export: 'التصدير والمشاريع',

    pricing_feat_imr: 'مخططات I-MR وX̄-R',
    pricing_feat_capability: 'مؤشرات القدرة (Cp/Cpk/Pp/Ppk)',
    pricing_feat_attribute: 'مخططات Attribute (p/np/c/u)',
    pricing_feat_nelson: 'مخالفات قواعد Nelson',
    pricing_feat_ad: 'اختبار Anderson-Darling للتوزيع الطبيعي',
    pricing_feat_dist: 'مخططات التوزيع / ECDF',
    pricing_feat_pareto: 'مخطط Pareto',
    pricing_feat_dpmo: 'حاسبة DPMO & Sigma',
    pricing_feat_oee: 'حاسبة OEE',
    pricing_feat_gagerr: 'Gage R&R (AIAG Average & Range)',
    pricing_feat_stability: 'دراسة الاستقرار',
    pricing_feat_aql: 'حاسبة خطة عينات AQL',
    pricing_feat_export_csv: 'تصدير إلى CSV / PNG',
    pricing_feat_export_excel: 'تصدير إلى Excel / PDF',
    pricing_feat_save: 'حفظ المشاريع والمزامنة السحابية',
    pricing_feat_dashboard: 'لوحة تحكم المشاريع',

    pricing_val_watermark: 'بعلامة مائية',
    pricing_val_nowatermark: 'بدون علامة مائية',
    pricing_val_50projects: 'حتى 50 مشروعًا',

    pricing_footer_prefix: 'هل لديك سؤال عن إحدى الخطط؟',
    pricing_footer_link: 'قم بزيارة صفحة حسابك',
    pricing_footer_suffix: 'لمعرفة الحالة الحالية لخطتك.',

    // ── Descriptive Statistics tool ──
    ds_data_input: '📋 إدخال البيانات',
    ds_placeholder: 'الصق رقمًا واحدًا في كل سطر (أو مفصولة بفاصلة/تاب)\nمثال:\n24.3\n25.1\n25.6\n...',
    ds_valid_value: 'قيمة صحيحة',
    ds_valid_values: 'قيمة صحيحة',
    ds_detected: 'تم اكتشافها',
    ds_upload_csv: '📁 رفع CSV / Excel',
    ds_calculating: 'جارٍ الحساب…',
    ds_calculate: '▶ احسب',
    ds_clear_all: '🗑️ مسح كل البيانات',
    ds_export_excel: '📊 تصدير إلى Excel',
    ds_export_excel_pro: '🔒 تصدير إلى Excel (Pro)',
    ds_empty_state:
      'الصق بياناتك أو ارفعها، ثم اضغط "احسب" لرؤية التحليل الإحصائي الكامل، والهيستوجرام، ومخطط الصندوق.',
    ds_histogram_boxplot: '📊 الهيستوجرام ومخطط الصندوق',
    ds_ad_test_name: 'اختبار Anderson-Darling للتوزيع الطبيعي',
    ds_ad_normal: 'p ≥ 0.05 — لا يوجد دليل معنوي ضد التوزيع الطبيعي (α = 0.05).',
    ds_ad_not_normal: 'p < 0.05 — البيانات تنحرف بشكل معنوي عن التوزيع الطبيعي (α = 0.05).',
    ds_ad_need_8: 'يلزم 8 قيم على الأقل لإجراء اختبار التوزيع الطبيعي.',
    ds_detailed_stats: 'الإحصاءات التفصيلية',
    ds_stat_n: 'N',
    ds_stat_mean: 'المتوسط',
    ds_stat_stdev: 'الانحراف المعياري',
    ds_stat_variance: 'التباين',
    ds_stat_cv: 'معامل الاختلاف (%)',
    ds_stat_skewness: 'الالتواء',
    ds_stat_kurtosis: 'التفلطح',
    ds_stat_min: 'الحد الأدنى',
    ds_stat_q1: 'الربيع الأول (Q1)',
    ds_stat_median: 'الوسيط',
    ds_stat_q3: 'الربيع الثالث (Q3)',
    ds_stat_max: 'الحد الأقصى',
    ds_stat_iqr: 'المدى الربيعي (IQR)',
    ds_stat_range: 'المدى',
    ds_ci_title: 'فترات الثقة 95%',
    ds_ci_need_n6: 'يلزم N ≥ 6',
    ds_range_to: 'إلى',
    ds_err_min2: 'يلزم قيمتان رقميتان صحيحتان على الأقل.',
    ds_err_calc_failed: 'فشل الحساب.',
    ds_err_network: 'خطأ في الشبكة أثناء الحساب.',
    ds_err_file_read: 'تعذّرت قراءة الملف المرفوع.',
    ds_frequency: 'التكرار',

    // ── Footer ──
    footer_about: 'عن الموقع',
    footer_contact: 'تواصل معنا',
    footer_rights: 'جميع الحقوق محفوظة.',
  },
} as const;

export type Lang = keyof typeof translations;
export type Dict = { readonly [K in keyof typeof translations['en']]: string };
export type TKey = keyof Dict;
