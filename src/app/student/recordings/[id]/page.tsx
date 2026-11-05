import React from "react";
import Link from "next/link";
import { PlayCircle, ArrowLeft } from "lucide-react";

export default async function RecordingPlayerPlaceholderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <Link
        href="/student"
        className="inline-flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-[#29d9ff] transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Student Portal</span>
      </Link>

      <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-8 sm:p-14 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-[#29d9ff]/10 text-[#29d9ff] flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(41,217,255,0.25)]">
          <PlayCircle className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <div className="font-mono text-xs uppercase tracking-widest text-[#29d9ff]">
            Protected Video Player
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Player coming soon</h1>
          <p className="font-mono text-xs text-slate-500">Recording ID: {id}</p>
        </div>
        <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
          The real protected player with dynamic forensic watermarks, telemetry tracking, and timeline bookmarks will be available here soon.
        </p>
      </div>
    </div>
  );
}
