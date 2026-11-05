"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  BookOpen,
  Calendar,
  CheckCircle,
  Clock,
  GraduationCap,
  HelpCircle,
  Radio,
  Video,
  Award,
  Layers,
  ArrowRight,
} from "lucide-react";

interface CourseCardData {
  id: string;
  title: string;
  description: string | null;
  teacherName: string;
  progressPercentage: number;
  totalReadyRecordings: number;
  completedRecordings: number;
}

interface UpcomingSessionData {
  id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  status: "scheduled" | "live" | "ended";
  livekit_room: string;
  courseTitle: string;
  topicTitle: string;
}

export default function StudentDashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState<string>("Student");
  const [stats, setStats] = useState({
    enrolledCoursesCount: 0,
    overallAttendancePercentage: 0,
    totalAssessmentsTaken: 0,
  });
  const [courses, setCourses] = useState<CourseCardData[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<UpcomingSessionData[]>([]);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);

        // 1. Get current authenticated user
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        // 2. Fetch student profile
        const { data: profile } = (await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single()) as { data: { full_name?: string } | null; error: unknown };

        const fullName = profile?.full_name?.trim() || "";
        const fName = fullName ? fullName.split(" ")[0] : "Student";
        setFirstName(fName);

        // 3. Fetch student's course enrollments
        const { data: enrollments } = (await supabase
          .from("enrollments")
          .select("course_id")
          .eq("student_id", user.id)) as { data: { course_id: string }[] | null; error: unknown };

        const courseIds = (enrollments || []).map((e) => e.course_id);
        const enrolledCount = courseIds.length;

        // 4. Fetch overall attendance from view: course_attendance_percentage
        let overallAttendance = 0;
        if (enrolledCount > 0) {
          const { data: attendanceData } = (await supabase
            .from("course_attendance_percentage")
            .select("attendance_percentage, sessions_attended, total_ended_sessions")
            .eq("student_id", user.id)) as {
            data:
              | {
                  attendance_percentage: number;
                  sessions_attended: number;
                  total_ended_sessions: number;
                }[]
              | null;
            error: unknown;
          };

          if (attendanceData && attendanceData.length > 0) {
            const totalEnded = attendanceData.reduce(
              (acc, curr) => acc + (Number(curr.total_ended_sessions) || 0),
              0
            );
            const totalAttended = attendanceData.reduce(
              (acc, curr) => acc + (Number(curr.sessions_attended) || 0),
              0
            );

            if (totalEnded > 0) {
              overallAttendance = Math.round((totalAttended / totalEnded) * 100);
            } else {
              // No sessions ended yet - count as 100% baseline
              overallAttendance = 100;
            }
          } else {
            overallAttendance = 100;
          }
        }

        // 5. Fetch total assessments taken from assessment_attempts
        const { count: assessmentCount } = await supabase
          .from("assessment_attempts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id);

        setStats({
          enrolledCoursesCount: enrolledCount,
          overallAttendancePercentage: overallAttendance,
          totalAssessmentsTaken: assessmentCount || 0,
        });

        // If not enrolled in any course, finish loading early
        if (courseIds.length === 0) {
          setCourses([]);
          setUpcomingSessions([]);
          setLoading(false);
          return;
        }

        // 6. Fetch course details
        const { data: coursesData } = (await supabase
          .from("courses")
          .select("id, title, description, teacher_id")
          .in("id", courseIds)) as {
          data:
            | {
                id: string;
                title: string;
                description: string | null;
                teacher_id: string;
              }[]
            | null;
          error: unknown;
        };

        // 7. Fetch teachers' profiles
        const teacherIds = Array.from(
          new Set(
            (coursesData || [])
              .map((c) => c.teacher_id)
              .filter((id): id is string => Boolean(id))
          )
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
              if (t.full_name) {
                teacherMap.set(t.id, t.full_name);
              }
            });
          }
        }

        // 8. Fetch recordings & lesson_progress for progress percentage
        const { data: recordingsData } = (await supabase
          .from("recordings")
          .select("id, course_id, status")
          .in("course_id", courseIds)
          .eq("status", "ready")) as {
          data: { id: string; course_id: string; status: string }[] | null;
          error: unknown;
        };

        const readyRecordings = recordingsData || [];
        const readyRecIds = readyRecordings.map((r) => r.id);

        const completedRecordingIds = new Set<string>();
        if (readyRecIds.length > 0) {
          const { data: progressData } = (await supabase
            .from("lesson_progress")
            .select("recording_id, completed")
            .eq("user_id", user.id)
            .eq("completed", true)
            .in("recording_id", readyRecIds)) as {
            data: { recording_id: string; completed: boolean }[] | null;
            error: unknown;
          };

          if (progressData) {
            progressData.forEach((p) => {
              if (p.recording_id) {
                completedRecordingIds.add(p.recording_id);
              }
            });
          }
        }

        // Build list of course card models
        const courseCards: CourseCardData[] = (coursesData || []).map((c) => {
          const courseReadyRecs = readyRecordings.filter((r) => r.course_id === c.id);
          const totalReady = courseReadyRecs.length;
          const completedCount = courseReadyRecs.filter((r) =>
            completedRecordingIds.has(r.id)
          ).length;
          const progressPercentage =
            totalReady > 0 ? Math.round((completedCount / totalReady) * 100) : 0;

          return {
            id: c.id,
            title: c.title,
            description: c.description,
            teacherName: teacherMap.get(c.teacher_id) || "Assigned Instructor",
            progressPercentage,
            totalReadyRecordings: totalReady,
            completedRecordings: completedCount,
          };
        });

        setCourses(courseCards);

        // 9. Fetch upcoming 5 sessions
        const { data: sessionsData } = (await supabase
          .from("live_sessions")
          .select("id, course_id, topic_id, title, scheduled_at, duration_minutes, status, livekit_room")
          .in("course_id", courseIds)
          .in("status", ["scheduled", "live"])
          .order("scheduled_at", { ascending: true })
          .limit(5)) as {
          data:
            | {
                id: string;
                course_id: string;
                topic_id: string | null;
                title: string;
                scheduled_at: string;
                duration_minutes: number;
                status: string;
                livekit_room: string;
              }[]
            | null;
          error: unknown;
        };

        if (sessionsData && sessionsData.length > 0) {
          const topicIds = Array.from(
            new Set(
              sessionsData
                .map((s) => s.topic_id)
                .filter((id): id is string => Boolean(id))
            )
          );

          const topicMap = new Map<string, string>();
          if (topicIds.length > 0) {
            const { data: topicsData } = (await supabase
              .from("topics")
              .select("id, title")
              .in("id", topicIds)) as {
              data: { id: string; title: string }[] | null;
              error: unknown;
            };

            if (topicsData) {
              topicsData.forEach((t) => topicMap.set(t.id, t.title));
            }
          }

          const courseTitleMap = new Map(courseCards.map((c) => [c.id, c.title]));

          const sessionCards: UpcomingSessionData[] = sessionsData.map((s) => ({
            id: s.id,
            title: s.title,
            scheduled_at: s.scheduled_at,
            duration_minutes: s.duration_minutes,
            status: s.status as "scheduled" | "live" | "ended",
            livekit_room: s.livekit_room,
            courseTitle: courseTitleMap.get(s.course_id) || "Enrolled Course",
            topicTitle: (s.topic_id && topicMap.get(s.topic_id)) || "General Topic",
          }));

          setUpcomingSessions(sessionCards);
        } else {
          setUpcomingSessions([]);
        }
      } catch (err) {
        console.error("Error loading student dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, [supabase, router]);

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* ─────────────────────────────────────────────────────────────
          1. GREETING
      ────────────────────────────────────────────────────────────── */}
      <section className="space-y-1">
        <p className="font-mono text-xs uppercase tracking-widest text-[#29d9ff]">
          STUDENT OVERVIEW
        </p>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white">
          {loading ? (
            <span className="inline-block w-64 h-9 bg-white/[0.06] rounded animate-pulse" />
          ) : (
            `Welcome back, ${firstName}!`
          )}
        </h1>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          2. STAT CARDS ROW (3 cards)
      ────────────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        {/* Card 1: Enrolled Courses */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-5 sm:p-6 transition-all hover:border-[#29d9ff]/20">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="font-mono text-xs uppercase tracking-wider text-slate-400">
              Enrolled Courses
            </span>
            <div className="w-8 h-8 rounded-full bg-[#29d9ff]/10 text-[#29d9ff] flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          {loading ? (
            <div className="h-8 w-16 bg-white/[0.06] rounded animate-pulse" />
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white tracking-tight">
                {stats.enrolledCoursesCount}
              </span>
              <span className="font-mono text-xs text-slate-500">active programs</span>
            </div>
          )}
        </div>

        {/* Card 2: Overall Attendance */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-5 sm:p-6 transition-all hover:border-[#29d9ff]/20">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="font-mono text-xs uppercase tracking-wider text-slate-400">
              Overall Attendance
            </span>
            <div className="w-8 h-8 rounded-full bg-emerald-400/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          {loading ? (
            <div className="h-8 w-20 bg-white/[0.06] rounded animate-pulse" />
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white tracking-tight">
                {stats.overallAttendancePercentage}%
              </span>
              <span className="font-mono text-xs text-emerald-400/80">≥75% threshold</span>
            </div>
          )}
        </div>

        {/* Card 3: Total Assessments Taken */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-5 sm:p-6 transition-all hover:border-[#29d9ff]/20">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="font-mono text-xs uppercase tracking-wider text-slate-400">
              Total Assessments Taken
            </span>
            <div className="w-8 h-8 rounded-full bg-purple-400/10 text-purple-400 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          {loading ? (
            <div className="h-8 w-16 bg-white/[0.06] rounded animate-pulse" />
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white tracking-tight">
                {stats.totalAssessmentsTaken}
              </span>
              <span className="font-mono text-xs text-slate-500">completed</span>
            </div>
          )}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. TWO COLUMNS (Desktop: Wide Left Courses, Narrow Right Stack)
             Mobile Reordering Order: Stats -> Quick Actions -> Upcoming Sessions -> Courses
      ────────────────────────────────────────────────────────────── */}
      <section className="flex flex-col lg:grid lg:grid-cols-12 gap-8 lg:gap-8 items-start">
        {/* ───────────────────────────────────────────────────────────
            LEFT COLUMN (Desktop Wide, Mobile 4th / Bottom)
            "My Courses"
        ──────────────────────────────────────────────────────────── */}
        <div className="w-full order-3 lg:order-1 lg:col-span-7 xl:col-span-8 space-y-6">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
            <div className="flex items-center gap-2.5">
              <GraduationCap className="w-5 h-5 text-[#29d9ff]" />
              <h2 className="text-xl font-bold text-white tracking-tight">My Courses</h2>
            </div>
            <span className="font-mono text-xs text-slate-400">
              {courses.length} {courses.length === 1 ? "Course" : "Courses"} Enrolled
            </span>
          </div>

          {loading ? (
            // Course skeletons
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-6 space-y-4 animate-pulse"
                >
                  <div className="h-5 w-2/3 bg-white/[0.06] rounded" />
                  <div className="h-4 w-1/3 bg-white/[0.04] rounded" />
                  <div className="h-2 w-full bg-white/[0.06] rounded" />
                </div>
              ))}
            </div>
          ) : courses.length > 0 ? (
            <div className="space-y-4">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-6 transition-all duration-200 hover:border-[#29d9ff]/30 group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <h3 className="text-lg font-bold text-white group-hover:text-[#29d9ff] transition-colors">
                        {course.title}
                      </h3>
                      <p className="text-xs font-mono text-slate-400">
                        Instructor: <span className="text-slate-200">{course.teacherName}</span>
                      </p>
                      {course.description && (
                        <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                          {course.description}
                        </p>
                      )}
                    </div>

                    <Link
                      href={`/student/courses/${course.id}`}
                      className="self-start inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#29d9ff]/10 hover:bg-[#29d9ff] text-[#29d9ff] hover:text-[#04060a] border border-[#29d9ff]/30 text-xs font-mono uppercase tracking-wider font-semibold transition-all duration-200 shadow-sm whitespace-nowrap"
                    >
                      <span>Continue</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  {/* Progress Bar with Percentage */}
                  <div className="mt-5 pt-4 border-t border-white/[0.06] space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400">Recording Progress</span>
                      <span className="text-[#29d9ff] font-bold">
                        {course.progressPercentage}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#29d9ff] to-[#00b0ff] rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${Math.min(100, Math.max(0, course.progressPercentage))}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                      <span>
                        {course.completedRecordings} of {course.totalReadyRecordings} ready lessons completed
                      </span>
                      {course.progressPercentage === 100 && (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Completed
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Empty state for courses
            <div className="rounded-2xl border border-white/[0.06] bg-[#070c18]/50 p-10 text-center space-y-3">
              <BookOpen className="w-10 h-10 text-slate-600 mx-auto" />
              <h3 className="text-base font-semibold text-white">No courses enrolled</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                You are not currently enrolled in any courses. Please contact your administrator to get enrolled in active modules.
              </p>
            </div>
          )}
        </div>

        {/* ───────────────────────────────────────────────────────────
            RIGHT COLUMN (Desktop Narrow Stack, Mobile 2nd & 3rd)
            Contains:
            1. Quick Actions Card (2x2 grid)
            2. Upcoming Sessions Card (next 5 sessions with Join live button)
        ──────────────────────────────────────────────────────────── */}
        <div className="w-full order-1 lg:order-2 lg:col-span-5 xl:col-span-4 space-y-6">
          {/* Quick Actions Card */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-white/[0.06] pb-3">
              <Layers className="w-4 h-4 text-[#29d9ff]" />
              <h3 className="text-sm font-bold uppercase tracking-wider font-mono text-white">
                Quick Actions
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Button 1: Virtual Classroom */}
              <Link
                href="/student/classroom"
                className="flex flex-col items-center justify-center text-center p-3.5 rounded-xl border border-white/[0.08] bg-[#04060a]/70 hover:bg-[#29d9ff]/10 hover:border-[#29d9ff]/40 transition-all duration-200 group"
              >
                <div className="w-8 h-8 rounded-lg bg-[#29d9ff]/10 text-[#29d9ff] group-hover:scale-110 flex items-center justify-center transition-transform mb-2">
                  <Video className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-slate-200 group-hover:text-white leading-tight">
                  Virtual Classroom
                </span>
                <span className="text-[10px] font-mono text-slate-500 mt-1">
                  Live Rooms
                </span>
              </Link>

              {/* Button 2: Program Calendar */}
              <Link
                href="/student/calendar"
                className="flex flex-col items-center justify-center text-center p-3.5 rounded-xl border border-white/[0.08] bg-[#04060a]/70 hover:bg-[#29d9ff]/10 hover:border-[#29d9ff]/40 transition-all duration-200 group"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-400/10 text-emerald-400 group-hover:scale-110 flex items-center justify-center transition-transform mb-2">
                  <Calendar className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-slate-200 group-hover:text-white leading-tight">
                  Program Calendar
                </span>
                <span className="text-[10px] font-mono text-slate-500 mt-1">
                  Schedules
                </span>
              </Link>

              {/* Button 3: Attendance Report */}
              <Link
                href="/student/attendance"
                className="flex flex-col items-center justify-center text-center p-3.5 rounded-xl border border-white/[0.08] bg-[#04060a]/70 hover:bg-[#29d9ff]/10 hover:border-[#29d9ff]/40 transition-all duration-200 group"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-400/10 text-amber-400 group-hover:scale-110 flex items-center justify-center transition-transform mb-2">
                  <Clock className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-slate-200 group-hover:text-white leading-tight">
                  Attendance Report
                </span>
                <span className="text-[10px] font-mono text-slate-500 mt-1">
                  Telemetry
                </span>
              </Link>

              {/* Button 4: Helpdesk */}
              <Link
                href="/student/helpdesk"
                className="flex flex-col items-center justify-center text-center p-3.5 rounded-xl border border-white/[0.08] bg-[#04060a]/70 hover:bg-[#29d9ff]/10 hover:border-[#29d9ff]/40 transition-all duration-200 group"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-400/10 text-purple-400 group-hover:scale-110 flex items-center justify-center transition-transform mb-2">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-slate-200 group-hover:text-white leading-tight">
                  Helpdesk
                </span>
                <span className="text-[10px] font-mono text-slate-500 mt-1">
                  Support Tickets
                </span>
              </Link>
            </div>
          </div>

          {/* Upcoming Sessions Card */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-[#29d9ff] animate-pulse" />
                <h3 className="text-sm font-bold uppercase tracking-wider font-mono text-white">
                  Upcoming Sessions
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-500">Next 5 classes</span>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-20 rounded-xl bg-white/[0.04] animate-pulse border border-white/[0.04]"
                  />
                ))}
              </div>
            ) : upcomingSessions.length > 0 ? (
              <div className="space-y-3">
                {upcomingSessions.map((session) => {
                  const isLive = session.status === "live";
                  const sessionDate = new Date(session.scheduled_at);
                  const formattedDate = sessionDate.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  });
                  const formattedTime = sessionDate.toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  });

                  return (
                    <div
                      key={session.id}
                      className={`p-3.5 rounded-xl border transition-all duration-200 ${
                        isLive
                          ? "bg-red-950/20 border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.15)]"
                          : "bg-[#04060a]/70 border-white/[0.06] hover:border-white/[0.15]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[10px] uppercase tracking-wider text-[#29d9ff] bg-[#29d9ff]/10 px-2 py-0.5 rounded-full border border-[#29d9ff]/20">
                              {session.topicTitle}
                            </span>
                            {isLive ? (
                              <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                                LIVE NOW
                              </span>
                            ) : (
                              <span className="font-mono text-[10px] text-slate-500">
                                {session.duration_minutes}m
                              </span>
                            )}
                          </div>

                          <h4 className="text-xs font-semibold text-white truncate">
                            {session.title}
                          </h4>

                          <p className="text-[11px] text-slate-400 truncate">
                            {session.courseTitle}
                          </p>

                          <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500 pt-0.5">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>
                              {formattedDate} • {formattedTime}
                            </span>
                          </div>
                        </div>

                        {/* Join Button: Enabled ONLY while session status is live */}
                        <div className="self-center">
                          {isLive ? (
                            <Link
                              href={`/student/classroom?room=${encodeURIComponent(
                                session.livekit_room
                              )}`}
                              className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-red-500 hover:bg-red-400 text-white text-xs font-mono uppercase tracking-wider font-bold shadow-[0_0_12px_rgba(239,68,68,0.5)] transition-all animate-pulse"
                            >
                              <Video className="w-3.5 h-3.5" />
                              <span>Join</span>
                            </Link>
                          ) : (
                            <button
                              type="button"
                              disabled
                              title="Session is scheduled. Join button enables when session goes live."
                              className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-white/[0.04] text-slate-500 border border-white/[0.06] text-xs font-mono uppercase tracking-wider cursor-not-allowed"
                            >
                              <span>Join</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              // Empty state for upcoming sessions
              <div className="rounded-xl border border-white/[0.06] bg-[#04060a]/50 p-6 text-center space-y-2">
                <Calendar className="w-6 h-6 text-slate-600 mx-auto" />
                <p className="text-xs font-semibold text-slate-300">No upcoming sessions</p>
                <p className="text-[11px] text-slate-500">
                  You have no scheduled live classes at this moment. Check back soon.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
