"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowRight, AlertCircle, ShieldAlert, Lock, Mail, ShieldCheck } from "lucide-react";

export default function StaffLoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Please enter your staff email and password.");
      return;
    }

    setLoading(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        throw signInError;
      }

      if (!data.user) {
        throw new Error("Unable to authenticate user.");
      }

      // Check User Role from profiles
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .single();

      if (profileError) {
        console.error("Profile query error during staff login:", profileError);
        throw new Error(
          `Profile query error: ${profileError.message || "Failed to load staff profile"} (${profileError.code || "DB_ERROR"}).`
        );
      }

      const userProfile = profile as unknown as { role?: string; full_name?: string; is_active?: boolean } | null;

      if (!userProfile) {
        throw new Error("Staff profile not found in database. Please contact an administrator.");
      }

      if (userProfile.is_active === false) {
        await supabase.auth.signOut();
        setError("Your staff account has been deactivated. Please contact an administrator.");
        return;
      }

      // Enforce: Students CANNOT sign in through /staff!
      if (userProfile.role === "student") {
        await supabase.auth.signOut();
        setError(
          "Access denied. Students cannot sign in through the staff portal. Please use the student login."
        );
        return;
      }

      // Redirect teachers to /teacher and admins to /admin
      if (userProfile.role === "teacher") {
        router.push("/teacher");
        router.refresh();
        return;
      }

      if (userProfile.role === "admin") {
        router.push("/admin");
        router.refresh();
        return;
      }

      // Fallback
      await supabase.auth.signOut();
      setError("Unknown role configuration. Access restricted.");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected authentication error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#04060a] text-slate-100 flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8 selection:bg-[#29d9ff]/30 selection:text-white">
      {/* Top Header */}
      <header className="max-w-md w-full mx-auto flex items-center justify-between mb-8">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-7 h-7 rounded bg-[#29d9ff] text-[#04060a] font-mono font-black text-sm flex items-center justify-center shadow-[0_0_15px_rgba(41,217,255,0.4)] group-hover:scale-105 transition-transform">
            I
          </div>
          <span className="text-xl font-bold tracking-tight text-white group-hover:text-[#29d9ff] transition-colors">
            Impara
          </span>
        </Link>
        <span className="font-mono text-[11px] uppercase tracking-widest text-amber-400 bg-amber-400/10 border border-amber-400/25 px-2.5 py-1 rounded-full flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          <span>STAFF ONLY</span>
        </span>
      </header>

      {/* Main Container */}
      <main className="max-w-md w-full mx-auto">
        <div className="rounded-2xl border border-white/[0.1] bg-[#070c18] p-8 shadow-2xl relative overflow-hidden">
          {/* Subtle amber top glow */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />

          <div className="mb-6 space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-white">Staff Authentication</h1>
            <p className="text-xs text-slate-400 font-mono">
              Instructor and system administrator portal. All access events are audited.
            </p>
          </div>

          {/* Security Notice */}
          <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-[11px] text-amber-300/90 font-mono flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              Restricted portal. Student logins are automatically rejected and recorded.
            </span>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-950/25 p-4 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-mono text-[11px] uppercase tracking-wider text-slate-300 mb-1.5">
                Staff Identity (Email)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="faculty@impara.internal"
                  className="w-full rounded-xl border border-white/[0.1] bg-[#04060a] pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-[#29d9ff] focus:outline-none focus:ring-1 focus:ring-[#29d9ff] transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block font-mono text-[11px] uppercase tracking-wider text-slate-300 mb-1.5">
                Access Secret (Password)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-white/[0.1] bg-[#04060a] pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-[#29d9ff] focus:outline-none focus:ring-1 focus:ring-[#29d9ff] transition-colors"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#29d9ff] py-3 text-xs font-semibold uppercase tracking-wider text-[#04060a] shadow-[0_0_20px_rgba(41,217,255,0.3)] hover:bg-[#29d9ff]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? (
                  <span>Verifying Credentials...</span>
                ) : (
                  <>
                    <span>Authorize Staff Session</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-4 border-t border-white/[0.06] text-center">
            <p className="font-mono text-[10px] text-slate-500 uppercase tracking-widest">
              Teacher & Admin accounts are issued exclusively by an administrator.
            </p>
          </div>
        </div>
      </main>

      {/* Sub footer */}
      <footer className="text-center mt-8">
        <p className="font-mono text-[11px] text-slate-600">
          Internal Faculty & Ops Gateway • Strictly Confidential
        </p>
      </footer>
    </div>
  );
}
