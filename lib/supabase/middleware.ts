import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/** Routes a signed-out visitor may open. Everything else redirects to sign-in. */
const PUBLIC_PREFIXES = ['/auth', '/how-it-works'];

function isPublic(pathname: string) {
  if (pathname === '/') return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

/**
 * API routes authenticate themselves and answer in JSON. Redirecting them to
 * an HTML sign-in page would turn a 401 into a parse error in the caller, and
 * would make the server-to-server workflow webhooks — which carry a shared
 * secret rather than a session cookie — unreachable.
 */
function isApi(pathname: string) {
  return pathname.startsWith('/api/');
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refreshes the auth token and keeps the cookie in sync.
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname) && !isApi(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/sign-in';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // A signed-in student landing on the auth pages goes to their dashboard.
  if (user && pathname.startsWith('/auth') && !pathname.startsWith('/auth/callback')
      && !pathname.startsWith('/auth/sign-out') && !pathname.startsWith('/auth/reset')) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}
