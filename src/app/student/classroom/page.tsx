import React from "react";
import Link from "next/link";
import { Video, ArrowLeft } from "lucide-react";

export default function ClassroomPage() {
  return (
    <div className="space-y-6">
      <Link
        href="/student"
        className="inline-flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-[#29d9ff] transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Student Dashboard</span>
      </Link>

      <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-8 sm:p-12 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-[#29d9ff]/10 text-[#29d9ff] flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(41,217,255,0.2)]">
          <Video className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <div className="font-mono text-xs uppercase tracking-widest text-[#29d9ff]">
            Virtual Classroom
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Live Classroom</h1>
        </div>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Coming soon. In-app WebRTC rooms with dynamic watermarking and attendance tracking.
        </p>
      </div>
    </div>
  );
}
