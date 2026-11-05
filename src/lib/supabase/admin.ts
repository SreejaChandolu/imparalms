import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Creates a Supabase admin client powered by the service role key.
 *
 * CRITICAL SECURITY REQUIREMENTS:
 * 1. This client bypasses all Row Level Security (RLS).
 * 2. It must ONLY be imported and executed inside server-side route handlers or server actions.
 * 3. SUPABASE_SERVICE_ROLE_KEY must NEVER be exported or referenced in client-side components.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set in environment.");
  }

  if (!serviceRoleKey || serviceRoleKey.trim() === "") {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured in .env.local. Add your service role key from the Supabase Dashboard (Settings -> API)."
    );
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
