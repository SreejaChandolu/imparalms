import React from "react";
import Link from "next/link";
import { Radio, ArrowLeft, Video } from "lucide-react";

export default async function LiveRoomPlaceholderPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  return (
    <div className="min-h-screen bg-[#04060a] text-slate-100 flex flex-col selection:bg-[#29d9ff]/30 selection:text-white">
      {/* Top Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#04060a]/85 border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/student" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded bg-[#29d9ff] text-[#04060a] font-mono font-black text-sm flex items-center justify-center shadow-[0_0_15px_rgba(41,217,255,0.4)] group-hover:scale-105 transition-transform">
              I
            </div>
            <span className="text-xl font-bold tracking-tight text-white group-hover:text-[#29d9ff] transition-colors">
              Impara
            </span>
          </Link>

          <Link
            href="/student/classroom"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/10 bg-white/[0.04] text-xs font-mono text-slate-300 hover:text-[#29d9ff] hover:border-[#29d9ff]/30 transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Virtual Classroom</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-16 flex flex-col items-center justify-center">
        <div className="w-full rounded-2xl border border-white/[0.08] bg-[#070c18] p-8 sm:p-14 text-center space-y-5 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-red-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto border border-red-500/20 shadow-[0_0_25px_rgba(239,68,68,0.25)]">
            <Radio className="w-8 h-8 animate-pulse" />
          </div>

          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-red-400 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
              <span>LIVE ROOM</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Live room coming soon
            </h1>
            <p className="font-mono text-xs text-slate-500">Session ID: {sessionId}</p>
          </div>

          <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
            The real interactive LiveKit WebRTC video room with real-time dynamic watermarking, low-latency audio/video, and attendance telemetry is coming soon.
          </p>

          <div className="pt-2">
            <Link
              href="/student/classroom"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#29d9ff] text-[#04060a] font-mono text-xs uppercase tracking-wider font-bold shadow-[0_0_15px_rgba(41,217,255,0.3)] hover:bg-[#6be4ff] transition-all"
            >
              <Video className="w-3.5 h-3.5" />
              <span>Back to Virtual Classroom</span>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.08] bg-[#020306] py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-mono">
          <p>© 2026 Impara</p>
          <div className="flex items-center gap-6">
            <Link href="/student/helpdesk" className="hover:text-[#29d9ff] transition-colors">
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
