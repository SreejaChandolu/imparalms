import React from "react";
import Link from "next/link";
import { GraduationCap, Video, ShieldCheck, Film, Users, BookOpen } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col justify-between">
      {/* Navigation Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-sm">
              I
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">Impara</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 ml-2 border border-indigo-200">
              LMS Platform
            </span>
          </div>

          <nav className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg shadow-sm transition-colors"
            >
              Student Sign Up
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex flex-col items-center justify-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-medium mb-6">
          <GraduationCap className="w-4 h-4" />
          <span>Interactive Live Classes & Protected Video Playback</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 tracking-tight max-w-3xl leading-tight">
          Learn live. Rewatch securely. <br />
          <span className="text-indigo-600">Track every second.</span>
        </h1>

        <p className="mt-5 text-lg text-slate-600 max-w-2xl leading-relaxed">
          Impara is a modern Learning Management System with in-app WebRTC live video classrooms,
          authenticated playback recordings, and granular progress tracking with server-enforced security.
        </p>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 max-w-5xl w-full text-left">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 mb-4">
              <Video className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-900 text-base">In-App Live Classes</h3>
            <p className="mt-2 text-sm text-slate-500 leading-normal">
              Direct LiveKit WebRTC video rooms embedded in the app. No external redirects or third-party links required.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 mb-4">
              <Film className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-900 text-base">Protected Recordings & Progress</h3>
            <p className="mt-2 text-sm text-slate-500 leading-normal">
              Private Supabase Storage with short-lived signed URLs and real-time playback heartbeat progress tracking.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-900 text-base">Role-Based Security</h3>
            <p className="mt-2 text-sm text-slate-500 leading-normal">
              Strict multi-tier roles (student, teacher, admin) enforced at the server boundary and via Postgres Row Level Security.
            </p>
          </div>
        </div>

        {/* Roles Breakdown */}
        <div className="mt-12 w-full max-w-5xl bg-slate-100 rounded-2xl p-6 border border-slate-200 text-left">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-semibold text-slate-900">Supported Roles & Access</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded bg-emerald-100 text-emerald-800 mb-2">
                Student
              </span>
              <p className="text-slate-600 text-xs leading-relaxed">
                Self-service sign up, attend scheduled live classes, access class recordings, track completion progress.
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded bg-sky-100 text-sky-800 mb-2">
                Teacher
              </span>
              <p className="text-slate-600 text-xs leading-relaxed">
                Created by Admin. Host live video rooms, manage courses and sessions, upload recordings, review student progress.
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded bg-purple-100 text-purple-800 mb-2">
                Admin
              </span>
              <p className="text-slate-600 text-xs leading-relaxed">
                Created by Admin. Manage all platform users, create teacher and admin accounts, system configuration and audit logs.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <p>© {new Date().getFullYear()} Impara LMS. Built with Next.js App Router, Supabase, and LiveKit.</p>
          <div className="flex items-center gap-4">
            <span>Status: Scaffold Initialized</span>
            <span>•</span>
            <span className="text-emerald-600 font-medium">Ready for Development</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
