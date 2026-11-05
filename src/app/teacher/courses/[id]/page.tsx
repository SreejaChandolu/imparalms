"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Edit2,
  ExternalLink,
  Film,
  Layers,
  Plus,
  Radio,
  Save,
  Star,
  Trash2,
  Users,
  Video,
  X,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

interface CourseData {
  id: string;
  title: string;
  description: string | null;
  teacher_id: string;
  starts_on: string | null;
  ends_on: string | null;
}

interface TopicItem {
  id: string;
  title: string;
  position: number;
}

interface ClassSessionItem {
  id: string;
  course_id: string;
  topic_id: string | null;
  teacher_id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  status: "scheduled" | "live" | "ended";
  started_at: string | null;
  ended_at: string | null;
  attendancePresentCount: number;
  attendancePercentage: number;
  averageRating: number | null;
  recordingStatus: "processing" | "ready" | "hidden" | "none";
}

interface ImportantDateItem {
  id: string;
  course_id: string;
  title: string;
  date: string;
  kind: "exam" | "deadline" | "holiday" | "other";
}

export default function TeacherCourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const courseId = (params?.id || "") as string;

  const [loading, setLoading] = useState(true);
  const [courseNotFound, setCourseNotFound] = useState(false);
  const [course, setCourse] = useState<CourseData | null>(null);
  const [enrolledCount, setEnrolledCount] = useState(0);
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [sessions, setSessions] = useState<ClassSessionItem[]>([]);
  const [importantDates, setImportantDates] = useState<ImportantDateItem[]>([]);
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({});

  // Course Ends Edit State
  const [endsOnInput, setEndsOnInput] = useState("");
  const [savingEndsOn, setSavingEndsOn] = useState(false);
  const [endsOnSuccess, setEndsOnSuccess] = useState(false);

  // Important Dates Modal / Form State
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [dateTitle, setDateTitle] = useState("");
  const [dateValue, setDateValue] = useState("");
  const [dateKind, setDateKind] = useState<"exam" | "deadline" | "holiday" | "other">("deadline");
  const [dateSubmitting, setDateSubmitting] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCourseDetails() {
      if (!courseId) return;

      try {
        setLoading(true);
        setCourseNotFound(false);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/staff");
          return;
        }

        // 1. Fetch course details (enforced by RLS: teacher_id = auth.uid())
        const { data: courseData, error: courseError } = (await supabase
          .from("courses")
          .select("id, title, description, teacher_id, starts_on, ends_on")
          .eq("id", courseId)
          .eq("teacher_id", user.id)
          .maybeSingle()) as { data: CourseData | null; error: unknown };

        if (courseError || !courseData) {
          setCourseNotFound(true);
          return;
        }

        setCourse(courseData);
        setEndsOnInput(courseData.ends_on || "");

        // 2. Fetch enrolled students count
        const { count } = await supabase
          .from("enrollments")
          .select("id", { count: "exact", head: true })
          .eq("course_id", courseId);

        const studentCount = count || 0;
        setEnrolledCount(studentCount);

        // 3. Fetch course topics
        const { data: topicsData } = (await supabase
          .from("topics")
          .select("id, title, position")
          .eq("course_id", courseId)
          .order("position", { ascending: true })) as {
          data: TopicItem[] | null;
          error: unknown;
        };

        const loadedTopics = topicsData || [];
        setTopics(loadedTopics);

        // Auto-expand all topics initially
        const initialExpanded: Record<string, boolean> = {};
        loadedTopics.forEach((t) => {
          initialExpanded[t.id] = true;
        });
        setExpandedTopics(initialExpanded);

        // 4. Fetch live_sessions for this course
        const { data: sessionsData } = (await supabase
          .from("live_sessions")
          .select("id, course_id, topic_id, teacher_id, title, scheduled_at, duration_minutes, status, started_at, ended_at")
          .eq("course_id", courseId)
          .order("scheduled_at", { ascending: true })) as {
          data: any[] | null;
          error: unknown;
        };

        const rawSessions = sessionsData || [];
        const sessionIds = rawSessions.map((s) => s.id);

        // 5. Fetch recordings for these sessions
        const recordingMap = new Map<string, "processing" | "ready" | "hidden">();
        if (sessionIds.length > 0) {
          const { data: recordingsData } = (await supabase
            .from("recordings")
            .select("session_id, status")
            .in("session_id", sessionIds)) as {
            data: { session_id: string; status: "processing" | "ready" | "hidden" }[] | null;
            error: unknown;
          };

          (recordingsData || []).forEach((r) => {
            recordingMap.set(r.session_id, r.status);
          });
        }

        // 6. Fetch ratings for these sessions
        const ratingsMap = new Map<string, { sum: number; count: number }>();
        if (sessionIds.length > 0) {
          const { data: ratingsData } = (await supabase
            .from("class_ratings")
            .select("session_id, stars")
            .in("session_id", sessionIds)) as {
            data: { session_id: string; stars: number }[] | null;
            error: unknown;
          };

          (ratingsData || []).forEach((r) => {
            const curr = ratingsMap.get(r.session_id) || { sum: 0, count: 0 };
            ratingsMap.set(r.session_id, { sum: curr.sum + r.stars, count: curr.count + 1 });
          });
        }

        // 7. Fetch attendance telemetry for ended sessions
        const endedSessions = rawSessions.filter((s) => s.status === "ended");
        const endedSessionIds = endedSessions.map((s) => s.id);
        const presentCountMap = new Map<string, number>();

        if (endedSessionIds.length > 0) {
          const { data: attendanceData } = (await supabase
            .from("attendance")
            .select("session_id, user_id, total_seconds")
            .in("session_id", endedSessionIds)) as {
            data: { session_id: string; user_id: string; total_seconds: number }[] | null;
            error: unknown;
          };

          const sessionDurationMap = new Map<string, number>();
          endedSessions.forEach((sess) => {
            let dur = sess.duration_minutes * 60;
            if (sess.started_at && sess.ended_at) {
              const diffSec = (new Date(sess.ended_at).getTime() - new Date(sess.started_at).getTime()) / 1000;
              if (diffSec > 0) dur = diffSec;
            }
            sessionDurationMap.set(sess.id, dur);
          });

          // Aggregate per user per session
          const userSecondsMap = new Map<string, number>();
          (attendanceData || []).forEach((r) => {
            const key = `${r.session_id}_${r.user_id}`;
            userSecondsMap.set(key, (userSecondsMap.get(key) || 0) + (Number(r.total_seconds) || 0));
          });

          userSecondsMap.forEach((totalSec, key) => {
            const [sessId] = key.split("_");
            const durationSec = sessionDurationMap.get(sessId) || 3600;
            if (durationSec > 0 && totalSec >= 0.75 * durationSec) {
              presentCountMap.set(sessId, (presentCountMap.get(sessId) || 0) + 1);
            }
          });
        }

        // Build enriched sessions
        const enrichedSessions: ClassSessionItem[] = rawSessions.map((s) => {
          const present = presentCountMap.get(s.id) || 0;
          const pct = studentCount > 0 ? Math.round((present / studentCount) * 100) : 0;
          const rInfo = ratingsMap.get(s.id);
          const avgRating = rInfo && rInfo.count > 0 ? Number((rInfo.sum / rInfo.count).toFixed(1)) : null;

          return {
            ...s,
            attendancePresentCount: present,
            attendancePercentage: pct,
            averageRating: avgRating,
            recordingStatus: recordingMap.get(s.id) || "none",
          };
        });

        setSessions(enrichedSessions);

        // 8. Fetch important dates
        const { data: datesData } = (await supabase
          .from("important_dates")
          .select("id, course_id, title, date, kind")
          .eq("course_id", courseId)
          .order("date", { ascending: true })) as {
          data: ImportantDateItem[] | null;
          error: unknown;
        };

        setImportantDates(datesData || []);
      } catch (err) {
        console.error("Error loading course detail:", err);
        setCourseNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    loadCourseDetails();
  }, [courseId, router, supabase]);

  const toggleTopicExpand = (topicId: string) => {
    setExpandedTopics((prev) => ({
      ...prev,
      [topicId]: !prev[topicId],
    }));
  };

  // Save updated ends_on date
  const handleSaveEndsOn = async () => {
    if (!course) return;

    try {
      setSavingEndsOn(true);
      setEndsOnSuccess(false);

      const { error } = await (supabase.from("courses") as any)
        .update({
          ends_on: endsOnInput || null,
        })
        .eq("id", course.id);

      if (error) throw error;

      setCourse((prev) => (prev ? { ...prev, ends_on: endsOnInput || null } : null));
      setEndsOnSuccess(true);
      setTimeout(() => setEndsOnSuccess(false), 3000);
    } catch (err: any) {
      console.error("Failed to update course ends_on:", err);
      alert(err.message || "Failed to update end date.");
    } finally {
      setSavingEndsOn(false);
    }
  };

  // Start Class (Same Go Live logic as /teacher/host)
  const handleStartClass = async (sessionId: string) => {
    try {
      const nowIso = new Date().toISOString();
      const { error } = await (supabase.from("live_sessions") as any)
        .update({
          status: "live",
          started_at: nowIso,
        })
        .eq("id", sessionId);

      if (error) throw error;

      router.push(`/live/${sessionId}`);
    } catch (err: any) {
      console.error("Failed to start session:", err);
      alert(err.message || "Failed to start live session.");
    }
  };

  // Important Dates Modal Handlers
  const openAddDateModal = () => {
    setEditingDateId(null);
    setDateTitle("");
    setDateValue(new Date().toISOString().split("T")[0]);
    setDateKind("deadline");
    setDateError(null);
    setDateModalOpen(true);
  };

  const openEditDateModal = (d: ImportantDateItem) => {
    setEditingDateId(d.id);
    setDateTitle(d.title);
    setDateValue(d.date.split("T")[0]);
    setDateKind(d.kind);
    setDateError(null);
    setDateModalOpen(true);
  };

  const handleSaveDate = async (e: React.FormEvent) => {
    e.preventDefault();
    setDateError(null);

    if (!dateTitle.trim() || !dateValue) {
      setDateError("Please enter title and date.");
      return;
    }

    try {
      setDateSubmitting(true);

      if (editingDateId) {
        // UPDATE
        const { error } = await (supabase.from("important_dates") as any)
          .update({
            title: dateTitle.trim(),
            date: dateValue,
            kind: dateKind,
          })
          .eq("id", editingDateId);

        if (error) throw error;

        setImportantDates((prev) =>
          prev.map((d) =>
            d.id === editingDateId
              ? { ...d, title: dateTitle.trim(), date: dateValue, kind: dateKind }
              : d
          ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        );
      } else {
        // INSERT
        const { data: newDate, error } = (await (supabase.from("important_dates") as any)
          .insert({
            course_id: courseId,
            title: dateTitle.trim(),
            date: dateValue,
            kind: dateKind,
          })
          .select("id, course_id, title, date, kind")
          .single()) as { data: ImportantDateItem | null; error: any };

        if (error) throw error;

        if (newDate) {
          setImportantDates((prev) =>
            [...prev, newDate].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          );
        }
      }

      setDateModalOpen(false);
    } catch (err: any) {
      console.error("Error saving important date:", err);
      setDateError(err.message || "Failed to save date.");
    } finally {
      setDateSubmitting(false);
    }
  };

  const handleDeleteDate = async (dateId: string) => {
    const confirmed = window.confirm("Delete this milestone from the course calendar?");
    if (!confirmed) return;

    try {
      const { error } = await supabase.from("important_dates").delete().eq("id", dateId);
      if (error) throw error;

      setImportantDates((prev) => prev.filter((d) => d.id !== dateId));
    } catch (err: any) {
      console.error("Failed to delete date:", err);
      alert(err.message || "Failed to delete date.");
    }
  };

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-6 w-32 bg-white/[0.06] rounded" />
        <div className="h-10 w-96 bg-white/[0.06] rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 h-96 rounded-2xl bg-white/[0.04] border border-white/[0.06]" />
          <div className="lg:col-span-4 h-96 rounded-2xl bg-white/[0.04] border border-white/[0.06]" />
        </div>
      </div>
    );
  }

  if (courseNotFound || !course) {
    return (
      <div className="space-y-6">
        <Link
          href="/teacher"
          className="inline-flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-[#29d9ff] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Instructor Dashboard</span>
        </Link>

        <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-10 sm:p-14 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h1 className="text-2xl font-bold text-white">Course not found</h1>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            This course does not exist or you do not have permission to manage its curriculum.
          </p>
          <Link
            href="/teacher"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#29d9ff] text-[#04060a] font-mono text-xs uppercase tracking-wider font-bold"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* ─────────────────────────────────────────────────────────────
          PAGE TITLE & HEADER
      ────────────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <Link
          href="/teacher"
          className="inline-flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-[#29d9ff] transition-colors group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Instructor Dashboard</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-[#29d9ff]">
              COURSE MANAGEMENT
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight">
              {course.title}
            </h1>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs text-slate-300 bg-white/[0.04] px-3.5 py-1.5 rounded-full border border-white/[0.08] self-start sm:self-auto">
            <Users className="w-3.5 h-3.5 text-[#29d9ff]" />
            <span>
              {enrolledCount} {enrolledCount === 1 ? "Student" : "Students"} Enrolled
            </span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TWO COLUMNS (Desktop: Wide Left Lessons, Narrow Right Stack)
          Mobile: Single column with right-hand cards below lessons
      ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-8 items-start">
        {/* ───────────────────────────────────────────────────────────
            LEFT COLUMN (Wide): Lessons List (Topics & Classes)
        ──────────────────────────────────────────────────────────── */}
        <div className="w-full lg:col-span-7 xl:col-span-8 space-y-6">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#29d9ff]" />
              <h2 className="text-xl font-bold text-white tracking-tight">Lessons</h2>
            </div>
            <span className="font-mono text-xs text-slate-400">
              {topics.length} {topics.length === 1 ? "Topic" : "Topics"}
            </span>
          </div>

          {topics.length > 0 ? (
            <div className="space-y-4">
              {topics.map((topic) => {
                const topicSessions = sessions.filter((s) => s.topic_id === topic.id);
                const isExpanded = Boolean(expandedTopics[topic.id]);

                return (
                  <div
                    key={topic.id}
                    className="rounded-2xl border border-white/[0.08] bg-[#070c18] overflow-hidden transition-all duration-200"
                  >
                    {/* Topic Header Toggle */}
                    <button
                      type="button"
                      onClick={() => toggleTopicExpand(topic.id)}
                      className="w-full text-left p-5 sm:p-6 flex items-center justify-between gap-4 cursor-pointer hover:bg-white/[0.02] transition-colors focus:outline-none"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#29d9ff]" />
                        <div>
                          <h3 className="text-base sm:text-lg font-bold text-white">
                            {topic.title}
                          </h3>
                          <p className="text-xs font-mono text-slate-500 mt-0.5">
                            {topicSessions.length} {topicSessions.length === 1 ? "Class Session" : "Class Sessions"}
                          </p>
                        </div>
                      </div>

                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                          isExpanded ? "rotate-180 text-[#29d9ff]" : ""
                        }`}
                      />
                    </button>

                    {/* Classes in Topic */}
                    {isExpanded && (
                      <div className="border-t border-white/[0.06] bg-[#04060a]/40 px-5 sm:px-6 py-4 space-y-3.5">
                        {topicSessions.length > 0 ? (
                          topicSessions.map((session) => {
                            const isLive = session.status === "live";
                            const isScheduled = session.status === "scheduled";
                            const isEnded = session.status === "ended";

                            const sessionDate = new Date(session.scheduled_at).toLocaleDateString(
                              undefined,
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              }
                            );

                            return (
                              <div
                                key={session.id}
                                className={`p-4 rounded-xl border transition-all space-y-3 ${
                                  isLive
                                    ? "bg-red-950/20 border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.15)]"
                                    : "bg-[#070c18] border-white/[0.06] hover:border-white/[0.12]"
                                }`}
                              >
                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                  <div className="space-y-1 flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-mono text-xs text-slate-400">
                                        {sessionDate}
                                      </span>
                                      {isLive ? (
                                        <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20 font-bold animate-pulse">
                                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                          LIVE NOW
                                        </span>
                                      ) : (
                                        <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400 bg-white/[0.04] px-2 py-0.5 rounded-full border border-white/[0.06]">
                                          {session.status.toUpperCase()}
                                        </span>
                                      )}

                                      {/* Recording Status Pill */}
                                      <span
                                        className={`font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                          session.recordingStatus === "ready"
                                            ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
                                            : session.recordingStatus === "processing"
                                            ? "text-amber-400 bg-amber-400/10 border-amber-400/20"
                                            : session.recordingStatus === "hidden"
                                            ? "text-slate-400 bg-slate-500/10 border-slate-500/20"
                                            : "text-slate-600 bg-white/[0.02] border-white/[0.04]"
                                        }`}
                                      >
                                        Recording: {session.recordingStatus}
                                      </span>
                                    </div>

                                    <h4 className="text-sm sm:text-base font-bold text-white">
                                      {session.title}
                                    </h4>
                                  </div>

                                  {/* Buttons: Start class (for scheduled) and View attendance */}
                                  <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                                    {isScheduled && (
                                      <button
                                        type="button"
                                        onClick={() => handleStartClass(session.id)}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#29d9ff] hover:bg-[#6be4ff] text-[#04060a] font-mono text-xs uppercase tracking-wider font-bold shadow-[0_0_10px_rgba(41,217,255,0.3)] transition-all"
                                      >
                                        <Video className="w-3.5 h-3.5" />
                                        <span>Start Class</span>
                                      </button>
                                    )}

                                    {isLive && (
                                      <Link
                                        href={`/live/${session.id}`}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-red-500 hover:bg-red-400 text-white font-mono text-xs uppercase tracking-wider font-bold shadow-[0_0_10px_rgba(239,68,68,0.4)] transition-all"
                                      >
                                        <Radio className="w-3.5 h-3.5" />
                                        <span>In Room</span>
                                      </Link>
                                    )}

                                    <Link
                                      href={`/teacher/attendance?session=${session.id}`}
                                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-white/10 hover:border-white/20 bg-white/[0.04] hover:bg-white/[0.08] font-mono text-xs uppercase tracking-wider text-slate-300 hover:text-white transition-all"
                                    >
                                      <span>View Attendance</span>
                                    </Link>
                                  </div>
                                </div>

                                {/* Class Statistics: Attendance & Rating */}
                                <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-white/[0.05] text-xs font-mono">
                                  <div className="text-slate-400">
                                    <span className="text-slate-500">Attendance:</span>{" "}
                                    {isEnded ? (
                                      <span className="text-white font-semibold">
                                        {session.attendancePresentCount} of {enrolledCount} present ({session.attendancePercentage}%)
                                      </span>
                                    ) : (
                                      <span className="text-slate-500">Telemetry after session</span>
                                    )}
                                  </div>

                                  <div className="text-slate-400 text-right">
                                    <span className="text-slate-500">Rating:</span>{" "}
                                    {session.averageRating !== null ? (
                                      <span className="text-amber-400 font-semibold">
                                        {session.averageRating} ★
                                      </span>
                                    ) : (
                                      <span className="text-slate-500">No ratings yet</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="py-4 text-center text-xs font-mono text-slate-500">
                            No classes scheduled in this topic yet.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.06] bg-[#070c18]/50 p-10 text-center space-y-2">
              <Layers className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-white">No topics configured</p>
              <p className="text-xs text-slate-500">
                Topics group curriculum lectures for this course.
              </p>
            </div>
          )}
        </div>

        {/* ───────────────────────────────────────────────────────────
            RIGHT COLUMN (Narrow Stacked Cards)
            1. Course ends (editable by teacher with Save button)
            2. Important dates (Add, Edit, Delete)
        ──────────────────────────────────────────────────────────── */}
        <div className="w-full lg:col-span-5 xl:col-span-4 space-y-6">
          {/* Card 1: Course Ends (Editable) */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#29d9ff]" />
                <h3 className="text-sm font-bold uppercase tracking-wider font-mono text-white">
                  Course Ends
                </h3>
              </div>
              {endsOnSuccess && (
                <span className="font-mono text-[10px] text-emerald-400 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Saved
                </span>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-400 leading-relaxed">
                Configure the final scheduled completion date for this course cohort.
              </p>

              <div className="space-y-1.5">
                <label className="block font-mono text-[11px] uppercase tracking-wider text-slate-400">
                  Target End Date
                </label>
                <input
                  type="date"
                  value={endsOnInput}
                  onChange={(e) => setEndsOnInput(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-[#04060a] px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-[#29d9ff] transition-colors font-mono"
                />
              </div>

              <button
                type="button"
                onClick={handleSaveEndsOn}
                disabled={savingEndsOn}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-[#29d9ff] hover:bg-[#6be4ff] text-[#04060a] font-mono text-xs uppercase tracking-wider font-bold shadow-[0_0_12px_rgba(41,217,255,0.3)] transition-all disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingEndsOn ? "Saving..." : "Save End Date"}</span>
              </button>
            </div>
          </div>

          {/* Card 2: Important Dates (Add, Edit, Delete) */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#29d9ff]" />
                <h3 className="text-sm font-bold uppercase tracking-wider font-mono text-white">
                  Important Dates
                </h3>
              </div>
              <button
                type="button"
                onClick={openAddDateModal}
                className="inline-flex items-center gap-1 font-mono text-xs text-[#29d9ff] hover:text-[#6be4ff] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Date</span>
              </button>
            </div>

            {importantDates.length > 0 ? (
              <div className="space-y-3">
                {importantDates.map((d) => {
                  const itemDate = new Date(d.date).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });

                  const badgeStyle =
                    d.kind === "exam"
                      ? "text-rose-400 bg-rose-500/10 border-rose-500/20"
                      : d.kind === "deadline"
                      ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                      : d.kind === "holiday"
                      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                      : "text-[#29d9ff] bg-[#29d9ff]/10 border-[#29d9ff]/20";

                  return (
                    <div
                      key={d.id}
                      className="p-3 rounded-xl border border-white/[0.06] bg-[#04060a]/70 space-y-2 group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs text-white font-semibold">
                          {itemDate}
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${badgeStyle}`}
                          >
                            {d.kind}
                          </span>
                          <button
                            type="button"
                            onClick={() => openEditDateModal(d)}
                            className="p-1 rounded text-slate-400 hover:text-white transition-colors"
                            title="Edit Date"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDate(d.id)}
                            className="p-1 rounded text-slate-400 hover:text-rose-400 transition-colors"
                            title="Delete Date"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-slate-300 leading-snug">{d.title}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-white/[0.06] bg-[#04060a]/50 p-6 text-center space-y-2">
                <Calendar className="w-6 h-6 text-slate-600 mx-auto" />
                <p className="text-xs font-semibold text-slate-300">No milestone dates</p>
                <p className="text-[11px] text-slate-500">
                  Click Add Date to publish exam dates, assignment deadlines, or holidays.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODAL: ADD / EDIT IMPORTANT DATE
      ────────────────────────────────────────────────────────────── */}
      {dateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#070c18] p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <h3 className="text-base font-bold text-white">
                {editingDateId ? "Edit Important Date" : "Add Important Date"}
              </h3>
              <button
                type="button"
                onClick={() => setDateModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {dateError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {dateError}
              </div>
            )}

            <form onSubmit={handleSaveDate} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block font-mono text-xs uppercase tracking-wider text-slate-300">
                  Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Midterm Comprehensive Examination"
                  value={dateTitle}
                  onChange={(e) => setDateTitle(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-[#04060a] px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-[#29d9ff]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-mono text-xs uppercase tracking-wider text-slate-300">
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={dateValue}
                  onChange={(e) => setDateValue(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-[#04060a] px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-[#29d9ff]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-mono text-xs uppercase tracking-wider text-slate-300">
                  Event Category
                </label>
                <select
                  value={dateKind}
                  onChange={(e) => setDateKind(e.target.value as any)}
                  className="w-full rounded-xl border border-white/[0.08] bg-[#04060a] px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-[#29d9ff]"
                >
                  <option value="exam">Exam</option>
                  <option value="deadline">Deadline</option>
                  <option value="holiday">Holiday</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDateModalOpen(false)}
                  className="px-4 py-2 rounded-full border border-white/10 text-xs font-mono uppercase text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={dateSubmitting}
                  className="px-5 py-2 rounded-full bg-[#29d9ff] text-[#04060a] font-mono text-xs uppercase tracking-wider font-bold shadow-[0_0_12px_rgba(41,217,255,0.3)]"
                >
                  {dateSubmitting ? "Saving..." : "Save Date"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
