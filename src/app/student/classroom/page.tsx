"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Radio,
  User,
  Video,
  Layers,
  Sparkles,
} from "lucide-react";

interface ClassroomSession {
  id: string;
  course_id: string;
  topic_id: string | null;
  teacher_id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  status: "live" | "scheduled" | "ended";
  livekit_room: string;
  courseTitle: string;
  topicTitle: string;
  teacherName: string;
}

export default function VirtualClassroomPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [liveSessions, setLiveSessions] = useState<ClassroomSession[]>([]);
  const [todaySessions, setTodaySessions] = useState<ClassroomSession[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<ClassroomSession[]>([]);
  const [hasEnrollments, setHasEnrollments] = useState(true);

  useEffect(() => {
    async function fetchClassroomData() {
      try {
        setLoading(true);

        // 1. Authenticate student
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        // 2. Fetch student's enrolled courses
        const { data: enrollments } = (await supabase
          .from("enrollments")
          .select("course_id")
          .eq("student_id", user.id)) as {
          data: { course_id: string }[] | null;
          error: unknown;
        };

        const courseIds = (enrollments || []).map((e) => e.course_id);

        if (courseIds.length === 0) {
          setHasEnrollments(false);
          setLoading(false);
          return;
        }

        setHasEnrollments(true);

        // 3. Fetch courses
        const { data: coursesData } = (await supabase
          .from("courses")
          .select("id, title, teacher_id")
          .in("id", courseIds)) as {
          data: { id: string; title: string; teacher_id: string }[] | null;
          error: unknown;
        };

        const courseMap = new Map((coursesData || []).map((c) => [c.id, c.title]));

        // 4. Fetch teachers
        const teacherIds = Array.from(
          new Set((coursesData || []).map((c) => c.teacher_id).filter(Boolean))
        );

        const teacherMap = new Map<string, string>();
        if (teacherIds.length > 0) {
          const { data: teachersData } = (await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", teacherIds)) as {
            data: { id: string; full_name: string }[] | null;
            error: unknown;
          };

          if (teachersData) {
            teachersData.forEach((t) => {
              if (t.full_name) teacherMap.set(t.id, t.full_name);
            });
          }
        }

        // 5. Fetch topics
        const { data: topicsData } = (await supabase
          .from("topics")
          .select("id, title")
          .in("course_id", courseIds)) as {
          data: { id: string; title: string }[] | null;
          error: unknown;
        };

        const topicMap = new Map((topicsData || []).map((t) => [t.id, t.title]));

        // 6. Fetch live & scheduled sessions for enrolled courses
        const { data: sessionsData } = (await supabase
          .from("live_sessions")
          .select("id, course_id, topic_id, teacher_id, title, scheduled_at, duration_minutes, status, livekit_room")
          .in("course_id", courseIds)
          .in("status", ["live", "scheduled"])
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
                status: "live" | "scheduled" | "ended";
                livekit_room: string;
              }[]
            | null;
          error: unknown;
        };

        const enrichedSessions: ClassroomSession[] = (sessionsData || []).map((s) => ({
          ...s,
          courseTitle: courseMap.get(s.course_id) || "Enrolled Course",
          topicTitle: (s.topic_id && topicMap.get(s.topic_id)) || "General Curriculum",
          teacherName: teacherMap.get(s.teacher_id) || "Assigned Instructor",
        }));

        // 7. Group sessions into: Live now, Today, Upcoming
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        const liveList: ClassroomSession[] = [];
        const todayList: ClassroomSession[] = [];
        const upcomingList: ClassroomSession[] = [];

        enrichedSessions.forEach((s) => {
          if (s.status === "live") {
            liveList.push(s);
          } else {
            const scheduledDate = new Date(s.scheduled_at);
            if (scheduledDate >= startOfToday && scheduledDate <= endOfToday) {
              todayList.push(s);
            } else if (scheduledDate > endOfToday) {
              upcomingList.push(s);
            }
          }
        });

        setLiveSessions(liveList);
        setTodaySessions(todayList);
        setUpcomingSessions(upcomingList);
      } catch (err) {
        console.error("Error loading classroom data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchClassroomData();
  }, [supabase, router]);

  return (
    <div className="space-y-10">
      {/* ─────────────────────────────────────────────────────────────
          PAGE HEADER
      ────────────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <Link
          href="/student"
          className="inline-flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-[#29d9ff] transition-colors group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Dashboard</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-[#29d9ff]">
              INTERACTIVE SESSIONS
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Virtual Classroom
            </h1>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs text-slate-400 bg-white/[0.04] px-3.5 py-1.5 rounded-full border border-white/[0.08] self-start sm:self-auto">
            <Radio className="w-3.5 h-3.5 text-[#29d9ff] animate-pulse" />
            <span>Encrypted WebRTC Rooms</span>
          </div>
        </div>
      </div>

      {loading ? (
        // Loading skeletons
        <div className="space-y-8 animate-pulse">
          <div className="h-44 rounded-2xl bg-white/[0.04] border border-white/[0.06]" />
          <div className="h-44 rounded-2xl bg-white/[0.04] border border-white/[0.06]" />
          <div className="h-44 rounded-2xl bg-white/[0.04] border border-white/[0.06]" />
        </div>
      ) : !hasEnrollments ? (
        // No enrolled courses state
        <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-10 sm:p-14 text-center space-y-4">
          <Layers className="w-10 h-10 text-slate-600 mx-auto" />
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white">No courses enrolled</h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              You are not enrolled in any active courses. Virtual classroom sessions will appear once you are enrolled in a curriculum.
            </p>
          </div>
          <Link
            href="/student"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#29d9ff] text-[#04060a] font-mono text-xs uppercase tracking-wider font-bold"
          >
            Go to My Courses
          </Link>
        </div>
      ) : (
        <div className="space-y-10">
          {/* ───────────────────────────────────────────────────────────
              1. LIVE NOW SECTION
          ──────────────────────────────────────────────────────────── */}
          <section className="space-y-4">
            <div className="flex items-center gap-2.5 border-b border-white/[0.08] pb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Live Now
              </h2>
              <span className="font-mono text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20 ml-auto">
                {liveSessions.length} {liveSessions.length === 1 ? "Active Session" : "Active Sessions"}
              </span>
            </div>

            {liveSessions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {liveSessions.map((session) => (
                  <div
                    key={session.id}
                    className="rounded-2xl border border-red-500/40 bg-gradient-to-br from-red-950/20 via-[#070c18] to-[#070c18] p-5 sm:p-6 space-y-4 shadow-[0_0_20px_rgba(239,68,68,0.15)] flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[#29d9ff] bg-[#29d9ff]/10 px-2.5 py-0.5 rounded-full border border-[#29d9ff]/20">
                          {session.topicTitle}
                        </span>
                        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-red-400 bg-red-500/15 px-2.5 py-0.5 rounded-full border border-red-500/30 font-bold animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          BROADCASTING LIVE
                        </span>
                      </div>

                      <h3 className="text-base sm:text-lg font-bold text-white">
                        {session.title}
                      </h3>

                      <p className="text-xs text-slate-300 font-medium">
                        {session.courseTitle}
                      </p>

                      <div className="flex items-center gap-4 font-mono text-xs text-slate-400 pt-1">
                        <span className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-[#29d9ff]" />
                          {session.teacherName}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {session.duration_minutes} mins
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between">
                      <span className="font-mono text-[11px] text-slate-500">
                        Attendance Telemetry Active
                      </span>

                      {/* Join button goes to /live/[sessionId] */}
                      <Link
                        href={`/live/${session.id}`}
                        className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-red-500 hover:bg-red-400 text-white font-mono text-xs uppercase tracking-wider font-bold shadow-[0_0_15px_rgba(239,68,68,0.5)] transition-all animate-pulse"
                      >
                        <Video className="w-4 h-4" />
                        <span>Join Class</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/[0.06] bg-[#070c18]/50 p-8 text-center space-y-2">
                <Radio className="w-6 h-6 text-slate-600 mx-auto" />
                <p className="text-xs font-semibold text-slate-300">No active live sessions right now</p>
                <p className="text-[11px] text-slate-500">
                  Classes appear here the moment your instructors begin broadcasting.
                </p>
              </div>
            )}
          </section>

          {/* ───────────────────────────────────────────────────────────
              2. TODAY SECTION
          ──────────────────────────────────────────────────────────── */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#29d9ff]" />
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Today
                </h2>
              </div>
              <span className="font-mono text-xs text-slate-400">
                {todaySessions.length} {todaySessions.length === 1 ? "Class" : "Classes"} Today
              </span>
            </div>

            {todaySessions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {todaySessions.map((session) => {
                  const sessionTime = new Date(session.scheduled_at).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  });

                  return (
                    <div
                      key={session.id}
                      className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-5 sm:p-6 space-y-4 transition-all hover:border-[#29d9ff]/30 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[10px] uppercase tracking-wider text-[#29d9ff] bg-[#29d9ff]/10 px-2.5 py-0.5 rounded-full border border-[#29d9ff]/20">
                            {session.topicTitle}
                          </span>
                          <span className="font-mono text-[10px] uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
                            SCHEDULED TODAY
                          </span>
                        </div>

                        <h3 className="text-base font-bold text-white">{session.title}</h3>

                        <p className="text-xs text-slate-300">{session.courseTitle}</p>

                        <div className="flex items-center gap-4 font-mono text-xs text-slate-400 pt-1">
                          <span className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            {session.teacherName}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {sessionTime} ({session.duration_minutes}m)
                          </span>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
                        <span className="font-mono text-[11px] text-slate-500">
                          Starts at {sessionTime}
                        </span>
                        <button
                          type="button"
                          disabled
                          title="Join enables when instructor starts the live session"
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/[0.05] text-slate-500 border border-white/[0.06] font-mono text-xs uppercase tracking-wider cursor-not-allowed"
                        >
                          <span>Starts Soon</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/[0.06] bg-[#070c18]/50 p-8 text-center space-y-2">
                <Clock className="w-6 h-6 text-slate-600 mx-auto" />
                <p className="text-xs font-semibold text-slate-300">No further classes scheduled for today</p>
                <p className="text-[11px] text-slate-500">
                  You are all caught up for today. Check upcoming sessions below.
                </p>
              </div>
            )}
          </section>

          {/* ───────────────────────────────────────────────────────────
              3. UPCOMING SECTION
          ──────────────────────────────────────────────────────────── */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#29d9ff]" />
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Upcoming
                </h2>
              </div>
              <span className="font-mono text-xs text-slate-400">
                {upcomingSessions.length} {upcomingSessions.length === 1 ? "Class" : "Classes"} Ahead
              </span>
            </div>

            {upcomingSessions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {upcomingSessions.map((session) => {
                  const sessionDate = new Date(session.scheduled_at);
                  const formattedDate = sessionDate.toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  });
                  const formattedTime = sessionDate.toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  });

                  return (
                    <div
                      key={session.id}
                      className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-5 sm:p-6 space-y-4 transition-all hover:border-[#29d9ff]/20 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[10px] uppercase tracking-wider text-[#29d9ff] bg-[#29d9ff]/10 px-2.5 py-0.5 rounded-full border border-[#29d9ff]/20">
                            {session.topicTitle}
                          </span>
                          <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400 bg-white/[0.05] px-2.5 py-0.5 rounded-full border border-white/[0.08]">
                            {formattedDate}
                          </span>
                        </div>

                        <h3 className="text-base font-bold text-white">{session.title}</h3>

                        <p className="text-xs text-slate-300">{session.courseTitle}</p>

                        <div className="flex items-center gap-4 font-mono text-xs text-slate-400 pt-1">
                          <span className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            {session.teacherName}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {formattedTime} ({session.duration_minutes}m)
                          </span>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs font-mono text-slate-500">
                        <span>WebRTC Class</span>
                        <span className="text-slate-400">{formattedDate} • {formattedTime}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/[0.06] bg-[#070c18]/50 p-8 text-center space-y-2">
                <Calendar className="w-6 h-6 text-slate-600 mx-auto" />
                <p className="text-xs font-semibold text-slate-300">No upcoming sessions</p>
                <p className="text-[11px] text-slate-500">
                  New class schedules will be published by your course instructors soon.
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
