import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    // 1. Authenticate user from session cookies on the server
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized: Please sign in." },
        { status: 401 }
      );
    }

    // 2. Verify user is active
    const { data: profile, error: profileError } = await (supabase
      .from("profiles") as any)
      .select("id, role, is_active")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || profile.is_active === false) {
      return NextResponse.json(
        { error: "Forbidden: Inactive or invalid account." },
        { status: 403 }
      );
    }

    // 3. Parse input
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // In case beacon sent plain text or empty body
    }

    const sessionId = body?.sessionId;
    const isLeaving = Boolean(body?.isLeaving);

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json(
        { error: "Session ID is required." },
        { status: 400 }
      );
    }

    // 4. Fetch session details
    const { data: session, error: sessionError } = await (supabase
      .from("live_sessions") as any)
      .select("id, course_id, teacher_id, status")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Live session not found." },
        { status: 404 }
      );
    }

    // If teacher is calling, we do not log student attendance
    if (session.teacher_id === user.id) {
      return NextResponse.json({
        isTeacher: true,
        message: "Instructor heartbeat acknowledged.",
      });
    }

    // 5. Verify student is enrolled in the session's course
    const { data: enrollment, error: enrollError } = await (supabase
      .from("enrollments") as any)
      .select("id")
      .eq("course_id", session.course_id)
      .eq("student_id", user.id)
      .maybeSingle();

    if (enrollError || !enrollment) {
      return NextResponse.json(
        { error: "Forbidden: You are not enrolled in this course." },
        { status: 403 }
      );
    }

    // 6. Verify session is live (allow isLeaving calls even if status just ended)
    if (session.status !== "live" && !isLeaving) {
      return NextResponse.json(
        { error: "Session is not currently live.", status: session.status },
        { status: 400 }
      );
    }

    // 7. Manage attendance record using server-side admin client
    // (Bypasses RLS safely on the server AFTER the strict verification checks above)
    const adminClient = createAdminClient();
    const now = new Date();
    const nowIso = now.toISOString();

    const { data: existing, error: existingError } = await (adminClient
      .from("attendance") as any)
      .select("id, joined_at, left_at, total_seconds")
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingError) {
      console.error("Error checking existing attendance record:", existingError);
    }

    if (!existing) {
      // First heartbeat upon joining: insert initial record
      const { data: newRow, error: insertError } = await (adminClient
        .from("attendance") as any)
        .insert({
          session_id: sessionId,
          user_id: user.id,
          joined_at: nowIso,
          left_at: nowIso,
          total_seconds: 0,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error inserting initial attendance:", insertError);
        return NextResponse.json(
          { error: insertError.message || "Failed to record initial attendance." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        isNew: true,
        total_seconds: 0,
        joined_at: nowIso,
      });
    } else {
      // Subsequent heartbeat: calculate elapsed time since previous heartbeat
      const prevTime = new Date(existing.left_at || existing.joined_at).getTime();
      const elapsedSec = Math.max(0, Math.floor((now.getTime() - prevTime) / 1000));
      // Cap at 30 seconds per heartbeat as instructed to prevent tampering
      const addedSec = Math.min(elapsedSec, 30);
      const updatedTotal = (Number(existing.total_seconds) || 0) + addedSec;

      const { error: updateError } = await (adminClient
        .from("attendance") as any)
        .update({
          left_at: nowIso,
          total_seconds: updatedTotal,
        })
        .eq("id", existing.id);

      if (updateError) {
        console.error("Error updating attendance telemetry:", updateError);
        return NextResponse.json(
          { error: updateError.message || "Failed to update attendance." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        isLeaving,
        total_seconds: updatedTotal,
        added_seconds: addedSec,
        left_at: nowIso,
      });
    }
  } catch (err: any) {
    console.error("Error in attendance heartbeat handler:", err);
    return NextResponse.json(
      { error: err.message || "Attendance heartbeat failed." },
      { status: 500 }
    );
  }
}
