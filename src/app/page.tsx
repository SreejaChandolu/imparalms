"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Video,
  ShieldCheck,
  Film,
  Lock,
  Layers,
  Activity,
  ArrowRight,
  Menu,
  X,
  Play,
  Volume2,
  Mic,
  Maximize2,
  Sparkles,
  Radio,
  Clock,
  CheckCircle2,
  Database,
  KeyRound,
  FileKey,
  ShieldAlert,
} from "lucide-react";

export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#04060a] text-slate-100 flex flex-col selection:bg-[#29d9ff]/30 selection:text-white overflow-x-hidden">
      {/* ─────────────────────────────────────────────────────────────
          STICKY TOP NAVIGATION
      ────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#04060a]/85 border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          {/* Brand Logo & Wordmark */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded bg-[#29d9ff] text-[#04060a] font-mono font-black text-sm flex items-center justify-center shadow-[0_0_15px_rgba(41,217,255,0.4)] group-hover:scale-105 transition-transform">
              I
            </div>
            <span className="text-xl font-bold tracking-tight text-white group-hover:text-[#29d9ff] transition-colors">
              Impara
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8">
            <a
              href="#features"
              className="font-mono text-xs uppercase tracking-widest text-slate-400 hover:text-[#29d9ff] transition-colors"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="font-mono text-xs uppercase tracking-widest text-slate-400 hover:text-[#29d9ff] transition-colors"
            >
              How it works
            </a>
            <a
              href="#security"
              className="font-mono text-xs uppercase tracking-widest text-slate-400 hover:text-[#29d9ff] transition-colors"
            >
              Security
            </a>
            <a
              href="#roadmap"
              className="font-mono text-xs uppercase tracking-widest text-slate-400 hover:text-[#29d9ff] transition-colors"
            >
              Roadmap
            </a>
          </nav>

          {/* Desktop Right Actions: Outlined pill Student Login (NO /staff link) */}
          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full border border-[#29d9ff]/40 px-5 py-2 font-mono text-xs uppercase tracking-wider text-[#29d9ff] hover:bg-[#29d9ff]/10 hover:border-[#29d9ff] hover:shadow-[0_0_15px_rgba(41,217,255,0.25)] transition-all duration-200"
            >
              Student Login
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#070c18] border-b border-white/[0.08] px-4 pt-3 pb-6 space-y-4">
            <nav className="flex flex-col space-y-3">
              <a
                href="#features"
                onClick={() => setMobileMenuOpen(false)}
                className="font-mono text-xs uppercase tracking-widest text-slate-300 hover:text-[#29d9ff] py-1.5 transition-colors"
              >
                Features
              </a>
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="font-mono text-xs uppercase tracking-widest text-slate-300 hover:text-[#29d9ff] py-1.5 transition-colors"
              >
                How it works
              </a>
              <a
                href="#security"
                onClick={() => setMobileMenuOpen(false)}
                className="font-mono text-xs uppercase tracking-widest text-slate-300 hover:text-[#29d9ff] py-1.5 transition-colors"
              >
                Security
              </a>
              <a
                href="#roadmap"
                onClick={() => setMobileMenuOpen(false)}
                className="font-mono text-xs uppercase tracking-widest text-slate-300 hover:text-[#29d9ff] py-1.5 transition-colors"
              >
                Roadmap
              </a>
            </nav>
            <div className="pt-2 border-t border-white/[0.08] flex flex-col gap-2.5">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center rounded-full border border-[#29d9ff]/40 py-2.5 font-mono text-xs uppercase tracking-wider text-[#29d9ff] hover:bg-[#29d9ff]/10"
              >
                Student Login
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ─────────────────────────────────────────────────────────────
          HERO SECTION
      ────────────────────────────────────────────────────────────── */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-32 overflow-hidden hero-glow-bg">
        {/* Subtle background grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(#29d9ff 1px, transparent 1px)`,
            backgroundSize: "32px 32px",
          }}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Column: Headlines & Call-to-actions */}
            <div className="lg:col-span-7 text-left space-y-6">
              {/* Small pill tag */}
              <div className="inline-flex items-center gap-2 rounded-full border border-[#29d9ff]/30 bg-[#29d9ff]/10 px-3.5 py-1 text-[11px] font-mono uppercase tracking-[0.2em] text-[#29d9ff] shadow-[0_0_12px_rgba(41,217,255,0.15)]">
                <Radio className="w-3.5 h-3.5 animate-pulse text-[#29d9ff]" />
                <span>LIVE + RECORDED LEARNING</span>
              </div>

              {/* Giant three-line headline */}
              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.08] text-left">
                <span className="block text-white">Live Classes.</span>
                <span className="block text-slate-400">Protected Recordings.</span>
                <span className="block text-[#29d9ff] glow-cyan">Learning, Tracked.</span>
              </h1>

              {/* Short paragraph */}
              <p className="text-base sm:text-lg text-slate-400 max-w-xl leading-relaxed font-normal">
                Impara is a precision learning platform built for live WebRTC cohorts and leak-resistant media
                distribution. Attend interactive sessions in-app, rewatch forensic-watermarked archives, and
                verify genuine watch progress with server-enforced checkpoints.
              </p>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap items-center gap-4">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#29d9ff] px-7 py-3.5 text-sm font-semibold text-[#04060a] shadow-[0_0_25px_rgba(41,217,255,0.35)] hover:bg-[#29d9ff]/90 hover:shadow-[0_0_35px_rgba(41,217,255,0.5)] transition-all duration-200"
                >
                  <span>Start learning</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <a
                  href="#how-it-works"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-6 py-3.5 text-sm font-medium text-slate-300 hover:text-white hover:border-[#29d9ff]/40 hover:bg-white/[0.06] transition-all duration-200"
                >
                  <span>See how it works</span>
                  <span className="text-[#29d9ff]">↓</span>
                </a>
              </div>

              {/* Mini trust metadata */}
              <div className="pt-4 flex items-center gap-6 text-xs font-mono text-slate-500">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Sub-300ms WebRTC</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#29d9ff]" />
                  <span>Postgres RLS Guard</span>
                </div>
              </div>
            </div>

            {/* Right Column: Mock Live-Class Card with Drifting Watermark & Floating Chips */}
            <div className="lg:col-span-5 relative">
              {/* Outer Glow behind the card */}
              <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#29d9ff]/20 to-transparent blur-xl opacity-50" />

              {/* Floating Chip: LIVE NOW (Top Right) */}
              <div className="absolute -top-3.5 -right-2 sm:-right-4 z-20 flex items-center gap-2 rounded-full border border-red-500/30 bg-[#070c18]/90 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-red-400 shadow-lg backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                <span>LIVE NOW</span>
              </div>

              {/* Floating Chip: RECORDING (Top Left) */}
              <div className="absolute -top-3.5 -left-2 sm:-left-4 z-20 flex items-center gap-1.5 rounded-full border border-white/15 bg-[#070c18]/90 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-slate-300 shadow-lg backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span>REC • 1080P</span>
              </div>

              {/* Floating Chip: WATERMARK (Bottom Left) */}
              <div className="absolute -bottom-3.5 -left-2 sm:-left-3 z-20 flex items-center gap-1.5 rounded-full border border-[#29d9ff]/30 bg-[#070c18]/95 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-[#29d9ff] shadow-lg backdrop-blur-md">
                <ShieldCheck className="w-3.5 h-3.5 text-[#29d9ff]" />
                <span>WATERMARK ACTIVE</span>
              </div>

              {/* Floating Chip: COMPLETION (Bottom Right) */}
              <div className="absolute -bottom-3.5 -right-2 sm:-right-3 z-20 flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-[#070c18]/95 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-emerald-400 shadow-lg backdrop-blur-md">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span>94.2% HEARTBEAT SYNC</span>
              </div>

              {/* Main Mock Player Card */}
              <div className="relative rounded-2xl border border-white/[0.12] bg-[#070c18] shadow-2xl overflow-hidden">
                {/* Window Chrome Header */}
                <div className="px-4 py-3 bg-[#0a1120] border-b border-white/[0.08] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                    <span className="ml-2 font-mono text-[11px] text-slate-400 truncate max-w-[150px] sm:max-w-none">
                      {"ROOM // CS-501-DISTRIBUTED"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[10px] text-slate-400">
                    <span className="px-2 py-0.5 rounded bg-white/[0.06] border border-white/[0.05]">
                      38 ATTENDEES
                    </span>
                  </div>
                </div>

                {/* Video Stage Area */}
                <div className="relative aspect-[16/10] bg-[#03060c] p-4 flex flex-col justify-between overflow-hidden">
                  {/* Visual Background / Mock Slide content */}
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-950/20 via-transparent to-slate-950/80 pointer-events-none" />

                  {/* Lecture Slide Mock Representation */}
                  <div className="relative z-0 space-y-2 max-w-[80%] pt-2">
                    <div className="inline-block font-mono text-[10px] uppercase tracking-widest text-[#29d9ff] bg-[#29d9ff]/10 px-2 py-0.5 rounded border border-[#29d9ff]/20">
                      Module 04.2 • Consensus Protocols
                    </div>
                    <div className="text-sm sm:text-base font-semibold text-white tracking-tight">
                      Raft State Machine & Leader Election
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono leading-relaxed hidden sm:block">
                      Term increments on Candidate heartbeat timeout. Majority quorum quorum = ⌊n/2⌋ + 1.
                    </p>
                  </div>

                  {/* DRIFTING NAME WATERMARK (Animated drifting diagonally) */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-10 overflow-hidden">
                    <div className="animate-drift-watermark flex items-center gap-2 font-mono text-[11px] text-white/30 bg-[#04060a]/40 backdrop-blur-[2px] px-3 py-1 rounded-md border border-white/10 shadow-sm">
                      <span className="text-[#29d9ff]/60 font-bold">IMPARA PROTECT</span>
                      <span>•</span>
                      <span>student_8492@impara</span>
                      <span>•</span>
                      <span>192.168.1.104</span>
                    </div>
                  </div>

                  {/* Teacher Inset Camera Preview (Bottom Right) */}
                  <div className="relative z-10 self-end mt-auto flex items-end justify-between w-full">
                    {/* Audio wave indicator */}
                    <div className="flex items-center gap-1 bg-[#04060a]/75 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-white/[0.08]">
                      <Mic className="w-3.5 h-3.5 text-[#29d9ff]" />
                      <div className="flex items-end gap-0.5 h-3">
                        <span className="w-0.5 h-2 bg-[#29d9ff] rounded-full animate-pulse" />
                        <span className="w-0.5 h-3 bg-[#29d9ff] rounded-full animate-pulse" />
                        <span className="w-0.5 h-1.5 bg-[#29d9ff] rounded-full animate-pulse" />
                        <span className="w-0.5 h-2.5 bg-[#29d9ff] rounded-full animate-pulse" />
                      </div>
                      <span className="font-mono text-[10px] text-slate-300 ml-1">Prof. Vance (Host)</span>
                    </div>

                    {/* Miniature video feed */}
                    <div className="w-24 h-16 sm:w-28 sm:h-20 rounded-lg border border-white/[0.15] bg-[#0c1424] overflow-hidden relative shadow-lg">
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10" />
                      <div className="absolute bottom-1 left-1.5 z-20 font-mono text-[9px] text-slate-300">
                        {"1080p // 60fps"}
                      </div>
                      <div className="w-full h-full flex items-center justify-center text-slate-600">
                        <Video className="w-6 h-6 text-[#29d9ff]/40" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Video Player Controls Bar */}
                <div className="px-4 py-3 bg-[#0a1120] border-t border-white/[0.08] flex items-center justify-between text-slate-400">
                  <div className="flex items-center gap-3">
                    <button type="button" className="text-white hover:text-[#29d9ff] transition-colors" aria-label="Play">
                      <Play className="w-4 h-4 fill-white" />
                    </button>
                    <button type="button" className="text-slate-400 hover:text-white transition-colors" aria-label="Volume">
                      <Volume2 className="w-4 h-4" />
                    </button>
                    <div className="font-mono text-[10px] text-slate-400">
                      <span className="text-[#29d9ff]">48:20</span> / 1:15:00
                    </div>
                  </div>

                  {/* Scrubber mock */}
                  <div className="flex-1 mx-4 h-1 bg-white/[0.1] rounded-full overflow-hidden max-w-[140px] sm:max-w-xs">
                    <div className="w-[64%] h-full bg-[#29d9ff] shadow-[0_0_8px_#29d9ff]" />
                  </div>

                  <div className="flex items-center gap-2">
                    <Maximize2 className="w-4 h-4 text-slate-400 hover:text-white transition-colors cursor-pointer" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION: FEATURES (6 Cards)
      ────────────────────────────────────────────────────────────── */}
      <section id="features" className="py-20 sm:py-28 border-t border-white/[0.08] relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-left max-w-2xl mb-16 space-y-3">
            <div className="font-mono text-xs uppercase tracking-[0.25em] text-[#29d9ff]">
              {"// 01 ARCHITECTURE & CAPABILITIES"}
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white">
              Engineered for high-trust education.
            </h2>
            <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
              Every component is built from the database schema up to ensure smooth live delivery, encrypted
              retrieval, and tamper-resistant progress telemetry.
            </p>
          </div>

          {/* 6 Feature Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#070c18]/80 p-7 hover:border-[#29d9ff]/30 hover:bg-[#070c18] transition-all duration-300 group">
              <div className="w-10 h-10 rounded-xl bg-[#29d9ff]/10 border border-[#29d9ff]/20 flex items-center justify-center text-[#29d9ff] mb-5 group-hover:scale-110 transition-transform">
                <Video className="w-5 h-5" />
              </div>
              <div className="font-mono text-[11px] text-slate-500 uppercase tracking-widest mb-1.5">
                WEBRTC / LIVEKIT
              </div>
              <h3 className="text-lg font-semibold text-white group-hover:text-[#29d9ff] transition-colors">
                In-App Live Classrooms
              </h3>
              <p className="mt-2.5 text-sm text-slate-400 leading-relaxed">
                Attend interactive rooms directly inside the browser. Sub-second WebRTC video, crystal audio,
                and screen-sharing with zero third-party downloads or external redirects.
              </p>
            </div>

            {/* Card 2 */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#070c18]/80 p-7 hover:border-[#29d9ff]/30 hover:bg-[#070c18] transition-all duration-300 group">
              <div className="w-10 h-10 rounded-xl bg-[#29d9ff]/10 border border-[#29d9ff]/20 flex items-center justify-center text-[#29d9ff] mb-5 group-hover:scale-110 transition-transform">
                <Film className="w-5 h-5" />
              </div>
              <div className="font-mono text-[11px] text-slate-500 uppercase tracking-widest mb-1.5">
                STORAGE / SIGNED URLS
              </div>
              <h3 className="text-lg font-semibold text-white group-hover:text-[#29d9ff] transition-colors">
                Protected Cloud Storage
              </h3>
              <p className="mt-2.5 text-sm text-slate-400 leading-relaxed">
                Lectures are automatically deposited in private Supabase Storage buckets. Access is provisioned
                exclusively through short-lived signed URLs verified against active enrollment.
              </p>
            </div>

            {/* Card 3 */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#070c18]/80 p-7 hover:border-[#29d9ff]/30 hover:bg-[#070c18] transition-all duration-300 group">
              <div className="w-10 h-10 rounded-xl bg-[#29d9ff]/10 border border-[#29d9ff]/20 flex items-center justify-center text-[#29d9ff] mb-5 group-hover:scale-110 transition-transform">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="font-mono text-[11px] text-slate-500 uppercase tracking-widest mb-1.5">
                ANTI-LEAK / FORENSIC
              </div>
              <h3 className="text-lg font-semibold text-white group-hover:text-[#29d9ff] transition-colors">
                Dynamic Name Watermark
              </h3>
              <p className="mt-2.5 text-sm text-slate-400 leading-relaxed">
                A non-obtrusive, drifting overlay renders the viewer’s email, session ID, and network hash
                continuously across the video surface to strongly discourage recording and unauthorized distribution.
              </p>
            </div>

            {/* Card 4 */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#070c18]/80 p-7 hover:border-[#29d9ff]/30 hover:bg-[#070c18] transition-all duration-300 group">
              <div className="w-10 h-10 rounded-xl bg-[#29d9ff]/10 border border-[#29d9ff]/20 flex items-center justify-center text-[#29d9ff] mb-5 group-hover:scale-110 transition-transform">
                <Activity className="w-5 h-5" />
              </div>
              <div className="font-mono text-[11px] text-slate-500 uppercase tracking-widest mb-1.5">
                HEARTBEAT / AUDIT
              </div>
              <h3 className="text-lg font-semibold text-white group-hover:text-[#29d9ff] transition-colors">
                Heartbeat Progress Tracking
              </h3>
              <p className="mt-2.5 text-sm text-slate-400 leading-relaxed">
                The player periodically synchronizes genuine watch time with the database. Scrub-skipping to
                the end cannot bypass completion—every minute is cryptographically logged.
              </p>
            </div>

            {/* Card 5 */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#070c18]/80 p-7 hover:border-[#29d9ff]/30 hover:bg-[#070c18] transition-all duration-300 group">
              <div className="w-10 h-10 rounded-xl bg-[#29d9ff]/10 border border-[#29d9ff]/20 flex items-center justify-center text-[#29d9ff] mb-5 group-hover:scale-110 transition-transform">
                <Database className="w-5 h-5" />
              </div>
              <div className="font-mono text-[11px] text-slate-500 uppercase tracking-widest mb-1.5">
                DATABASE / RLS
              </div>
              <h3 className="text-lg font-semibold text-white group-hover:text-[#29d9ff] transition-colors">
                Server & DB Policy Enforcement
              </h3>
              <p className="mt-2.5 text-sm text-slate-400 leading-relaxed">
                Roles (student, teacher, admin) are locked down by PostgreSQL Row Level Security and Next.js
                server action boundaries—never reliant on easily circumvented UI button hiding.
              </p>
            </div>

            {/* Card 6 */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#070c18]/80 p-7 hover:border-[#29d9ff]/30 hover:bg-[#070c18] transition-all duration-300 group">
              <div className="w-10 h-10 rounded-xl bg-[#29d9ff]/10 border border-[#29d9ff]/20 flex items-center justify-center text-[#29d9ff] mb-5 group-hover:scale-110 transition-transform">
                <Clock className="w-5 h-5" />
              </div>
              <div className="font-mono text-[11px] text-slate-500 uppercase tracking-widest mb-1.5">
                CROSS-DEVICE / RESUME
              </div>
              <h3 className="text-lg font-semibold text-white group-hover:text-[#29d9ff] transition-colors">
                Instant State Resumption
              </h3>
              <p className="mt-2.5 text-sm text-slate-400 leading-relaxed">
                Switch seamlessly between desktop and laptop. Playback position, watched markers, and course
                checkpoints are mirrored automatically to your student profile.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION: HOW IT WORKS (4 Numbered Steps)
      ────────────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 sm:py-28 border-t border-white/[0.08] bg-[#030509]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-left max-w-2xl mb-16 space-y-3">
            <div className="font-mono text-xs uppercase tracking-[0.25em] text-[#29d9ff]">
              {"// 02 END-TO-END WORKFLOW"}
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white">
              From live lecture to verified mastery.
            </h2>
            <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
              A streamlined, friction-free journey designed for students to focus entirely on learning while
              security protocols run quietly in the background.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Step 01 */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-7 flex flex-col justify-between hover:border-[#29d9ff]/30 transition-all">
              <div>
                <div className="font-mono text-3xl font-black text-[#29d9ff]/40 mb-4">
                  01
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#29d9ff] mb-2">
                  AUTHENTICATE
                </div>
                <h3 className="text-base font-semibold text-white mb-2">
                  Self-Serve Signup
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Students create their account securely through Supabase Auth. Server triggers default permissions
                  to the student role and prevent unauthorized privilege escalation.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/[0.06] font-mono text-[11px] text-slate-500">
                JWT • Session Cookies
              </div>
            </div>

            {/* Step 02 */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-7 flex flex-col justify-between hover:border-[#29d9ff]/30 transition-all">
              <div>
                <div className="font-mono text-3xl font-black text-[#29d9ff]/40 mb-4">
                  02
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#29d9ff] mb-2">
                  CONNECT
                </div>
                <h3 className="text-base font-semibold text-white mb-2">
                  Join Live Classroom
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  When a class starts, the Next.js server validates enrollment and mints a LiveKit token.
                  Students enter the WebRTC room instantly without opening external apps.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/[0.06] font-mono text-[11px] text-slate-500">
                LiveKit • WebRTC Sub-300ms
              </div>
            </div>

            {/* Step 03 */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-7 flex flex-col justify-between hover:border-[#29d9ff]/30 transition-all">
              <div>
                <div className="font-mono text-3xl font-black text-[#29d9ff]/40 mb-4">
                  03
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#29d9ff] mb-2">
                  PROTECT
                </div>
                <h3 className="text-base font-semibold text-white mb-2">
                  Secure Storage Vault
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Live sessions are archived to private Supabase Storage. Unauthenticated direct URLs are disabled;
                  only authenticated students receive time-bounded signed media tokens.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/[0.06] font-mono text-[11px] text-slate-500">
                Private Bucket • Signed URLs
              </div>
            </div>

            {/* Step 04 */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-7 flex flex-col justify-between hover:border-[#29d9ff]/30 transition-all">
              <div>
                <div className="font-mono text-3xl font-black text-[#29d9ff]/40 mb-4">
                  04
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#29d9ff] mb-2">
                  VERIFY
                </div>
                <h3 className="text-base font-semibold text-white mb-2">
                  Heartbeat Telemetry
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  The custom player plays video with an active drifting watermark and synchronizes playback
                  heartbeats every few seconds. Once 90% is logged, completion is verified.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/[0.06] font-mono text-[11px] text-slate-500">
                Telemetry • Watch Progress
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION: SECURITY ("Layers, not a single lock")
      ────────────────────────────────────────────────────────────── */}
      <section id="security" className="py-20 sm:py-28 border-t border-white/[0.08] relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-left max-w-3xl mb-16 space-y-4">
            <div className="font-mono text-xs uppercase tracking-[0.25em] text-[#29d9ff]">
              {"// 03 DEFENSE-IN-DEPTH"}
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white">
              Layers, not a single lock.
            </h2>
            <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
              Real-world educational content protection cannot rely on naive browser DRM or client-side
              button hiding. Impara employs a layered defense where each barrier operates independently
              of the client.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Security Layer 1 */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-8 space-y-4 hover:border-[#29d9ff]/30 transition-all">
              <div className="w-9 h-9 rounded-lg bg-[#29d9ff]/10 border border-[#29d9ff]/20 flex items-center justify-center text-[#29d9ff]">
                <Database className="w-5 h-5" />
              </div>
              <div className="font-mono text-xs text-[#29d9ff] uppercase tracking-widest">
                {"LAYER 01 // DATABASE RLS"}
              </div>
              <h3 className="text-lg font-semibold text-white">
                PostgreSQL Engine Isolation
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Row Level Security policies execute directly inside the PostgreSQL database engine. Even if an
                attacker intercepts the network traffic or forges API calls, they cannot read un-enrolled course
                records or another student&apos;s watch logs.
              </p>
            </div>

            {/* Security Layer 2 */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-8 space-y-4 hover:border-[#29d9ff]/30 transition-all">
              <div className="w-9 h-9 rounded-lg bg-[#29d9ff]/10 border border-[#29d9ff]/20 flex items-center justify-center text-[#29d9ff]">
                <FileKey className="w-5 h-5" />
              </div>
              <div className="font-mono text-xs text-[#29d9ff] uppercase tracking-widest">
                {"LAYER 02 // TIME-BOUNDED MEDIA TOKENS"}
              </div>
              <h3 className="text-lg font-semibold text-white">
                Short-Lived Signed URLs
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Raw MP4 files and HLS chunks are stored in private S3-compatible Supabase storage. Playback URLs
                are cryptographically signed on the server and expire within minutes, preventing shared or scraped
                direct download links.
              </p>
            </div>

            {/* Security Layer 3 */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-8 space-y-4 hover:border-[#29d9ff]/30 transition-all">
              <div className="w-9 h-9 rounded-lg bg-[#29d9ff]/10 border border-[#29d9ff]/20 flex items-center justify-center text-[#29d9ff]">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="font-mono text-xs text-[#29d9ff] uppercase tracking-widest">
                {"LAYER 03 // FORENSIC WATERMARKING"}
              </div>
              <h3 className="text-lg font-semibold text-white">
                Dynamic Viewer Watermarking
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                A moving, semi-transparent identifier constantly shifts position across the video canvas. Any
                screen recordings or external captures permanently embed the leaker&apos;s personal account identity
                and session timestamp.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION: ROADMAP (4 Cards with Status Pills)
      ────────────────────────────────────────────────────────────── */}
      <section id="roadmap" className="py-20 sm:py-28 border-t border-white/[0.08] bg-[#030509]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-left max-w-2xl mb-16 space-y-3">
            <div className="font-mono text-xs uppercase tracking-[0.25em] text-[#29d9ff]">
              {"// 04 PRODUCT TRAJECTORY"}
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white">
              Continuous platform evolution.
            </h2>
            <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
              We are actively rolling out capabilities to redefine live cohort interaction and protected
              video delivery.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Roadmap Card 1 */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-6 flex flex-col justify-between hover:border-[#29d9ff]/30 transition-all">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono text-xs text-slate-500">PHASE 01</span>
                  <span className="rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-400">
                    SHIPPED
                  </span>
                </div>
                <h3 className="text-base font-semibold text-white mb-2">
                  WebRTC Live Classrooms
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Low-latency LiveKit rooms with teacher screen sharing, live attendee roster, and real-time audio/video.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1.5 font-mono text-[11px] text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Production Ready</span>
              </div>
            </div>

            {/* Roadmap Card 2 */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-6 flex flex-col justify-between hover:border-[#29d9ff]/30 transition-all">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono text-xs text-slate-500">PHASE 02</span>
                  <span className="rounded-full bg-[#29d9ff]/10 border border-[#29d9ff]/25 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[#29d9ff]">
                    IN PRODUCTION
                  </span>
                </div>
                <h3 className="text-base font-semibold text-white mb-2">
                  Protected Storage Vault
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Private Supabase Storage integration with short-lived signed URLs generated on-demand per authorized student.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1.5 font-mono text-[11px] text-[#29d9ff]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Verified Core</span>
              </div>
            </div>

            {/* Roadmap Card 3 */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-6 flex flex-col justify-between hover:border-[#29d9ff]/30 transition-all">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono text-xs text-slate-500">PHASE 03</span>
                  <span className="rounded-full bg-amber-500/10 border border-amber-500/25 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-400">
                    IN PROGRESS
                  </span>
                </div>
                <h3 className="text-base font-semibold text-white mb-2">
                  Heartbeat Telemetry Engine
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Precision watch-progress heartbeat, auto-resuming video player bookmarks, and fraud-resistant completion gates.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1.5 font-mono text-[11px] text-amber-400">
                <Activity className="w-3.5 h-3.5" />
                <span>Active Sprint</span>
              </div>
            </div>

            {/* Roadmap Card 4 */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-6 flex flex-col justify-between hover:border-[#29d9ff]/30 transition-all">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono text-xs text-slate-500">PHASE 04</span>
                  <span className="rounded-full bg-slate-500/10 border border-slate-500/25 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                    PLANNED
                  </span>
                </div>
                <h3 className="text-base font-semibold text-white mb-2">
                  Hardware DRM & Offline Keys
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Encrypted offline caching and Widevine/FairPlay DRM streams for verified native desktop and mobile clients.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
                <Lock className="w-3.5 h-3.5" />
                <span>Upcoming</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          CLOSING CALL TO ACTION
      ────────────────────────────────────────────────────────────── */}
      <section className="py-20 sm:py-28 border-t border-white/[0.08] relative overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute inset-0 bg-radial-gradient from-[#29d9ff]/10 via-transparent to-transparent pointer-events-none" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="rounded-3xl border border-[#29d9ff]/20 bg-gradient-to-b from-[#0a1426] to-[#04060a] p-10 sm:p-16 shadow-[0_0_50px_-10px_rgba(41,217,255,0.15)]">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#29d9ff]/30 bg-[#29d9ff]/10 px-3.5 py-1 text-[11px] font-mono uppercase tracking-[0.2em] text-[#29d9ff] mb-6">
              <Sparkles className="w-3.5 h-3.5 text-[#29d9ff]" />
              <span>JOIN THE NEXT COHORT</span>
            </div>

            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white max-w-2xl mx-auto leading-tight">
              Ready for focused, leak-resistant live learning?
            </h2>

            <p className="mt-4 text-slate-400 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
              Create your student profile in seconds. Attend in-app live lectures and rewatch archives with
              playback progress always saved.
            </p>

            <div className="mt-8 flex justify-center">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#29d9ff] px-8 py-4 text-sm font-semibold text-[#04060a] shadow-[0_0_25px_rgba(41,217,255,0.4)] hover:bg-[#29d9ff]/90 hover:shadow-[0_0_40px_rgba(41,217,255,0.6)] transition-all duration-200"
              >
                <span>Start learning →</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          FOOTER
      ────────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.08] bg-[#020306] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded bg-[#29d9ff] text-[#04060a] font-mono font-bold text-xs flex items-center justify-center">
                I
              </div>
              <span className="text-base font-bold text-white tracking-tight">Impara</span>
              <span className="font-mono text-[10px] text-slate-500 uppercase tracking-wider ml-2">
                PLATFORM
              </span>
            </div>

            <div className="flex items-center gap-6 font-mono text-xs text-slate-500">
              <a href="#features" className="hover:text-[#29d9ff] transition-colors">
                Features
              </a>
              <a href="#how-it-works" className="hover:text-[#29d9ff] transition-colors">
                How it works
              </a>
              <a href="#security" className="hover:text-[#29d9ff] transition-colors">
                Security
              </a>
              <a href="#roadmap" className="hover:text-[#29d9ff] transition-colors">
                Roadmap
              </a>
            </div>
          </div>

          <div className="pt-6 border-t border-white/[0.06] text-center sm:text-left">
            <p className="text-xs sm:text-sm text-slate-500 font-mono leading-relaxed max-w-4xl">
              Impara is a learning platform in active development. Protection layers reduce, but cannot
              eliminate, the risk of recording or sharing. © 2026 Impara.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
