"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getFirstNameAndInitial } from "@/lib/utils";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Filter,
  GraduationCap,
  Inbox,
  LifeBuoy,
  Loader2,
  Mail,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  User,
  X,
  AlertCircle,
  HelpCircle,
  Check,
} from "lucide-react";

interface TicketSenderProfile {
  id: string;
  full_name: string;
  role: "student" | "teacher" | "admin";
  student_id: string | null;
}

interface HelpTicketItem {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  status: "open" | "answered" | "closed";
  reply: string | null;
  created_at: string;
  sender_name: string;
  sender_role: "student" | "teacher" | "admin";
  sender_code: string | null;
}

export default function AdminHelpdeskPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<HelpTicketItem[]>([]);

  // Filters State
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Selected Ticket Modal State
  const [selectedTicket, setSelectedTicket] = useState<HelpTicketItem | null>(null);
  const [replyInput, setReplyInput] = useState("");
  const [statusChoice, setStatusChoice] = useState<"open" | "answered" | "closed">("answered");
  const [savingReply, setSavingReply] = useState(false);
  const [replySuccessMessage, setReplySuccessMessage] = useState<string | null>(null);
  const [replyErrorMessage, setReplyErrorMessage] = useState<string | null>(null);

  // Load all tickets from Supabase
  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/staff");
        return;
      }

      // 1. Fetch tickets (newest first)
      const { data: ticketsData, error: ticketsError } = await supabase
        .from("help_tickets")
        .select("id, user_id, subject, message, status, reply, created_at")
        .order("created_at", { ascending: false });

      if (ticketsError) throw ticketsError;

      const rawTickets = ticketsData || [];
      const userIds = Array.from(new Set(rawTickets.map((t: any) => t.user_id)));

      // 2. Fetch profiles for ticket senders
      const profileMap = new Map<string, TicketSenderProfile>();
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, role, student_id")
          .in("id", userIds);

        ((profilesData as any[]) || []).forEach((p) => {
          profileMap.set(p.id, {
            id: p.id,
            full_name: p.full_name || "User",
            role: (p.role as any) || "student",
            student_id: p.student_id || null,
          });
        });
      }

      const formatted: HelpTicketItem[] = rawTickets.map((t: any) => {
        const sender = profileMap.get(t.user_id);
        return {
          id: t.id,
          user_id: t.user_id,
          subject: t.subject,
          message: t.message,
          status: t.status as "open" | "answered" | "closed",
          reply: t.reply,
          created_at: t.created_at,
          sender_name: sender?.full_name || "Platform User",
          sender_role: sender?.role || "student",
          sender_code: sender?.student_id || null,
        };
      });

      setTickets(formatted);
    } catch (err) {
      console.error("Error loading helpdesk tickets:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase, router]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  // Open Ticket Detail & Reply Modal
  const handleOpenTicketModal = (ticket: HelpTicketItem) => {
    setSelectedTicket(ticket);
    setReplyInput(ticket.reply || "");
    // Business rule: if ticket is open, default to "answered" for the reply.
    // If ticket was already answered or closed, preserve existing status unless user changes it.
    if (ticket.status === "open") {
      setStatusChoice("answered");
    } else {
      setStatusChoice(ticket.status);
    }
    setReplySuccessMessage(null);
    setReplyErrorMessage(null);
  };

  // Close Modal
  const handleCloseModal = () => {
    setSelectedTicket(null);
    setReplyInput("");
    setReplySuccessMessage(null);
    setReplyErrorMessage(null);
  };

  // Save Reply & Status
  const handleSaveReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;

    try {
      setSavingReply(true);
      setReplyErrorMessage(null);
      setReplySuccessMessage(null);

      const hasReplyText = replyInput.trim().length > 0;
      // Critical Business Rule: "saving a reply sets the status to answered unless the admin picks another."
      let finalStatus: "open" | "answered" | "closed" = statusChoice;
      if (hasReplyText && statusChoice === "open") {
        finalStatus = "answered";
      }

      const payload = {
        reply: hasReplyText ? replyInput.trim() : null,
        status: finalStatus,
      };

      const { error } = await (supabase.from("help_tickets") as any)
        .update(payload)
        .eq("id", selectedTicket.id);

      if (error) throw error;

      // Update in local state
      const updatedTicket: HelpTicketItem = {
        ...selectedTicket,
        reply: payload.reply,
        status: finalStatus,
      };

      setTickets((prev) =>
        prev.map((t) => (t.id === selectedTicket.id ? updatedTicket : t))
      );
      setSelectedTicket(updatedTicket);
      setStatusChoice(finalStatus);
      setReplySuccessMessage("Ticket reply and status successfully updated.");
    } catch (err: any) {
      console.error("Error saving ticket reply:", err);
      setReplyErrorMessage(err.message || "Failed to update ticket. Please try again.");
    } finally {
      setSavingReply(false);
    }
  };

  // Filtered Tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      // Status filter
      if (statusFilter !== "all" && t.status !== statusFilter) return false;

      // Role filter
      if (roleFilter !== "all" && t.sender_role !== roleFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSender = t.sender_name.toLowerCase().includes(q);
        const matchesSubject = t.subject.toLowerCase().includes(q);
        const matchesMessage = t.message.toLowerCase().includes(q);
        const matchesCode = t.sender_code ? t.sender_code.toLowerCase().includes(q) : false;
        if (!matchesSender && !matchesSubject && !matchesMessage && !matchesCode) return false;
      }

      return true;
    });
  }, [tickets, statusFilter, roleFilter, searchQuery]);

  // Metric counts
  const metrics = useMemo(() => {
    const total = tickets.length;
    const open = tickets.filter((t) => t.status === "open").length;
    const answered = tickets.filter((t) => t.status === "answered").length;
    const closed = tickets.filter((t) => t.status === "closed").length;
    const studentCount = tickets.filter((t) => t.sender_role === "student").length;
    const teacherCount = tickets.filter((t) => t.sender_role === "teacher").length;

    return { total, open, answered, closed, studentCount, teacherCount };
  }, [tickets]);

  return (
    <div className="space-y-8">
      {/* ─────────────────────────────────────────────────────────────
          HEADER
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
            <span>Helpdesk & Support Inbox</span>
            {metrics.open > 0 ? (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 font-mono font-bold animate-pulse">
                {metrics.open} Open Ticket{metrics.open === 1 ? "" : "s"}
              </span>
            ) : (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono">
                All Cleared
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Review support escalations and technical inquiries from students and faculty, provide official responses, and maintain ticket statuses.
          </p>
        </div>

        <button
          type="button"
          onClick={loadTickets}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.1] text-xs font-mono text-slate-300 hover:text-white transition-all self-start sm:self-auto cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#29d9ff]" : ""}`} />
          <span>Refresh Inbox</span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          METRICS CARDS
      ────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tickets */}
        <div className="p-4 rounded-2xl border border-white/[0.08] bg-[#070c18]/80 backdrop-blur-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>TOTAL TICKETS</span>
            <Inbox className="w-4 h-4 text-[#29d9ff]" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {loading ? "—" : metrics.total}
          </div>
          <p className="text-[10px] text-slate-400 font-mono">
            {metrics.studentCount} student • {metrics.teacherCount} teacher
          </p>
        </div>

        {/* Open Tickets */}
        <div className="p-4 rounded-2xl border border-white/[0.08] bg-[#070c18]/80 backdrop-blur-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>AWAITING REPLY</span>
            <AlertCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-400">
            {loading ? "—" : metrics.open}
          </div>
          <p className="text-[10px] text-slate-400 font-mono">Requiring administrative attention</p>
        </div>

        {/* Answered */}
        <div className="p-4 rounded-2xl border border-white/[0.08] bg-[#070c18]/80 backdrop-blur-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>ANSWERED</span>
            <LifeBuoy className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {loading ? "—" : metrics.answered}
          </div>
          <p className="text-[10px] text-slate-400 font-mono">Response delivered to sender</p>
        </div>

        {/* Closed */}
        <div className="p-4 rounded-2xl border border-white/[0.08] bg-[#070c18]/80 backdrop-blur-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>RESOLVED & CLOSED</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {loading ? "—" : metrics.closed}
          </div>
          <p className="text-[10px] text-slate-400 font-mono">Archived historical tickets</p>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          FILTER CONTROLS BAR
      ────────────────────────────────────────────────────────────── */}
      <div className="p-4 rounded-2xl border border-white/[0.08] bg-[#070c18] flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tickets by sender, subject, or message..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#04060a] border border-white/[0.1] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#29d9ff]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdowns */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[#04060a] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#29d9ff]"
            >
              <option value="all">All Statuses ({tickets.length})</option>
              <option value="open">Open ({metrics.open})</option>
              <option value="answered">Answered ({metrics.answered})</option>
              <option value="closed">Closed ({metrics.closed})</option>
            </select>
          </div>

          {/* Role Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Sender Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[#04060a] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#29d9ff]"
            >
              <option value="all">All Senders</option>
              <option value="student">Students ({metrics.studentCount})</option>
              <option value="teacher">Faculty / Teachers ({metrics.teacherCount})</option>
            </select>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TICKETS LIST / TABLE
      ────────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] overflow-hidden space-y-0">
        <div className="p-4 border-b border-white/[0.08] bg-[#0a1122] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#29d9ff]" />
            <span className="font-mono text-xs font-semibold text-white uppercase tracking-wider">
              Tickets ({filteredTickets.length})
            </span>
          </div>
          <span className="font-mono text-xs text-slate-400">
            Click any ticket row to view full details and submit an admin reply
          </span>
        </div>

        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-white/[0.03] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <LifeBuoy className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-base font-semibold text-white">No tickets found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {tickets.length === 0
                ? "There are currently no support tickets submitted by users."
                : "No help tickets match your active filter and search keywords."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.02] text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4">Sender</th>
                  <th className="py-3 px-4">Subject & Message</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Admin Response</th>
                  <th className="py-3 px-4 text-right">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredTickets.map((t) => {
                  const { initial } = getFirstNameAndInitial(t.sender_name, "User");
                  const dateObj = new Date(t.created_at);
                  const formattedDate = dateObj.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  });
                  const formattedTime = dateObj.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <tr
                      key={t.id}
                      onClick={() => handleOpenTicketModal(t)}
                      className="hover:bg-white/[0.03] transition-colors cursor-pointer group"
                    >
                      {/* Sender */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-white/[0.06] border border-white/[0.1] text-slate-300 font-bold text-[11px] flex items-center justify-center shrink-0">
                            {initial}
                          </div>
                          <div>
                            <div className="font-semibold text-white group-hover:text-[#29d9ff] transition-colors">
                              {t.sender_name}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span
                                className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded border ${
                                  t.sender_role === "teacher"
                                    ? "bg-cyan-500/10 text-[#29d9ff] border-[#29d9ff]/25"
                                    : "bg-purple-500/10 text-purple-400 border-purple-500/25"
                                }`}
                              >
                                {t.sender_role}
                              </span>
                              {t.sender_code && (
                                <span className="text-[10px] font-mono text-slate-500">
                                  {t.sender_code}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Subject & Message */}
                      <td className="py-4 px-4 max-w-md">
                        <div className="font-semibold text-white text-sm truncate">
                          {t.subject}
                        </div>
                        <p className="text-slate-400 text-xs line-clamp-1 mt-0.5">
                          {t.message}
                        </p>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider font-bold border ${
                            t.status === "open"
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                              : t.status === "answered"
                              ? "bg-cyan-500/10 text-[#29d9ff] border-[#29d9ff]/30"
                              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>

                      {/* Reply preview */}
                      <td className="py-4 px-4 max-w-xs">
                        {t.reply ? (
                          <div className="flex items-start gap-1.5 text-xs text-slate-300">
                            <span className="text-cyan-400 font-mono text-[10px] uppercase font-bold shrink-0 mt-0.5">
                              Replied:
                            </span>
                            <span className="line-clamp-1 text-slate-400">{t.reply}</span>
                          </div>
                        ) : (
                          <span className="text-[11px] font-mono text-slate-500 italic">
                            Awaiting response...
                          </span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="py-4 px-4 text-right whitespace-nowrap font-mono text-[11px]">
                        <div className="text-slate-300">{formattedDate}</div>
                        <div className="text-[10px] text-slate-500">{formattedTime}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODAL: TICKET DETAIL & REPLY INTERFACE
      ────────────────────────────────────────────────────────────── */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[92vh] rounded-2xl border border-white/[0.12] bg-[#070c18] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-6 border-b border-white/[0.08] flex items-start justify-between gap-4 bg-[#0a1122]">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider font-bold border ${
                      selectedTicket.status === "open"
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                        : selectedTicket.status === "answered"
                        ? "bg-cyan-500/10 text-[#29d9ff] border-[#29d9ff]/30"
                        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    }`}
                  >
                    Status: {selectedTicket.status}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    ID: {selectedTicket.id.slice(0, 8)}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white leading-tight">
                  {selectedTicket.subject}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conversation Flow */}
            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              {/* Feedback messages */}
              {replySuccessMessage && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{replySuccessMessage}</span>
                </div>
              )}
              {replyErrorMessage && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{replyErrorMessage}</span>
                </div>
              )}

              {/* Sender Message Box */}
              <div className="rounded-xl border border-white/[0.08] bg-[#04060a] p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-white/[0.06] text-slate-300 font-bold text-[10px] flex items-center justify-center">
                      {selectedTicket.sender_name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-semibold text-white text-xs">
                      {selectedTicket.sender_name}
                    </span>
                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-white/[0.05] text-slate-400 border border-white/[0.08]">
                      {selectedTicket.sender_role}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">
                    {new Date(selectedTicket.created_at).toLocaleString()}
                  </span>
                </div>

                <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {selectedTicket.message}
                </p>
              </div>

              {/* Previous Admin Reply Display if already set */}
              {selectedTicket.reply && (
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.03] p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-mono text-[#29d9ff] font-semibold">
                    <LifeBuoy className="w-3.5 h-3.5" />
                    <span>Current Official Response</span>
                  </div>
                  <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {selectedTicket.reply}
                  </p>
                </div>
              )}

              {/* Reply Drafting Form */}
              <form onSubmit={handleSaveReply} className="space-y-4 pt-2 border-t border-white/[0.08]">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300 uppercase tracking-wider flex items-center justify-between">
                    <span>Admin Reply</span>
                    <span className="text-[10px] text-slate-500">
                      Visible to {selectedTicket.sender_name} in their helpdesk
                    </span>
                  </label>
                  <textarea
                    rows={4}
                    value={replyInput}
                    onChange={(e) => setReplyInput(e.target.value)}
                    placeholder="Type official administrative response..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#04060a] border border-white/[0.1] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#29d9ff] resize-none leading-relaxed"
                  />
                </div>

                {/* Status Selector & Rule Explanation */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="space-y-0.5">
                    <label className="text-xs font-mono text-slate-300 uppercase tracking-wider block">
                      Target Ticket Status
                    </label>
                    <p className="text-[10px] text-slate-500 font-mono">
                      Saving a reply marks the ticket as Answered unless another status is selected.
                    </p>
                  </div>

                  <select
                    value={statusChoice}
                    onChange={(e) => setStatusChoice(e.target.value as any)}
                    className="px-3 py-1.5 rounded-xl bg-[#04060a] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#29d9ff] shrink-0"
                  >
                    <option value="open">Open (Unresolved)</option>
                    <option value="answered">Answered (Default upon reply)</option>
                    <option value="closed">Closed (Issue resolved)</option>
                  </select>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={savingReply}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#29d9ff] hover:bg-[#6be4ff] text-[#04060a] font-mono text-xs uppercase tracking-wider font-bold transition-all disabled:opacity-50 shadow-[0_0_12px_rgba(41,217,255,0.25)]"
                  >
                    {savingReply ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>Save Response & Status</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
