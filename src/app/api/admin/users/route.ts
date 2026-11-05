import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/supabase/server-admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    // 1. Verify caller is an authenticated admin
    const admin = await getAuthenticatedAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: "Forbidden: Administrator privileges required." },
        { status: 403 }
      );
    }

    // 2. Initialize Admin Client
    const adminClient = createAdminClient();

    // 3. Fetch all auth users to retrieve email addresses
    let authUserMap = new Map<string, string>();
    try {
      const { data: authData, error: authError } = await adminClient.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

      if (!authError && authData?.users) {
        authData.users.forEach((u) => {
          if (u.email) authUserMap.set(u.id, u.email);
        });
      }
    } catch (listErr) {
      console.warn("Could not list auth users via admin API:", listErr);
    }

    // 4. Fetch all profiles from public.profiles
    const { data: profiles, error: profilesError } = await adminClient
      .from("profiles")
      .select("id, full_name, role, student_id, is_active, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (profilesError) {
      return NextResponse.json(
        { error: profilesError.message || "Failed to load profiles." },
        { status: 500 }
      );
    }

    // 5. Merge profile records with auth emails
    const combinedUsers = (profiles || []).map((p: any) => ({
      id: p.id,
      full_name: p.full_name || "Unnamed User",
      email: authUserMap.get(p.id) || p.student_id ? `${p.student_id}@student.impara.local` : "—",
      role: p.role || "student",
      is_active: p.is_active ?? true,
      student_id: p.student_id || null,
      created_at: p.created_at,
    }));

    return NextResponse.json({ users: combinedUsers });
  } catch (err: any) {
    console.error("Unexpected error in /api/admin/users:", err);
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred while fetching users." },
      { status: 500 }
    );
  }
}
