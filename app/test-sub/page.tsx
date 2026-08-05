'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

// صفحة اختبار مؤقتة لجدول saved_analyses بس — مش جزء من المنتج النهائي.
// بعد ما تتأكد إن كل حاجة شغالة، امسح المجلد ده بالكامل (app/test-sub).
export default function TestSavedAnalysesPage() {
  const [log, setLog] = useState<string>('اضغط "اختبار الحفظ" عشان تبدأ.')

  async function runTest() {
    const supabase = createClient()
    const lines: string[] = []

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLog('مش مسجل دخول. سجّل دخول الأول من /login على localhost.')
      return
    }
    lines.push(`مسجل دخول كـ: ${user.email}`)

    // 1) محاولة إدراج صف تجريبي
    const { data: inserted, error: insertError } = await supabase
      .from('saved_analyses')
      .insert({
        user_id: user.id,
        tool: 'dpmo',
        name: 'اختبار مؤقت',
        input_data: { test: true },
        results: { test: true },
      })
      .select()
      .single()

    if (insertError) {
      lines.push(`❌ فشل الإدراج (INSERT): ${insertError.message}`)
      setLog(lines.join('\n'))
      return
    }
    lines.push(`✅ اتحفظ صف جديد بـ id: ${inserted.id}`)

    // 2) محاولة قراءة كل الصفوف بتاعة اليوزر
    const { data: rows, error: selectError } = await supabase
      .from('saved_analyses')
      .select('*')
      .eq('user_id', user.id)

    if (selectError) {
      lines.push(`❌ فشلت القراءة (SELECT): ${selectError.message}`)
    } else {
      lines.push(`✅ عدد الصفوف اللي رجعت: ${rows?.length ?? 0}`)
    }

    // 3) حذف الصف التجريبي عشان منسيبش بيانات وهمية
    const { error: deleteError } = await supabase
      .from('saved_analyses')
      .delete()
      .eq('id', inserted.id)

    lines.push(
      deleteError
        ? `❌ فشل الحذف (DELETE): ${deleteError.message}`
        : '✅ اتحذف الصف التجريبي بنجاح (تنظيف بعد الاختبار)'
    )

    setLog(lines.join('\n'))
  }

  return (
    <div style={{ padding: 40, fontFamily: 'monospace', fontSize: 15, lineHeight: 1.8 }}>
      <h1>اختبار جدول saved_analyses</h1>
      <button
        onClick={runTest}
        style={{ padding: '10px 20px', fontSize: 15, cursor: 'pointer', marginBottom: 20 }}
      >
        اختبار الحفظ
      </button>
      <pre style={{ background: '#f4f4f4', padding: 16, borderRadius: 6, whiteSpace: 'pre-wrap' }}>
        {log}
      </pre>
    </div>
  )
}
