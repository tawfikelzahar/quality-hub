import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

// نفس الأدوات المسموح بيها في CHECK constraint بتاع الجدول —
// لو ضفنا أداة جديدة، لازم تتضاف هنا وفي الـ SQL مع بعض.
const VALID_TOOLS = ['spc', 'pareto', 'dpmo', 'oee', 'gage_rr', 'stability', 'aql'] as const
type Tool = (typeof VALID_TOOLS)[number]

const MAX_SAVED_ANALYSES = 50

// GET /api/saved-analyses?tool=gage_rr  → قائمة مشاريع اليوزر الحالي
// (مش بنرجّع input_data/results هنا، دول بيتجابوا لما يفتح مشروع بعينه،
// عشان الـ list ميبقاش تقيل لو الداتا كبيرة)
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 })
  }

  const tool = request.nextUrl.searchParams.get('tool')
  if (tool && !VALID_TOOLS.includes(tool as Tool)) {
    return NextResponse.json({ error: 'Invalid tool filter.' }, { status: 400 })
  }

  let query = supabase
    .from('saved_analyses')
    .select('id, tool, name, created_at, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (tool) query = query.eq('tool', tool)

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ analyses: data })
}

// POST /api/saved-analyses → حفظ تحليل جديد (Pro-only، بحد أقصى 50 مشروع)
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 })
  }

  // فحص الاشتراك — نفس الجدول والـ hook اللي بنيناهم في المرحلة 1
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status')
    .eq('id', user.id)
    .single()

  if (profile?.subscription_status !== 'pro') {
    return NextResponse.json(
      { error: 'حفظ المشاريع ميزة متاحة لمشتركي Pro فقط.' },
      { status: 403 }
    )
  }

  let body: { tool?: string; name?: string; input_data?: unknown; results?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.tool || !VALID_TOOLS.includes(body.tool as Tool)) {
    return NextResponse.json({ error: 'Invalid or missing tool.' }, { status: 400 })
  }
  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ error: 'Name is required.' }, { status: 400 })
  }
  if (body.input_data === undefined || body.results === undefined) {
    return NextResponse.json({ error: 'input_data and results are required.' }, { status: 400 })
  }

  // حد الـ 50 مشروع بيتفحص هنا في الكود، مش في الداتابيز — عشان لو
  // غيّرناه بعدين نغيّره في مكان واحد بس (زي ما اتفقنا في المرحلة 0).
  const { count, error: countError } = await supabase
    .from('saved_analyses')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 })
  }
  if ((count ?? 0) >= MAX_SAVED_ANALYSES) {
    return NextResponse.json(
      { error: `وصلت للحد الأقصى (${MAX_SAVED_ANALYSES} مشروع محفوظ). احذف مشروع قديم عشان تحفظ جديد.` },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('saved_analyses')
    .insert({
      user_id: user.id,
      tool: body.tool,
      name: body.name.trim(),
      input_data: body.input_data,
      results: body.results,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ analysis: data }, { status: 201 })
}
