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
  ShieldCheck,
  AlertCircle,
  Inbox,
  UserCheck,
  LifeBuoy,
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

export default function TeacherHelpdeskPage() {
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
    async function fetchTeacherTickets() {
      try {
        setLoading(true);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        // Fetch teacher's own tickets (enforced by RLS)
        const { data: ticketsData, error } = await supabase
          .from("help_tickets")
          .select("id, user_id, subject, message, status, reply, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching teacher helpdesk tickets:", error);
        } else {
          setTickets((ticketsData as HelpTicketItem[]) || []);
        }
      } catch (err) {
        console.error("Unexpected error loading helpdesk tickets:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchTeacherTickets();
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
      setFormError("Please enter your message or query details.");
      return;
    }

    try {
      setSubmitting(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setFormError("You must be logged in to submit a support inquiry.");
        return;
      }

      const { data, error } = await (supabase.from("help_tickets") as any)
        .insert({
          user_id: user.id,
          subject: subject.trim(),
          message: message.trim(),
          status: "open",
        })
        .select()
        .single();

      if (error) {
        console.error("Error submitting help ticket:", error);
        setFormError(error.message || "Failed to submit ticket. Please try again.");
      } else if (data) {
        setTickets((prev) => [data as HelpTicketItem, ...prev]);
        setSubject("");
        setMessage("");
        setFormSuccess("Your ticket has been sent to Administration. You will see their reply here.");
        setTimeout(() => setFormSuccess(null), 5000);
      }
    } catch (err: any) {
      console.error("Unexpected error submitting ticket:", err);
      setFormError(err.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <Link
            href="/teacher"
            className="inline-flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-[#29d9ff] transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Teacher Dashboard</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <span>Faculty Helpdesk & Support</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Submit administrative inquiries, technical assistance requests, or curriculum questions directly to administration.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-[#29d9ff]/30 text-xs font-mono text-[#29d9ff] self-start sm:self-auto">
          <LifeBuoy className="w-3.5 h-3.5" />
          <span>Priority Faculty Support</span>
        </div>
      </div>

      {/* Main Grid: Form Left, Tickets History Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Submit Ticket Form */}
        <div className="lg:col-span-5 rounded-2xl border border-white/[0.08] bg-[#070c18] p-6 space-y-6">
          <div className="space-y-1">
            <div className="text-xs font-mono uppercase text-[#29d9ff] tracking-wider">
              NEW SUPPORT REQUEST
            </div>
            <h2 className="text-lg font-bold text-white">Contact Administration</h2>
            <p className="text-xs text-slate-400">
              Staff coordinators will review your submission and reply directly.
            </p>
          </div>

          {formSuccess && (
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-mono flex items-start gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formSuccess}</span>
            </div>
          )}

          {formError && (
            <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 text-xs font-mono flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmitTicket} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-mono text-slate-300">
                SUBJECT <span className="text-[#29d9ff]">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., Live lecture equipment issue, course schedule conflict"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={submitting}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#04060a] border border-white/[0.1] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#29d9ff] disabled:opacity-50 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-mono text-slate-300">
                MESSAGE <span className="text-[#29d9ff]">*</span>
              </label>
              <textarea
                rows={5}
                placeholder="Describe your issue or request in detail..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={submitting}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#04060a] border border-white/[0.1] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#29d9ff] disabled:opacity-50 transition-colors resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#29d9ff] hover:bg-cyan-300 text-slate-950 font-bold text-xs shadow-[0_0_20px_rgba(41,217,255,0.25)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Ticket</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Ticket History */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#29d9ff]" />
              <span>Your Submitted Inquiries</span>
            </h2>
            <span className="text-xs font-mono text-slate-400">
              {tickets.length} ticket{tickets.length === 1 ? "" : "s"}
            </span>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-5 space-y-3 animate-pulse"
                >
                  <div className="h-4 w-48 bg-white/[0.06] rounded" />
                  <div className="h-12 bg-white/[0.03] rounded-xl" />
                </div>
              ))}
            </div>
          ) : tickets.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.04] text-slate-400 flex items-center justify-center mx-auto">
                <Inbox className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-white">No Tickets Submitted</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                You haven&apos;t filed any faculty support inquiries yet. Use the form on the left to reach out to Administration.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {tickets.map((t) => {
                const dateStr = new Date(t.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });

                return (
                  <div
                    key={t.id}
                    className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-5 space-y-4 transition-all hover:border-white/[0.14]"
                  >
                    {/* Ticket Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.04] pb-3">
                      <div>
                        <h3 className="font-semibold text-white text-sm">{t.subject}</h3>
                        <span className="text-[11px] font-mono text-slate-400">{dateStr}</span>
                      </div>

                      {/* Status Badge */}
                      <div>
                        {t.status === "open" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Clock className="w-3 h-3" />
                            <span>Open</span>
                          </span>
                        )}
                        {t.status === "answered" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-[#29d9ff]/10 text-[#29d9ff] border border-[#29d9ff]/20">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Answered</span>
                          </span>
                        )}
                        {t.status === "closed" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Closed</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Teacher Message */}
                    <div className="space-y-1">
                      <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                        YOUR INQUIRY
                      </div>
                      <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {t.message}
                      </p>
                    </div>

                    {/* Admin Reply */}
                    {t.reply ? (
                      <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/20 space-y-2 mt-2">
                        <div className="flex items-center gap-2 text-xs font-mono text-[#29d9ff]">
                          <ShieldCheck className="w-4 h-4" />
                          <span className="font-semibold">Administration Reply</span>
                        </div>
                        <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed pl-6">
                          {t.reply}
                        </p>
                      </div>
                    ) : (
                      <div className="text-[11px] font-mono text-slate-500 italic flex items-center gap-1.5 pt-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>Awaiting administrative response...</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
