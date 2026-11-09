"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getFirstNameAndInitial } from "@/lib/utils";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
  X,
  AlertTriangle,
  Clock,
} from "lucide-react";

interface UserProfileMeta {
  id: string;
  full_name: string;
  role: string;
}

interface SecurityEventItem {
  id: string;
  user_id: string | null;
  event: string;
  created_at: string;
  userName: string;
  userRole: string | null;
}

const PAGE_SIZE = 50;

export default function AdminSecurityPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<SecurityEventItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  // Filters
  const [eventSearchQuery, setEventSearchQuery] = useState("");
  const [selectedUserFilter, setSelectedUserFilter] = useState("all");
  const [datePreset, setDatePreset] = useState<"all" | "today" | "7d" | "30d" | "custom">("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Profiles cache for user mapping
  const [userProfiles, setUserProfiles] = useState<UserProfileMeta[]>([]);
  const [profilesMap, setProfilesMap] = useState<Map<string, UserProfileMeta>>(new Map());

  // Load User Profiles once for lookup & user filter dropdown
  useEffect(() => {
    async function loadProfiles() {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .order("full_name");

      const list = (data as UserProfileMeta[]) || [];
      setUserProfiles(list);

      const map = new Map<string, UserProfileMeta>();
      list.forEach((p) => map.set(p.id, p));
      setProfilesMap(map);
    }
    loadProfiles();
  }, [supabase]);

  // Compute date filter boundary
  const dateRangeBounds = useMemo(() => {
    const now = new Date();
    if (datePreset === "today") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { start: start.toISOString(), end: null };
    }
    if (datePreset === "7d") {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { start: start.toISOString(), end: null };
    }
    if (datePreset === "30d") {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { start: start.toISOString(), end: null };
    }
    if (datePreset === "custom") {
      const start = customStartDate ? new Date(customStartDate).toISOString() : null;
      const end = customEndDate ? new Date(`${customEndDate}T23:59:59.999Z`).toISOString() : null;
      return { start, end };
    }
    return { start: null, end: null };
  }, [datePreset, customStartDate, customEndDate]);

  // Fetch paginated events from Supabase
  const loadEvents = useCallback(async (page: number) => {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/staff");
        return;
      }

      let query = supabase
        .from("security_events")
        .select("id, user_id, event, created_at", { count: "exact" })
        .order("created_at", { ascending: false });

      // Apply User filter
      if (selectedUserFilter !== "all") {
        if (selectedUserFilter === "anonymous") {
          query = query.is("user_id", null);
        } else {
          query = query.eq("user_id", selectedUserFilter);
        }
      }

      // Apply Event text search
      if (eventSearchQuery.trim()) {
        query = query.ilike("event", `%${eventSearchQuery.trim()}%`);
      }

      // Apply Date bounds
      if (dateRangeBounds.start) {
        query = query.gte("created_at", dateRangeBounds.start);
      }
      if (dateRangeBounds.end) {
        query = query.lte("created_at", dateRangeBounds.end);
      }

      // Pagination
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;

      if (error) throw error;

      setTotalCount(count || 0);

      const rawList = (data as any[]) || [];
      const formatted: SecurityEventItem[] = rawList.map((item) => {
        const prof = item.user_id ? profilesMap.get(item.user_id) : null;
        return {
          id: item.id,
          user_id: item.user_id,
          event: item.event,
          created_at: item.created_at,
          userName: prof ? prof.full_name : item.user_id ? "Unknown User" : "System / Anonymous",
          userRole: prof ? prof.role : null,
        };
      });

      setEvents(formatted);
    } catch (err) {
      console.error("Error loading security events log:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase, router, selectedUserFilter, eventSearchQuery, dateRangeBounds, profilesMap]);

  // Load events when page or filters change
  useEffect(() => {
    loadEvents(currentPage);
  }, [loadEvents, currentPage]);

  // Reset to page 1 on filter change
  const handleFilterChange = (updater: () => void) => {
    updater();
    setCurrentPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Export current filtered events to CSV
  const handleExportCSV = async () => {
    try {
      let query = supabase
        .from("security_events")
        .select("id, user_id, event, created_at")
        .order("created_at", { ascending: false })
        .limit(1000); // Export up to latest 1000 matching

      if (selectedUserFilter !== "all") {
        if (selectedUserFilter === "anonymous") {
          query = query.is("user_id", null);
        } else {
          query = query.eq("user_id", selectedUserFilter);
        }
      }
      if (eventSearchQuery.trim()) {
        query = query.ilike("event", `%${eventSearchQuery.trim()}%`);
      }
      if (dateRangeBounds.start) {
        query = query.gte("created_at", dateRangeBounds.start);
      }
      if (dateRangeBounds.end) {
        query = query.lte("created_at", dateRangeBounds.end);
      }

      const { data } = await query;
      const rows = (data || []).map((item: any) => {
        const prof = item.user_id ? profilesMap.get(item.user_id) : null;
        const uName = prof ? prof.full_name : item.user_id ? "Unknown User" : "System / Anonymous";
        const uRole = prof ? prof.role : "n/a";
        return [
          `"${item.created_at}"`,
          `"${uName.replace(/"/g, '""')}"`,
          `"${uRole}"`,
          `"${item.event.replace(/"/g, '""')}"`,
          `"${item.id}"`,
        ].join(",");
      });

      const csvContent =
        "data:text/csv;charset=utf-8," +
        ["Timestamp,User,Role,Event Description,Event ID", ...rows].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `impara-security-log-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Error exporting security log:", err);
    }
  };

  return (
    <div className="space-y-8">
      {/* ─────────────────────────────────────────────────────────────
          HEADER & EXPORT
      ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-[#29d9ff] transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Admin Dashboard</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <span>Security & Audit Forensics Log</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-[#29d9ff]/30 text-[#29d9ff] font-mono">
              Immutable Trail
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time surveillance of user authentication cycles, permission authorizations, anti-leak events, and account modifications.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => loadEvents(currentPage)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.1] text-xs font-mono text-slate-300 hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#29d9ff]" : ""}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={loading || totalCount === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.12] text-xs font-mono uppercase tracking-wider font-semibold text-white hover:border-[#29d9ff]/50 transition-all shadow-sm disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-[#29d9ff]" />
            <span>Export Log</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          FILTER BAR
      ────────────────────────────────────────────────────────────── */}
      <div className="p-4 rounded-2xl border border-white/[0.08] bg-[#070c18] space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Event Text */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={eventSearchQuery}
              onChange={(e) =>
                handleFilterChange(() => setEventSearchQuery(e.target.value))
              }
              placeholder="Filter by event text (e.g. login, token, role)..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#04060a] border border-white/[0.1] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#29d9ff]"
            />
            {eventSearchQuery && (
              <button
                onClick={() => handleFilterChange(() => setEventSearchQuery(""))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* User Filter Dropdown */}
          <div className="md:col-span-4">
            <select
              value={selectedUserFilter}
              onChange={(e) =>
                handleFilterChange(() => setSelectedUserFilter(e.target.value))
              }
              className="w-full px-3 py-2 rounded-xl bg-[#04060a] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#29d9ff]"
            >
              <option value="all">All Users & System ({userProfiles.length + 1})</option>
              <option value="anonymous">System / Anonymous Only</option>
              {userProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} ({p.role})
                </option>
              ))}
            </select>
          </div>

          {/* Date Preset Filter */}
          <div className="md:col-span-3">
            <select
              value={datePreset}
              onChange={(e) =>
                handleFilterChange(() => setDatePreset(e.target.value as any))
              }
              className="w-full px-3 py-2 rounded-xl bg-[#04060a] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#29d9ff]"
            >
              <option value="all">All Recorded History</option>
              <option value="today">Today</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="custom">Custom Range...</option>
            </select>
          </div>
        </div>

        {/* Custom Date Bounds */}
        {datePreset === "custom" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-white/[0.04]">
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-slate-400 block">START DATE</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) =>
                  handleFilterChange(() => setCustomStartDate(e.target.value))
                }
                className="w-full px-3 py-1.5 rounded-xl bg-[#04060a] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#29d9ff]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-slate-400 block">END DATE</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) =>
                  handleFilterChange(() => setCustomEndDate(e.target.value))
                }
                className="w-full px-3 py-1.5 rounded-xl bg-[#04060a] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#29d9ff]"
              />
            </div>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECURITY EVENTS LOG TABLE
      ────────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] overflow-hidden space-y-0">
        <div className="p-4 border-b border-white/[0.08] bg-[#0a1122] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#29d9ff]" />
            <span className="font-mono text-xs font-semibold text-white uppercase tracking-wider">
              Audit Stream
            </span>
          </div>
          <span className="font-mono text-xs text-slate-400">
            Showing {(currentPage - 1) * PAGE_SIZE + (events.length > 0 ? 1 : 0)} -{" "}
            {Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount} events
          </span>
        </div>

        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-12 bg-white/[0.03] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <ShieldCheck className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-base font-semibold text-white">No security events found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No audit logs matched your current query criteria. Try clearing search keywords or selecting a broader time frame.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.02] text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4">User Identity</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Event Description</th>
                  <th className="py-3 px-4 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {events.map((ev) => {
                  const { initial } = getFirstNameAndInitial(ev.userName, "User");
                  const dateObj = new Date(ev.created_at);
                  const formattedDate = dateObj.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });
                  const formattedTime = dateObj.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  });

                  return (
                    <tr key={ev.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-full bg-white/[0.06] border border-white/[0.1] text-slate-300 font-bold text-[10px] flex items-center justify-center shrink-0">
                            {initial}
                          </div>
                          <div>
                            <div className="font-semibold text-white group-hover:text-[#29d9ff] transition-colors">
                              {ev.userName}
                            </div>
                            {ev.user_id && (
                              <div className="text-[10px] font-mono text-slate-500 truncate max-w-[140px]">
                                {ev.user_id}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {ev.userRole ? (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border ${
                              ev.userRole === "admin"
                                ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                                : ev.userRole === "teacher"
                                ? "bg-cyan-500/10 text-[#29d9ff] border-[#29d9ff]/30"
                                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            }`}
                          >
                            {ev.userRole}
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-500 uppercase">System</span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-200">
                        <div className="break-all">{ev.event}</div>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap font-mono text-[11px]">
                        <div className="text-white">{formattedDate}</div>
                        <div className="text-[10px] text-slate-500">{formattedTime}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            PAGINATION CONTROLS (Exactly 50 per page)
        ────────────────────────────────────────────────────────────── */}
        <div className="p-4 border-t border-white/[0.08] bg-[#0a1122] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs font-mono text-slate-400">
            Page <span className="text-white font-bold">{currentPage}</span> of{" "}
            <span className="text-white font-bold">{totalPages}</span> ({PAGE_SIZE} events per page)
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1 || loading}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-xs font-mono text-slate-300 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <span className="px-3 py-1 text-xs font-mono text-[#29d9ff] bg-[#29d9ff]/10 rounded-lg border border-[#29d9ff]/20">
              {currentPage}
            </span>

            <button
              type="button"
              disabled={currentPage >= totalPages || loading}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-xs font-mono text-slate-300 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
