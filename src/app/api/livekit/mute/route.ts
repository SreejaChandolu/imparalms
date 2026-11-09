import { NextResponse } from "next/server";
import { RoomServiceClient, DataPacket_Kind, TrackType, TrackSource } from "livekit-server-sdk";
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
    const { sessionId, studentIdentity, muteAll } = body;

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json(
        { error: "Session ID is required." },
        { status: 400 }
      );
    }

    // 3. Fetch session details from live_sessions
    const { data: session, error: sessionError } = await (supabase
      .from("live_sessions") as any)
      .select("id, teacher_id, livekit_room, status")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Live session not found." },
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
        { error: "Forbidden: Only the instructor of this course can manage participant audio." },
        { status: 403 }
      );
    }

    // 5. Connect to LiveKit RoomServiceClient
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

    if (!apiKey || !apiSecret || !livekitUrl || !session.livekit_room) {
      return NextResponse.json(
        { error: "LiveKit server credentials are not properly configured." },
        { status: 500 }
      );
    }

    const roomService = new RoomServiceClient(livekitUrl, apiKey, apiSecret);

    if (muteAll) {
      // Fetch all participants in the room
      const participants = await roomService.listParticipants(session.livekit_room);
      let mutedCount = 0;

      for (const p of participants) {
        // Never mute the instructor / teacher
        if (p.identity === session.teacher_id) continue;

        if (p.tracks && p.tracks.length > 0) {
          for (const track of p.tracks) {
            const isAudio =
              track.type === TrackType.AUDIO ||
              track.source === TrackSource.MICROPHONE ||
              (track as any).type === 0 ||
              (track as any).type === "AUDIO";

            if (isAudio && !track.muted) {
              try {
                await roomService.mutePublishedTrack(
                  session.livekit_room,
                  p.identity,
                  track.sid,
                  true
                );
                mutedCount++;
              } catch (muteErr: any) {
                console.warn(`Could not mute track ${track.sid} for ${p.identity}:`, muteErr.message);
              }
            }
          }
        }
      }

      // Also broadcast data packet on topic "mute" so clients can update local state immediately
      try {
        const payloadBytes = new TextEncoder().encode(
          JSON.stringify({ type: "mute-command", muteAll: true })
        );
        await roomService.sendData(
          session.livekit_room,
          payloadBytes,
          DataPacket_Kind.RELIABLE,
          { topic: "mute" }
        );
      } catch (dataErr: any) {
        console.warn("Could not broadcast mute data packet:", dataErr.message);
      }

      return NextResponse.json({
        success: true,
        message: `Muted ${mutedCount} audio track(s) across all students.`,
        mutedCount,
      });
    }

    if (studentIdentity && typeof studentIdentity === "string") {
      // Cannot mute the teacher
      if (studentIdentity === session.teacher_id) {
        return NextResponse.json(
          { error: "Cannot mute the instructor." },
          { status: 400 }
        );
      }

      try {
        const p = await roomService.getParticipant(session.livekit_room, studentIdentity);
        let trackMuted = false;

        if (p && p.tracks && p.tracks.length > 0) {
          for (const track of p.tracks) {
            const isAudio =
              track.type === TrackType.AUDIO ||
              track.source === TrackSource.MICROPHONE ||
              (track as any).type === 0 ||
              (track as any).type === "AUDIO";

            if (isAudio && !track.muted) {
              await roomService.mutePublishedTrack(
                session.livekit_room,
                studentIdentity,
                track.sid,
                true
              );
              trackMuted = true;
            }
          }
        }

        // Send targeted mute packet to that student
        try {
          const payloadBytes = new TextEncoder().encode(
            JSON.stringify({ type: "mute-command", studentIdentity })
          );
          await roomService.sendData(
            session.livekit_room,
            payloadBytes,
            DataPacket_Kind.RELIABLE,
            { topic: "mute", destinationIdentities: [studentIdentity] }
          );
        } catch (dataErr: any) {
          console.warn(`Could not send direct mute packet to ${studentIdentity}:`, dataErr.message);
        }

        return NextResponse.json({
          success: true,
          message: `Participant ${studentIdentity} has been muted.`,
          trackMuted,
        });
      } catch (partErr: any) {
        console.error(`Error muting participant ${studentIdentity}:`, partErr);
        return NextResponse.json(
          { error: partErr.message || "Failed to mute student." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: "Either studentIdentity or muteAll must be specified." },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("Error in livekit mute handler:", err);
    return NextResponse.json(
      { error: err.message || "Failed to execute mute action." },
      { status: 500 }
    );
  }
}
