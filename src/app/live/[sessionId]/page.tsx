"use client";

import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LiveKitRoom,
  VideoTrack,
  AudioConference,
  useTracks,
  useParticipants,
  useRoomContext,
  useLocalParticipant,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { RoomEvent, Track, RemoteParticipant } from "livekit-client";
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  CameraOff,
  Check,
  CheckCircle2,
  Clock,
  Hand,
  Layers,
  LifeBuoy,
  Loader2,
  Maximize2,
  MessageSquare,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  PhoneOff,
  Radio,
  Send,
  Shield,
  Square,
  Star,
  Users,
  Video,
  Volume2,
  X,
} from "lucide-react";

interface SessionData {
  id: string;
  course_id: string;
  teacher_id: string;
  title: string;
  status: "scheduled" | "live" | "ended";
  livekit_room: string;
  scheduled_at: string;
  courseTitle?: string;
  teacherName?: string;
}

interface ChatMessage {
  id: string;
  senderName: string;
  senderRole: "teacher" | "student";
  text: string;
  timestamp: string;
}

export default function LiveRoomPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const sessionId = (params?.sessionId || "") as string;

  const [initialLoading, setInitialLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    fullName: string;
    role: "student" | "teacher" | "admin";
    studentCode: string | null;
  } | null>(null);

  const [session, setSession] = useState<SessionData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // LiveKit Connection State
  const [token, setToken] = useState<string | null>(null);
  const [livekitUrl, setLivekitUrl] = useState<string>("");
  const [isTeacher, setIsTeacher] = useState<boolean>(false);
  const [roomState, setRoomState] = useState<"prejoin" | "connecting" | "connected" | "ended">("prejoin");

  // Pre-join devices for teacher
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>("");
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>("");
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(true);
  const [micActive, setMicActive] = useState(true);

  // 1. Initial Load: Authenticate and fetch Session
  useEffect(() => {
    async function loadSessionAndUser() {
      try {
        setInitialLoading(true);
        setErrorMsg(null);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        // Fetch User Profile
        const { data: profile } = await (supabase
          .from("profiles") as any)
          .select("id, full_name, role, student_id, is_active")
          .eq("id", user.id)
          .single();

        if (!profile || profile.is_active === false) {
          setErrorMsg("Your account is not active. Please contact administrator.");
          setInitialLoading(false);
          return;
        }

        const userObj = {
          id: user.id,
          fullName: profile.full_name || "User",
          role: profile.role as "student" | "teacher" | "admin",
          studentCode: profile.student_id || null,
        };
        setCurrentUser(userObj);

        // Fetch Session Details
        const { data: sessData, error: sessErr } = await (supabase
          .from("live_sessions") as any)
          .select("id, course_id, teacher_id, title, status, livekit_room, scheduled_at")
          .eq("id", sessionId)
          .single();

        if (sessErr || !sessData) {
          setErrorMsg("Live session not found.");
          setInitialLoading(false);
          return;
        }

        // Fetch Course Title
        const { data: courseData } = await (supabase
          .from("courses") as any)
          .select("title")
          .eq("id", sessData.course_id)
          .single();

        // Fetch Teacher Name
        const { data: teacherProfile } = await (supabase
          .from("profiles") as any)
          .select("full_name")
          .eq("id", sessData.teacher_id)
          .single();

        const fullSession: SessionData = {
          ...sessData,
          courseTitle: courseData?.title || "Course",
          teacherName: teacherProfile?.full_name || "Instructor",
        };
        setSession(fullSession);

        const userIsTeacher = sessData.teacher_id === user.id;
        const userIsStudent = profile.role === "student";
        setIsTeacher(userIsTeacher);

        console.log("[DEBUG LiveKit Role]", {
          userId: user.id,
          fullName: profile.full_name,
          dbRole: profile.role,
          studentId: profile.student_id,
          isTeacher: userIsTeacher,
          isStudent: userIsStudent,
          sessionTeacherId: sessData.teacher_id,
        });

        if (sessData.status === "ended") {
          setRoomState("ended");
        } else {
          setRoomState("prejoin");
        }
      } catch (err: any) {
        console.error("Error loading session:", err);
        setErrorMsg(err.message || "Failed to load live session.");
      } finally {
        setInitialLoading(false);
      }
    }

    if (sessionId) {
      loadSessionAndUser();
    }
  }, [sessionId, supabase, router]);

  // Suppress expected teardown abort logs from cluttering the console as red errors
  useEffect(() => {
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      const msg = typeof args[0] === "string" ? args[0] : "";
      if (
        msg.includes("DataChannel error on lossy: User-Initiated Abort") ||
        msg.includes("publisher data channel 'RELIABLE' closed unexpectedly") ||
        msg.includes("publisher data channel 'DATA_TRACK_LOSSY' closed unexpectedly") ||
        msg.includes("User-Initiated Abort")
      ) {
        console.debug("[LiveKit Expected Teardown Notice]", ...args);
        return;
      }
      originalConsoleError.apply(console, args);
    };

    return () => {
      console.error = originalConsoleError;
    };
  }, []);

  // 2. Teacher Pre-join: Enumerate & preview media devices
  useEffect(() => {
    if (!isTeacher || roomState !== "prejoin") return;

    let localStream: MediaStream | null = null;

    async function initPreview() {
      try {
        if (!navigator.mediaDevices?.enumerateDevices) return;

        const devices = await navigator.mediaDevices.enumerateDevices();
        const vInputs = devices.filter((d) => d.kind === "videoinput");
        const aInputs = devices.filter((d) => d.kind === "audioinput");
        setVideoDevices(vInputs);
        setAudioDevices(aInputs);

        const vidId = selectedVideoDevice || (vInputs[0]?.deviceId || undefined);
        const audId = selectedAudioDevice || (aInputs[0]?.deviceId || undefined);

        if (vInputs[0] && !selectedVideoDevice) setSelectedVideoDevice(vInputs[0].deviceId);
        if (aInputs[0] && !selectedAudioDevice) setSelectedAudioDevice(aInputs[0].deviceId);

        localStream = await navigator.mediaDevices.getUserMedia({
          video: vidId ? { deviceId: { exact: vidId } } : true,
          audio: audId ? { deviceId: { exact: audId } } : true,
        });

        previewStreamRef.current = localStream;
        if (previewVideoRef.current) {
          previewVideoRef.current.srcObject = localStream;
        }
      } catch (err) {
        console.warn("Could not start local device preview:", err);
      }
    }

    initPreview();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
      }
      if (previewStreamRef.current) {
        previewStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isTeacher, roomState, selectedVideoDevice, selectedAudioDevice]);

  const isConnectingRef = useRef(false);

  // 3. Connect to Room (Fetches server-side token)
  const handleConnectToRoom = useCallback(async (asBroadcastingTeacher = false) => {
    if (isConnectingRef.current || roomState === "connected") return;
    isConnectingRef.current = true;
    try {
      setRoomState("connecting");
      setErrorMsg(null);

      // Stop local preview stream before passing device control to LiveKit
      if (previewStreamRef.current) {
        previewStreamRef.current.getTracks().forEach((t) => t.stop());
        previewStreamRef.current = null;
      }

      // If teacher is starting broadcast for the first time on a scheduled session,
      // update live_sessions to status = 'live' and started_at = now
      if (asBroadcastingTeacher && session && session.status !== "live") {
        const nowIso = new Date().toISOString();
        await (supabase.from("live_sessions") as any)
          .update({
            status: "live",
            started_at: nowIso,
          })
          .eq("id", session.id);

        setSession((prev) => (prev ? { ...prev, status: "live" } : null));
      }

      // Fetch LiveKit Token from server route
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to obtain room token.");
      }

      setToken(data.token);
      setLivekitUrl(data.livekitUrl);
      setRoomState("connected");
    } catch (err: any) {
      console.error("Connection error:", err);
      setErrorMsg(err.message || "Failed to connect to live room.");
      setRoomState("prejoin");
    } finally {
      isConnectingRef.current = false;
    }
  }, [sessionId, session, supabase, roomState]);

  // 4. Student Waiting Poll: When session not live yet, poll every 5 seconds to update status
  useEffect(() => {
    if (isTeacher || roomState !== "prejoin" || !session || session.status === "live") return;

    const pollInterval = setInterval(async () => {
      try {
        const { data: updated } = await (supabase
          .from("live_sessions") as any)
          .select("status")
          .eq("id", sessionId)
          .single();

        if (updated?.status === "live") {
          // Update status so student can click 'Join Class' button (connects once on user action)
          setSession((prev) => (prev ? { ...prev, status: "live" } : null));
        } else if (updated?.status === "ended") {
          setSession((prev) => (prev ? { ...prev, status: "ended" } : null));
          setRoomState("ended");
        }
      } catch (pollErr) {
        console.warn("Session status polling error:", pollErr);
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [isTeacher, roomState, session, sessionId, supabase]);

  // 5. Attendance Heartbeat for Students
  useEffect(() => {
    if (isTeacher || roomState !== "connected" || !sessionId) return;

    // Send initial join heartbeat
    fetch("/api/attendance/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    }).catch((err) => console.warn("Initial attendance heartbeat error:", err));

    // Send periodic heartbeat every 20 seconds while connected
    const heartbeatInterval = setInterval(() => {
      fetch("/api/attendance/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      }).catch((err) => console.warn("Attendance heartbeat error:", err));
    }, 20000);

    return () => {
      clearInterval(heartbeatInterval);
      // Send final leaving heartbeat
      try {
        const payload = JSON.stringify({ sessionId, isLeaving: true });
        if (navigator.sendBeacon) {
          const blob = new Blob([payload], { type: "application/json" });
          navigator.sendBeacon("/api/attendance/heartbeat", blob);
        } else {
          fetch("/api/attendance/heartbeat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
            keepalive: true,
          }).catch(() => {});
        }
      } catch {}
    };
  }, [isTeacher, roomState, sessionId]);

  // Handle Room Disconnected (e.g. Teacher ended class)
  const handleRoomDisconnected = useCallback(() => {
    setRoomState("ended");
  }, []);

  return (
    <div className="min-h-screen bg-[#04060a] text-slate-100 flex flex-col selection:bg-[#29d9ff]/30 selection:text-white">
      {/* ─────────────────────────────────────────────────────────────
          TOP BRAND / SESSION BAR
      ────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-[#04060a]/90 border-b border-white/[0.08] h-14 px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={isTeacher ? "/teacher" : "/student"}
            className="flex items-center gap-2 group"
          >
            <div className="w-7 h-7 rounded-lg bg-[#29d9ff] text-[#04060a] font-mono font-black text-sm flex items-center justify-center shadow-[0_0_12px_rgba(41,217,255,0.4)] group-hover:scale-105 transition-transform">
              I
            </div>
            <span className="font-bold tracking-tight text-white hidden sm:inline group-hover:text-[#29d9ff] transition-colors">
              Impara Live
            </span>
          </Link>

          {session && (
            <div className="h-4 w-px bg-white/10 hidden sm:block" />
          )}

          {session && (
            <div className="flex items-center gap-2 truncate max-w-xs sm:max-w-md">
              <span className="text-xs font-mono text-[#29d9ff] uppercase truncate hidden md:inline">
                [{session.courseTitle}]
              </span>
              <span className="text-xs sm:text-sm font-semibold text-white truncate">
                {session.title}
              </span>
            </div>
          )}
        </div>

        {/* Status / Role Indicator */}
        <div className="flex items-center gap-2">
          {session?.status === "live" && roomState === "connected" && (
            <div className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-red-400 bg-red-500/10 px-2.5 py-0.5 rounded-full border border-red-500/20 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
              <span>LIVE BROADCAST</span>
            </div>
          )}

          <span
            className={`font-mono text-[10px] uppercase px-2.5 py-0.5 rounded-full border ${
              isTeacher
                ? "bg-cyan-500/10 text-[#29d9ff] border-[#29d9ff]/30 font-bold"
                : "bg-white/[0.04] text-slate-300 border-white/[0.08]"
            }`}
          >
            {isTeacher ? "Instructor" : "Attendee"}
          </span>
        </div>
      </header>

      {/* Error Banner */}
      {errorMsg && (
        <div className="bg-rose-500/15 border-b border-rose-500/30 px-4 py-2.5 text-xs text-rose-300 flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MAIN CONTENT AREA SWITCHER
      ────────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {initialLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="w-8 h-8 text-[#29d9ff] animate-spin" />
            <p className="text-xs font-mono text-slate-400">Loading interactive classroom session...</p>
          </div>
        ) : roomState === "prejoin" ? (
          /* PRE-JOIN VIEW */
          <PreJoinScreen
            session={session}
            isTeacher={isTeacher}
            currentUser={currentUser}
            videoDevices={videoDevices}
            audioDevices={audioDevices}
            selectedVideoDevice={selectedVideoDevice}
            selectedAudioDevice={selectedAudioDevice}
            setSelectedVideoDevice={setSelectedVideoDevice}
            setSelectedAudioDevice={setSelectedAudioDevice}
            previewVideoRef={previewVideoRef}
            cameraActive={cameraActive}
            micActive={micActive}
            setCameraActive={setCameraActive}
            setMicActive={setMicActive}
            onConnect={handleConnectToRoom}
          />
        ) : roomState === "connecting" ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="w-8 h-8 text-[#29d9ff] animate-spin" />
            <p className="text-xs font-mono text-slate-400">Negotiating WebRTC room connection...</p>
          </div>
        ) : roomState === "connected" && token && livekitUrl ? (
          /* ACTIVE LIVE ROOM VIEW */
          <LiveKitRoom
            serverUrl={livekitUrl}
            token={token}
            connect={true}
            video={isTeacher}
            audio={isTeacher}
            onDisconnected={handleRoomDisconnected}
            className="flex-1 flex flex-col h-full bg-[#04060a]"
          >
            <LiveRoomStage
              session={session!}
              isTeacher={isTeacher}
              currentUser={currentUser!}
              onEndClassSuccess={() => setRoomState("ended")}
            />
          </LiveKitRoom>
        ) : (
          /* CLASS ENDED VIEW WITH RATING DIALOG */
          <ClassEndedView
            session={session}
            isTeacher={isTeacher}
            currentUser={currentUser}
            onReturn={() => router.push(isTeacher ? "/teacher" : "/student")}
          />
        )}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT 1: PRE-JOIN SCREEN (Teacher Device Preview vs Student Waiting State)
// ─────────────────────────────────────────────────────────────────────────────
function PreJoinScreen({
  session,
  isTeacher,
  currentUser,
  videoDevices,
  audioDevices,
  selectedVideoDevice,
  selectedAudioDevice,
  setSelectedVideoDevice,
  setSelectedAudioDevice,
  previewVideoRef,
  cameraActive,
  micActive,
  setCameraActive,
  setMicActive,
  onConnect,
}: {
  session: SessionData | null;
  isTeacher: boolean;
  currentUser: any;
  videoDevices: MediaDeviceInfo[];
  audioDevices: MediaDeviceInfo[];
  selectedVideoDevice: string;
  selectedAudioDevice: string;
  setSelectedVideoDevice: (id: string) => void;
  setSelectedAudioDevice: (id: string) => void;
  previewVideoRef: React.RefObject<HTMLVideoElement | null>;
  cameraActive: boolean;
  micActive: boolean;
  setCameraActive: React.Dispatch<React.SetStateAction<boolean>>;
  setMicActive: React.Dispatch<React.SetStateAction<boolean>>;
  onConnect: (asTeacher?: boolean) => void;
}) {
  const isSessionLive = session?.status === "live";

  if (isTeacher) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-2xl rounded-2xl border border-white/[0.08] bg-[#070c18] p-6 sm:p-8 space-y-6 shadow-2xl">
          <div className="space-y-1">
            <div className="font-mono text-xs uppercase tracking-widest text-[#29d9ff]">
              FACULTY BROADCAST CONSOLE
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Hardware Check & Preview
            </h2>
            <p className="text-xs text-slate-400">
              Verify your camera, microphone, and audio input levels before going live to students.
            </p>
          </div>

          {/* Camera Preview Box */}
          <div className="relative aspect-video rounded-xl bg-black border border-white/[0.08] overflow-hidden flex items-center justify-center">
            <video
              ref={previewVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover -scale-x-100 ${!cameraActive ? "hidden" : ""}`}
            />

            {!cameraActive && (
              <div className="text-center space-y-2 text-slate-500">
                <CameraOff className="w-10 h-10 mx-auto" />
                <p className="text-xs font-mono">Camera preview paused</p>
              </div>
            )}

            {/* Quick Toggle Overlays */}
            <div className="absolute bottom-3 left-3 flex items-center gap-2 z-10">
              <button
                type="button"
                onClick={() => setCameraActive(!cameraActive)}
                className={`p-2 rounded-xl backdrop-blur-md transition-all ${
                  cameraActive
                    ? "bg-white/[0.1] text-white hover:bg-white/[0.2]"
                    : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                }`}
              >
                {cameraActive ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() => setMicActive(!micActive)}
                className={`p-2 rounded-xl backdrop-blur-md transition-all ${
                  micActive
                    ? "bg-white/[0.1] text-white hover:bg-white/[0.2]"
                    : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                }`}
              >
                {micActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Device Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
                Camera Device
              </label>
              <select
                value={selectedVideoDevice}
                onChange={(e) => setSelectedVideoDevice(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#04060a] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#29d9ff]"
              >
                {videoDevices.map((d, idx) => (
                  <option key={d.deviceId || idx} value={d.deviceId}>
                    {d.label || `Camera ${idx + 1}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
                Microphone Device
              </label>
              <select
                value={selectedAudioDevice}
                onChange={(e) => setSelectedAudioDevice(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#04060a] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#29d9ff]"
              >
                {audioDevices.map((d, idx) => (
                  <option key={d.deviceId || idx} value={d.deviceId}>
                    {d.label || `Microphone ${idx + 1}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => onConnect(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#29d9ff] hover:bg-[#6be4ff] text-[#04060a] font-mono text-xs uppercase tracking-wider font-bold transition-all shadow-[0_0_20px_rgba(41,217,255,0.4)] cursor-pointer"
            >
              <Radio className="w-4 h-4 animate-pulse" />
              <span>Start Broadcasting</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Student Pre-join Screen
  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#070c18] p-8 sm:p-10 text-center space-y-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

        {isSessionLive ? (
          <>
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 text-[#29d9ff] flex items-center justify-center mx-auto border border-[#29d9ff]/20 shadow-[0_0_25px_rgba(41,217,255,0.25)]">
              <Radio className="w-8 h-8 animate-pulse" />
            </div>

            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>CLASSROOM IS LIVE NOW</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {session?.title}
              </h2>
              <p className="text-xs font-mono text-slate-400">
                Instructor: {session?.teacherName} • {session?.courseTitle}
              </p>
            </div>

            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
              Your instructor is currently broadcasting. Join now to view live video, participate in chat, and log mandatory 75% attendance telemetry.
            </p>

            <button
              type="button"
              onClick={() => onConnect(false)}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-[#29d9ff] hover:bg-[#6be4ff] text-[#04060a] font-mono text-xs uppercase tracking-wider font-bold transition-all shadow-[0_0_20px_rgba(41,217,255,0.4)] cursor-pointer"
            >
              <Video className="w-4 h-4" />
              <span>Join Class Now</span>
            </button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-2xl bg-white/[0.04] text-slate-400 flex items-center justify-center mx-auto border border-white/[0.08]">
              <Clock className="w-8 h-8 animate-spin" style={{ animationDuration: "12s" }} />
            </div>

            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>WAITING ROOM</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Waiting for the teacher to start the class...
              </h2>
              <p className="text-xs font-mono text-slate-400">
                {session?.courseTitle} • Instructor: {session?.teacherName}
              </p>
            </div>

            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
              Your instructor has not started broadcasting yet. You will enter automatically as soon as the session goes live (checking every 5 seconds).
            </p>

            <div className="pt-2 flex items-center justify-center gap-2 text-xs font-mono text-[#29d9ff]">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Auto-detecting broadcast start...</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT 2: ACTIVE ROOM VIEW (Main Video Stage + Side Panel + Bottom Controls)
// ─────────────────────────────────────────────────────────────────────────────
function LiveRoomStage({
  session,
  isTeacher,
  currentUser,
  onEndClassSuccess,
}: {
  session: SessionData;
  isTeacher: boolean;
  currentUser: { id: string; fullName: string; role: string; studentCode: string | null };
  onEndClassSuccess: () => void;
}) {
  const room = useRoomContext();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } =
    useLocalParticipant();

  const isStudent = currentUser.role === "student";

  // Tracks for camera and screen share
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], { onlySubscribed: false });
  const participants = useParticipants();

  // Sidebar Tab State
  const [activeSideTab, setActiveSideTab] = useState<"chat" | "participants">("chat");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Chat messages
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Raised Hands Tracker (Set of student user IDs)
  const [raisedHands, setRaisedHands] = useState<Set<string>>(new Set());
  const [handRaisedByMe, setHandRaisedByMe] = useState(false);

  // Error & Status Banners
  const [screenShareError, setScreenShareError] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);

  // Host Mute Controls State
  const [mutingAll, setMutingAll] = useState(false);
  const [mutingStudentId, setMutingStudentId] = useState<string | null>(null);

  // Ending Class State
  const [endingClass, setEndingClass] = useState(false);

  // 1. Dynamic Moving Watermark for Students
  const [watermarkPos, setWatermarkPos] = useState({ top: 25, left: 30 });
  const [currentTimeStr, setCurrentTimeStr] = useState(() => new Date().toLocaleTimeString());

  useEffect(() => {
    if (!isStudent) return;

    const updateWatermark = () => {
      // Pick random coordinates within 10% - 65% so it stays comfortably inside video frame
      const randTop = Math.floor(Math.random() * 55) + 10;
      const randLeft = Math.floor(Math.random() * 55) + 10;
      setWatermarkPos({ top: randTop, left: randLeft });
      setCurrentTimeStr(new Date().toLocaleTimeString());
    };

    updateWatermark();
    const interval = setInterval(updateWatermark, 10000);
    return () => clearInterval(interval);
  }, [isStudent]);

  // 2. Data Messages (Chat, Raise-Hand & Mute Commands)
  useEffect(() => {
    const handleDataReceived = (
      payload: Uint8Array,
      participant?: RemoteParticipant,
      _kind?: any,
      topic?: string
    ) => {
      try {
        const text = new TextDecoder().decode(payload);
        const data = JSON.parse(text);

        console.log("[DEBUG LiveKit Data Received]", {
          topic,
          participant: participant?.identity,
          data,
        });

        if (topic === "hand" || data.type === "hand" || data.type === "raise-hand") {
          const studentId = data.studentId || participant?.identity;
          if (studentId) {
            setRaisedHands((prev) => {
              const next = new Set(prev);
              if (data.raised) {
                next.add(studentId);
              } else {
                next.delete(studentId);
              }
              return next;
            });
          }
        } else if (topic === "mute" || data.type === "mute-command") {
          // Instructor muted student(s)
          if (data.muteAll || data.studentIdentity === currentUser.id) {
            console.log("[DEBUG LiveKit Mute Command Received]", data);
            if (isMicrophoneEnabled) {
              localParticipant.setMicrophoneEnabled(false).catch(console.warn);
            }
          }
        } else if (data.type === "chat") {
          setChatMessages((prev) => [
            ...prev,
            {
              id: `${Date.now()}_${Math.random()}`,
              senderName: data.senderName || participant?.name || "Participant",
              senderRole: data.senderRole || "student",
              text: data.text,
              timestamp:
                data.timestamp ||
                new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
        }
      } catch (err) {
        console.warn("Failed to parse LiveKit data message:", err);
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room, currentUser.id, isMicrophoneEnabled, localParticipant]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

  // Send Chat Message
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const msgText = chatInput.trim();
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const payload = {
      type: "chat",
      senderName: currentUser.fullName,
      senderRole: isTeacher ? "teacher" : "student",
      text: msgText,
      timestamp: timeStr,
    };

    try {
      const encoded = new TextEncoder().encode(JSON.stringify(payload));
      console.log("[DEBUG LiveKit Data Sent]", { topic: "chat", payload });
      await room.localParticipant.publishData(encoded, { reliable: true, topic: "chat" });

      // Add to own local chat
      setChatMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}_${Math.random()}`,
          senderName: currentUser.fullName,
          senderRole: isTeacher ? "teacher" : "student",
          text: msgText,
          timestamp: timeStr,
        },
      ]);
      setChatInput("");
    } catch (err) {
      console.error("Failed to send chat message:", err);
    }
  };

  // Toggle Raise Hand (Student only)
  const handleToggleRaiseHand = async () => {
    const nextState = !handRaisedByMe;
    setHandRaisedByMe(nextState);

    const payload = {
      type: "hand",
      studentId: currentUser.id,
      studentName: currentUser.fullName,
      raised: nextState,
    };

    try {
      const encoded = new TextEncoder().encode(JSON.stringify(payload));
      console.log("[DEBUG LiveKit Data Sent]", { topic: "hand", payload });
      await room.localParticipant.publishData(encoded, { reliable: true, topic: "hand" });

      setRaisedHands((prev) => {
        const next = new Set(prev);
        if (nextState) next.add(currentUser.id);
        else next.delete(currentUser.id);
        return next;
      });
    } catch (err) {
      console.error("Failed to publish raise-hand state:", err);
    }
  };

  // Toggle Screen Share (Teacher only)
  const handleToggleScreenShare = async () => {
    setScreenShareError(null);
    const targetState = !isScreenShareEnabled;
    try {
      console.log("[DEBUG LiveKit ScreenShare]", { action: targetState ? "enable" : "disable" });
      await localParticipant.setScreenShareEnabled(targetState);
      console.log("[DEBUG LiveKit ScreenShare Result]", { success: true, enabled: targetState });
    } catch (err: any) {
      console.error("[DEBUG LiveKit ScreenShare Result]", {
        success: false,
        enabled: false,
        error: err.message || err,
      });
      let msg = "Could not start screen sharing.";
      if (
        err.name === "NotAllowedError" ||
        err.message?.includes("Permission denied") ||
        err.message?.includes("Permission was denied") ||
        err.message?.includes("denied by system")
      ) {
        msg = "Screen sharing permission was denied or cancelled.";
      } else if (err.message) {
        msg = `Screen share error: ${err.message}`;
      }
      setScreenShareError(msg);
    }
  };

  // Toggle Microphone (Student / Teacher)
  const handleToggleMic = async () => {
    setMicError(null);
    const targetState = !isMicrophoneEnabled;
    try {
      await localParticipant.setMicrophoneEnabled(targetState);
    } catch (err: any) {
      console.error("Microphone toggle error:", err);
      let msg = "Could not access microphone.";
      if (
        err.name === "NotAllowedError" ||
        err.message?.includes("Permission denied") ||
        err.message?.includes("Permission was denied")
      ) {
        msg = "Microphone access was blocked by your browser. Please allow microphone permissions in site settings.";
      } else if (err.message) {
        msg = `Microphone error: ${err.message}`;
      }
      setMicError(msg);
    }
  };

  // Host Controls: Mute All Students
  const handleMuteAllStudents = async () => {
    try {
      setMutingAll(true);
      const res = await fetch("/api/livekit/mute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, muteAll: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to mute students.");
    } catch (err: any) {
      console.error("Mute all error:", err);
      alert(err.message || "Failed to mute all students.");
    } finally {
      setMutingAll(false);
    }
  };

  // Host Controls: Mute Individual Student
  const handleMuteSingleStudent = async (studentIdentity: string) => {
    try {
      setMutingStudentId(studentIdentity);
      const res = await fetch("/api/livekit/mute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, studentIdentity }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to mute student.");
    } catch (err: any) {
      console.error("Mute student error:", err);
      alert(err.message || "Failed to mute student.");
    } finally {
      setMutingStudentId(null);
    }
  };

  // End Class Handler (Teacher only)
  const handleEndClass = async () => {
    if (
      !confirm(
        "Are you sure you want to end this class? All students will be disconnected, the room closed, and final attendance calculated."
      )
    ) {
      return;
    }

    try {
      setEndingClass(true);
      const res = await fetch("/api/livekit/end-class", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to conclude class.");
      }

      // Disconnect local room
      await room.disconnect();
      onEndClassSuccess();
    } catch (err: any) {
      console.error("Error ending class:", err);
      alert(err.message || "Failed to end class.");
    } finally {
      setEndingClass(false);
    }
  };

  // Student Leave Handler
  const handleStudentLeave = async () => {
    await room.disconnect();
  };

  // Separate teacher camera track vs screen share track
  const teacherScreenTrack = tracks.find(
    (t) => t.source === Track.Source.ScreenShare && t.publication?.track && !t.publication?.isMuted
  );
  const teacherCameraTrack = tracks.find(
    (t) => t.source === Track.Source.Camera && t.publication?.track && !t.publication?.isMuted
  );

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Audio Conference handles incoming audio tracks automatically */}
      <AudioConference />

      {/* Main Container: Video Stage on Left, Side Panel on Right */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* ─────────────────────────────────────────────────────────────
            MAIN STAGE (Large Teacher Video & Screen Share)
        ────────────────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col p-3 sm:p-4 bg-[#020306] relative overflow-hidden justify-center items-center">
          {/* Visible Error Notification for Screen Sharing or Microphone */}
          {screenShareError && (
            <div className="absolute top-4 left-4 right-4 z-50 p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-between backdrop-blur-md shadow-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{screenShareError}</span>
              </div>
              <button
                type="button"
                onClick={() => setScreenShareError(null)}
                className="p-1 hover:bg-rose-500/20 rounded-md text-rose-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {micError && (
            <div className="absolute top-4 left-4 right-4 z-50 p-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between backdrop-blur-md shadow-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{micError}</span>
              </div>
              <button
                type="button"
                onClick={() => setMicError(null)}
                className="p-1 hover:bg-amber-500/20 rounded-md text-amber-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Video Container Box */}
          <div className="w-full h-full max-h-full rounded-2xl bg-black border border-white/[0.08] relative overflow-hidden flex items-center justify-center">
            {/* Moving Watermark for Students (Pointer-events-none, non-selectable) */}
            {isStudent && (
              <div
                style={{
                  top: `${watermarkPos.top}%`,
                  left: `${watermarkPos.left}%`,
                }}
                className="absolute z-[60] pointer-events-none select-none transition-all duration-1000 ease-in-out px-3.5 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/20 text-white/80 font-mono text-xs sm:text-sm tracking-wider shadow-2xl whitespace-nowrap"
              >
                {currentUser.fullName} •{" "}
                {currentUser.studentCode ||
                  (currentUser.id ? `STU-${currentUser.id.slice(0, 8).toUpperCase()}` : "STUDENT")}{" "}
                • {currentTimeStr}
              </div>
            )}

            {teacherScreenTrack ? (
              /* SCREEN SHARE SPOTLIGHT */
              <div className="w-full h-full relative flex items-center justify-center">
                <VideoTrack trackRef={teacherScreenTrack} className="w-full h-full object-contain" />

                {/* PiP of teacher camera if active during screen share */}
                {teacherCameraTrack && (
                  <div className="absolute bottom-4 right-4 w-44 sm:w-56 aspect-video rounded-xl bg-black border border-white/20 shadow-2xl overflow-hidden z-20">
                    <VideoTrack
                      trackRef={teacherCameraTrack}
                      className={`w-full h-full object-cover ${isTeacher ? "-scale-x-100" : ""}`}
                    />
                  </div>
                )}
              </div>
            ) : teacherCameraTrack ? (
              /* FULL CAMERA VIEW */
              <div className="w-full h-full relative flex items-center justify-center">
                <VideoTrack
                  trackRef={teacherCameraTrack}
                  className={`w-full h-full object-contain ${isTeacher ? "-scale-x-100" : ""}`}
                />
              </div>
            ) : (
              /* NO ACTIVE VIDEO PLACEHOLDER */
              <div className="text-center space-y-3 p-6 text-slate-500">
                <div className="w-16 h-16 rounded-full bg-white/[0.04] text-slate-400 flex items-center justify-center mx-auto border border-white/[0.08]">
                  <Video className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {isTeacher ? "Your camera is currently paused" : "Instructor camera is currently paused"}
                  </h3>
                  <p className="text-xs font-mono text-slate-500 mt-0.5">
                    {isTeacher ? "Turn on camera below to broadcast" : "Audio and chat remain active"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            SIDE PANEL (Chat & Participants)
        ────────────────────────────────────────────────────────────── */}
        {sidebarOpen && (
          <aside className="w-80 sm:w-88 border-l border-white/[0.08] bg-[#070c18] flex flex-col z-20">
            {/* Tabs Header */}
            <div className="p-3 border-b border-white/[0.08] flex items-center justify-between bg-[#0a1122]">
              <div className="flex items-center gap-1 p-1 rounded-xl bg-[#04060a] border border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setActiveSideTab("chat")}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-1.5 ${
                    activeSideTab === "chat"
                      ? "bg-[#29d9ff] text-[#04060a] font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Chat</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSideTab("participants")}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-1.5 ${
                    activeSideTab === "participants"
                      ? "bg-[#29d9ff] text-[#04060a] font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Participants ({participants.length})</span>
                  {isTeacher && raisedHands.size > 0 && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold animate-pulse">
                      ✋ {raisedHands.size}
                    </span>
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* TAB CONTENT */}
            {activeSideTab === "chat" ? (
              /* CHAT TAB */
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                  {chatMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
                      <MessageSquare className="w-8 h-8 text-slate-600" />
                      <p className="text-xs">Classroom chat room open. Send questions and comments here.</p>
                    </div>
                  ) : (
                    chatMessages.map((msg) => (
                      <div key={msg.id} className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-mono">
                          <span
                            className={`font-semibold ${
                              msg.senderRole === "teacher" ? "text-[#29d9ff]" : "text-white"
                            }`}
                          >
                            {msg.senderName}
                          </span>
                          {msg.senderRole === "teacher" && (
                            <span className="text-[9px] uppercase px-1 rounded bg-cyan-500/10 text-[#29d9ff] border border-[#29d9ff]/20">
                              Instructor
                            </span>
                          )}
                          <span className="text-[10px] text-slate-500 ml-auto">{msg.timestamp}</span>
                        </div>
                        <p className="text-xs text-slate-300 bg-white/[0.02] p-2 rounded-lg border border-white/[0.04] break-words">
                          {msg.text}
                        </p>
                      </div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Chat Input */}
                <form onSubmit={handleSendChat} className="p-3 border-t border-white/[0.08] flex gap-2 bg-[#04060a]">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type a message to class..."
                    className="flex-1 px-3 py-2 rounded-xl bg-[#070c18] border border-white/[0.1] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#29d9ff]"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim()}
                    className="p-2 rounded-xl bg-[#29d9ff] hover:bg-[#6be4ff] text-[#04060a] transition-all disabled:opacity-40"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            ) : (
              /* PARTICIPANTS TAB */
              <div className="flex-1 p-3 space-y-2 overflow-y-auto">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 uppercase tracking-wider px-2 py-1">
                  <span>Connected Users ({participants.length})</span>
                </div>

                {/* Host Controls Header (Teacher only) */}
                {isTeacher && (
                  <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] border border-white/[0.08] mb-2">
                    <span className="text-[11px] font-mono text-slate-400">Host Audio Controls</span>
                    <button
                      type="button"
                      onClick={handleMuteAllStudents}
                      disabled={mutingAll}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-all disabled:opacity-50"
                    >
                      <MicOff className="w-3 h-3 text-rose-400" />
                      <span>{mutingAll ? "Muting All..." : "Mute All Students"}</span>
                    </button>
                  </div>
                )}

                <div className="space-y-1.5">
                  {participants.map((p) => {
                    const isHandRaised = raisedHands.has(p.identity);
                    const isInstructor = p.identity === session.teacher_id;

                    return (
                      <div
                        key={p.sid || p.identity}
                        className="p-2.5 rounded-xl border border-white/[0.06] bg-[#04060a] flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <div className="w-6 h-6 rounded-full bg-white/[0.06] text-[10px] font-bold text-slate-300 flex items-center justify-center shrink-0">
                            {p.name ? p.name.charAt(0).toUpperCase() : "U"}
                          </div>
                          <div className="truncate">
                            <div className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
                              <span>{p.name || "Participant"}</span>
                              {p.isLocal && <span className="text-[10px] text-slate-500 font-mono">(You)</span>}
                            </div>
                            <div className="text-[10px] font-mono text-slate-500">
                              {isInstructor ? "Faculty Instructor" : "Student Attendee"}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* Hand Raised Badge */}
                          {isHandRaised && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-mono font-bold animate-pulse">
                              <Hand className="w-3 h-3" />
                              <span>Hand Raised</span>
                            </span>
                          )}

                          {/* Teacher Mute Button per student */}
                          {isTeacher && !isInstructor && (
                            <button
                              type="button"
                              onClick={() => handleMuteSingleStudent(p.identity)}
                              disabled={mutingStudentId === p.identity}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono bg-white/[0.05] hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-white/[0.08] hover:border-rose-500/30 transition-all disabled:opacity-50"
                              title="Mute student microphone"
                            >
                              <MicOff className="w-3 h-3 text-rose-400" />
                              <span>{mutingStudentId === p.identity ? "..." : "Mute"}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          BOTTOM CONTROL BAR
      ────────────────────────────────────────────────────────────── */}
      <footer className="h-16 border-t border-white/[0.08] bg-[#070c18] px-4 sm:px-6 flex items-center justify-between z-30">
        {/* Left: Sidebar Toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`p-2.5 rounded-xl border text-xs font-mono flex items-center gap-2 transition-all ${
              sidebarOpen
                ? "bg-[#29d9ff]/10 text-[#29d9ff] border-[#29d9ff]/30 font-bold"
                : "bg-white/[0.04] text-slate-300 border-white/[0.08] hover:bg-white/[0.08]"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">Side Panel</span>
          </button>
        </div>

        {/* Center Controls */}
        <div className="flex items-center gap-2.5">
          {isTeacher ? (
            /* TEACHER CONTROLS: MIC, CAMERA, SCREEN SHARE */
            <>
              <button
                type="button"
                onClick={handleToggleMic}
                className={`p-3 rounded-full transition-all ${
                  isMicrophoneEnabled
                    ? "bg-white/[0.08] hover:bg-white/[0.15] text-white"
                    : "bg-rose-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]"
                }`}
                title={isMicrophoneEnabled ? "Mute Microphone" : "Unmute Microphone"}
              >
                {isMicrophoneEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>

              <button
                type="button"
                onClick={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
                className={`p-3 rounded-full transition-all ${
                  isCameraEnabled
                    ? "bg-white/[0.08] hover:bg-white/[0.15] text-white"
                    : "bg-rose-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]"
                }`}
                title={isCameraEnabled ? "Stop Camera" : "Start Camera"}
              >
                {isCameraEnabled ? <Camera className="w-5 h-5" /> : <CameraOff className="w-5 h-5" />}
              </button>

              <button
                type="button"
                onClick={handleToggleScreenShare}
                className={`p-3 rounded-full transition-all ${
                  isScreenShareEnabled
                    ? "bg-[#29d9ff] text-[#04060a] shadow-[0_0_15px_rgba(41,217,255,0.4)]"
                    : "bg-white/[0.08] hover:bg-white/[0.15] text-white"
                }`}
                title={isScreenShareEnabled ? "Stop Screen Share" : "Share Screen"}
              >
                {isScreenShareEnabled ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
              </button>
            </>
          ) : (
            /* STUDENT CONTROLS: MIC TOGGLE & RAISE HAND (STRICTLY NO CAMERA OR SCREEN SHARE) */
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleToggleMic}
                className={`p-3 rounded-full transition-all ${
                  isMicrophoneEnabled
                    ? "bg-white/[0.08] hover:bg-white/[0.15] text-white"
                    : "bg-rose-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]"
                }`}
                title={isMicrophoneEnabled ? "Mute Microphone" : "Unmute Microphone"}
              >
                {isMicrophoneEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>

              <button
                type="button"
                onClick={handleToggleRaiseHand}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-mono text-xs uppercase tracking-wider font-bold transition-all ${
                  handRaisedByMe
                    ? "bg-amber-400 text-slate-950 shadow-[0_0_15px_rgba(251,191,36,0.4)]"
                    : "bg-white/[0.08] hover:bg-white/[0.15] text-white border border-white/[0.1]"
                }`}
              >
                <Hand className="w-4 h-4" />
                <span>{handRaisedByMe ? "Lower Hand" : "Raise Hand"}</span>
              </button>
            </div>
          )}
        </div>

        {/* Right: End Class (Teacher) / Leave (Student) */}
        <div className="flex items-center gap-2">
          {isTeacher ? (
            <button
              type="button"
              disabled={endingClass}
              onClick={handleEndClass}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-rose-500 hover:bg-rose-600 text-white font-mono text-xs uppercase tracking-wider font-bold transition-all shadow-[0_0_15px_rgba(239,68,68,0.4)] disabled:opacity-50"
            >
              {endingClass ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
              <span>End Class</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStudentLeave}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/[0.08] hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border border-white/[0.1] hover:border-rose-500/30 font-mono text-xs uppercase tracking-wider transition-all"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              <span>Leave</span>
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT 3: CLASS ENDED VIEW WITH RATING DIALOG
// ─────────────────────────────────────────────────────────────────────────────
function ClassEndedView({
  session,
  isTeacher,
  currentUser,
  onReturn,
}: {
  session: SessionData | null;
  isTeacher: boolean;
  currentUser: any;
  onReturn: () => void;
}) {
  const supabase = createClient();

  const [ratingStars, setRatingStars] = useState<number>(5);
  const [hoverStars, setHoverStars] = useState<number | null>(null);
  const [ratingComment, setRatingComment] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);
  const [alreadyRated, setAlreadyRated] = useState(false);
  const [existingRatingVal, setExistingRatingVal] = useState<number>(5);
  const [ratingSuccess, setRatingSuccess] = useState(false);

  // Check if student already rated this session
  useEffect(() => {
    if (isTeacher || !session || !currentUser) return;

    async function checkExistingRating() {
      const { data } = await (supabase
        .from("class_ratings") as any)
        .select("stars, comment")
        .eq("session_id", session!.id)
        .eq("user_id", currentUser.id)
        .maybeSingle();

      if (data) {
        setAlreadyRated(true);
        setExistingRatingVal(data.stars);
        if (data.comment) setRatingComment(data.comment);
      }
    }

    checkExistingRating();
  }, [isTeacher, session, currentUser, supabase]);

  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !currentUser || alreadyRated) return;

    try {
      setSubmittingRating(true);

      const { error } = await (supabase.from("class_ratings") as any).upsert(
        {
          session_id: session.id,
          user_id: currentUser.id,
          stars: ratingStars,
          comment: ratingComment.trim() || null,
        },
        { onConflict: "session_id,user_id" }
      );

      if (error) throw error;

      setRatingSuccess(true);
      setAlreadyRated(true);
      setExistingRatingVal(ratingStars);
    } catch (err: any) {
      console.error("Error submitting rating:", err);
      alert(err.message || "Failed to submit rating.");
    } finally {
      setSubmittingRating(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#070c18] p-8 sm:p-10 text-center space-y-6 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20 shadow-[0_0_20px_rgba(52,211,153,0.2)]">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div className="space-y-1.5">
          <div className="font-mono text-xs uppercase tracking-widest text-[#29d9ff]">
            SESSION CONCLUDED
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Class Ended</h2>
          <p className="text-xs text-slate-400 font-mono">
            {session?.title} • {session?.courseTitle}
          </p>
        </div>

        {isTeacher ? (
          /* TEACHER POST-SESSION SUMMARY */
          <div className="space-y-4 pt-2">
            <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
              Your broadcast has concluded. Attendance telemetry heartbeats have been finalized and recorded in the 75% compliance engine.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link
                href={`/teacher/attendance?session=${session?.id}`}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#29d9ff] hover:bg-[#6be4ff] text-[#04060a] font-mono text-xs uppercase tracking-wider font-bold transition-all shadow-sm"
              >
                <span>View Attendance Telemetry</span>
              </Link>
              <button
                type="button"
                onClick={onReturn}
                className="w-full sm:w-auto px-5 py-2.5 rounded-full border border-white/10 hover:border-white/20 bg-white/[0.04] text-xs font-mono text-slate-300 hover:text-white transition-all"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        ) : (
          /* STUDENT RATING DIALOG */
          <div className="space-y-4 pt-2">
            {alreadyRated ? (
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                <div className="flex items-center justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-5 h-5 ${
                        star <= existingRatingVal ? "fill-amber-400 text-amber-400" : "text-slate-600"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-slate-300">
                  {ratingSuccess ? "Thank you! Your feedback has been recorded." : "You have already submitted a rating for this lecture."}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitRating} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-mono text-slate-300 uppercase tracking-wider block">
                    How was this lecture experience?
                  </label>
                  {/* Interactive Star Rating */}
                  <div className="flex items-center justify-center gap-2 py-1">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const filled = star <= (hoverStars ?? ratingStars);
                      return (
                        <button
                          key={star}
                          type="button"
                          onMouseEnter={() => setHoverStars(star)}
                          onMouseLeave={() => setHoverStars(null)}
                          onClick={() => setRatingStars(star)}
                          className="p-1 text-slate-600 hover:scale-125 transition-transform focus:outline-none"
                        >
                          <Star
                            className={`w-7 h-7 transition-colors ${
                              filled ? "fill-amber-400 text-amber-400" : "text-slate-600"
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <textarea
                  rows={3}
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  placeholder="Optional written feedback for your instructor (strictly anonymous)..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#04060a] border border-white/[0.1] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#29d9ff] resize-none"
                />

                <button
                  type="submit"
                  disabled={submittingRating}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-[#29d9ff] hover:bg-[#6be4ff] text-[#04060a] font-mono text-xs uppercase tracking-wider font-bold transition-all shadow-[0_0_15px_rgba(41,217,255,0.3)] disabled:opacity-50"
                >
                  {submittingRating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Submit Anonymous Rating</span>
                </button>
              </form>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={onReturn}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-white/10 hover:border-white/20 bg-white/[0.04] text-xs font-mono text-slate-300 hover:text-white transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Student Dashboard</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
