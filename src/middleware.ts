import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Define paths that don't require authentication
  const isPublicPath = path === '/login' || path.startsWith('/api/auth');
  
  // We don't want to block static files, PWA manifests, images, or Next.js internals
  const isStaticPath =
    path.startsWith('/_next') ||
    path === '/favicon.ico' ||
    path === '/pad.png' ||
    path === '/manifest.json' ||
    path === '/sw.js' ||
    path.endsWith('.ico') ||
    path.endsWith('.png') ||
    path.endsWith('.svg') ||
    path.endsWith('.jpg') ||
    path.endsWith('.jpeg') ||
    path.endsWith('.webp') ||
    path.endsWith('.webmanifest');

  if (isPublicPath || isStaticPath) {
    return NextResponse.next();
  }

  // Check if the auth cookie exists
  const hasAuthCookie = request.cookies.has('site-auth');

  if (!hasAuthCookie) {
    // Redirect to login if not authenticated
    return NextResponse.redirect(new URL('/database/login', request.url));
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
     * - public static files (.svg, .png, .ico, manifest, sw.js, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)',
  ],
};
