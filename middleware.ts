import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { LANG_COOKIE, isUnlocalizedPath, localeOfPath, localizePath, stripLocale } from '@/lib/i18n/routing'
import { SITE } from '@/lib/site'

// الأدوات بقت متاحة لأي زائر (حتى غير مسجل) عشان تتفهرس على جوجل وعشان
// أي حد يقدر يجرب قبل ما يسجل. الحماية اتنقلت لمستوى الفيتشرز نفسها:
//   - Save والـ Export (Excel/PDF) بيتطلبوا اشتراك Pro (useSubscription)
//   - Export (CSV/PNG) بيتطلب تسجيل دخول بس (مش لازم Pro)
// دي بيانات شخصية فعلاً محتاجة جلسة مسجلة، فضلت زي ما هي.
const PROTECTED_PATHS = ['/account', '/dashboard', '/admin']

// Language in the URL (lib/i18n/routing.ts):
//   /ar/…  Arabic, served as is from app/[lang] with lang = "ar"
//   /…     English, rewritten inside to /en/… so the address never shows /en
//   /en/…  redirected to the address without /en (one URL per page)
// A visitor who chose Arabic (cookie qh-lang=ar) and opens an English
// address is sent to the Arabic one. Search engines don't keep cookies, so
// they see each address in its own language.
function languageResponse(request: NextRequest): NextResponse | null {
  const { pathname, search } = request.nextUrl
  if (isUnlocalizedPath(pathname)) return null

  if (/^\/en(\/|$)/.test(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = stripLocale(pathname)
    return NextResponse.redirect(url, 308)
  }
  if (localeOfPath(pathname) === 'ar') return null

  const wantsPage = request.method === 'GET' && (request.headers.get('accept') ?? '').includes('text/html')
  if (wantsPage && request.cookies.get(LANG_COOKIE)?.value === 'ar') {
    const url = request.nextUrl.clone()
    url.pathname = localizePath(pathname, 'ar')
    url.search = search
    return NextResponse.redirect(url, 307)
  }

  const url = request.nextUrl.clone()
  url.pathname = pathname === '/' ? '/en' : `/en${pathname}`
  return NextResponse.rewrite(url, { request })
}

// The live site has one address (SITE.url, www.mizanquality.com). Pages
// opened on a *.vercel.app address of the production deployment (the old
// qualityhub-zeta.vercel.app is still in Google) are sent there with a
// permanent redirect, so Google keeps one copy of each page. Preview
// deployments are left alone, and so are /api and /auth (a sign-in that
// started on the old address must finish there, its cookies live there).
const CANONICAL_HOST = (() => { try { return new URL(SITE.url).host } catch { return '' } })()

function canonicalRedirect(request: NextRequest): NextResponse | null {
  if (process.env.VERCEL_ENV !== 'production' || !CANONICAL_HOST) return null
  if (request.method !== 'GET' && request.method !== 'HEAD') return null
  const host = (request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '').toLowerCase()
  if (!host.endsWith('.vercel.app')) return null
  if (/^\/(api|auth)(\/|$)/.test(request.nextUrl.pathname)) return null
  const url = new URL(request.nextUrl.pathname + request.nextUrl.search, `https://${CANONICAL_HOST}`)
  return NextResponse.redirect(url, 308)
}

export async function middleware(request: NextRequest) {
  const moved = canonicalRedirect(request)
  if (moved) return moved
  const lang = languageResponse(request)
  if (lang && lang.headers.get('location')) return lang // redirects need no session work
  const pass = () => lang ?? NextResponse.next({ request })
  let response = pass()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = pass()
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const path = stripLocale(request.nextUrl.pathname)
  const isProtected = PROTECTED_PATHS.some((p) => path.startsWith(p))

  if (isProtected && !user) {
    const redirectUrl = new URL(localizePath('/login', localeOfPath(request.nextUrl.pathname)), request.url)
    redirectUrl.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}