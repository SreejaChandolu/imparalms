import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database, UserRole } from "@/types/database";

/**
 * Updates user session and enforces Role-Based Access Control (RBAC) across routes.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options as any)
        );
      },
    },
  });

  const pathname = request.nextUrl.pathname;
  const isAuthRoute = pathname === "/login" || pathname === "/signup" || pathname === "/staff";
  const isDashboardRoute =
    pathname.startsWith("/student") ||
    pathname.startsWith("/teacher") ||
    pathname.startsWith("/admin");

  // Only run role checks on auth and dashboard routes to minimize network calls
  if (!isAuthRoute && !isDashboardRoute) {
    return supabaseResponse;
  }

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // If Supabase network is unreachable (e.g. offline/sandbox build), proceed safely
    return supabaseResponse;
  }

  // 1. Unauthenticated users trying to access protected dashboards
  if (!user) {
    if (pathname.startsWith("/student")) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    if (pathname.startsWith("/teacher") || pathname.startsWith("/admin")) {
      const url = request.nextUrl.clone();
      url.pathname = "/staff";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // 2. Fetch authenticated user's role and active status from profiles
  let userRole: UserRole = "student";
  let isUserActive = true;
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .single();

    const userProfile = profile as unknown as { role?: UserRole; is_active?: boolean } | null;
    if (userProfile?.role) {
      userRole = userProfile.role;
    }
    if (userProfile?.is_active === false) {
      isUserActive = false;
    }
  } catch {
    userRole = "student";
  }

  // 3. Reject deactivated accounts immediately
  if (!isUserActive) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = userRole === "student" ? "/login" : "/staff";
    url.searchParams.set("error", "deactivated");
    return NextResponse.redirect(url);
  }

  // 4. If accessing /student, /teacher, /admin, redirect wrong roles to their own dashboard
  if (pathname.startsWith("/student") && userRole !== "student") {
    const url = request.nextUrl.clone();
    url.pathname = userRole === "admin" ? "/admin" : "/teacher";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/teacher") && userRole !== "teacher") {
    const url = request.nextUrl.clone();
    url.pathname = userRole === "admin" ? "/admin" : "/student";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/admin") && userRole !== "admin") {
    const url = request.nextUrl.clone();
    url.pathname = userRole === "teacher" ? "/teacher" : "/student";
    return NextResponse.redirect(url);
  }

  // 4. If logged-in user visits auth pages (/login, /signup, /staff), redirect to their role dashboard
  if (pathname === "/login" || pathname === "/signup") {
    const url = request.nextUrl.clone();
    url.pathname = userRole === "admin" ? "/admin" : userRole === "teacher" ? "/teacher" : "/student";
    return NextResponse.redirect(url);
  }

  if (pathname === "/staff") {
    const url = request.nextUrl.clone();
    url.pathname = userRole === "admin" ? "/admin" : userRole === "teacher" ? "/teacher" : "/student";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
