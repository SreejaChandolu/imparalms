"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  Clock,
  Eye,
  EyeOff,
  Filter,
  Loader2,
  PlayCircle,
  Search,
  Video,
  AlertCircle,
  CheckCircle2,
  Shield,
  Layers,
} from "lucide-react";

interface TeacherCourse {
  id: string;
  title: string;
}

interface RecordingItem {
  id: string;
  session_id: string;
  course_id: string;
  topic_id: string | null;
  duration_seconds: number;
  status: "processing" | "ready" | "hidden";
  created_at: string;
  course_title: string;
  topic_name: string;
  session_title: string;
  session_date: string;
}

export default function TeacherRecordingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<TeacherCourse[]>([]);
  const [recordings, setRecordings] = useState<RecordingItem[]>([]);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Filters
  const [selectedCourseId, setSelectedCourseId] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    async function loadRecordings() {
      try {
        setLoading(true);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        // 1. Fetch teacher courses
        const { data: coursesData } = await supabase
          .from("courses")
          .select("id, title")
          .eq("teacher_id", user.id)
          .order("title");

        const teacherCourses = (coursesData as TeacherCourse[]) || [];
        setCourses(teacherCourses);

        if (teacherCourses.length === 0) {
          setLoading(false);
          return;
        }

        const courseIds = teacherCourses.map((c) => c.id);
        const courseMap = new Map(teacherCourses.map((c) => [c.id, c.title]));

        // 2. Fetch recordings for teacher's courses
        const { data: recordingsData, error } = await supabase
          .from("recordings")
          .select(`
            id,
            session_id,
            course_id,
            topic_id,
            duration_seconds,
            status,
            created_at,
            topics:topic_id (id, title),
            live_sessions:session_id (id, title, scheduled_at, started_at)
          `)
          .in("course_id", courseIds)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching recordings:", error);
        } else {
          const list: RecordingItem[] = (recordingsData || []).map((row: any) => {
            const courseTitle = courseMap.get(row.course_id) || "Course";
            const sess = row.live_sessions;
            const top = row.topics;

            const sessionDate = sess?.started_at || sess?.scheduled_at || row.created_at;
            const formattedDate = new Date(sessionDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });

            return {
              id: row.id,
              session_id: row.session_id,
              course_id: row.course_id,
              topic_id: row.topic_id,
              duration_seconds: row.duration_seconds || 0,
              status: row.status,
              created_at: row.created_at,
              course_title: courseTitle,
              topic_name: top?.title || "Lecture",
              session_title: sess?.title || "Class Recording",
              session_date: formattedDate,
            };
          });

          setRecordings(list);
        }
      } catch (err) {
        console.error("Error loading teacher recordings:", err);
      } finally {
        setLoading(false);
      }
    }

    loadRecordings();
  }, [supabase, router]);

  // Toggle Visibility Handler using RPC
  const handleToggleVisibility = async (rec: RecordingItem) => {
    if (rec.status === "processing") return;

    setActionError(null);
    setActionSuccess(null);
    setTogglingId(rec.id);

    const willHide = rec.status === "ready";

    try {
      // Call public.set_recording_visibility RPC
      const { error } = await (supabase.rpc as any)("set_recording_visibility", {
        p_recording_id: rec.id,
        p_hidden: willHide,
      });

      if (error) {
        console.error("RPC set_recording_visibility error:", error);
        setActionError(error.message || "Failed to update recording visibility.");
      } else {
        // Update local state immediately
        const newStatus = willHide ? "hidden" : "ready";
        setRecordings((prev) =>
          prev.map((item) => (item.id === rec.id ? { ...item, status: newStatus } : item))
        );
        setActionSuccess(
          `Recording "${rec.session_title}" is now ${willHide ? "hidden from students" : "visible to students"}.`
        );
        setTimeout(() => setActionSuccess(null), 4000);
      }
    } catch (err: any) {
      console.error("Unexpected error toggling recording:", err);
      setActionError(err.message || "An unexpected error occurred.");
    } finally {
      setTogglingId(null);
    }
  };

  // Filtered recordings
  const filteredRecordings = useMemo(() => {
    return recordings.filter((r) => {
      // Course filter
      if (selectedCourseId !== "all" && r.course_id !== selectedCourseId) {
        return false;
      }
      // Status filter
      if (selectedStatus !== "all" && r.status !== selectedStatus) {
        return false;
      }
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = r.session_title.toLowerCase().includes(q);
        const matchesTopic = r.topic_name.toLowerCase().includes(q);
        const matchesCourse = r.course_title.toLowerCase().includes(q);
        if (!matchesTitle && !matchesTopic && !matchesCourse) return false;
      }
      return true;
    });
  }, [recordings, selectedCourseId, selectedStatus, searchQuery]);

  // Stats Counters
  const counters = useMemo(() => {
    const total = recordings.length;
    const ready = recordings.filter((r) => r.status === "ready").length;
    const hidden = recordings.filter((r) => r.status === "hidden").length;
    const processing = recordings.filter((r) => r.status === "processing").length;
    return { total, ready, hidden, processing };
  }, [recordings]);

  // Format seconds to human readable duration
  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return "0 mins";
    const mins = Math.round(seconds / 60);
    if (mins >= 60) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${h}h ${m}m`;
    }
    return `${mins} mins`;
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
            <span>Course Lecture Recordings</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage video assets, monitor encoding queues, and toggle student accessibility with instant privacy controls.
          </p>
        </div>
      </div>

      {/* Feedback Banners */}
      {actionSuccess && (
        <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-mono flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 text-xs font-mono flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Metric Counters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#070c18]/80 backdrop-blur-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>TOTAL RECORDINGS</span>
            <Video className="w-4 h-4 text-[#29d9ff]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-white">
            {loading ? "—" : counters.total}
          </div>
          <p className="text-xs text-slate-400">Class lectures recorded</p>
        </div>

        <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#070c18]/80 backdrop-blur-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>PUBLISHED / READY</span>
            <Eye className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-emerald-400">
            {loading ? "—" : counters.ready}
          </div>
          <p className="text-xs text-slate-400">Visible to enrolled students</p>
        </div>

        <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#070c18]/80 backdrop-blur-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>HIDDEN</span>
            <EyeOff className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-amber-400">
            {loading ? "—" : counters.hidden}
          </div>
          <p className="text-xs text-slate-400">Restricted from student view</p>
        </div>

        <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#070c18]/80 backdrop-blur-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>PROCESSING</span>
            <Clock className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-indigo-400">
            {loading ? "—" : counters.processing}
          </div>
          <p className="text-xs text-slate-400">Encoding & transcoding video</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl border border-white/[0.08] bg-[#070c18] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Course filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Course:</span>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[#04060a] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#29d9ff]"
            >
              <option value="all">All Courses ({courses.length})</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[#04060a] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#29d9ff]"
            >
              <option value="all">All Statuses</option>
              <option value="ready">Ready (Published)</option>
              <option value="hidden">Hidden</option>
              <option value="processing">Processing</option>
            </select>
          </div>
        </div>

        {/* Search input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search title, topic, course..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#04060a] border border-white/[0.1] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#29d9ff]"
          />
        </div>
      </div>

      {/* Recordings Table */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            <div className="h-6 w-48 bg-white/[0.05] rounded animate-pulse" />
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-white/[0.03] rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
        ) : filteredRecordings.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.04] text-slate-400 flex items-center justify-center mx-auto">
              <Video className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-white">No Recordings Found</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {recordings.length === 0
                ? "No lectures have been recorded yet for your courses. Start a live session with recording enabled."
                : "No recordings match your selected filter criteria."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.02] text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                  <th className="py-3.5 px-4">Title & Topic</th>
                  <th className="py-3.5 px-4">Course</th>
                  <th className="py-3.5 px-4">Recorded Date</th>
                  <th className="py-3.5 px-4">Duration</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Visibility Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredRecordings.map((rec) => {
                  const isProcessing = rec.status === "processing";
                  const isReady = rec.status === "ready";
                  const isHidden = rec.status === "hidden";
                  const isToggling = togglingId === rec.id;

                  return (
                    <tr key={rec.id} className="hover:bg-white/[0.02] transition-colors">
                      {/* Title & Topic */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-[#29d9ff] shrink-0">
                            <PlayCircle className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-white">{rec.session_title}</div>
                            <div className="text-[11px] text-cyan-400 font-mono">
                              Topic: {rec.topic_name}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Course */}
                      <td className="py-4 px-4 whitespace-nowrap text-slate-300">
                        {rec.course_title}
                      </td>

                      {/* Date */}
                      <td className="py-4 px-4 whitespace-nowrap font-mono text-slate-400">
                        {rec.session_date}
                      </td>

                      {/* Duration */}
                      <td className="py-4 px-4 whitespace-nowrap font-mono text-white font-medium">
                        {formatDuration(rec.duration_seconds)}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        {isReady && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <Eye className="w-3.5 h-3.5" />
                            <span>Ready</span>
                          </span>
                        )}
                        {isHidden && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>Hidden</span>
                          </span>
                        )}
                        {isProcessing && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Processing...</span>
                          </span>
                        )}
                      </td>

                      {/* Action Button */}
                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        {isProcessing ? (
                          <span
                            title="Cannot change visibility while video is processing"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04] text-xs font-mono text-slate-500 cursor-not-allowed"
                          >
                            <span>Locked</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => handleToggleVisibility(rec)}
                            disabled={isToggling}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                              isReady
                                ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30 hover:border-amber-500/50"
                                : "bg-[#29d9ff]/10 hover:bg-[#29d9ff]/20 text-[#29d9ff] border-[#29d9ff]/30 hover:border-[#29d9ff]/50"
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {isToggling ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Updating...</span>
                              </>
                            ) : isReady ? (
                              <>
                                <EyeOff className="w-3.5 h-3.5" />
                                <span>Hide from Students</span>
                              </>
                            ) : (
                              <>
                                <Eye className="w-3.5 h-3.5" />
                                <span>Publish (Show)</span>
                              </>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
