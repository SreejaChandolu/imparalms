"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowRight, AlertCircle, CheckCircle2, Lock, Mail, User } from "lucide-react";

export default function StudentSignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // Basic Validation
    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      setError("Please fill in all required fields.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please verify your entry.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters in length.");
      return;
    }

    setLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      // If user has a confirmed session immediately
      if (data.session) {
        router.push("/student");
        router.refresh();
      } else {
        // Confirmation email sent
        setSuccessMessage(
          "Account created! Please check your inbox to confirm your email before signing in."
        );
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred during registration.");
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
        <span className="font-mono text-[11px] uppercase tracking-widest text-[#29d9ff] bg-[#29d9ff]/10 border border-[#29d9ff]/20 px-2.5 py-1 rounded-full">
          STUDENT PORTAL
        </span>
      </header>

      {/* Main Container */}
      <main className="max-w-md w-full mx-auto">
        <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-8 shadow-2xl relative overflow-hidden">
          {/* Subtle top glow */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#29d9ff] to-transparent opacity-60" />

          <div className="mb-6 space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-white">Create student account</h1>
            <p className="text-xs text-slate-400 font-mono">
              Join interactive live cohorts and access protected lecture vaults.
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-950/25 p-4 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Alert */}
          {successMessage && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-950/25 p-4 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p>{successMessage}</p>
                <Link
                  href="/login"
                  className="inline-block font-mono text-[11px] uppercase tracking-wider text-[#29d9ff] underline hover:text-[#29d9ff]/80"
                >
                  Proceed to Login →
                </Link>
              </div>
            </div>
          )}

          {!successMessage && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block font-mono text-[11px] uppercase tracking-wider text-slate-300 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Nixon Cruz"
                    className="w-full rounded-xl border border-white/[0.1] bg-[#04060a] pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-[#29d9ff] focus:outline-none focus:ring-1 focus:ring-[#29d9ff] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block font-mono text-[11px] uppercase tracking-wider text-slate-300 mb-1.5">
                  Email Address
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
                    placeholder="student@example.com"
                    className="w-full rounded-xl border border-white/[0.1] bg-[#04060a] pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-[#29d9ff] focus:outline-none focus:ring-1 focus:ring-[#29d9ff] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block font-mono text-[11px] uppercase tracking-wider text-slate-300 mb-1.5">
                  Password
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

              <div>
                <label className="block font-mono text-[11px] uppercase tracking-wider text-slate-300 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
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
                    <span>Registering profile...</span>
                  ) : (
                    <>
                      <span>Complete Signup</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Footer note inside card */}
          <div className="mt-6 pt-4 border-t border-white/[0.06] text-center">
            <p className="text-xs text-slate-400">
              Already have an account?{" "}
              <Link href="/login" className="text-[#29d9ff] hover:underline font-mono text-xs">
                Student Sign In
              </Link>
            </p>
          </div>
        </div>
      </main>

      {/* Sub footer */}
      <footer className="text-center mt-8">
        <p className="font-mono text-[11px] text-slate-600">
          Protected by Impara RBAC • Role: Student Only
        </p>
      </footer>
    </div>
  );
}
