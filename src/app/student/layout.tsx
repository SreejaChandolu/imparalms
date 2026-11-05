"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOut, User, ChevronDown } from "lucide-react";

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const [studentName, setStudentName] = useState<string>("");
  const [studentInitial, setStudentInitial] = useState<string>("S");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchStudentProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      const { data: profile } = (await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single()) as { data: { full_name?: string } | null; error: any };

      const name = profile?.full_name?.trim() || user.email?.split("@")[0] || "Student";
      setStudentName(name);
      setStudentInitial(name.charAt(0).toUpperCase());
    }

    fetchStudentProfile();
  }, [supabase]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Close dropdown on navigation
  useEffect(() => {
    setDropdownOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-[#04060a] text-slate-100 flex flex-col selection:bg-[#29d9ff]/30 selection:text-white">
      {/* ─────────────────────────────────────────────────────────────
          SHARED TOP HEADER
      ────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#04060a]/85 border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo & Wordmark on Left */}
          <Link href="/student" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded bg-[#29d9ff] text-[#04060a] font-mono font-black text-sm flex items-center justify-center shadow-[0_0_15px_rgba(41,217,255,0.4)] group-hover:scale-105 transition-transform">
              I
            </div>
            <span className="text-xl font-bold tracking-tight text-white group-hover:text-[#29d9ff] transition-colors">
              Impara
            </span>
          </Link>

          {/* Right: Avatar with initial and dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-[#29d9ff]/40 transition-all focus:outline-none"
              aria-label="User menu"
              aria-expanded={dropdownOpen}
            >
              <div className="w-9 h-9 rounded-full bg-[#29d9ff]/15 border border-[#29d9ff]/30 text-[#29d9ff] font-mono font-bold text-sm flex items-center justify-center shadow-[0_0_12px_rgba(41,217,255,0.2)]">
                {studentInitial}
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                  dropdownOpen ? "rotate-180 text-[#29d9ff]" : ""
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl border border-white/[0.1] bg-[#070c18] py-1.5 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3.5 py-2 border-b border-white/[0.06]">
                  <p className="text-xs font-medium text-white truncate">{studentName}</p>
                  <p className="font-mono text-[10px] text-[#29d9ff] uppercase tracking-wider">
                    Student
                  </p>
                </div>

                <Link
                  href="/student/profile"
                  className="flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors"
                >
                  <User className="w-3.5 h-3.5 text-[#29d9ff]" />
                  <span>Profile</span>
                </Link>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors text-left"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Page Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {children}
      </main>

      {/* ─────────────────────────────────────────────────────────────
          SHARED FOOTER AT THE BOTTOM OF EVERY PAGE
      ────────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.08] bg-[#020306] py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-mono">
          <p>© 2026 Impara</p>
          <div className="flex items-center gap-6">
            <Link
              href="/student/helpdesk"
              className="hover:text-[#29d9ff] transition-colors"
            >
              Helpdesk
            </Link>
            <Link href="#" className="hover:text-[#29d9ff] transition-colors">
              Terms
            </Link>
            <Link href="#" className="hover:text-[#29d9ff] transition-colors">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
