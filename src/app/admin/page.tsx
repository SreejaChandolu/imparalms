"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getFirstNameAndInitial } from "@/lib/utils";
import {
  Users,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Star,
  LifeBuoy,
  Radio,
  ShieldAlert,
  ArrowRight,
  UserPlus,
  Shield,
  BarChart3,
  MessageSquare,
  ChevronRight,
  AlertTriangle,
  PlayCircle,
} from "lucide-react";

interface AdminProfile {
  id: string;
  full_name: string;
  role: string;
}

interface LiveSessionItem {
  id: string;
  course_id: string;
  teacher_id: string;
  title: string;
  status: "scheduled" | "live" | "ended";
  scheduled_at: string;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number;
}

interface SecurityAlertItem {
  id: string;
  user_id: string | null;
  event: string;
  created_at: string;
  userName: string;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);

  // Platform Metrics
  const [totalUsersCount, setTotalUsersCount] = useState<number>(0);
  const [activeCoursesCount, setActiveCoursesCount] = useState<number>(0);
  const [classesHeld30Days, setClassesHeld30Days] = useState<number>(0);
  const [platformAttendancePct, setPlatformAttendancePct] = useState<number | null>(null);
  const [platformRatingAvg, setPlatformRatingAvg] = useState<number | null>(null);
  const [openTicketsCount, setOpenTicketsCount] = useState<number>(0);

  // Live and Upcoming Sessions
  const [liveSessions, setLiveSessions] = useState<
    Array<{
      id: string;
      title: string;
      courseTitle: string;
      teacherName: string;
      startedAt: string | null;
    }>
  >([]);

  const [upcomingSessions, setUpcomingSessions] = useState<
    Array<{
      id: string;
      title: string;
      courseTitle: string;
      teacherName: string;
      scheduledAt: string;
      durationMinutes: number;
    }>
  >([]);

  // Security Events
  const [securityAlerts, setSecurityAlerts] = useState<SecurityAlertItem[]>([]);

  useEffect(() => {
    async function loadAdminDashboard() {
      try {
        setLoading(true);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/staff");
          return;
        }

        // 1. Fetch Admin Profile
        const { data: prof } = await supabase
          .from("profiles")
          .select("id, full_name, role")
          .eq("id", user.id)
          .single();

        if (prof) {
          setAdminProfile(prof as AdminProfile);
        }

        // 2. Fetch all profiles for user count and name resolution
        const { data: allProfilesData } = await supabase
          .from("profiles")
          .select("id, full_name, role");

        const allProfiles: any[] = (allProfilesData as any[]) || [];
        setTotalUsersCount(allProfiles.length);

        const profileNameMap = new Map<string, string>();
        allProfiles.forEach((p: any) => {
          profileNameMap.set(p.id, p.full_name || "User");
        });

        // 3. Fetch courses
        const { data: coursesData } = await supabase
          .from("courses")
          .select("id, title, ends_on, teacher_id");

        const coursesList: any[] = (coursesData as any[]) || [];
        const courseMap = new Map<string, { title: string; teacher_id: string }>();
        const todayStr = new Date().toISOString().slice(0, 10);

        let activeCourses = 0;
        coursesList.forEach((c: any) => {
          courseMap.set(c.id, { title: c.title, teacher_id: c.teacher_id });
          if (!c.ends_on || c.ends_on >= todayStr) {
            activeCourses += 1;
          }
        });
        setActiveCoursesCount(activeCourses);

        // 4. Fetch live_sessions across platform
        const { data: sessionsData } = await supabase
          .from("live_sessions")
          .select("id, course_id, teacher_id, title, status, scheduled_at, started_at, ended_at, duration_minutes")
          .order("scheduled_at", { ascending: true });

        const rawSessions: LiveSessionItem[] = (sessionsData as any[]) || [];

        // Compute Classes Held (last 30 days)
        const nowMs = Date.now();
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        const endedSessions = rawSessions.filter((s) => s.status === "ended");

        const endedLast30 = endedSessions.filter((s) => {
          const sTime = new Date(s.started_at || s.scheduled_at).getTime();
          return nowMs - sTime <= thirtyDaysMs;
        });
        setClassesHeld30Days(endedLast30.length);

        // Live sessions right now
        const currentLive = rawSessions.filter((s) => s.status === "live");
        setLiveSessions(
          currentLive.map((s) => {
            const courseInfo = courseMap.get(s.course_id);
            const teacherId = s.teacher_id || courseInfo?.teacher_id || "";
            return {
              id: s.id,
              title: s.title,
              courseTitle: courseInfo?.title || "Course",
              teacherName: profileNameMap.get(teacherId) || "Instructor",
              startedAt: s.started_at,
            };
          })
        );

        // Next 5 upcoming scheduled sessions
        const upcoming = rawSessions
          .filter((s) => s.status === "scheduled")
          .filter((s) => new Date(s.scheduled_at).getTime() >= nowMs - 2 * 60 * 60 * 1000)
          .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
          .slice(0, 5);

        setUpcomingSessions(
          upcoming.map((s) => {
            const courseInfo = courseMap.get(s.course_id);
            const teacherId = s.teacher_id || courseInfo?.teacher_id || "";
            return {
              id: s.id,
              title: s.title,
              courseTitle: courseInfo?.title || "Course",
              teacherName: profileNameMap.get(teacherId) || "Instructor",
              scheduledAt: s.scheduled_at,
              durationMinutes: s.duration_minutes || 60,
            };
          })
        );

        // 5. Compute Platform Attendance (75% rule)
        if (endedSessions.length > 0) {
          const endedSessionIds = endedSessions.map((s) => s.id);
          const { data: attData } = await supabase
            .from("attendance")
            .select("session_id, user_id, total_seconds")
            .in("session_id", endedSessionIds);

          const { data: enrollmentsData } = await supabase
            .from("enrollments")
            .select("course_id, student_id");

          // Course enrolled counts
          const courseEnrolledMap = new Map<string, number>();
          ((enrollmentsData as any[]) || []).forEach((e: any) => {
            courseEnrolledMap.set(e.course_id, (courseEnrolledMap.get(e.course_id) || 0) + 1);
          });

          // Session durations map
          const sessionDurMap = new Map<string, number>();
          endedSessions.forEach((s) => {
            let effSec = (s.duration_minutes || 60) * 60;
            if (s.started_at && s.ended_at) {
              const diff = (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000;
              if (diff > 0) effSec = Math.round(diff);
            }
            sessionDurMap.set(s.id, effSec);
          });

          // Aggregate student seconds per session
          const userSessionSecMap = new Map<string, number>();
          ((attData as any[]) || []).forEach((r: any) => {
            const key = `${r.session_id}_${r.user_id}`;
            userSessionSecMap.set(key, (userSessionSecMap.get(key) || 0) + (Number(r.total_seconds) || 0));
          });

          // Count verified present
          const sessionPresentCounts = new Map<string, number>();
          userSessionSecMap.forEach((totalSec, key) => {
            const [sessId] = key.split("_");
            const effSec = sessionDurMap.get(sessId) || 3600;
            if (effSec > 0 && totalSec >= 0.75 * effSec) {
              sessionPresentCounts.set(sessId, (sessionPresentCounts.get(sessId) || 0) + 1);
            }
          });

          let totalPossible = 0;
          let totalPresent = 0;
          endedSessions.forEach((s) => {
            const enrolled = courseEnrolledMap.get(s.course_id) || 0;
            const present = sessionPresentCounts.get(s.id) || 0;
            totalPossible += enrolled;
            totalPresent += present;
          });

          const avgPct = totalPossible > 0 ? Math.round((totalPresent / totalPossible) * 100) : null;
          setPlatformAttendancePct(avgPct);
        } else {
          setPlatformAttendancePct(null);
        }

        // 6. Platform Rating Average
        const { data: ratingsData } = await supabase
          .from("class_ratings")
          .select("stars");

        const rawRatings: any[] = (ratingsData as any[]) || [];
        if (rawRatings.length > 0) {
          const sumStars = rawRatings.reduce((acc: number, r: any) => acc + (r.stars || 0), 0);
          setPlatformRatingAvg(Number((sumStars / rawRatings.length).toFixed(1)));
        } else {
          setPlatformRatingAvg(null);
        }

        // 7. Open Helpdesk Tickets Count
        const { count: openTickets } = await supabase
          .from("help_tickets")
          .select("id", { count: "exact", head: true })
          .eq("status", "open");

        setOpenTicketsCount(openTickets || 0);

        // 8. Recent Security Alerts (latest 10)
        const { data: securityData } = await supabase
          .from("security_events")
          .select("id, user_id, event, created_at")
          .order("created_at", { ascending: false })
          .limit(10);

        const alerts: SecurityAlertItem[] = ((securityData as any[]) || []).map((sec: any) => ({
          id: sec.id,
          user_id: sec.user_id,
          event: sec.event,
          created_at: sec.created_at,
          userName: sec.user_id ? profileNameMap.get(sec.user_id) || "System User" : "Anonymous / System",
        }));
        setSecurityAlerts(alerts);
      } catch (err) {
        console.error("Error loading admin dashboard metrics:", err);
      } finally {
        setLoading(false);
      }
    }

    loadAdminDashboard();
  }, [supabase, router]);

  const { firstName: adminFirstName } = getFirstNameAndInitial(
    adminProfile?.full_name,
    "Administrator"
  );

  return (
    <div className="space-y-8">
      {/* Welcome Greeting */}
      <div className="border-b border-white/[0.08] pb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <span>Welcome back, {adminFirstName}!</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          High-level institutional surveillance, real-time platform telemetry, and administrative control.
        </p>
      </div>

      {/* Six Stat Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Users */}
        <div className="p-4 rounded-2xl border border-white/[0.08] bg-[#070c18]/80 backdrop-blur-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-mono">
            <span>TOTAL USERS</span>
            <Users className="w-4 h-4 text-[#29d9ff]" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {loading ? "—" : totalUsersCount}
          </div>
          <p className="text-[10px] text-slate-400">All registered profiles</p>
        </div>

        {/* Active Courses */}
        <div className="p-4 rounded-2xl border border-white/[0.08] bg-[#070c18]/80 backdrop-blur-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-mono">
            <span>ACTIVE COURSES</span>
            <BookOpen className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {loading ? "—" : activeCoursesCount}
          </div>
          <p className="text-[10px] text-slate-400">Ongoing cohorts</p>
        </div>

        {/* Classes Held (30 days) */}
        <div className="p-4 rounded-2xl border border-white/[0.08] bg-[#070c18]/80 backdrop-blur-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-mono">
            <span>CLASSES (30D)</span>
            <Calendar className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {loading ? "—" : classesHeld30Days}
          </div>
          <p className="text-[10px] text-slate-400">Ended lectures held</p>
        </div>

        {/* Platform Attendance */}
        <div className="p-4 rounded-2xl border border-white/[0.08] bg-[#070c18]/80 backdrop-blur-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-mono">
            <span>ATTENDANCE</span>
            <CheckCircle2
              className={`w-4 h-4 ${platformAttendancePct !== null ? "text-emerald-400" : "text-slate-500"}`}
            />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {loading ? "—" : platformAttendancePct !== null ? `${platformAttendancePct}%` : "—"}
          </div>
          <p className="text-[10px] text-slate-400">
            {platformAttendancePct !== null ? "75% rule compliance" : "No classes yet"}
          </p>
        </div>

        {/* Platform Rating */}
        <div className="p-4 rounded-2xl border border-white/[0.08] bg-[#070c18]/80 backdrop-blur-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-mono">
            <span>RATING</span>
            <Star
              className={`w-4 h-4 ${
                platformRatingAvg !== null ? "fill-amber-400 text-amber-400" : "text-slate-500"
              }`}
            />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {loading ? "—" : platformRatingAvg !== null ? platformRatingAvg.toFixed(1) : "—"}
          </div>
          <p className="text-[10px] text-slate-400">
            {platformRatingAvg !== null ? "out of 5.0 stars" : "No ratings yet"}
          </p>
        </div>

        {/* Open Helpdesk Tickets */}
        <div className="p-4 rounded-2xl border border-white/[0.08] bg-[#070c18]/80 backdrop-blur-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-mono">
            <span>OPEN TICKETS</span>
            <LifeBuoy className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-400">
            {loading ? "—" : openTicketsCount}
          </div>
          <p className="text-[10px] text-slate-400">Awaiting response</p>
        </div>
      </div>

      {/* Main Two Columns Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Wide (8 cols) - Live Now & Recent Security Alerts */}
        <div className="lg:col-span-8 space-y-8">
          {/* Live Now Card */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                </div>
                <h2 className="text-lg font-bold text-white tracking-tight">Live Now</h2>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {liveSessions.length} active broadcast{liveSessions.length === 1 ? "" : "s"}
              </span>
            </div>

            {loading ? (
              <div className="space-y-3 py-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-16 bg-white/[0.03] rounded-xl animate-pulse" />
                ))}
              </div>
            ) : liveSessions.length === 0 ? (
              <div className="p-8 rounded-xl border border-white/[0.04] bg-[#04060a]/50 text-center space-y-2">
                <Radio className="w-6 h-6 text-slate-500 mx-auto" />
                <h3 className="text-sm font-semibold text-white">No Live Classes In Progress</h3>
                <p className="text-xs text-slate-400">
                  There are currently no active classroom lectures broadcasting across the platform.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {liveSessions.map((sess) => {
                  const startTime = sess.startedAt
                    ? new Date(sess.startedAt).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : "Recently";

                  return (
                    <div
                      key={sess.id}
                      className="p-4 rounded-xl border border-white/[0.06] bg-[#04060a]/80 hover:border-white/[0.12] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase tracking-wider">
                            ON AIR
                          </span>
                          <span className="text-xs font-semibold text-white">{sess.title}</span>
                        </div>
                        <div className="text-xs text-slate-400 font-mono">
                          <span className="text-cyan-400">{sess.courseTitle}</span>
                          <span className="text-slate-600 mx-1.5">•</span>
                          <span>Instructor: {sess.teacherName}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs font-mono text-slate-400 flex items-center gap-1.5 sm:justify-end">
                          <Clock className="w-3.5 h-3.5 text-rose-400" />
                          <span>Started at {startTime}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Security Alerts Card */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-bold text-white tracking-tight">Recent Security Alerts</h2>
              </div>
              <Link
                href="/admin/security"
                className="text-xs font-mono text-[#29d9ff] hover:underline inline-flex items-center gap-1"
              >
                <span>View Full Log</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="space-y-3 py-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-12 bg-white/[0.03] rounded-xl animate-pulse" />
                ))}
              </div>
            ) : securityAlerts.length === 0 ? (
              <div className="p-8 rounded-xl border border-white/[0.04] bg-[#04060a]/50 text-center space-y-2">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
                <h3 className="text-sm font-semibold text-white">No Security Alerts</h3>
                <p className="text-xs text-slate-400">
                  Zero suspicious access events or security incidents logged recently.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04] overflow-hidden rounded-xl border border-white/[0.06]">
                {securityAlerts.map((alert) => {
                  const dateStr = new Date(alert.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  });
                  const timeStr = new Date(alert.created_at).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  });

                  return (
                    <div
                      key={alert.id}
                      className="p-3.5 bg-[#04060a]/60 hover:bg-white/[0.02] transition-colors flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="text-slate-200 font-medium">{alert.event}</div>
                        <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                          <span className="text-[#29d9ff]">{alert.userName}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        <div>{dateStr}</div>
                        <div>{timeStr}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Narrow (4 cols) - Quick Actions & Upcoming Sessions */}
        <div className="lg:col-span-4 space-y-8">
          {/* Quick Actions 2x3 Grid */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-6 space-y-4">
            <h2 className="text-base font-bold text-white tracking-tight">Quick Actions</h2>

            <div className="grid grid-cols-2 gap-2.5">
              <Link
                href="/admin/users?action=new"
                className="p-3 rounded-xl border border-white/[0.06] bg-[#04060a]/60 hover:bg-white/[0.04] hover:border-[#29d9ff]/30 transition-all flex flex-col justify-between h-24 group"
              >
                <UserPlus className="w-4 h-4 text-[#29d9ff] group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold text-slate-200 group-hover:text-white leading-tight">
                  Create Teacher Account
                </span>
              </Link>

              <Link
                href="/admin/users"
                className="p-3 rounded-xl border border-white/[0.06] bg-[#04060a]/60 hover:bg-white/[0.04] hover:border-[#29d9ff]/30 transition-all flex flex-col justify-between h-24 group"
              >
                <Users className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold text-slate-200 group-hover:text-white leading-tight">
                  Manage Users
                </span>
              </Link>

              <Link
                href="/admin/courses"
                className="p-3 rounded-xl border border-white/[0.06] bg-[#04060a]/60 hover:bg-white/[0.04] hover:border-[#29d9ff]/30 transition-all flex flex-col justify-between h-24 group"
              >
                <BookOpen className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold text-slate-200 group-hover:text-white leading-tight">
                  Courses & Enrolments
                </span>
              </Link>

              <Link
                href="/admin/reports"
                className="p-3 rounded-xl border border-white/[0.06] bg-[#04060a]/60 hover:bg-white/[0.04] hover:border-[#29d9ff]/30 transition-all flex flex-col justify-between h-24 group"
              >
                <BarChart3 className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold text-slate-200 group-hover:text-white leading-tight">
                  Reports
                </span>
              </Link>

              <Link
                href="/admin/security"
                className="p-3 rounded-xl border border-white/[0.06] bg-[#04060a]/60 hover:bg-white/[0.04] hover:border-[#29d9ff]/30 transition-all flex flex-col justify-between h-24 group"
              >
                <Shield className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold text-slate-200 group-hover:text-white leading-tight">
                  Security Log
                </span>
              </Link>

              <Link
                href="/admin/helpdesk"
                className="p-3 rounded-xl border border-white/[0.06] bg-[#04060a]/60 hover:bg-white/[0.04] hover:border-[#29d9ff]/30 transition-all flex flex-col justify-between h-24 group"
              >
                <MessageSquare className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold text-slate-200 group-hover:text-white leading-tight">
                  Helpdesk Inbox
                </span>
              </Link>
            </div>
          </div>

          {/* Upcoming Sessions Across Platform */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white tracking-tight">Upcoming Sessions</h2>
              <span className="text-xs font-mono text-slate-400">Platform Wide</span>
            </div>

            {loading ? (
              <div className="space-y-3 py-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 bg-white/[0.03] rounded-xl animate-pulse" />
                ))}
              </div>
            ) : upcomingSessions.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">
                No future sessions scheduled.
              </div>
            ) : (
              <div className="space-y-2.5">
                {upcomingSessions.map((sess) => {
                  const dateObj = new Date(sess.scheduledAt);
                  const dateStr = dateObj.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  });
                  const timeStr = dateObj.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  });

                  return (
                    <div
                      key={sess.id}
                      className="p-3 rounded-xl border border-white/[0.06] bg-[#04060a]/60 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5 truncate">
                        <div className="font-semibold text-white truncate">{sess.title}</div>
                        <div className="text-[11px] font-mono text-slate-400 truncate">
                          <span className="text-cyan-400">{sess.courseTitle}</span>
                          <span className="text-slate-600 mx-1">•</span>
                          <span>{sess.teacherName}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0 font-mono text-[11px]">
                        <div className="text-slate-300 font-medium">{dateStr}</div>
                        <div className="text-slate-500">{timeStr}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
