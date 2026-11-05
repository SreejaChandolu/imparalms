"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getFirstNameAndInitial } from "@/lib/utils";
import { LogOut, ChevronDown, Shield, Users, LayoutDashboard, Settings } from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const [adminName, setAdminName] = useState<string>("");
  const [adminInitial, setAdminInitial] = useState<string>("A");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchAdminProfile() {
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

      const rawName = profile?.full_name?.trim() || user.email?.split("@")[0] || "Administrator";
      const { initial } = getFirstNameAndInitial(rawName, "Admin");
      setAdminName(rawName);
      setAdminInitial(initial);
    }

    fetchAdminProfile();
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
    router.push("/staff");
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
          <div className="flex items-center gap-3">
            <Link href="/admin" className="flex items-center gap-2.5 group">
              <div className="w-7 h-7 rounded bg-[#29d9ff] text-[#04060a] font-mono font-black text-sm flex items-center justify-center shadow-[0_0_15px_rgba(41,217,255,0.4)] group-hover:scale-105 transition-transform">
                I
              </div>
              <span className="text-xl font-bold tracking-tight text-white group-hover:text-[#29d9ff] transition-colors">
                Impara
              </span>
            </Link>
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[#29d9ff] bg-[#29d9ff]/10 px-2.5 py-0.5 rounded-full border border-[#29d9ff]/25">
              <Shield className="w-3 h-3" />
              <span>Admin Console</span>
            </span>
          </div>

          {/* Right: Avatar with initial and dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-[#29d9ff]/40 transition-all focus:outline-none"
              aria-label="Admin user menu"
            >
              <div className="w-8 h-8 rounded-full bg-[#29d9ff]/15 border border-[#29d9ff]/40 text-[#29d9ff] font-bold text-xs flex items-center justify-center shadow-[0_0_10px_rgba(41,217,255,0.2)]">
                {adminInitial}
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-52 rounded-xl bg-[#070c18] border border-white/[0.1] shadow-2xl py-1.5 z-50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
                <div className="px-4 py-2 border-b border-white/[0.06]">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-[#29d9ff]">
                    System Administrator
                  </p>
                  <p className="text-xs font-semibold text-white truncate mt-0.5">
                    {adminName || "Administrator"}
                  </p>
                </div>

                <Link
                  href="/admin"
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/[0.04] transition-colors"
                >
                  <LayoutDashboard className="w-3.5 h-3.5 text-slate-400" />
                  <span>Admin Dashboard</span>
                </Link>

                <Link
                  href="/admin/users"
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/[0.04] transition-colors"
                >
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span>Manage Users</span>
                </Link>

                <div className="border-t border-white/[0.06] my-1" />

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors text-left"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          MAIN CONTENT AREA
      ────────────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* ─────────────────────────────────────────────────────────────
          SHARED FOOTER
      ────────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.08] bg-[#04060a] py-6 text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>© 2026 Impara. All rights reserved.</div>
          <div className="flex items-center gap-6">
            <Link href="/admin/helpdesk" className="hover:text-[#29d9ff] transition-colors">
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
