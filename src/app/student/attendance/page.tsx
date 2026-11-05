"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  ShieldCheck,
  XCircle,
  Layers,
  BookOpen,
} from "lucide-react";

interface CourseAttendanceSummary {
  courseId: string;
  courseTitle: string;
  teacherName: string;
  attendancePercentage: number;
  totalEndedSessions: number;
  sessionsAttended: number;
  isBelowThreshold: boolean;
  sessions: {
    sessionId: string;
    date: string;
    topicTitle: string;
    sessionTitle: string;
    status: "Present" | "Absent";
    minutesAttended: number;
    totalMinutes: number;
    percentage: number;
  }[];
}

export default function AttendanceReportPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [studentName, setStudentName] = useState("Student");
  const [studentCode, setStudentCode] = useState<string | null>(null);
  const [overallPercentage, setOverallPercentage] = useState<number>(100);
  const [coursesAttendance, setCoursesAttendance] = useState<CourseAttendanceSummary[]>([]);
  const [hasEnrollments, setHasEnrollments] = useState(true);

  useEffect(() => {
    async function fetchAttendanceReport() {
      try {
        setLoading(true);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        // 1. Fetch profile
        const { data: profile } = (await supabase
          .from("profiles")
          .select("full_name, student_id")
          .eq("id", user.id)
          .single()) as {
          data: { full_name?: string; student_id?: string | null } | null;
          error: unknown;
        };

        if (profile?.full_name) setStudentName(profile.full_name);
        if (profile?.student_id) setStudentCode(profile.student_id);

        // 2. Fetch student's course enrollments
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

        const teacherIds = Array.from(
          new Set((coursesData || []).map((c) => c.teacher_id).filter(Boolean))
        );

        // 4. Fetch teachers
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

        // 6. Fetch from course_attendance_percentage view
        const { data: viewData } = (await supabase
          .from("course_attendance_percentage")
          .select("course_id, attendance_percentage, sessions_attended, total_ended_sessions")
          .eq("student_id", user.id)) as {
          data:
            | {
                course_id: string;
                attendance_percentage: number;
                sessions_attended: number;
                total_ended_sessions: number;
              }[]
            | null;
          error: unknown;
        };

        const courseViewMap = new Map(
          (viewData || []).map((v) => [v.course_id, v])
        );

        // Compute overall attendance percentage
        let totalAttendedCount = 0;
        let totalEndedCount = 0;

        (viewData || []).forEach((v) => {
          totalAttendedCount += Number(v.sessions_attended) || 0;
          totalEndedCount += Number(v.total_ended_sessions) || 0;
        });

        const overall =
          totalEndedCount > 0
            ? Math.round((totalAttendedCount / totalEndedCount) * 100)
            : 100;

        setOverallPercentage(overall);

        // 7. Fetch all ended sessions for enrolled courses
        const { data: sessionsData } = (await supabase
          .from("live_sessions")
          .select("id, course_id, topic_id, title, scheduled_at, duration_minutes, started_at, ended_at, status")
          .in("course_id", courseIds)
          .eq("status", "ended")
          .order("scheduled_at", { ascending: false })) as {
          data:
            | {
                id: string;
                course_id: string;
                topic_id: string | null;
                title: string;
                scheduled_at: string;
                duration_minutes: number;
                started_at: string | null;
                ended_at: string | null;
                status: string;
              }[]
            | null;
          error: unknown;
        };

        const endedSessions = sessionsData || [];
        const sessionIds = endedSessions.map((s) => s.id);

        // 8. Fetch student attendance telemetry records
        const attendanceMap = new Map<string, number>();
        if (sessionIds.length > 0) {
          const { data: attendanceRows } = (await supabase
            .from("attendance")
            .select("session_id, total_seconds")
            .eq("user_id", user.id)
            .in("session_id", sessionIds)) as {
            data: { session_id: string; total_seconds: number }[] | null;
            error: unknown;
          };

          if (attendanceRows) {
            attendanceRows.forEach((row) => {
              const prev = attendanceMap.get(row.session_id) || 0;
              attendanceMap.set(row.session_id, prev + (Number(row.total_seconds) || 0));
            });
          }
        }

        // 9. Build course tables with session attendance rows (75% threshold rule)
        const summaryList: CourseAttendanceSummary[] = (coursesData || []).map((c) => {
          const viewInfo = courseViewMap.get(c.id);
          const courseEndedSessions = endedSessions.filter((s) => s.course_id === c.id);

          const courseSessions = courseEndedSessions.map((session) => {
            // Calculate effective duration in seconds
            let effectiveDurationSeconds = session.duration_minutes * 60;
            if (session.started_at && session.ended_at) {
              const diffSec =
                (new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 1000;
              if (diffSec > 0) {
                effectiveDurationSeconds = diffSec;
              }
            }

            const attendedSec = attendanceMap.get(session.id) || 0;
            const isPresent =
              effectiveDurationSeconds > 0 && attendedSec >= 0.75 * effectiveDurationSeconds;

            const minutesAttended = Math.round(attendedSec / 60);
            const totalMinutes = Math.round(effectiveDurationSeconds / 60);
            const pct =
              effectiveDurationSeconds > 0
                ? Math.min(100, Math.round((attendedSec / effectiveDurationSeconds) * 100))
                : 0;

            const dateStr = new Date(session.scheduled_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            });

            return {
              sessionId: session.id,
              date: dateStr,
              topicTitle: (session.topic_id && topicMap.get(session.topic_id)) || "Curriculum",
              sessionTitle: session.title,
              status: isPresent ? ("Present" as const) : ("Absent" as const),
              minutesAttended,
              totalMinutes,
              percentage: pct,
            };
          });

          const pctValue =
            viewInfo?.attendance_percentage !== undefined
              ? Number(viewInfo.attendance_percentage)
              : courseSessions.length > 0
              ? Math.round(
                  (courseSessions.filter((s) => s.status === "Present").length /
                    courseSessions.length) *
                    100
                )
              : 100;

          return {
            courseId: c.id,
            courseTitle: c.title,
            teacherName: teacherMap.get(c.teacher_id) || "Assigned Instructor",
            attendancePercentage: pctValue,
            totalEndedSessions: Number(viewInfo?.total_ended_sessions) || courseSessions.length,
            sessionsAttended:
              Number(viewInfo?.sessions_attended) ||
              courseSessions.filter((s) => s.status === "Present").length,
            isBelowThreshold: pctValue < 75,
            sessions: courseSessions,
          };
        });

        setCoursesAttendance(summaryList);
      } catch (err) {
        console.error("Error loading attendance report:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchAttendanceReport();
  }, [supabase, router]);

  // Client-Side CSV Export Function
  const handleDownloadCSV = () => {
    if (coursesAttendance.length === 0) return;

    const headers = [
      "Course Title",
      "Teacher",
      "Course Overall %",
      "Session Date",
      "Topic",
      "Session Title",
      "Attendance Status",
      "Minutes Attended",
      "Session Duration (Mins)",
      "Attendance Share %",
    ];

    const rows: string[][] = [];

    coursesAttendance.forEach((course) => {
      if (course.sessions.length === 0) {
        rows.push([
          `"${course.courseTitle.replace(/"/g, '""')}"`,
          `"${course.teacherName.replace(/"/g, '""')}"`,
          `"${course.attendancePercentage}%"`,
          "N/A",
          "N/A",
          "No ended sessions yet",
          "N/A",
          "0",
          "0",
          "N/A",
        ]);
      } else {
        course.sessions.forEach((sess) => {
          rows.push([
            `"${course.courseTitle.replace(/"/g, '""')}"`,
            `"${course.teacherName.replace(/"/g, '""')}"`,
            `"${course.attendancePercentage}%"`,
            `"${sess.date}"`,
            `"${sess.topicTitle.replace(/"/g, '""')}"`,
            `"${sess.sessionTitle.replace(/"/g, '""')}"`,
            sess.status,
            String(sess.minutesAttended),
            String(sess.totalMinutes),
            `"${sess.percentage}%"`,
          ]);
        });
      }
    });

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const dateStr = new Date().toISOString().split("T")[0];
    link.download = `Impara_Attendance_Report_${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const isOverallBelowThreshold = overallPercentage < 75;

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* ─────────────────────────────────────────────────────────────
          PAGE HEADER & ACTIONS
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
              TELEMETRY & COMPLIANCE
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Attendance Report
            </h1>
          </div>

          <button
            type="button"
            onClick={handleDownloadCSV}
            disabled={loading || coursesAttendance.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/[0.04] hover:bg-[#29d9ff]/10 hover:border-[#29d9ff]/40 hover:text-[#29d9ff] text-slate-300 font-mono text-xs uppercase tracking-wider transition-all self-start sm:self-auto disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV</span>
          </button>
        </div>
      </div>

      {loading ? (
        // Loading Skeleton
        <div className="space-y-6 animate-pulse">
          <div className="h-32 rounded-2xl bg-white/[0.04] border border-white/[0.06]" />
          <div className="h-64 rounded-2xl bg-white/[0.04] border border-white/[0.06]" />
        </div>
      ) : !hasEnrollments ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-10 sm:p-14 text-center space-y-4">
          <BookOpen className="w-10 h-10 text-slate-600 mx-auto" />
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white">No enrolled courses</h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              You are not currently enrolled in any courses. Attendance tracking begins when you attend live sessions.
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
        <div className="space-y-8">
          {/* ───────────────────────────────────────────────────────────
              TOP SUMMARY CARD: OVERALL ATTENDANCE PERCENTAGE
          ──────────────────────────────────────────────────────────── */}
          <div
            className={`rounded-2xl border p-6 sm:p-8 relative overflow-hidden transition-all ${
              isOverallBelowThreshold
                ? "border-amber-500/40 bg-gradient-to-br from-amber-950/20 via-[#070c18] to-[#070c18] shadow-[0_0_25px_rgba(251,191,36,0.15)]"
                : "border-white/[0.08] bg-[#070c18]"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#29d9ff]" />
                  <span className="font-mono text-xs uppercase tracking-widest text-slate-400">
                    PROGRAM VERIFICATION
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  Overall Verified Attendance
                </h2>
                <p className="text-xs text-slate-400 max-w-lg leading-relaxed">
                  Students must attend at least{" "}
                  <span className="text-white font-semibold">75% of actual class duration</span>{" "}
                  to be marked Present. Telemetry heartbeats are continuously recorded.
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div
                  className={`rounded-2xl border p-4 sm:p-5 text-center min-w-[130px] ${
                    isOverallBelowThreshold
                      ? "border-amber-400/40 bg-amber-400/10 text-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.2)]"
                      : "border-emerald-400/30 bg-emerald-400/10 text-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.15)]"
                  }`}
                >
                  <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                    AGGREGATE SCORE
                  </div>
                  <div className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-1">
                    {overallPercentage}%
                  </div>
                  <div className="text-[10px] font-mono mt-0.5">
                    {isOverallBelowThreshold ? "Below 75% Target" : "Verified In Good Standing"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────
              COURSE ATTENDANCE TABLES (One Table Per Enrolled Course)
          ──────────────────────────────────────────────────────────── */}
          <div className="space-y-8">
            {coursesAttendance.map((course) => (
              <div
                key={course.courseId}
                className={`rounded-2xl border overflow-hidden transition-all ${
                  course.isBelowThreshold
                    ? "border-amber-400/30 bg-[#070c18]"
                    : "border-white/[0.08] bg-[#070c18]"
                }`}
              >
                {/* Course Table Header */}
                <div
                  className={`p-5 sm:p-6 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    course.isBelowThreshold
                      ? "border-amber-400/20 bg-amber-400/[0.04]"
                      : "border-white/[0.06] bg-white/[0.02]"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs uppercase tracking-wider text-[#29d9ff]">
                        COURSE MODULE
                      </span>
                      {course.isBelowThreshold && (
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                          <AlertTriangle className="w-3 h-3" /> ATTENTION REQUIRED
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-white">
                      {course.courseTitle}
                    </h3>
                    <p className="font-mono text-xs text-slate-400">
                      Instructor: <span className="text-slate-300">{course.teacherName}</span>
                    </p>
                  </div>

                  {/* Course Percentage Highlight */}
                  <div className="flex items-center gap-3 self-start sm:self-center">
                    <div className="text-right">
                      <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                        Course Attendance
                      </div>
                      <div
                        className={`text-2xl font-bold font-mono ${
                          course.isBelowThreshold ? "text-amber-400" : "text-emerald-400"
                        }`}
                      >
                        {course.attendancePercentage}%
                      </div>
                    </div>

                    <div
                      className={`px-3 py-1.5 rounded-xl border text-xs font-mono uppercase tracking-wider font-semibold ${
                        course.isBelowThreshold
                          ? "bg-amber-400/10 border-amber-400/30 text-amber-400"
                          : "bg-emerald-400/10 border-emerald-400/30 text-emerald-400"
                      }`}
                    >
                      {course.sessionsAttended} / {course.totalEndedSessions} Attended
                    </div>
                  </div>
                </div>

                {/* Table of Sessions */}
                <div className="overflow-x-auto">
                  {course.sessions.length > 0 ? (
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b border-white/[0.06] bg-white/[0.01] font-mono text-[11px] uppercase tracking-wider text-slate-400">
                          <th className="py-3 px-5 sm:px-6">Date</th>
                          <th className="py-3 px-5 sm:px-6">Topic & Session</th>
                          <th className="py-3 px-5 sm:px-6 text-center">Status</th>
                          <th className="py-3 px-5 sm:px-6 text-right">Minutes Attended</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {course.sessions.map((sess) => (
                          <tr
                            key={sess.sessionId}
                            className="hover:bg-white/[0.02] transition-colors"
                          >
                            {/* Date */}
                            <td className="py-3.5 px-5 sm:px-6 font-mono text-slate-300 whitespace-nowrap">
                              {sess.date}
                            </td>

                            {/* Topic & Session */}
                            <td className="py-3.5 px-5 sm:px-6 max-w-xs sm:max-w-md">
                              <span className="font-mono text-[10px] uppercase tracking-wider text-[#29d9ff] bg-[#29d9ff]/10 px-2 py-0.5 rounded border border-[#29d9ff]/20 mr-2">
                                {sess.topicTitle}
                              </span>
                              <span className="text-white font-medium">{sess.sessionTitle}</span>
                            </td>

                            {/* Status (Present / Absent) */}
                            <td className="py-3.5 px-5 sm:px-6 text-center whitespace-nowrap">
                              {sess.status === "Present" ? (
                                <span className="inline-flex items-center gap-1.5 font-mono text-xs text-emerald-400 bg-emerald-400/10 px-2.5 py-0.5 rounded-full border border-emerald-400/20">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Present</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 font-mono text-xs text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/20">
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Absent</span>
                                </span>
                              )}
                            </td>

                            {/* Minutes Attended */}
                            <td className="py-3.5 px-5 sm:px-6 text-right font-mono whitespace-nowrap">
                              <span className="text-slate-200 font-semibold">
                                {sess.minutesAttended}
                              </span>
                              <span className="text-slate-500"> / {sess.totalMinutes} mins</span>
                              <span className="text-xs text-slate-400 ml-2">
                                ({sess.percentage}%)
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-8 text-center space-y-1">
                      <Clock className="w-6 h-6 text-slate-600 mx-auto" />
                      <p className="text-xs font-semibold text-slate-300">
                        No ended sessions for this course yet
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Attendance will appear here after class sessions conclude.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
