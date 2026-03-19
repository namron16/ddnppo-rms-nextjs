// middleware.ts
// ─────────────────────────────────────────────
// Next.js edge middleware.
// Protects /admin/* and /dashboard routes.
// Unauthenticated users are redirected to /login.
//
// NOTE: Because auth state is held in React context
// (client-side only), we use a lightweight cookie
// set by the login page to persist the session.
// In production, replace with a real JWT/session check.

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED = ['/admin', '/dashboard']
const PUBLIC    = ['/login']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isLoggedIn   = request.cookies.has('rms_session')

  // Redirect authenticated users away from login
  if (PUBLIC.some(p => pathname.startsWith(p)) && isLoggedIn) {
    const role = request.cookies.get('rms_role')?.value
    const dest = role === 'admin' ? '/admin/master' : '/dashboard'
    return NextResponse.redirect(new URL(dest, request.url))
  }

  // Redirect unauthenticated users to login
  if (PROTECTED.some(p => pathname.startsWith(p)) && !isLoggedIn) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/dashboard/:path*', '/login'],
}
