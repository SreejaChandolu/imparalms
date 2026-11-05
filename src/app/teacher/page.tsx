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
  Users,
  BookOpen,
  Calendar,
  Radio,
  Clock,
  Plus,
  ShieldCheck,
} from "lucide-react";

export default function TeacherDashboard() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTeacherData() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/staff");
          return;
        }

        // Fetch profile
        const { data: prof, error: profError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (profError) {
          console.error("Teacher dashboard profile fetch error:", profError);
        } else if (prof) {
          setProfile(prof as Profile);
        }

        // Fetch courses where teacher_id = user.id
        const { data: teacherCourses } = await supabase
          .from("courses")
          .select("*")
          .eq("teacher_id", user.id);

        if (teacherCourses) {
          setCourses(teacherCourses as Course[]);
        }

        // Fetch live sessions
        const { data: teacherSessions } = await supabase
          .from("live_sessions")
          .select("*")
          .eq("teacher_id", user.id)
          .order("scheduled_at", { ascending: false })
          .limit(6);

        if (teacherSessions) {
          setSessions(teacherSessions as LiveSession[]);
        }
      } catch (err) {
        console.error("Failed to load teacher data", err);
      } finally {
        setLoading(false);
      }
    }

    loadTeacherData();
  }, [router, supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/staff");
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
            <span className="font-mono text-[10px] uppercase tracking-widest text-sky-400 bg-sky-400/10 border border-sky-400/20 px-2.5 py-0.5 rounded-full">
              FACULTY PORTAL
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="font-mono text-xs text-slate-400 bg-white/[0.04] px-3 py-1 rounded-full border border-white/[0.06]">
              Instructor: {profile?.full_name || "Faculty Member"}
            </span>
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
          <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <div className="font-mono text-xs text-sky-400 uppercase tracking-widest mb-1">
                INSTRUCTOR CONSOLE
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                {profile?.full_name || "Instructor"}
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                You are assigned to {courses.length} course{courses.length === 1 ? "" : "s"}.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-white/[0.08] bg-[#04060a] p-3 text-center min-w-[110px]">
                <div className="font-mono text-xs text-slate-500">HOST STATUS</div>
                <div className="text-xl font-bold text-sky-400 mt-0.5">READY</div>
                <div className="text-[10px] text-slate-500 font-mono">LiveKit Publisher</div>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-[#04060a] p-3 text-center min-w-[110px]">
                <div className="font-mono text-xs text-slate-500">ATTENDANCE</div>
                <div className="text-xl font-bold text-emerald-400 mt-0.5">75% GATE</div>
                <div className="text-[10px] text-slate-500 font-mono">SQL View Active</div>
              </div>
            </div>
          </div>
        </div>

        {/* Sessions Managed */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-sky-400" />
              <h2 className="text-lg font-bold text-white">Your Teaching Sessions</h2>
            </div>
            <span className="font-mono text-xs text-slate-500">LiveKit WebRTC Classrooms</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sessions.length > 0 ? (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-5 flex flex-col justify-between hover:border-sky-400/30 transition-all group"
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
                      ) : session.status === "ended" ? (
                        <span className="rounded-full bg-slate-500/10 border border-slate-500/20 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                          ENDED
                        </span>
                      ) : (
                        <span className="rounded-full bg-white/[0.06] border border-white/[0.06] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                          SCHEDULED
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-semibold text-white group-hover:text-sky-400 transition-colors">
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
                      className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-300 hover:bg-sky-500/20 px-4 py-1.5 text-xs font-mono uppercase tracking-wider transition-all"
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>Host Broadcast</span>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full rounded-2xl border border-white/[0.06] bg-[#070c18]/50 p-8 text-center">
                <Calendar className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No sessions registered yet.</p>
              </div>
            )}
          </div>
        </div>

        {/* Assigned Courses */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-sky-400" />
              <h2 className="text-lg font-bold text-white">Assigned Courses</h2>
            </div>
            <span className="font-mono text-xs text-slate-500">Instructor RLS Scope</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {courses.length > 0 ? (
              courses.map((course) => (
                <div
                  key={course.id}
                  className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-6 space-y-3"
                >
                  <div className="font-mono text-[10px] text-sky-400 uppercase tracking-widest">
                    TEACHING COHORT
                  </div>
                  <h3 className="text-lg font-semibold text-white">{course.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{course.description}</p>
                </div>
              ))
            ) : (
              <div className="col-span-full rounded-2xl border border-white/[0.06] bg-[#070c18]/50 p-8 text-center">
                <BookOpen className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No courses assigned to your instructor profile yet.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
