import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/** Routes a signed-out visitor may open. Everything else redirects to sign-in. */
const PUBLIC_PREFIXES = ['/auth', '/how-it-works', '/admin'];

/**
 * The admin side is its own product: its own sign-in, its own accounts, and
 * its own guards. The pages under it check administrator membership against
 * the database, so middleware's job here is only to keep the two sides from
 * landing on each other's screens.
 */
function isAdminArea(pathname: string) {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

/**
 * The two admin pages a student may land on.
 *
 * Whoever sets the admin side up is almost certainly signed in as a student
 * already — it is their deployment. Bouncing them to the dashboard would make
 * the first-run page unreachable by exactly the person it exists for, and the
 * fix would be "sign out first", which nobody guesses. Neither page shows
 * anything: one takes a username and password, the other refuses once an
 * administrator exists.
 */
function isAdminDoor(pathname: string) {
  return pathname === '/admin/sign-in' || pathname === '/admin/first-run';
}

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

  /*
   * Which side this session belongs to.
   *
   * Asked once, of the database, and only for a signed-in session. An
   * administrator has no student profile worth showing and a student has no
   * business on the admin screens, so each is sent back to their own side
   * rather than shown an empty or forbidden one.
   */
  let admin = false;
  let suspended = false;
  if (user) {
    // One round trip: middleware runs on every request and two would be felt.
    const { data } = await supabase.rpc('session_state');
    const state = Array.isArray(data) ? data[0] : null;
    admin = state?.is_admin === true;
    suspended = state?.suspended === true;
  }

  /*
   * A suspended account is signed out on its next request rather than left
   * holding a session that quietly fails. Administrators are exempt: the
   * suspension flag does not apply to them, and locking the last
   * administrator out of their own deployment would be unrecoverable.
   */
  if (user && suspended && !admin) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = '/auth/sign-in';
    url.search = '?suspended=1';
    return NextResponse.redirect(url);
  }

  if (user && admin && !isAdminArea(pathname) && !isApi(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin';
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (user && !admin && isAdminArea(pathname) && !isAdminDoor(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

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
