"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  HelpCircle,
  MessageSquare,
  Send,
  ShieldAlert,
  AlertCircle,
  Inbox,
} from "lucide-react";

interface HelpTicketItem {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  status: "open" | "answered" | "closed";
  reply: string | null;
  created_at: string;
}

export default function HelpdeskPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<HelpTicketItem[]>([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTickets() {
      try {
        setLoading(true);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        // Fetch student's own tickets (enforced by RLS)
        const { data: ticketsData, error } = (await supabase
          .from("help_tickets")
          .select("id, user_id, subject, message, status, reply, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })) as {
          data: HelpTicketItem[] | null;
          error: unknown;
        };

        if (error) {
          console.error("Error fetching tickets:", error);
        } else {
          setTickets(ticketsData || []);
        }
      } catch (err) {
        console.error("Unexpected error loading helpdesk tickets:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchTickets();
  }, [supabase, router]);

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!subject.trim()) {
      setFormError("Please enter a ticket subject.");
      return;
    }

    if (!message.trim()) {
      setFormError("Please enter a detailed message.");
      return;
    }

    try {
      setSubmitting(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // Enforced by strict RLS: user_id must be auth.uid(), status must be 'open', reply must be null
      const { data: newTicket, error } = (await (supabase
        .from("help_tickets") as any)
        .insert({
          user_id: user.id,
          subject: subject.trim(),
          message: message.trim(),
          status: "open",
          reply: null,
        })
        .select("id, user_id, subject, message, status, reply, created_at")
        .single()) as { data: HelpTicketItem | null; error: any };

      if (error) {
        console.error("Ticket submission error:", error);
        throw new Error(error.message || "Failed to submit help ticket.");
      }

      if (newTicket) {
        setTickets((prev) => [newTicket, ...prev]);
        setSubject("");
        setMessage("");
        setFormSuccess("Your ticket has been submitted. An administrator or teacher will review it shortly.");
      }
    } catch (err: any) {
      setFormError(err.message || "An unexpected error occurred while submitting your ticket.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* ─────────────────────────────────────────────────────────────
          PAGE HEADER
      ────────────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <Link
          href="/student"
          className="inline-flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-[#29d9ff] transition-colors group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Dashboard</span>
        </Link>

        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-[#29d9ff]">
            STUDENT ASSISTANCE
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Helpdesk & Support
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Submit questions regarding course materials, session attendance, or platform assistance.
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-8 items-start">
        {/* ───────────────────────────────────────────────────────────
            LEFT COLUMN (Form to Submit a Ticket)
        ──────────────────────────────────────────────────────────── */}
        <div className="w-full lg:col-span-5 space-y-6">
          <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-5 sm:p-7 space-y-5">
            <div className="border-b border-white/[0.06] pb-3">
              <span className="font-mono text-xs uppercase tracking-wider text-[#29d9ff]">
                NEW INQUIRY
              </span>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Submit a Support Ticket
              </h2>
            </div>

            {formSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{formSuccess}</span>
              </div>
            )}

            {formError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitTicket} className="space-y-4">
              {/* Subject */}
              <div className="space-y-1.5">
                <label
                  htmlFor="subject"
                  className="block font-mono text-xs uppercase tracking-wider text-slate-300"
                >
                  Subject
                </label>
                <input
                  id="subject"
                  type="text"
                  required
                  placeholder="e.g. Question on neural backpropagation derivation"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-[#04060a] px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#29d9ff] focus:ring-1 focus:ring-[#29d9ff] transition-colors"
                />
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <label
                  htmlFor="message"
                  className="block font-mono text-xs uppercase tracking-wider text-slate-300"
                >
                  Detailed Message
                </label>
                <textarea
                  id="message"
                  required
                  rows={5}
                  placeholder="Describe your question or issue in detail..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-[#04060a] px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#29d9ff] focus:ring-1 focus:ring-[#29d9ff] transition-colors resize-none leading-relaxed"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#29d9ff] text-[#04060a] font-mono text-xs uppercase tracking-wider font-bold shadow-[0_0_15px_rgba(41,217,255,0.3)] hover:bg-[#6be4ff] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <span>Submitting...</span>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Ticket</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* ───────────────────────────────────────────────────────────
            RIGHT COLUMN (List of Student's Own Tickets)
        ──────────────────────────────────────────────────────────── */}
        <div className="w-full lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#29d9ff]" />
              <h2 className="text-lg font-bold text-white tracking-tight">Your Tickets</h2>
            </div>
            <span className="font-mono text-xs text-slate-400">
              {tickets.length} {tickets.length === 1 ? "Ticket" : "Tickets"}
            </span>
          </div>

          {loading ? (
            // Loading Skeletons
            <div className="space-y-4 animate-pulse">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-36 rounded-2xl bg-white/[0.04] border border-white/[0.06]"
                />
              ))}
            </div>
          ) : tickets.length > 0 ? (
            <div className="space-y-4">
              {tickets.map((t) => {
                const dateStr = new Date(t.created_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                });

                // Status styling: open / answered / closed
                const statusBadge =
                  t.status === "answered"
                    ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
                    : t.status === "open"
                    ? "text-[#29d9ff] bg-[#29d9ff]/10 border-[#29d9ff]/20"
                    : "text-slate-400 bg-slate-500/10 border-slate-500/20";

                return (
                  <div
                    key={t.id}
                    className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-5 sm:p-6 space-y-4 transition-all hover:border-[#29d9ff]/20"
                  >
                    {/* Ticket Header */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 border-b border-white/[0.05] pb-3">
                      <div className="space-y-1">
                        <span
                          className={`inline-block font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusBadge}`}
                        >
                          {t.status.toUpperCase()}
                        </span>
                        <h3 className="text-base font-bold text-white">{t.subject}</h3>
                      </div>
                      <span className="font-mono text-[11px] text-slate-500 shrink-0">
                        {dateStr}
                      </span>
                    </div>

                    {/* Student's Message */}
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {t.message}
                    </p>

                    {/* Admin's Reply If Present */}
                    {t.reply ? (
                      <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.04] p-4 space-y-2">
                        <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-emerald-400 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Admin / Instructor Resolution</span>
                        </div>
                        <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                          {t.reply}
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500 pt-1">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>Awaiting staff response</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.06] bg-[#070c18]/50 p-10 text-center space-y-2">
              <Inbox className="w-8 h-8 text-slate-600 mx-auto" />
              <h3 className="text-sm font-semibold text-white">No support tickets submitted yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Have a question or need assistance with your curriculum? Fill out the form on the left to submit a ticket.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
