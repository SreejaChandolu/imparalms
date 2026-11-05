import React from "react";
import Link from "next/link";
import { ArrowLeft, MessageSquare } from "lucide-react";

export default function AdminHelpdeskPlaceholderPage() {
  return (
    <div className="space-y-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-[#29d9ff] transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Admin Dashboard</span>
      </Link>

      <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-8 sm:p-14 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-indigo-400/10 text-indigo-400 flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(129,140,248,0.2)]">
          <MessageSquare className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <div className="font-mono text-xs uppercase tracking-widest text-[#29d9ff]">
            SUPPORT ESCALATIONS
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Helpdesk Inbox</h1>
        </div>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Coming soon. Respond to student and faculty support tickets, resolve priority technical inquiries, and maintain knowledge base entries.
        </p>
      </div>
    </div>
  );
}
