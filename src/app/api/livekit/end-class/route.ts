import { NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";
import { createClient } from "@/lib/supabase/server";

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

    // 2. Parse input
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json(
        { error: "Session ID is required." },
        { status: 400 }
      );
    }

    // 3. Fetch session
    const { data: session, error: sessionError } = await (supabase
      .from("live_sessions") as any)
      .select("id, teacher_id, livekit_room, status")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Session not found." },
        { status: 404 }
      );
    }

    // 4. Verify caller is the session's teacher (or admin)
    const { data: profile } = await (supabase
      .from("profiles") as any)
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile?.role === "admin";
    const isTeacher = session.teacher_id === user.id;

    if (!isTeacher && !isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Only the instructor of this course can conclude the class." },
        { status: 403 }
      );
    }

    // 5. Update live_sessions table: status = 'ended', ended_at = now
    const nowIso = new Date().toISOString();
    const { error: updateError } = await (supabase.from("live_sessions") as any)
      .update({
        status: "ended",
        ended_at: nowIso,
      })
      .eq("id", sessionId);

    if (updateError) {
      console.error("Error setting session to ended:", updateError);
      return NextResponse.json(
        { error: updateError.message || "Failed to update session status." },
        { status: 500 }
      );
    }

    // 6. Delete LiveKit Room (which disconnects all participants)
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

    if (apiKey && apiSecret && livekitUrl && session.livekit_room) {
      try {
        const roomService = new RoomServiceClient(livekitUrl, apiKey, apiSecret);
        await roomService.deleteRoom(session.livekit_room);
      } catch (lkErr: any) {
        // Room may already be closed or empty; log warning without breaking the flow
        console.warn("Notice: LiveKit deleteRoom result:", lkErr.message || lkErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Class ended successfully. Room closed and telemetry concluded.",
    });
  } catch (err: any) {
    console.error("Error ending live class:", err);
    return NextResponse.json(
      { error: err.message || "Failed to conclude live class." },
      { status: 500 }
    );
  }
}
