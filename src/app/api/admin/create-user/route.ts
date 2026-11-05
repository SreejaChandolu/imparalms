import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/supabase/server-admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    // 1. Verify that the caller is an authenticated admin on the server
    const admin = await getAuthenticatedAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: "Forbidden: Administrator privileges required." },
        { status: 403 }
      );
    }

    // 2. Parse and validate input payload
    const body = await request.json();
    const { full_name, email, password } = body;

    if (!full_name || typeof full_name !== "string" || full_name.trim().length < 2) {
      return NextResponse.json(
        { error: "Full name must be at least 2 characters long." },
        { status: 400 }
      );
    }

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        { error: "Temporary password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    // 3. Initialize Admin Client with service role key
    const adminClient = createAdminClient();

    // 4. Create auth user with confirmed email
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name.trim(),
      },
    });

    if (authError || !authData?.user) {
      console.error("Supabase Admin createUser error:", authError);
      return NextResponse.json(
        { error: authError?.message || "Failed to create user account." },
        { status: 400 }
      );
    }

    const newUserId = authData.user.id;

    // 5. Update the profile row to set role = 'teacher' (signup trigger defaults to student)
    // Wait briefly or upsert if trigger takes a moment
    const { error: profileError } = await (adminClient.from("profiles") as any)
      .upsert({
        id: newUserId,
        full_name: full_name.trim(),
        role: "teacher",
        is_active: true,
      });

    if (profileError) {
      console.error("Error setting teacher profile role:", profileError);
      // Attempt regular update if upsert had conflict
      await (adminClient.from("profiles") as any)
        .update({
          full_name: full_name.trim(),
          role: "teacher",
          is_active: true,
        })
        .eq("id", newUserId);
    }

    // 6. Record audit event in security_events
    try {
      await (adminClient.from("security_events") as any).insert({
        user_id: admin.userId,
        event: `Created teacher account for ${email.trim()} (${full_name.trim()})`,
      });
    } catch (auditErr) {
      console.warn("Failed to write security event log:", auditErr);
    }

    return NextResponse.json({
      success: true,
      user: {
        id: newUserId,
        email: email.trim(),
        full_name: full_name.trim(),
        role: "teacher",
        is_active: true,
        created_at: authData.user.created_at,
      },
    });
  } catch (err: any) {
    console.error("Unexpected error in /api/admin/create-user:", err);
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred while creating teacher account." },
      { status: 500 }
    );
  }
}
