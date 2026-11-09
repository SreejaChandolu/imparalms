"use client";

import React, { useEffect, useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Radio,
  Video,
  Zap,
  Layers,
  AlertCircle,
  Play,
  Square,
  Loader2,
} from "lucide-react";

interface TeacherCourse {
  id: string;
  title: string;
}

interface TeacherTopic {
  id: string;
  course_id: string;
  title: string;
}

interface ScheduledSessionOption {
  id: string;
  course_id: string;
  topic_id: string | null;
  teacher_id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  status: "scheduled" | "live" | "ended";
  courseTitle: string;
  topicTitle: string;
}

function TeacherHostContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const courseQueryParam = searchParams.get("course");
  const sessionQueryParam = searchParams.get("session");

  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<TeacherCourse[]>([]);
  const [topics, setTopics] = useState<TeacherTopic[]>([]);
  const [scheduledSessions, setScheduledSessions] = useState<ScheduledSessionOption[]>([]);
  const [liveSessions, setLiveSessions] = useState<ScheduledSessionOption[]>([]);
  const [endingSessionId, setEndingSessionId] = useState<string | null>(null);

  // Host Mode: 'scheduled' or 'instant'
  const [mode, setMode] = useState<"scheduled" | "instant">("scheduled");

  // Selected Scheduled Session ID
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");

  // Instant Class Form State
  const [instantCourseId, setInstantCourseId] = useState("");
  const [instantTopicId, setInstantTopicId] = useState("");
  const [instantTitle, setInstantTitle] = useState("");

  const [starting, setStarting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadHostData() {
      try {
        setLoading(true);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/staff");
          return;
        }

        // 1. Fetch teacher courses
        const { data: coursesData } = (await supabase
          .from("courses")
          .select("id, title")
          .eq("teacher_id", user.id)) as {
          data: TeacherCourse[] | null;
          error: unknown;
        };

        const loadedCourses = coursesData || [];
        setCourses(loadedCourses);

        if (loadedCourses.length > 0) {
          setInstantCourseId(courseQueryParam || loadedCourses[0].id);
        }

        const courseIds = loadedCourses.map((c) => c.id);

        if (courseIds.length === 0) {
          setLoading(false);
          return;
        }

        // 2. Fetch topics for courses
        const { data: topicsData } = (await supabase
          .from("topics")
          .select("id, course_id, title")
          .in("course_id", courseIds)) as {
          data: TeacherTopic[] | null;
          error: unknown;
        };

        const loadedTopics = topicsData || [];
        setTopics(loadedTopics);

        const initialTopics = loadedTopics.filter(
          (t) => t.course_id === (courseQueryParam || loadedCourses[0]?.id)
        );
        if (initialTopics.length > 0) {
          setInstantTopicId(initialTopics[0].id);
        }

        // 3. Fetch scheduled & live sessions for teacher
        const { data: sessionsData } = (await supabase
          .from("live_sessions")
          .select("id, course_id, topic_id, teacher_id, title, scheduled_at, duration_minutes, status")
          .eq("teacher_id", user.id)
          .in("status", ["scheduled", "live"])
          .order("scheduled_at", { ascending: true })) as {
          data:
            | {
                id: string;
                course_id: string;
                topic_id: string | null;
                teacher_id: string;
                title: string;
                scheduled_at: string;
                duration_minutes: number;
                status: "scheduled" | "live" | "ended";
              }[]
            | null;
          error: unknown;
        };

        const courseMap = new Map(loadedCourses.map((c) => [c.id, c.title]));
        const topicMap = new Map(loadedTopics.map((t) => [t.id, t.title]));

        const enriched: ScheduledSessionOption[] = (sessionsData || []).map((s) => ({
          ...s,
          courseTitle: courseMap.get(s.course_id) || "Assigned Course",
          topicTitle: (s.topic_id && topicMap.get(s.topic_id)) || "General Topic",
        }));

        // Check all currently live sessions for this teacher
        const currentlyLive = enriched.filter((s) => s.status === "live");
        setLiveSessions(currentlyLive);

        const onlyScheduled = enriched.filter((s) => s.status === "scheduled");
        setScheduledSessions(onlyScheduled);

        // Preselection priority:
        // 1. If sessionQueryParam matches a session
        // 2. If courseQueryParam matches, pick that course's next scheduled session
        // 3. Otherwise pick the first scheduled session
        if (sessionQueryParam && onlyScheduled.some((s) => s.id === sessionQueryParam)) {
          setSelectedSessionId(sessionQueryParam);
        } else if (courseQueryParam) {
          const matchCourseSession = onlyScheduled.find((s) => s.course_id === courseQueryParam);
          if (matchCourseSession) {
            setSelectedSessionId(matchCourseSession.id);
          } else if (onlyScheduled.length > 0) {
            setSelectedSessionId(onlyScheduled[0].id);
          } else {
            setMode("instant");
          }
        } else if (onlyScheduled.length > 0) {
          setSelectedSessionId(onlyScheduled[0].id);
        } else {
          setMode("instant");
        }
      } catch (err) {
        console.error("Error loading host page data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadHostData();
  }, [courseQueryParam, sessionQueryParam, router, supabase]);

  const instantTopics = useMemo(() => {
    return topics.filter((t) => t.course_id === instantCourseId);
  }, [topics, instantCourseId]);

  const handleInstantCourseChange = (cId: string) => {
    setInstantCourseId(cId);
    const related = topics.filter((t) => t.course_id === cId);
    if (related.length > 0) {
      setInstantTopicId(related[0].id);
    } else {
      setInstantTopicId("");
    }
  };

  const selectedScheduledSession = useMemo(() => {
    return scheduledSessions.find((s) => s.id === selectedSessionId) || null;
  }, [scheduledSessions, selectedSessionId]);

  // Handle "Go Live" action
  const handleGoLive = async () => {
    setErrorMsg(null);

    try {
      setStarting(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/staff");
        return;
      }

      if (mode === "scheduled") {
        if (!selectedSessionId) {
          setErrorMsg("Please select a scheduled session to host.");
          return;
        }

        // Set session status to 'live' and started_at to now
        const nowIso = new Date().toISOString();

        const { error: updateError } = await (supabase
          .from("live_sessions") as any)
          .update({
            status: "live",
            started_at: nowIso,
          })
          .eq("id", selectedSessionId)
          .eq("teacher_id", user.id);

        if (updateError) throw updateError;

        // Redirect to /live/[sessionId]
        router.push(`/live/${selectedSessionId}`);
      } else {
        // Mode === 'instant'
        if (!instantCourseId) {
          setErrorMsg("Please select a course for the instant class.");
          return;
        }

        if (!instantTitle.trim()) {
          setErrorMsg("Please enter a title for the instant class.");
          return;
        }

        const nowIso = new Date().toISOString();
        const livekitRoom = `room-${instantCourseId.slice(0, 8)}-${Date.now()}`;

        const { data: newSession, error: insertError } = (await (supabase
          .from("live_sessions") as any)
          .insert({
            course_id: instantCourseId,
            topic_id: instantTopicId || null,
            teacher_id: user.id,
            title: instantTitle.trim(),
            scheduled_at: nowIso,
            started_at: nowIso,
            duration_minutes: 60,
            status: "live",
            livekit_room: livekitRoom,
          })
          .select("id")
          .single()) as { data: { id: string } | null; error: any };

        if (insertError) throw insertError;
        if (!newSession?.id) throw new Error("Failed to create instant session.");

        // Redirect to /live/[sessionId]
        router.push(`/live/${newSession.id}`);
      }
    } catch (err: any) {
      console.error("Failed to go live:", err);
      setErrorMsg(err.message || "Failed to start live session.");
    } finally {
      setStarting(false);
    }
  };

  const handleEndClass = async (sessionId: string, sessionTitle: string) => {
    if (
      !confirm(
        `Are you sure you want to end "${sessionTitle}"? This will conclude the session, disconnect attendees, and finalize attendance telemetry.`
      )
    ) {
      return;
    }

    try {
      setEndingSessionId(sessionId);
      setErrorMsg(null);

      const res = await fetch("/api/livekit/end-class", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to end class.");
      }

      setLiveSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err: any) {
      console.error("Error concluding live session:", err);
      setErrorMsg(err.message || "Failed to conclude session.");
    } finally {
      setEndingSessionId(null);
    }
  };

  return (
    <div className="space-y-8 sm:space-y-10 max-w-4xl mx-auto">
      {/* ─────────────────────────────────────────────────────────────
          PAGE HEADER
      ────────────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <Link
          href="/teacher"
          className="inline-flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-[#29d9ff] transition-colors group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Dashboard</span>
        </Link>

        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-[#29d9ff]">
            BROADCAST CONTROL
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Host a Live Class
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Activate a scheduled lecture or launch an instant classroom session with encrypted WebRTC rooms.
          </p>
        </div>
      </div>

      {/* Active Live Sessions Alert List */}
      {liveSessions.length > 0 && (
        <div className="space-y-3">
          {liveSessions.map((ls) => (
            <div
              key={ls.id}
              className="p-4 rounded-2xl border border-red-500/40 bg-red-950/20 shadow-[0_0_20px_rgba(239,68,68,0.2)] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-red-400 bg-red-500/15 px-2.5 py-0.5 rounded-full border border-red-500/30 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                  <span>ACTIVE LIVE SESSION</span>
                </div>
                <h3 className="text-base font-bold text-white">{ls.title}</h3>
                <p className="text-xs text-slate-300 font-mono">
                  {ls.courseTitle} • {ls.topicTitle}
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center">
                <Link
                  href={`/live/${ls.id}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500 hover:bg-red-400 text-white font-mono text-xs uppercase tracking-wider font-bold shadow-[0_0_15px_rgba(239,68,68,0.5)] transition-all whitespace-nowrap"
                >
                  <Radio className="w-4 h-4 animate-pulse" />
                  <span>Return to Room</span>
                </Link>

                <button
                  type="button"
                  disabled={endingSessionId === ls.id}
                  onClick={() => handleEndClass(ls.id, ls.title)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/[0.06] hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-white/[0.1] hover:border-rose-500/30 font-mono text-xs uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
                >
                  {endingSessionId === ls.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-rose-400" />
                  )}
                  <span>End Class</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="h-80 rounded-2xl bg-white/[0.04] border border-white/[0.06] animate-pulse" />
      ) : courses.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-10 text-center space-y-3">
          <Layers className="w-10 h-10 text-slate-600 mx-auto" />
          <h2 className="text-lg font-bold text-white">No assigned courses</h2>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            You must be assigned as an instructor for at least one course before hosting live sessions.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-6 sm:p-8 space-y-6">
          {/* Mode Tabs: Scheduled Session vs Instant Class */}
          <div className="flex items-center rounded-xl bg-[#04060a] p-1 border border-white/[0.08]">
            <button
              type="button"
              onClick={() => setMode("scheduled")}
              className={`flex-1 py-2.5 rounded-lg text-xs font-mono uppercase tracking-wider font-bold transition-all flex items-center justify-center gap-2 ${
                mode === "scheduled"
                  ? "bg-[#29d9ff] text-[#04060a] shadow-[0_0_15px_rgba(41,217,255,0.3)]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Pick Scheduled Session ({scheduledSessions.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setMode("instant")}
              className={`flex-1 py-2.5 rounded-lg text-xs font-mono uppercase tracking-wider font-bold transition-all flex items-center justify-center gap-2 ${
                mode === "instant"
                  ? "bg-[#29d9ff] text-[#04060a] shadow-[0_0_15px_rgba(41,217,255,0.3)]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>Launch Instant Class</span>
            </button>
          </div>

          {/* TAB 1: SCHEDULED SESSION SELECTOR */}
          {mode === "scheduled" && (
            <div className="space-y-5">
              {scheduledSessions.length > 0 ? (
                <div className="space-y-3">
                  <label className="block font-mono text-xs uppercase tracking-wider text-slate-300">
                    Select a scheduled class to start
                  </label>

                  <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                    {scheduledSessions.map((session) => {
                      const isSelected = session.id === selectedSessionId;
                      const sessionDate = new Date(session.scheduled_at);
                      const formattedDate = sessionDate.toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      });
                      const formattedTime = sessionDate.toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      });

                      return (
                        <div
                          key={session.id}
                          onClick={() => setSelectedSessionId(session.id)}
                          className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isSelected
                              ? "border-[#29d9ff] bg-[#29d9ff]/10 ring-1 ring-[#29d9ff]"
                              : "border-white/[0.06] bg-[#04060a]/70 hover:border-white/[0.15]"
                          }`}
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] uppercase tracking-wider text-[#29d9ff] bg-[#29d9ff]/10 px-2 py-0.5 rounded border border-[#29d9ff]/20">
                                {session.topicTitle}
                              </span>
                              <span className="font-mono text-xs text-slate-400">
                                {session.courseTitle}
                              </span>
                            </div>

                            <h4 className="text-sm sm:text-base font-bold text-white">
                              {session.title}
                            </h4>

                            <div className="flex items-center gap-2 font-mono text-xs text-slate-500">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span>
                                {formattedDate} at {formattedTime} ({session.duration_minutes}m)
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-start sm:self-center">
                            <div
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                isSelected
                                  ? "border-[#29d9ff] bg-[#29d9ff]"
                                  : "border-slate-600 bg-transparent"
                              }`}
                            >
                              {isSelected && <div className="w-2 h-2 rounded-full bg-[#04060a]" />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-8 rounded-xl border border-white/[0.06] bg-[#04060a]/50 text-center space-y-3">
                  <Calendar className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-sm font-semibold text-white">No scheduled classes found</p>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    You do not have any upcoming scheduled sessions. You can switch to &ldquo;Launch Instant Class&rdquo; or schedule a lecture first.
                  </p>
                  <Link
                    href="/teacher/schedule"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 hover:border-white/20 bg-white/[0.04] text-xs font-mono uppercase tracking-wider text-slate-200"
                  >
                    Schedule a Lecture
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: INSTANT CLASS FORM */}
          {mode === "instant" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Course */}
                <div className="space-y-1.5">
                  <label className="block font-mono text-xs uppercase tracking-wider text-slate-300">
                    Course
                  </label>
                  <select
                    value={instantCourseId}
                    onChange={(e) => handleInstantCourseChange(e.target.value)}
                    className="w-full rounded-xl border border-white/[0.08] bg-[#04060a] px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-[#29d9ff] transition-colors"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Topic */}
                <div className="space-y-1.5">
                  <label className="block font-mono text-xs uppercase tracking-wider text-slate-300">
                    Topic of Course
                  </label>
                  <select
                    value={instantTopicId}
                    onChange={(e) => setInstantTopicId(e.target.value)}
                    className="w-full rounded-xl border border-white/[0.08] bg-[#04060a] px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-[#29d9ff] transition-colors"
                  >
                    <option value="">General Curriculum Topic</option>
                    {instantTopics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <label className="block font-mono text-xs uppercase tracking-wider text-slate-300">
                  Instant Class Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ad-hoc Live Workshop & Q&A Session"
                  value={instantTitle}
                  onChange={(e) => setInstantTitle(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-[#04060a] px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#29d9ff] transition-colors"
                />
              </div>
            </div>
          )}

          {/* Broadcast Launch Summary & Go Live Button */}
          <div className="pt-4 border-t border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="font-mono text-xs text-slate-400">
              <span className="text-[#29d9ff]">LiveKit Room:</span>{" "}
              {mode === "scheduled" && selectedScheduledSession
                ? selectedScheduledSession.title
                : mode === "instant" && instantTitle.trim()
                ? instantTitle.trim()
                : "Dynamic Encrypted Feed"}
            </div>

            <button
              type="button"
              onClick={handleGoLive}
              disabled={starting || (mode === "scheduled" && !selectedSessionId)}
              className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-full bg-red-500 hover:bg-red-400 text-white font-mono text-xs uppercase tracking-wider font-bold shadow-[0_0_20px_rgba(239,68,68,0.5)] transition-all animate-pulse disabled:opacity-50 disabled:animate-none disabled:cursor-not-allowed"
            >
              {starting ? (
                <span>Starting Stream...</span>
              ) : (
                <>
                  <Radio className="w-4 h-4" />
                  <span>Go Live</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TeacherHostPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto space-y-8 animate-pulse">
          <div className="h-6 w-32 bg-white/[0.06] rounded" />
          <div className="h-10 w-64 bg-white/[0.06] rounded" />
          <div className="h-80 rounded-2xl bg-white/[0.04] border border-white/[0.06]" />
        </div>
      }
    >
      <TeacherHostContent />
    </Suspense>
  );
}
