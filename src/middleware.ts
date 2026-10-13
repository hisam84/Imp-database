import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Define paths that don't require authentication
  const isPublicPath = path === '/login' || path.startsWith('/api/auth');
  
  // We don't want to block static files or Next.js internals
  const isStaticPath = path.startsWith('/_next') || path === '/favicon.ico';

  if (isPublicPath || isStaticPath) {
    return NextResponse.next();
  }

  // Check if the auth cookie exists
  const hasAuthCookie = request.cookies.has('site-auth');

  if (!hasAuthCookie) {
    // Redirect to login if not authenticated
    return NextResponse.redirect(new URL('/login', request.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
