"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Edit2,
  Layers,
  Plus,
  Trash2,
  Video,
  X,
  CheckCircle2,
  AlertCircle,
  Radio,
} from "lucide-react";

interface TeacherCourse {
  id: string;
  title: string;
}

interface TeacherTopic {
  id: string;
  course_id: string;
  title: string;
  position: number;
}

interface TeacherSessionItem {
  id: string;
  course_id: string;
  topic_id: string | null;
  teacher_id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  status: "scheduled" | "live" | "ended";
  livekit_room: string;
  courseTitle: string;
  topicTitle: string;
}

export default function TeacherSchedulePage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<TeacherCourse[]>([]);
  const [topics, setTopics] = useState<TeacherTopic[]>([]);
  const [sessions, setSessions] = useState<TeacherSessionItem[]>([]);

  // Form State
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [title, setTitle] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [sessionTime, setSessionTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);

  // Edit State
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/staff");
          return;
        }

        // 1. Fetch teacher's courses
        const { data: coursesData } = (await supabase
          .from("courses")
          .select("id, title")
          .eq("teacher_id", user.id)) as {
          data: TeacherCourse[] | null;
          error: unknown;
        };

        const loadedCourses = coursesData || [];
        setCourses(loadedCourses);

        if (loadedCourses.length > 0) {
          setSelectedCourseId(loadedCourses[0].id);
        }

        const courseIds = loadedCourses.map((c) => c.id);

        if (courseIds.length === 0) {
          setLoading(false);
          return;
        }

        // 2. Fetch topics for these courses
        const { data: topicsData } = (await supabase
          .from("topics")
          .select("id, course_id, title, position")
          .in("course_id", courseIds)
          .order("position", { ascending: true })) as {
          data: TeacherTopic[] | null;
          error: unknown;
        };

        const loadedTopics = topicsData || [];
        setTopics(loadedTopics);

        // Preselect first topic of the first course if available
        const initialTopics = loadedTopics.filter((t) => t.course_id === loadedCourses[0]?.id);
        if (initialTopics.length > 0) {
          setSelectedTopicId(initialTopics[0].id);
        }

        // 3. Fetch teacher's upcoming sessions
        const { data: sessionsData } = (await supabase
          .from("live_sessions")
          .select("id, course_id, topic_id, teacher_id, title, scheduled_at, duration_minutes, status, livekit_room")
          .eq("teacher_id", user.id)
          .in("status", ["scheduled", "live"])
          .order("scheduled_at", { ascending: true })) as {
          data:
            | {
                id: string;
                course_id: string;
                topic_id: string | null;
                teacher_id: string;
                title: string;
                scheduled_at: string;
                duration_minutes: number;
                status: "scheduled" | "live" | "ended";
                livekit_room: string;
              }[]
            | null;
          error: unknown;
        };

        const courseMap = new Map(loadedCourses.map((c) => [c.id, c.title]));
        const topicMap = new Map(loadedTopics.map((t) => [t.id, t.title]));

        const enrichedSessions: TeacherSessionItem[] = (sessionsData || []).map((s) => ({
          ...s,
          courseTitle: courseMap.get(s.course_id) || "Assigned Course",
          topicTitle: (s.topic_id && topicMap.get(s.topic_id)) || "General Curriculum",
        }));

        setSessions(enrichedSessions);
      } catch (err) {
        console.error("Error loading schedule data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router, supabase]);

  // Available topics for currently selected course
  const availableTopics = useMemo(() => {
    return topics.filter((t) => t.course_id === selectedCourseId);
  }, [topics, selectedCourseId]);

  // When course changes in form, update selected topic
  const handleCourseChange = (newCourseId: string) => {
    setSelectedCourseId(newCourseId);
    const related = topics.filter((t) => t.course_id === newCourseId);
    if (related.length > 0) {
      setSelectedTopicId(related[0].id);
    } else {
      setSelectedTopicId("");
    }
  };

  const resetForm = () => {
    setEditingSessionId(null);
    setTitle("");
    setSessionDate("");
    setSessionTime("");
    setDurationMinutes(60);
    setErrorMsg(null);
    setSuccessMsg(null);
    if (courses.length > 0) {
      handleCourseChange(courses[0].id);
    }
  };

  const handleEditClick = (session: TeacherSessionItem) => {
    setEditingSessionId(session.id);
    setSelectedCourseId(session.course_id);
    setSelectedTopicId(session.topic_id || "");
    setTitle(session.title);
    setDurationMinutes(session.duration_minutes);

    const d = new Date(session.scheduled_at);
    const dateStr = d.toISOString().split("T")[0];
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    setSessionDate(dateStr);
    setSessionTime(`${hours}:${minutes}`);

    setErrorMsg(null);
    setSuccessMsg(null);

    // Smooth scroll to form
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelSession = async (session: TeacherSessionItem) => {
    if (session.status !== "scheduled") {
      setErrorMsg("Only scheduled sessions can be cancelled.");
      return;
    }

    const confirmed = window.confirm(`Cancel and remove the scheduled class "${session.title}"?`);
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("live_sessions")
        .delete()
        .eq("id", session.id)
        .eq("status", "scheduled");

      if (error) {
        throw error;
      }

      setSessions((prev) => prev.filter((s) => s.id !== session.id));
      setSuccessMsg(`Session "${session.title}" has been cancelled.`);
    } catch (err: any) {
      console.error("Failed to cancel session:", err);
      setErrorMsg(err.message || "Failed to cancel session.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!selectedCourseId) {
      setErrorMsg("Please select a course.");
      return;
    }

    if (!title.trim()) {
      setErrorMsg("Please enter a class title.");
      return;
    }

    if (!sessionDate || !sessionTime) {
      setErrorMsg("Please choose both date and time for the class.");
      return;
    }

    try {
      setSubmitting(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/staff");
        return;
      }

      // Combine date and time
      const combinedDateTime = new Date(`${sessionDate}T${sessionTime}:00`);
      if (isNaN(combinedDateTime.getTime())) {
        setErrorMsg("Invalid date or time provided.");
        return;
      }

      const scheduledIso = combinedDateTime.toISOString();

      if (editingSessionId) {
        // UPDATE existing session
        const { error: updateError } = await (supabase
          .from("live_sessions") as any)
          .update({
            course_id: selectedCourseId,
            topic_id: selectedTopicId || null,
            title: title.trim(),
            scheduled_at: scheduledIso,
            duration_minutes: Number(durationMinutes) || 60,
          })
          .eq("id", editingSessionId)
          .eq("teacher_id", user.id);

        if (updateError) throw updateError;

        const courseTitle = courses.find((c) => c.id === selectedCourseId)?.title || "Course";
        const topicTitle = topics.find((t) => t.id === selectedTopicId)?.title || "Curriculum";

        setSessions((prev) =>
          prev.map((s) =>
            s.id === editingSessionId
              ? {
                  ...s,
                  course_id: selectedCourseId,
                  topic_id: selectedTopicId || null,
                  title: title.trim(),
                  scheduled_at: scheduledIso,
                  duration_minutes: Number(durationMinutes) || 60,
                  courseTitle,
                  topicTitle,
                }
              : s
          )
        );

        setSuccessMsg("Class session updated successfully.");
        resetForm();
      } else {
        // INSERT new scheduled session
        const livekitRoom = `room-${selectedCourseId.slice(0, 8)}-${Date.now()}`;

        const { data: inserted, error: insertError } = (await (supabase
          .from("live_sessions") as any)
          .insert({
            course_id: selectedCourseId,
            topic_id: selectedTopicId || null,
            teacher_id: user.id,
            title: title.trim(),
            scheduled_at: scheduledIso,
            duration_minutes: Number(durationMinutes) || 60,
            status: "scheduled",
            livekit_room: livekitRoom,
          })
          .select("id, course_id, topic_id, teacher_id, title, scheduled_at, duration_minutes, status, livekit_room")
          .single()) as { data: any; error: any };

        if (insertError) throw insertError;

        const courseTitle = courses.find((c) => c.id === selectedCourseId)?.title || "Course";
        const topicTitle = topics.find((t) => t.id === selectedTopicId)?.title || "Curriculum";

        const newSessionItem: TeacherSessionItem = {
          ...inserted,
          courseTitle,
          topicTitle,
        };

        setSessions((prev) => [...prev, newSessionItem].sort(
          (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
        ));

        setSuccessMsg("Class scheduled successfully.");
        resetForm();
      }
    } catch (err: any) {
      console.error("Scheduling error:", err);
      setErrorMsg(err.message || "Failed to schedule session.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* ─────────────────────────────────────────────────────────────
          PAGE HEADER
      ────────────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <Link
          href="/teacher"
          className="inline-flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-[#29d9ff] transition-colors group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Dashboard</span>
        </Link>

        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-[#29d9ff]">
            CURRICULUM SCHEDULING
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Schedule a Class
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Publish upcoming lecture dates, select curriculum topics, and configure session lengths.
          </p>
        </div>
      </div>

      {/* Feedback Alerts */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button type="button" onClick={() => setSuccessMsg(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button type="button" onClick={() => setErrorMsg(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          1. SCHEDULE / EDIT FORM
      ────────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-5 sm:p-7 space-y-6">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#29d9ff]" />
            <h2 className="text-base sm:text-lg font-bold text-white">
              {editingSessionId ? "Edit Scheduled Session" : "Schedule New Session"}
            </h2>
          </div>
          {editingSessionId && (
            <button
              type="button"
              onClick={resetForm}
              className="font-mono text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel Edit</span>
            </button>
          )}
        </div>

        {courses.length === 0 && !loading ? (
          <div className="p-6 text-center text-xs text-slate-400">
            You must have at least one assigned course to schedule classes.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Course Selector */}
              <div className="space-y-1.5">
                <label className="block font-mono text-xs uppercase tracking-wider text-slate-300">
                  Course
                </label>
                <select
                  required
                  value={selectedCourseId}
                  onChange={(e) => handleCourseChange(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-[#04060a] px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-[#29d9ff] transition-colors"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Topic Selector */}
              <div className="space-y-1.5">
                <label className="block font-mono text-xs uppercase tracking-wider text-slate-300">
                  Topic of Course
                </label>
                <select
                  value={selectedTopicId}
                  onChange={(e) => setSelectedTopicId(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-[#04060a] px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-[#29d9ff] transition-colors"
                >
                  <option value="">General Curriculum Topic</option>
                  {availableTopics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <label className="block font-mono text-xs uppercase tracking-wider text-slate-300">
                Session Title
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Heuristic Optimizations & Deep Graph Search"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-white/[0.08] bg-[#04060a] px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#29d9ff] transition-colors"
              />
            </div>

            {/* Date, Time, Duration */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="block font-mono text-xs uppercase tracking-wider text-slate-300">
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-[#04060a] px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-[#29d9ff] transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-mono text-xs uppercase tracking-wider text-slate-300">
                  Start Time
                </label>
                <input
                  type="time"
                  required
                  value={sessionTime}
                  onChange={(e) => setSessionTime(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-[#04060a] px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-[#29d9ff] transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-mono text-xs uppercase tracking-wider text-slate-300">
                  Duration (Mins)
                </label>
                <input
                  type="number"
                  min="15"
                  max="360"
                  required
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full rounded-xl border border-white/[0.08] bg-[#04060a] px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-[#29d9ff] transition-colors"
                />
              </div>
            </div>

            {/* Form Action */}
            <div className="pt-2 flex items-center justify-end gap-3">
              {editingSessionId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 rounded-full border border-white/10 hover:border-white/20 text-xs font-mono uppercase tracking-wider text-slate-300 transition-all"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#29d9ff] text-[#04060a] font-mono text-xs uppercase tracking-wider font-bold shadow-[0_0_15px_rgba(41,217,255,0.3)] hover:bg-[#6be4ff] transition-all disabled:opacity-50"
              >
                {submitting ? (
                  <span>Saving...</span>
                ) : editingSessionId ? (
                  <>
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Update Class</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>Schedule Class</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. UPCOMING SESSIONS LIST (With Edit & Cancel)
      ────────────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#29d9ff]" />
            <h2 className="text-lg font-bold text-white tracking-tight">
              My Scheduled & Live Sessions
            </h2>
          </div>
          <span className="font-mono text-xs text-slate-400">
            {sessions.length} {sessions.length === 1 ? "Session" : "Sessions"}
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-24 rounded-2xl bg-white/[0.04] border border-white/[0.06] animate-pulse"
              />
            ))}
          </div>
        ) : sessions.length > 0 ? (
          <div className="space-y-3">
            {sessions.map((session) => {
              const isLive = session.status === "live";
              const isScheduled = session.status === "scheduled";
              const sessionDate = new Date(session.scheduled_at);
              const formattedDate = sessionDate.toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              });
              const formattedTime = sessionDate.toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              });

              return (
                <div
                  key={session.id}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isLive
                      ? "bg-red-950/20 border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.15)]"
                      : "bg-[#070c18] border-white/[0.08] hover:border-white/[0.15]"
                  }`}
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-[#29d9ff] bg-[#29d9ff]/10 px-2 py-0.5 rounded-full border border-[#29d9ff]/20">
                        {session.topicTitle}
                      </span>
                      {isLive ? (
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20 font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                          LIVE NOW
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400 bg-white/[0.04] px-2 py-0.5 rounded-full border border-white/[0.06]">
                          SCHEDULED
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-white truncate">
                      {session.title}
                    </h3>

                    <div className="flex items-center gap-3 font-mono text-xs text-slate-400">
                      <span>{session.courseTitle}</span>
                      <span>•</span>
                      <span>
                        {formattedDate} at {formattedTime} ({session.duration_minutes}m)
                      </span>
                    </div>
                  </div>

                  {/* Actions: Edit & Cancel (Cancel only active for scheduled sessions) */}
                  <div className="flex items-center gap-2 self-start sm:self-center">
                    {isLive ? (
                      <Link
                        href={`/live/${session.id}`}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-red-500 hover:bg-red-400 text-white font-mono text-xs uppercase tracking-wider font-bold shadow-[0_0_12px_rgba(239,68,68,0.5)] transition-all"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>Join Room</span>
                      </Link>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleEditClick(session)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 hover:border-white/25 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-mono uppercase tracking-wider text-slate-200 transition-all"
                        >
                          <Edit2 className="w-3 h-3 text-[#29d9ff]" />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCancelSession(session)}
                          disabled={!isScheduled}
                          title={isScheduled ? "Cancel this scheduled session" : "Cannot cancel live or completed session"}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-rose-500/20 hover:border-rose-500/40 bg-rose-500/5 hover:bg-rose-500/15 text-xs font-mono uppercase tracking-wider text-rose-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Cancel</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.06] bg-[#070c18]/50 p-10 text-center space-y-2">
            <Calendar className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-white">No upcoming sessions</p>
            <p className="text-xs text-slate-500">
              Fill in the form above to schedule your next live class session.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
