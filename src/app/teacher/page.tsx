"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getFirstName } from "@/lib/utils";
import {
  BookOpen,
  Calendar,
  CheckCircle,
  Clock,
  Film,
  HelpCircle,
  Layers,
  Play,
  Plus,
  Radio,
  Star,
  Users,
  Video,
  ArrowRight,
} from "lucide-react";

interface TeacherCourseCard {
  id: string;
  title: string;
  description: string | null;
  enrolledStudentsCount: number;
  averageAttendancePct: number | null;
  averageRating: number | null;
  ratingsCount: number;
}

interface UpcomingTeacherSession {
  id: string;
  course_id: string;
  topic_id: string | null;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  status: "live" | "scheduled" | "ended";
  courseTitle: string;
  topicTitle: string;
}

export default function TeacherDashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState("Instructor");
  const [stats, setStats] = useState({
    coursesCount: 0,
    overallAttendancePercentage: null as number | null,
    averageRating: null as number | null,
    totalRatingsCount: 0,
    recordingsCount: 0,
  });
  const [courses, setCourses] = useState<TeacherCourseCard[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<UpcomingTeacherSession[]>([]);

  useEffect(() => {
    async function loadTeacherDashboard() {
      try {
        setLoading(true);

        // 1. Authenticate user
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/staff");
          return;
        }

        // 2. Fetch profile
        const { data: profile } = (await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single()) as { data: { full_name?: string } | null; error: unknown };

        const fullName = profile?.full_name?.trim() || "";
        const fName = getFirstName(fullName || user.email?.split("@")[0], "Instructor");
        setFirstName(fName);

        // 3. Fetch courses where teacher_id = user.id
        const { data: coursesData } = (await supabase
          .from("courses")
          .select("id, title, description")
          .eq("teacher_id", user.id)) as {
          data: { id: string; title: string; description: string | null }[] | null;
          error: unknown;
        };

        const teacherCourses = coursesData || [];
        const courseIds = teacherCourses.map((c) => c.id);

        if (courseIds.length === 0) {
          setCourses([]);
          setUpcomingSessions([]);
          setStats({
            coursesCount: 0,
            overallAttendancePercentage: null,
            averageRating: null,
            totalRatingsCount: 0,
            recordingsCount: 0,
          });
          setLoading(false);
          return;
        }

        // 4. Fetch enrollments for teacher's courses
        const { data: enrollmentsData } = (await supabase
          .from("enrollments")
          .select("course_id, student_id")
          .in("course_id", courseIds)) as {
          data: { course_id: string; student_id: string }[] | null;
          error: unknown;
        };

        const courseEnrollmentMap = new Map<string, number>();
        (enrollmentsData || []).forEach((e) => {
          const count = courseEnrollmentMap.get(e.course_id) || 0;
          courseEnrollmentMap.set(e.course_id, count + 1);
        });

        // 5. Fetch all sessions for teacher
        const { data: allSessionsData } = (await supabase
          .from("live_sessions")
          .select("id, course_id, topic_id, title, scheduled_at, duration_minutes, started_at, ended_at, status")
          .eq("teacher_id", user.id)
          .order("scheduled_at", { ascending: true })) as {
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
                status: "live" | "scheduled" | "ended";
              }[]
            | null;
          error: unknown;
        };

        const allSessions = allSessionsData || [];
        const endedSessions = allSessions.filter((s) => s.status === "ended");
        const endedSessionIds = endedSessions.map((s) => s.id);

        // 6. Fetch attendance for ended sessions
        const sessionAttendanceCounts = new Map<string, number>(); // sessionId -> count of present students
        if (endedSessionIds.length > 0) {
          const { data: attendanceRows } = (await supabase
            .from("attendance")
            .select("session_id, user_id, total_seconds")
            .in("session_id", endedSessionIds)) as {
            data: { session_id: string; user_id: string; total_seconds: number }[] | null;
            error: unknown;
          };

          const sessionMap = new Map(endedSessions.map((s) => [s.id, s]));

          // Group attended seconds per user per session
          const userSessionSeconds = new Map<string, number>();
          (attendanceRows || []).forEach((r) => {
            const key = `${r.session_id}_${r.user_id}`;
            userSessionSeconds.set(key, (userSessionSeconds.get(key) || 0) + (Number(r.total_seconds) || 0));
          });

          userSessionSeconds.forEach((totalSec, key) => {
            const [sessId] = key.split("_");
            const sess = sessionMap.get(sessId);
            if (!sess) return;

            let effectiveDuration = sess.duration_minutes * 60;
            if (sess.started_at && sess.ended_at) {
              const diffSec = (new Date(sess.ended_at).getTime() - new Date(sess.started_at).getTime()) / 1000;
              if (diffSec > 0) effectiveDuration = diffSec;
            }

            if (effectiveDuration > 0 && totalSec >= 0.75 * effectiveDuration) {
              const presentCount = sessionAttendanceCounts.get(sessId) || 0;
              sessionAttendanceCounts.set(sessId, presentCount + 1);
            }
          });
        }

        // Calculate attendance per course
        const courseAttendanceMap = new Map<string, number | null>();
        let overallAttendedTotal = 0;
        let overallPossibleTotal = 0;

        teacherCourses.forEach((course) => {
          const courseEnded = endedSessions.filter((s) => s.course_id === course.id);
          const enrolledCount = courseEnrollmentMap.get(course.id) || 0;

          if (courseEnded.length === 0 || enrolledCount === 0) {
            courseAttendanceMap.set(course.id, null);
          } else {
            let coursePresentSum = 0;
            courseEnded.forEach((s) => {
              coursePresentSum += sessionAttendanceCounts.get(s.id) || 0;
            });
            const totalPossible = courseEnded.length * enrolledCount;
            const pct = totalPossible > 0 ? Math.round((coursePresentSum / totalPossible) * 100) : null;
            courseAttendanceMap.set(course.id, pct);

            overallAttendedTotal += coursePresentSum;
            overallPossibleTotal += totalPossible;
          }
        });

        const overallAttendance =
          overallPossibleTotal > 0
            ? Math.round((overallAttendedTotal / overallPossibleTotal) * 100)
            : null;

        // 7. Fetch ratings for teacher's sessions
        const allSessionIds = allSessions.map((s) => s.id);
        const { data: ratingsData } = (await supabase
          .from("class_ratings")
          .select("session_id, stars")
          .in("session_id", allSessionIds.length ? allSessionIds : ["00000000-0000-0000-0000-000000000000"])) as {
          data: { session_id: string; stars: number }[] | null;
          error: unknown;
        };

        const sessionToCourseMap = new Map(allSessions.map((s) => [s.id, s.course_id]));
        const courseRatingsMap = new Map<string, { sum: number; count: number }>();

        let totalStarsSum = 0;
        let totalRatingsCount = 0;

        (ratingsData || []).forEach((r) => {
          totalStarsSum += r.stars;
          totalRatingsCount += 1;

          const cId = sessionToCourseMap.get(r.session_id);
          if (cId) {
            const curr = courseRatingsMap.get(cId) || { sum: 0, count: 0 };
            courseRatingsMap.set(cId, { sum: curr.sum + r.stars, count: curr.count + 1 });
          }
        });

        const overallAvgRating =
          totalRatingsCount > 0 ? Number((totalStarsSum / totalRatingsCount).toFixed(1)) : null;

        // 8. Fetch recordings count for teacher's courses
        const { count: recordingsCount } = await supabase
          .from("recordings")
          .select("id", { count: "exact", head: true })
          .in("course_id", courseIds);

        setStats({
          coursesCount: teacherCourses.length,
          overallAttendancePercentage: overallAttendance,
          averageRating: overallAvgRating,
          totalRatingsCount,
          recordingsCount: recordingsCount || 0,
        });

        // 9. Build course cards
        const courseCards: TeacherCourseCard[] = teacherCourses.map((c) => {
          const ratingInfo = courseRatingsMap.get(c.id);
          const avgRating =
            ratingInfo && ratingInfo.count > 0
              ? Number((ratingInfo.sum / ratingInfo.count).toFixed(1))
              : null;

          return {
            id: c.id,
            title: c.title,
            description: c.description,
            enrolledStudentsCount: courseEnrollmentMap.get(c.id) || 0,
            averageAttendancePct: courseAttendanceMap.get(c.id) ?? null,
            averageRating: avgRating,
            ratingsCount: ratingInfo?.count || 0,
          };
        });
        setCourses(courseCards);

        // 10. Fetch upcoming 5 sessions
        const upcomingFiltered = allSessions
          .filter((s) => s.status === "scheduled" || s.status === "live")
          .slice(0, 5);

        // Topics for upcoming sessions
        const topicIds = Array.from(
          new Set(upcomingFiltered.map((s) => s.topic_id).filter(Boolean))
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

        const courseTitleMap = new Map(teacherCourses.map((c) => [c.id, c.title]));

        const upcomingCards: UpcomingTeacherSession[] = upcomingFiltered.map((s) => ({
          id: s.id,
          course_id: s.course_id,
          topic_id: s.topic_id,
          title: s.title,
          scheduled_at: s.scheduled_at,
          duration_minutes: s.duration_minutes,
          status: s.status,
          courseTitle: courseTitleMap.get(s.course_id) || "Assigned Course",
          topicTitle: (s.topic_id && topicMap.get(s.topic_id)) || "General Curriculum",
        }));

        setUpcomingSessions(upcomingCards);
      } catch (err) {
        console.error("Failed to load teacher dashboard data", err);
      } finally {
        setLoading(false);
      }
    }

    loadTeacherDashboard();
  }, [router, supabase]);

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* ─────────────────────────────────────────────────────────────
          1. GREETING
      ────────────────────────────────────────────────────────────── */}
      <section className="space-y-1">
        <p className="font-mono text-xs uppercase tracking-widest text-[#29d9ff]">
          INSTRUCTOR WORKSPACE
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
          2. FOUR STAT CARDS
      ────────────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Card 1: My Courses */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-5 sm:p-6 transition-all hover:border-[#29d9ff]/20">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="font-mono text-xs uppercase tracking-wider text-slate-400">
              My Courses
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
                {stats.coursesCount}
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
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                stats.overallAttendancePercentage !== null
                  ? stats.overallAttendancePercentage >= 75
                    ? "bg-emerald-400/10 text-emerald-400"
                    : "bg-amber-400/10 text-amber-400"
                  : "bg-white/[0.05] text-slate-500"
              }`}
            >
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          {loading ? (
            <div className="h-8 w-20 bg-white/[0.06] rounded animate-pulse" />
          ) : stats.overallAttendancePercentage !== null ? (
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white tracking-tight">
                {stats.overallAttendancePercentage}%
              </span>
              <span
                className={`font-mono text-xs ${
                  stats.overallAttendancePercentage >= 75
                    ? "text-emerald-400/80"
                    : "text-amber-400/80"
                }`}
              >
                {stats.overallAttendancePercentage >= 75 ? "≥75% verified" : "Below 75% target"}
              </span>
            </div>
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white tracking-tight">—</span>
              <span className="font-mono text-xs text-slate-500">No classes yet</span>
            </div>
          )}
        </div>

        {/* Card 3: Average Class Rating */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-5 sm:p-6 transition-all hover:border-[#29d9ff]/20">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="font-mono text-xs uppercase tracking-wider text-slate-400">
              Average Class Rating
            </span>
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                stats.averageRating !== null
                  ? "bg-amber-400/10 text-amber-400"
                  : "bg-white/[0.05] text-slate-500"
              }`}
            >
              <Star className="w-4 h-4 fill-current" />
            </div>
          </div>
          {loading ? (
            <div className="h-8 w-24 bg-white/[0.06] rounded animate-pulse" />
          ) : stats.averageRating !== null ? (
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white tracking-tight">
                {stats.averageRating} ★
              </span>
              <span className="font-mono text-xs text-slate-500">
                {stats.totalRatingsCount} {stats.totalRatingsCount === 1 ? "rating" : "ratings"}
              </span>
            </div>
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white tracking-tight">—</span>
              <span className="font-mono text-xs text-slate-500">No ratings yet</span>
            </div>
          )}
        </div>

        {/* Card 4: Recordings */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-5 sm:p-6 transition-all hover:border-[#29d9ff]/20">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="font-mono text-xs uppercase tracking-wider text-slate-400">
              Recordings
            </span>
            <div className="w-8 h-8 rounded-full bg-purple-400/10 text-purple-400 flex items-center justify-center">
              <Film className="w-4 h-4" />
            </div>
          </div>
          {loading ? (
            <div className="h-8 w-16 bg-white/[0.06] rounded animate-pulse" />
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white tracking-tight">
                {stats.recordingsCount}
              </span>
              <span className="font-mono text-xs text-slate-500">archived</span>
            </div>
          )}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. TWO COLUMNS (Desktop: Wide Left Courses, Narrow Right Stack)
             Mobile Reordering: Stats -> Quick Actions -> Upcoming Sessions -> Courses
      ────────────────────────────────────────────────────────────── */}
      <section className="flex flex-col lg:grid lg:grid-cols-12 gap-8 items-start">
        {/* ───────────────────────────────────────────────────────────
            LEFT COLUMN (Desktop Wide, Mobile 4th / Bottom)
            "My Courses"
        ──────────────────────────────────────────────────────────── */}
        <div className="w-full order-3 lg:order-1 lg:col-span-7 xl:col-span-8 space-y-6">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
            <div className="flex items-center gap-2.5">
              <BookOpen className="w-5 h-5 text-[#29d9ff]" />
              <h2 className="text-xl font-bold text-white tracking-tight">My Courses</h2>
            </div>
            <span className="font-mono text-xs text-slate-400">
              {courses.length} {courses.length === 1 ? "Course" : "Courses"} Managed
            </span>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-6 space-y-4 animate-pulse"
                >
                  <div className="h-6 w-2/3 bg-white/[0.06] rounded" />
                  <div className="h-4 w-1/3 bg-white/[0.04] rounded" />
                  <div className="h-10 w-full bg-white/[0.04] rounded" />
                </div>
              ))}
            </div>
          ) : courses.length > 0 ? (
            <div className="space-y-4">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-6 space-y-5 transition-all duration-200 hover:border-[#29d9ff]/30 group"
                >
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-white group-hover:text-[#29d9ff] transition-colors">
                      {course.title}
                    </h3>
                    {course.description && (
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {course.description}
                      </p>
                    )}
                  </div>

                  {/* Course Metrics */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-4 p-3 rounded-xl bg-[#04060a]/70 border border-white/[0.06] text-center font-mono">
                    <div>
                      <div className="text-[10px] uppercase text-slate-500">Enrolled</div>
                      <div className="text-sm sm:text-base font-bold text-white mt-0.5">
                        {course.enrolledStudentsCount}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-slate-500">Attendance</div>
                      <div className="text-sm sm:text-base font-bold mt-0.5">
                        {course.averageAttendancePct !== null ? (
                          <span
                            className={
                              course.averageAttendancePct >= 75
                                ? "text-emerald-400"
                                : "text-amber-400"
                            }
                          >
                            {course.averageAttendancePct}%
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">
                            — <span className="text-[10px] text-slate-500 font-mono">No classes yet</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-slate-500">Avg Rating</div>
                      <div className="text-sm sm:text-base font-bold mt-0.5">
                        {course.averageRating !== null ? (
                          <span className="text-amber-400">{course.averageRating} ★</span>
                        ) : (
                          <span className="text-slate-400 font-normal">
                            — <span className="text-[10px] text-slate-500 font-mono">No ratings yet</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Two Buttons: Open & Host class */}
                  <div className="pt-2 flex items-center justify-between gap-3 border-t border-white/[0.06]">
                    <Link
                      href={`/teacher/courses/${course.id}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-white/10 hover:border-white/20 bg-white/[0.03] hover:bg-white/[0.08] font-mono text-xs uppercase tracking-wider text-slate-200 hover:text-white transition-all"
                    >
                      <span>Open Course</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>

                    <Link
                      href={`/teacher/host?course=${course.id}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#29d9ff]/10 hover:bg-[#29d9ff] text-[#29d9ff] hover:text-[#04060a] border border-[#29d9ff]/30 font-mono text-xs uppercase tracking-wider font-bold transition-all shadow-sm"
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>Host Class</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.06] bg-[#070c18]/50 p-10 text-center space-y-3">
              <BookOpen className="w-10 h-10 text-slate-600 mx-auto" />
              <h3 className="text-base font-semibold text-white">No courses assigned</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                You do not have any courses assigned to your instructor account yet. Please contact an administrator.
              </p>
            </div>
          )}
        </div>

        {/* ───────────────────────────────────────────────────────────
            RIGHT COLUMN (Desktop Narrow Stack, Mobile 2nd & 3rd)
            Contains:
            1. Quick Actions (2x3 grid)
            2. Upcoming Sessions (next 5 sessions with Start class button)
        ──────────────────────────────────────────────────────────── */}
        <div className="w-full order-1 lg:order-2 lg:col-span-5 xl:col-span-4 space-y-6">
          {/* Quick Actions (2x3 Grid) */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-white/[0.06] pb-3">
              <Layers className="w-4 h-4 text-[#29d9ff]" />
              <h3 className="text-sm font-bold uppercase tracking-wider font-mono text-white">
                Quick Actions
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* 1. Host Class Now */}
              <Link
                href="/teacher/host"
                className="flex flex-col items-center justify-center text-center p-3.5 rounded-xl border border-white/[0.08] bg-[#04060a]/70 hover:bg-[#29d9ff]/10 hover:border-[#29d9ff]/40 transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 group-hover:scale-110 flex items-center justify-center transition-transform mb-2">
                  <Radio className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-slate-200 group-hover:text-white leading-tight">
                  Host Class Now
                </span>
                <span className="text-[10px] font-mono text-slate-500 mt-1">Go Live</span>
              </Link>

              {/* 2. Schedule Class */}
              <Link
                href="/teacher/schedule"
                className="flex flex-col items-center justify-center text-center p-3.5 rounded-xl border border-white/[0.08] bg-[#04060a]/70 hover:bg-[#29d9ff]/10 hover:border-[#29d9ff]/40 transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-[#29d9ff]/10 text-[#29d9ff] group-hover:scale-110 flex items-center justify-center transition-transform mb-2">
                  <Calendar className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-slate-200 group-hover:text-white leading-tight">
                  Schedule Class
                </span>
                <span className="text-[10px] font-mono text-slate-500 mt-1">New Session</span>
              </Link>

              {/* 3. Attendance Reports */}
              <Link
                href="/teacher/attendance"
                className="flex flex-col items-center justify-center text-center p-3.5 rounded-xl border border-white/[0.08] bg-[#04060a]/70 hover:bg-[#29d9ff]/10 hover:border-[#29d9ff]/40 transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-400/10 text-emerald-400 group-hover:scale-110 flex items-center justify-center transition-transform mb-2">
                  <Clock className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-slate-200 group-hover:text-white leading-tight">
                  Attendance
                </span>
                <span className="text-[10px] font-mono text-slate-500 mt-1">Telemetry</span>
              </Link>

              {/* 4. Class Ratings */}
              <Link
                href="/teacher/ratings"
                className="flex flex-col items-center justify-center text-center p-3.5 rounded-xl border border-white/[0.08] bg-[#04060a]/70 hover:bg-[#29d9ff]/10 hover:border-[#29d9ff]/40 transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-400/10 text-amber-400 group-hover:scale-110 flex items-center justify-center transition-transform mb-2">
                  <Star className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-slate-200 group-hover:text-white leading-tight">
                  Class Ratings
                </span>
                <span className="text-[10px] font-mono text-slate-500 mt-1">Feedback</span>
              </Link>

              {/* 5. Recordings */}
              <Link
                href="/teacher/recordings"
                className="flex flex-col items-center justify-center text-center p-3.5 rounded-xl border border-white/[0.08] bg-[#04060a]/70 hover:bg-[#29d9ff]/10 hover:border-[#29d9ff]/40 transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-400/10 text-purple-400 group-hover:scale-110 flex items-center justify-center transition-transform mb-2">
                  <Film className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-slate-200 group-hover:text-white leading-tight">
                  Recordings
                </span>
                <span className="text-[10px] font-mono text-slate-500 mt-1">Archives</span>
              </Link>

              {/* 6. Helpdesk */}
              <Link
                href="/teacher/helpdesk"
                className="flex flex-col items-center justify-center text-center p-3.5 rounded-xl border border-white/[0.08] bg-[#04060a]/70 hover:bg-[#29d9ff]/10 hover:border-[#29d9ff]/40 transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-cyan-400/10 text-cyan-400 group-hover:scale-110 flex items-center justify-center transition-transform mb-2">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-slate-200 group-hover:text-white leading-tight">
                  Helpdesk
                </span>
                <span className="text-[10px] font-mono text-slate-500 mt-1">Support</span>
              </Link>
            </div>
          </div>

          {/* Upcoming Sessions Card */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#29d9ff]" />
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
                                LIVE
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

                        {/* "Start class" button */}
                        <div className="self-center">
                          <Link
                            href={`/teacher/host?session=${session.id}`}
                            className={`inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full font-mono text-xs uppercase tracking-wider font-bold transition-all ${
                              isLive
                                ? "bg-red-500 hover:bg-red-400 text-white shadow-[0_0_12px_rgba(239,68,68,0.5)] animate-pulse"
                                : "bg-[#29d9ff] hover:bg-[#6be4ff] text-[#04060a] shadow-[0_0_12px_rgba(41,217,255,0.3)]"
                            }`}
                          >
                            <Video className="w-3.5 h-3.5" />
                            <span>{isLive ? "In Room" : "Start"}</span>
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-white/[0.06] bg-[#04060a]/50 p-6 text-center space-y-2">
                <Calendar className="w-6 h-6 text-slate-600 mx-auto" />
                <p className="text-xs font-semibold text-slate-300">No upcoming sessions</p>
                <p className="text-[11px] text-slate-500">
                  Use the Schedule Class action to schedule your next lecture.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
