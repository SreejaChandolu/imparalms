"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getFirstNameAndInitial } from "@/lib/utils";
import type { Profile, SecurityEvent } from "@/types/database";
import {
  LogOut,
  Users,
  ShieldCheck,
  ShieldAlert,
  Database,
  UserCheck,
  BookOpen,
  Calendar,
  Activity,
} from "lucide-react";

export default function AdminDashboard() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAdminData() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/staff");
          return;
        }

        // Fetch own profile
        const { data: prof, error: profError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (profError) {
          console.error("Admin dashboard profile fetch error:", profError);
        } else if (prof) {
          setProfile(prof as Profile);
        }

        // Admin RLS permits selecting all profiles
        const { data: allProfiles } = await supabase
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: false });

        if (allProfiles) {
          setProfiles(allProfiles as Profile[]);
        }

        // Fetch security events
        const { data: events } = await supabase
          .from("security_events")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(5);

        if (events) {
          setSecurityEvents(events as SecurityEvent[]);
        }
      } catch (err) {
        console.error("Failed to load admin data", err);
      } finally {
        setLoading(false);
      }
    }

    loadAdminData();
  }, [router, supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/staff");
    router.refresh();
  };

  const studentCount = profiles.filter((p) => p.role === "student").length;
  const teacherCount = profiles.filter((p) => p.role === "teacher").length;
  const adminCount = profiles.filter((p) => p.role === "admin").length;

  const { firstName: adminFirstName, initial: adminInitial } = getFirstNameAndInitial(
    profile?.full_name,
    "Admin"
  );

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
            <span className="font-mono text-[10px] uppercase tracking-widest text-purple-400 bg-purple-400/10 border border-purple-400/20 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
              <ShieldAlert className="w-3 h-3 text-purple-400" />
              <span>ADMINISTRATOR PORTAL</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-400 font-mono font-bold text-xs flex items-center justify-center shadow-[0_0_12px_rgba(168,85,247,0.2)]">
                {adminInitial}
              </div>
              <span className="font-mono text-xs text-slate-400 bg-white/[0.04] px-3 py-1 rounded-full border border-white/[0.06]">
                Admin: {adminFirstName}
              </span>
            </div>
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
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <div className="font-mono text-xs text-purple-400 uppercase tracking-widest mb-1">
                SYSTEM CONTROL PLANE
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                Welcome back, {adminFirstName}!
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                Platform Overview & Security Audit. Postgres Row Level Security and server boundary role enforcement are active.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="rounded-xl border border-white/[0.08] bg-[#04060a] p-3 text-center min-w-[85px]">
                <div className="font-mono text-[10px] text-slate-500">STUDENTS</div>
                <div className="text-lg font-bold text-emerald-400 mt-0.5">{studentCount}</div>
                <div className="text-[9px] text-slate-500 font-mono">Self-Serve</div>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-[#04060a] p-3 text-center min-w-[85px]">
                <div className="font-mono text-[10px] text-slate-500">TEACHERS</div>
                <div className="text-lg font-bold text-sky-400 mt-0.5">{teacherCount}</div>
                <div className="text-[9px] text-slate-500 font-mono">Admin Only</div>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-[#04060a] p-3 text-center min-w-[85px]">
                <div className="font-mono text-[10px] text-slate-500">ADMINS</div>
                <div className="text-lg font-bold text-purple-400 mt-0.5">{adminCount}</div>
                <div className="text-[9px] text-slate-500 font-mono">Root</div>
              </div>
            </div>
          </div>
        </div>

        {/* User Management List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-400" />
              <h2 className="text-lg font-bold text-white">Registered Users & Assigned Roles</h2>
            </div>
            <span className="font-mono text-xs text-slate-500">Unrestricted Admin Scope</span>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0a1120] border-b border-white/[0.08] font-mono uppercase text-slate-400 text-[10px] tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Name</th>
                    <th className="px-6 py-3.5">Role</th>
                    <th className="px-6 py-3.5">Student ID</th>
                    <th className="px-6 py-3.5">Registered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {profiles.map((p) => (
                    <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 font-medium text-white">{p.full_name || "Unnamed"}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-block font-mono text-[10px] uppercase px-2 py-0.5 rounded-full border ${
                            p.role === "admin"
                              ? "bg-purple-500/10 border-purple-500/30 text-purple-300"
                              : p.role === "teacher"
                              ? "bg-sky-500/10 border-sky-500/30 text-sky-300"
                              : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                          }`}
                        >
                          {p.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-400">
                        {p.student_id || "—"}
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-500">
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Security & Access Policies Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-6 space-y-3">
            <div className="flex items-center gap-2 font-mono text-xs text-[#29d9ff]">
              <Database className="w-4 h-4" />
              <span>RLS ENFORCEMENT AUDIT</span>
            </div>
            <h3 className="text-base font-semibold text-white">Row Level Security Active</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              All 14 application tables and views have RLS enabled. Students can only select courses they are
              enrolled in; teachers can only manage their assigned courses; only admins have universal mutation rights.
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-6 space-y-3">
            <div className="flex items-center gap-2 font-mono text-xs text-amber-400">
              <ShieldCheck className="w-4 h-4" />
              <span>ROLE CREATION RESTRICTION</span>
            </div>
            <h3 className="text-base font-semibold text-white">Server-Enforced User Roles</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Public self-registration at <code className="text-white">/signup</code> is hard-coded in database triggers
              to always assign the <code className="text-white">student</code> role. Teacher and Admin accounts can only
              be provisioned by an administrator.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
