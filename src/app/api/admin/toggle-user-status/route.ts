import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/supabase/server-admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    // 1. Verify caller is an authenticated admin on the server
    const admin = await getAuthenticatedAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: "Forbidden: Administrator privileges required." },
        { status: 403 }
      );
    }

    // 2. Parse input
    const body = await request.json();
    const { userId, is_active } = body;

    if (!userId || typeof userId !== "string") {
      return NextResponse.json(
        { error: "Target userId is required." },
        { status: 400 }
      );
    }

    if (typeof is_active !== "boolean") {
      return NextResponse.json(
        { error: "is_active boolean value is required." },
        { status: 400 }
      );
    }

    // 3. Prevent self-deactivation
    if (userId === admin.userId) {
      return NextResponse.json(
        { error: "Admins cannot deactivate their own account." },
        { status: 400 }
      );
    }

    // 4. Initialize Admin Client with service role key
    const adminClient = createAdminClient();

    // 5. Update profiles.is_active
    const { error: profileError } = await (adminClient.from("profiles") as any)
      .update({ is_active })
      .eq("id", userId);

    if (profileError) {
      console.error("Error updating profile active status:", profileError);
      return NextResponse.json(
        { error: profileError.message || "Failed to update profile status." },
        { status: 500 }
      );
    }

    // 6. Ban / Unban user in Supabase Auth
    // Passing ban_duration: 'none' unbans the user; '876000h' (~100 years) bans them.
    const banDuration = is_active ? "none" : "876000h";
    const { error: authError } = await adminClient.auth.admin.updateUserById(userId, {
      ban_duration: banDuration,
    });

    if (authError) {
      console.error("Error updating user auth ban duration:", authError);
    }

    // 7. Record security audit event
    try {
      await (adminClient.from("security_events") as any).insert({
        user_id: admin.userId,
        event: `${is_active ? "Activated" : "Deactivated"} account for user (${userId})`,
      });
    } catch (auditErr) {
      console.warn("Failed to write security event log:", auditErr);
    }

    return NextResponse.json({
      success: true,
      userId,
      is_active,
    });
  } catch (err: any) {
    console.error("Unexpected error in /api/admin/toggle-user-status:", err);
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred while toggling user status." },
      { status: 500 }
    );
  }
}
