import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

export interface AuthenticatedAdminResult {
  userId: string;
  email?: string;
  fullName: string;
}

/**
 * Validates that the active cookie session belongs to an authenticated user
 * with role = 'admin' and is_active = true.
 * Returns null if unauthenticated or not an active administrator.
 */
export async function getAuthenticatedAdmin(): Promise<AuthenticatedAdminResult | null> {
  try {
    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return null;
    }

    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as any)
            );
          } catch {
            // Cannot modify cookies if response headers are already in-flight
          }
        },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return null;
    }

    // Query profiles for role and active status
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, is_active, full_name")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return null;
    }

    const userProfile = profile as unknown as {
      role?: string;
      is_active?: boolean;
      full_name?: string;
    };

    if (userProfile.role !== "admin" || userProfile.is_active === false) {
      return null;
    }

    return {
      userId: user.id,
      email: user.email,
      fullName: userProfile.full_name || "Admin",
    };
  } catch (err) {
    console.error("Error verifying authenticated admin caller:", err);
    return null;
  }
}
