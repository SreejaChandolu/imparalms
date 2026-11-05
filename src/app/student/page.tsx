"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Course, LiveSession } from "@/types/database";
import {
  LogOut,
  Video,
  Film,
  Award,
  BookOpen,
  Calendar,
  Radio,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export default function StudentDashboard() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStudentData() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        // Fetch profile
        const { data: prof, error: profError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (profError) {
          console.error("Student dashboard profile fetch error:", profError);
        } else if (prof) {
          setProfile(prof as Profile);
        }

        // Fetch enrolled courses
        const { data: enrolled } = await supabase
          .from("enrollments")
          .select("courses(*)")
          .eq("student_id", user.id);

        if (enrolled) {
          const courseList = enrolled.map((item: any) => item.courses).filter(Boolean);
          setCourses(courseList as Course[]);
        }

        // Fetch live / upcoming sessions
        const { data: sessions } = await supabase
          .from("live_sessions")
          .select("*")
          .in("status", ["scheduled", "live"])
          .order("scheduled_at", { ascending: true })
          .limit(4);

        if (sessions) {
          setUpcomingSessions(sessions as LiveSession[]);
        }
      } catch (err) {
        console.error("Failed to load student data", err);
      } finally {
        setLoading(false);
      }
    }

    loadStudentData();
  }, [router, supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-[#04060a] text-slate-100 flex flex-col selection:bg-[#29d9ff]/30 selection:text-white">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-[#04060a]/85 border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-[#29d9ff] text-[#04060a] font-mono font-black text-sm flex items-center justify-center">
                I
              </div>
              <span className="text-lg font-bold tracking-tight text-white">Impara</span>
            </Link>
            <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-0.5 rounded-full">
              STUDENT PORTAL
            </span>
          </div>

          <div className="flex items-center gap-4">
            {profile?.student_id && (
              <span className="hidden sm:inline-block font-mono text-xs text-slate-400 bg-white/[0.04] px-3 py-1 rounded-full border border-white/[0.06]">
                ID: {profile.student_id}
              </span>
            )}
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-1.5 text-xs font-mono uppercase tracking-wider text-slate-300 hover:text-rose-400 hover:border-rose-400/40 hover:bg-rose-500/10 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        {/* Welcome Header */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#29d9ff]/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <div className="font-mono text-xs text-[#29d9ff] uppercase tracking-widest mb-1">
                WELCOME BACK
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                {profile?.full_name || "Student"}
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                You are enrolled in {courses.length} active course{courses.length === 1 ? "" : "s"}.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-white/[0.08] bg-[#04060a] p-3 text-center min-w-[110px]">
                <div className="font-mono text-xs text-slate-500">ATTENDANCE</div>
                <div className="text-xl font-bold text-emerald-400 mt-0.5">≥ 75%</div>
                <div className="text-[10px] text-slate-500 font-mono">Verified Present</div>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-[#04060a] p-3 text-center min-w-[110px]">
                <div className="font-mono text-xs text-slate-500">WATERMARK</div>
                <div className="text-xl font-bold text-[#29d9ff] mt-0.5">ACTIVE</div>
                <div className="text-[10px] text-slate-500 font-mono">Dynamic Token</div>
              </div>
            </div>
          </div>
        </div>

        {/* Live & Upcoming Sessions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-[#29d9ff] animate-pulse" />
              <h2 className="text-lg font-bold text-white">Live & Upcoming Sessions</h2>
            </div>
            <span className="font-mono text-xs text-slate-500">In-App WebRTC Rooms</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upcomingSessions.length > 0 ? (
              upcomingSessions.map((session) => (
                <div
                  key={session.id}
                  className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-5 flex flex-col justify-between hover:border-[#29d9ff]/30 transition-all group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                        {session.duration_minutes} MINS
                      </span>
                      {session.status === "live" ? (
                        <span className="flex items-center gap-1.5 rounded-full bg-red-500/10 border border-red-500/20 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-red-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                          <span>LIVE NOW</span>
                        </span>
                      ) : (
                        <span className="rounded-full bg-white/[0.06] border border-white/[0.06] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                          SCHEDULED
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-semibold text-white group-hover:text-[#29d9ff] transition-colors">
                      {session.title}
                    </h3>
                    <div className="mt-2 flex items-center gap-2 font-mono text-xs text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>{new Date(session.scheduled_at).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-white/[0.06] flex items-center justify-between">
                    <span className="font-mono text-[11px] text-slate-500">
                      Room: {session.livekit_room}
                    </span>
                    <button
                      type="button"
                      disabled={session.status !== "live"}
                      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-mono uppercase tracking-wider transition-all ${
                        session.status === "live"
                          ? "bg-[#29d9ff] text-[#04060a] font-bold shadow-[0_0_15px_rgba(41,217,255,0.4)]"
                          : "bg-white/[0.05] text-slate-500 cursor-not-allowed border border-white/[0.05]"
                      }`}
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>{session.status === "live" ? "Join Class" : "Starts Soon"}</span>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full rounded-2xl border border-white/[0.06] bg-[#070c18]/50 p-8 text-center">
                <Calendar className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No scheduled sessions in your enrolled courses today.</p>
              </div>
            )}
          </div>
        </div>

        {/* Enrolled Courses */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#29d9ff]" />
              <h2 className="text-lg font-bold text-white">Your Courses</h2>
            </div>
            <span className="font-mono text-xs text-slate-500">RLS Enforced Enrollment</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {courses.length > 0 ? (
              courses.map((course) => (
                <div
                  key={course.id}
                  className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-6 space-y-3"
                >
                  <div className="font-mono text-[10px] text-[#29d9ff] uppercase tracking-widest">
                    ACTIVE ENROLLMENT
                  </div>
                  <h3 className="text-lg font-semibold text-white">{course.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{course.description}</p>
                  <div className="pt-2 flex items-center gap-4 text-xs font-mono text-slate-500">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Attendance Telemetry Enabled
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full rounded-2xl border border-white/[0.06] bg-[#070c18]/50 p-8 text-center">
                <BookOpen className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400">You are not enrolled in any courses yet.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
