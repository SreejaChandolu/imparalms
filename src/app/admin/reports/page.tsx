import React from "react";
import Link from "next/link";
import { ArrowLeft, BarChart3 } from "lucide-react";

export default function AdminReportsPlaceholderPage() {
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
        <div className="w-14 h-14 rounded-2xl bg-emerald-400/10 text-emerald-400 flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(52,211,153,0.2)]">
          <BarChart3 className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <div className="font-mono text-xs uppercase tracking-widest text-[#29d9ff]">
            ACADEMIC AUDIT & ANALYTICS
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Platform Reports</h1>
        </div>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Coming soon. Platform-wide 75% attendance compliance reports, rating telemetry aggregations, and CSV exports for institution accreditation.
        </p>
      </div>
    </div>
  );
}
