import { NextResponse } from "next/server";
import { AccessToken, TrackSource } from "livekit-server-sdk";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    // 1. Verify user session from cookies on the server
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized: Please sign in to join the live session." },
        { status: 401 }
      );
    }

    // 2. Verify user is active in profiles
    const { data: profile, error: profileError } = await (supabase
      .from("profiles") as any)
      .select("id, full_name, role, is_active, student_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Forbidden: User profile not found." },
        { status: 403 }
      );
    }

    if (profile.is_active === false) {
      return NextResponse.json(
        { error: "Forbidden: Account is deactivated. Please contact support." },
        { status: 403 }
      );
    }

    // 3. Parse input
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json(
        { error: "Session ID is required." },
        { status: 400 }
      );
    }

    // 4. Fetch session details from live_sessions
    const { data: session, error: sessionError } = await (supabase
      .from("live_sessions") as any)
      .select("id, course_id, teacher_id, title, status, livekit_room, scheduled_at")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Live session not found." },
        { status: 404 }
      );
    }

    const isTeacher = session.teacher_id === user.id;

    // Check authorization:
    // (a) Teacher of this session: issue teacher token
    // (b) Student enrolled in course AND status is "live": issue student token
    if (!isTeacher) {
      // Check if student is enrolled
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

      // Check if session is live
      if (session.status !== "live") {
        return NextResponse.json(
          {
            error: "Class not live yet. Waiting for instructor to broadcast.",
            status: session.status,
          },
          { status: 403 }
        );
      }
    }

    // 5. Ensure LiveKit credentials exist in environment
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

    if (!apiKey || !apiSecret || !livekitUrl) {
      console.error("LiveKit credentials missing in environment variables.");
      return NextResponse.json(
        { error: "LiveKit server credentials are not properly configured." },
        { status: 500 }
      );
    }

    // 6. Generate LiveKit Access Token
    // Identity = user id, name = full name, metadata = role
    // Token lifetime = ~1 hour (3600 seconds)
    const at = new AccessToken(apiKey, apiSecret, {
      identity: user.id,
      name: profile.full_name || user.email?.split("@")[0] || "User",
      metadata: JSON.stringify({
        role: isTeacher ? "teacher" : "student",
        studentId: profile.student_id || null,
      }),
      ttl: "1h",
    });

    // Enforce permissions strictly via token grants on the server:
    // Teacher: publish audio, video, screen share, data, subscribe
    // Student: publish microphone ONLY (canPublishSources: [TrackSource.MICROPHONE]), data, subscribe
    if (isTeacher) {
      at.addGrant({
        roomJoin: true,
        room: session.livekit_room,
        canPublish: true,
        canPublishSources: [
          TrackSource.CAMERA,
          TrackSource.MICROPHONE,
          TrackSource.SCREEN_SHARE,
          TrackSource.SCREEN_SHARE_AUDIO,
        ],
        canPublishData: true,
        canSubscribe: true,
      });
    } else {
      at.addGrant({
        roomJoin: true,
        room: session.livekit_room,
        canPublish: true,
        canPublishSources: [TrackSource.MICROPHONE],
        canPublishData: true,
        canSubscribe: true,
      });
    }

    console.log("[DEBUG LiveKit Token Issue]", {
      userId: user.id,
      role: isTeacher ? "teacher" : "student",
      room: session.livekit_room,
      canPublishSources: isTeacher ? ["camera", "microphone", "screen_share"] : ["microphone"],
    });

    const token = await at.toJwt();

    return NextResponse.json({
      token,
      roomName: session.livekit_room,
      livekitUrl,
      isTeacher,
      role: isTeacher ? "teacher" : "student",
      session: {
        id: session.id,
        title: session.title,
        status: session.status,
      },
      user: {
        id: user.id,
        name: profile.full_name,
        studentId: profile.student_id,
      },
    });
  } catch (err: any) {
    console.error("Error generating LiveKit token:", err);
    return NextResponse.json(
      { error: err.message || "Failed to issue LiveKit access token." },
      { status: 500 }
    );
  }
}
