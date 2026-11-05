"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  Bookmark,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  ExternalLink,
  Hourglass,
  Layers,
  Play,
  PlayCircle,
  Video,
  AlertCircle,
  BookOpen,
} from "lucide-react";

interface CourseDetail {
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

interface RecordingItem {
  id: string;
  session_id: string;
  course_id: string;
  topic_id: string | null;
  storage_path: string;
  duration_seconds: number;
  status: "ready" | "processing" | "hidden";
  created_at: string;
  sessionTitle?: string;
  sessionDate?: string;
  completed?: boolean;
}

interface BookmarkItem {
  id: string;
  recording_id: string;
  position_seconds: number;
  note: string;
  created_at: string;
  recordingTitle?: string;
}

interface ImportantDateItem {
  id: string;
  title: string;
  date: string;
  kind: "exam" | "deadline" | "holiday" | "other";
}

function formatDuration(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return "0 mins";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes > 0 ? `${minutes}m` : ""}`.trim();
  }
  return `${minutes} mins`;
}

function formatTimestamp(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getDaysRemaining(endsOn: string | null): { text: string; isEnded: boolean } {
  if (!endsOn) return { text: "Open ended", isEnded: false };
  const target = new Date(endsOn);
  target.setHours(0, 0, 0, 0);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 1) {
    return { text: `${diffDays} days remaining`, isEnded: false };
  } else if (diffDays === 1) {
    return { text: "1 day remaining", isEnded: false };
  } else if (diffDays === 0) {
    return { text: "Ends today", isEnded: false };
  } else {
    const daysAgo = Math.abs(diffDays);
    return { text: `Course ended ${daysAgo} day${daysAgo === 1 ? "" : "s"} ago`, isEnded: true };
  }
}

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const courseId = (params?.courseId || "") as string;

  const [loading, setLoading] = useState(true);
  const [courseNotFound, setCourseNotFound] = useState(false);
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [teacherName, setTeacherName] = useState("Assigned Instructor");
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [recordings, setRecordings] = useState<RecordingItem[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [importantDates, setImportantDates] = useState<ImportantDateItem[]>([]);
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function fetchCourseData() {
      if (!courseId) return;

      try {
        setLoading(true);
        setCourseNotFound(false);

        // 1. Authenticate user
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        // 2. Fetch course by courseId (enforced by RLS)
        const { data: courseData, error: courseError } = (await supabase
          .from("courses")
          .select("id, title, description, teacher_id, starts_on, ends_on")
          .eq("id", courseId)
          .maybeSingle()) as { data: CourseDetail | null; error: unknown };

        if (courseError || !courseData) {
          setCourseNotFound(true);
          return;
        }

        setCourse(courseData);

        // 3. Fetch instructor full_name
        if (courseData.teacher_id) {
          const { data: teacherProfile } = (await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", courseData.teacher_id)
            .maybeSingle()) as { data: { full_name?: string } | null; error: unknown };

          if (teacherProfile?.full_name) {
            setTeacherName(teacherProfile.full_name);
          }
        }

        // 4. Fetch topics for this course
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

        // Auto-expand all topics initially for easy overview
        const initialExpanded: Record<string, boolean> = {};
        loadedTopics.forEach((t) => {
          initialExpanded[t.id] = true;
        });
        setExpandedTopics(initialExpanded);

        // 5. Fetch recordings with status 'ready' or 'processing' (hidden excluded)
        const { data: recordingsData } = (await supabase
          .from("recordings")
          .select("id, session_id, course_id, topic_id, storage_path, duration_seconds, status, created_at")
          .eq("course_id", courseId)
          .in("status", ["ready", "processing"])
          .order("created_at", { ascending: true })) as {
          data: RecordingItem[] | null;
          error: unknown;
        };

        const rawRecordings = recordingsData || [];

        // 6. Fetch live sessions for recording titles/dates
        const sessionIds = Array.from(
          new Set(rawRecordings.map((r) => r.session_id).filter(Boolean))
        );

        const sessionMap = new Map<string, { title: string; scheduled_at: string }>();
        if (sessionIds.length > 0) {
          const { data: sessionsData } = (await supabase
            .from("live_sessions")
            .select("id, title, scheduled_at")
            .in("id", sessionIds)) as {
            data: { id: string; title: string; scheduled_at: string }[] | null;
            error: unknown;
          };

          if (sessionsData) {
            sessionsData.forEach((s) => {
              sessionMap.set(s.id, {
                title: s.title,
                scheduled_at: s.scheduled_at,
              });
            });
          }
        }

        // 7. Fetch student's lesson_progress for these recordings
        const recordingIds = rawRecordings.map((r) => r.id);
        const progressMap = new Map<string, boolean>();

        if (recordingIds.length > 0) {
          const { data: progressData } = (await supabase
            .from("lesson_progress")
            .select("recording_id, completed")
            .eq("user_id", user.id)
            .in("recording_id", recordingIds)) as {
            data: { recording_id: string; completed: boolean }[] | null;
            error: unknown;
          };

          if (progressData) {
            progressData.forEach((p) => {
              progressMap.set(p.recording_id, Boolean(p.completed));
            });
          }
        }

        // Enrich recordings with session details and completion status
        const enrichedRecordings: RecordingItem[] = rawRecordings.map((rec) => {
          const sessionInfo = sessionMap.get(rec.session_id);
          return {
            ...rec,
            sessionTitle: sessionInfo?.title,
            sessionDate: sessionInfo?.scheduled_at,
            completed: progressMap.get(rec.id) || false,
          };
        });
        setRecordings(enrichedRecordings);

        // 8. Fetch bookmarks for recordings in this course
        if (recordingIds.length > 0) {
          const { data: bookmarksData } = (await supabase
            .from("bookmarks")
            .select("id, recording_id, position_seconds, note, created_at")
            .eq("user_id", user.id)
            .in("recording_id", recordingIds)
            .order("created_at", { ascending: false })) as {
            data: BookmarkItem[] | null;
            error: unknown;
          };

          const recordingTitleMap = new Map(
            enrichedRecordings.map((r) => [r.id, r.sessionTitle || "Class Recording"])
          );

          const enrichedBookmarks = (bookmarksData || []).map((b) => ({
            ...b,
            recordingTitle: recordingTitleMap.get(b.recording_id) || "Lesson Recording",
          }));

          setBookmarks(enrichedBookmarks);
        } else {
          setBookmarks([]);
        }

        // 9. Fetch important dates for this course
        const { data: datesData } = (await supabase
          .from("important_dates")
          .select("id, title, date, kind")
          .eq("course_id", courseId)
          .order("date", { ascending: true })) as {
          data: ImportantDateItem[] | null;
          error: unknown;
        };

        setImportantDates(datesData || []);
      } catch (err) {
        console.error("Error loading course details:", err);
        setCourseNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    fetchCourseData();
  }, [courseId, supabase, router]);

  const toggleTopicExpand = (topicId: string) => {
    setExpandedTopics((prev) => ({
      ...prev,
      [topicId]: !prev[topicId],
    }));
  };

  // Group recordings and compute progress statistics per topic
  const topicStats = useMemo(() => {
    const stats: Record<
      string,
      {
        readyRecordings: RecordingItem[];
        processingRecordings: RecordingItem[];
        totalReady: number;
        completedCount: number;
        progressPercentage: number;
        status: "empty" | "half" | "checked";
      }
    > = {};

    topics.forEach((topic) => {
      const topicRecs = recordings.filter((r) => r.topic_id === topic.id);
      const readyRecs = topicRecs.filter((r) => r.status === "ready");
      const processingRecs = topicRecs.filter((r) => r.status === "processing");

      const totalReady = readyRecs.length;
      const completedCount = readyRecs.filter((r) => r.completed).length;

      let progressPercentage = 0;
      let status: "empty" | "half" | "checked" = "empty";

      if (totalReady > 0) {
        progressPercentage = Math.round((completedCount / totalReady) * 100);
        if (completedCount === totalReady) {
          status = "checked";
        } else if (completedCount > 0) {
          status = "half";
        } else {
          status = "empty";
        }
      }

      stats[topic.id] = {
        readyRecordings: readyRecs,
        processingRecordings: processingRecs,
        totalReady,
        completedCount,
        progressPercentage,
        status,
      };
    });

    return stats;
  }, [topics, recordings]);

  // Loading Skeleton State
  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-4 w-32 bg-white/[0.06] rounded" />
        <div className="space-y-2">
          <div className="h-8 w-2/3 bg-white/[0.06] rounded" />
          <div className="h-4 w-1/4 bg-white/[0.04] rounded" />
        </div>

        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-8 items-start">
          <div className="w-full lg:col-span-7 xl:col-span-8 space-y-4">
            <div className="h-6 w-32 bg-white/[0.06] rounded" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-white/[0.04] border border-white/[0.06]" />
            ))}
          </div>

          <div className="w-full lg:col-span-5 xl:col-span-4 space-y-6">
            <div className="h-24 rounded-2xl bg-white/[0.04] border border-white/[0.06]" />
            <div className="h-36 rounded-2xl bg-white/[0.04] border border-white/[0.06]" />
            <div className="h-36 rounded-2xl bg-white/[0.04] border border-white/[0.06]" />
          </div>
        </div>
      </div>
    );
  }

  // Friendly "Course not found" state (Respects RLS if not enrolled or invalid ID)
  if (courseNotFound || !course) {
    return (
      <div className="space-y-6">
        <Link
          href="/student"
          className="inline-flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-[#29d9ff] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to My Courses</span>
        </Link>

        <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-8 sm:p-14 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(244,63,94,0.2)]">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <div className="font-mono text-xs uppercase tracking-widest text-rose-400">
              Access Restricted
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Course not found</h1>
          </div>
          <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
            The course you are looking for does not exist or your student account is not enrolled in this program. Please check with your program coordinator.
          </p>
          <div className="pt-2">
            <Link
              href="/student"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#29d9ff] text-[#04060a] font-mono text-xs uppercase tracking-wider font-bold shadow-[0_0_15px_rgba(41,217,255,0.3)] hover:bg-[#6be4ff] transition-all"
            >
              <span>Return to Dashboard</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const daysRemainingInfo = getDaysRemaining(course.ends_on);

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* ─────────────────────────────────────────────────────────────
          TOP NAVIGATION & HEADER
      ────────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <Link
          href="/student"
          className="inline-flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-[#29d9ff] transition-colors group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
          <span>Back to My Courses</span>
        </Link>

        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight">
            {course.title}
          </h1>
          <p className="font-mono text-xs sm:text-sm text-slate-400 mt-1.5 flex items-center gap-2">
            <span>Instructor:</span>
            <span className="text-[#29d9ff] font-semibold">{teacherName}</span>
          </p>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TWO COLUMNS (Desktop: Wide Left Lessons, Narrow Right Stack)
          Mobile: Single column with right-hand cards below lessons
      ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-8 items-start">
        {/* ───────────────────────────────────────────────────────────
            LEFT COLUMN (Wide): Lessons List (Topics of the course)
        ──────────────────────────────────────────────────────────── */}
        <div className="w-full lg:col-span-7 xl:col-span-8 space-y-6">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
            <div className="flex items-center gap-2.5">
              <Layers className="w-5 h-5 text-[#29d9ff]" />
              <h2 className="text-xl font-bold text-white tracking-tight">Lessons</h2>
            </div>
            <span className="font-mono text-xs text-slate-400">
              {topics.length} {topics.length === 1 ? "Module" : "Modules"}
            </span>
          </div>

          {topics.length > 0 ? (
            <div className="space-y-4">
              {topics.map((topic) => {
                const stat = topicStats[topic.id] || {
                  readyRecordings: [],
                  processingRecordings: [],
                  totalReady: 0,
                  completedCount: 0,
                  progressPercentage: 0,
                  status: "empty" as const,
                };

                const isExpanded = Boolean(expandedTopics[topic.id]);
                const allTopicRecordings = [
                  ...stat.readyRecordings,
                  ...stat.processingRecordings,
                ];

                return (
                  <div
                    key={topic.id}
                    className="rounded-2xl border border-white/[0.08] bg-[#070c18] overflow-hidden transition-all duration-200 hover:border-[#29d9ff]/30 group"
                  >
                    {/* Topic Header Row (Clickable to Expand / Collapse) */}
                    <button
                      type="button"
                      onClick={() => toggleTopicExpand(topic.id)}
                      className="w-full text-left p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer focus:outline-none"
                    >
                      <div className="flex items-center gap-3.5 flex-1 min-w-0">
                        {/* Status Circle: empty / half / checked */}
                        <div className="flex-shrink-0">
                          {stat.status === "checked" ? (
                            <div
                              className="w-5 h-5 rounded-full bg-emerald-400/20 border border-emerald-400 text-emerald-400 flex items-center justify-center shadow-[0_0_8px_rgba(52,211,153,0.3)]"
                              title="All lesson recordings completed"
                            >
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          ) : stat.status === "half" ? (
                            <div
                              className="w-5 h-5 flex items-center justify-center"
                              title="Some recordings completed"
                            >
                              <svg
                                className="w-5 h-5 text-[#29d9ff]"
                                viewBox="0 0 24 24"
                                fill="none"
                              >
                                <circle
                                  cx="12"
                                  cy="12"
                                  r="9"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  className="text-slate-600"
                                />
                                <path
                                  d="M12 3 A9 9 0 0 1 12 21 Z"
                                  fill="currentColor"
                                  className="text-[#29d9ff]"
                                />
                              </svg>
                            </div>
                          ) : (
                            <div
                              className="w-5 h-5 rounded-full border-2 border-slate-600"
                              title="Nothing completed yet"
                            />
                          )}
                        </div>

                        {/* Topic Title */}
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-[#29d9ff] transition-colors truncate">
                            {topic.title}
                          </h3>
                          <p className="text-xs font-mono text-slate-500 mt-0.5">
                            {stat.completedCount} of {stat.totalReady} ready recordings completed
                          </p>
                        </div>
                      </div>

                      {/* Progress Bar & Expand Arrow */}
                      <div className="flex items-center gap-4 sm:min-w-[200px] justify-between sm:justify-end">
                        <div className="flex-1 sm:max-w-[140px] space-y-1.5">
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="text-slate-400 text-[10px] uppercase">Progress</span>
                            <span className="text-[#29d9ff] font-bold">
                              {stat.progressPercentage}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#29d9ff] to-[#00b0ff] rounded-full transition-all duration-300"
                              style={{ width: `${stat.progressPercentage}%` }}
                            />
                          </div>
                        </div>

                        <ChevronDown
                          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                            isExpanded ? "rotate-180 text-[#29d9ff]" : ""
                          }`}
                        />
                      </div>
                    </button>

                    {/* Expanded Recordings List */}
                    {isExpanded && (
                      <div className="border-t border-white/[0.06] bg-[#04060a]/40 px-5 sm:px-6 py-4 space-y-3">
                        {allTopicRecordings.length > 0 ? (
                          allTopicRecordings.map((rec) => {
                            const isProcessing = rec.status === "processing";
                            const displayName =
                              rec.sessionTitle ||
                              (rec.sessionDate
                                ? `Session from ${new Date(rec.sessionDate).toLocaleDateString()}`
                                : "Curriculum Lesson");

                            const formattedDate = rec.sessionDate
                              ? new Date(rec.sessionDate).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : new Date(rec.created_at).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                });

                            return (
                              <div
                                key={rec.id}
                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-white/[0.05] bg-[#070c18] hover:border-white/[0.12] transition-colors"
                              >
                                <div className="space-y-1 min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="text-xs sm:text-sm font-semibold text-slate-200 truncate">
                                      {displayName}
                                    </h4>
                                    {rec.completed && (
                                      <span className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20">
                                        <Check className="w-2.5 h-2.5" /> Completed
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-3 font-mono text-[11px] text-slate-500">
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-slate-400" />
                                      {isProcessing ? "Processing duration" : formatDuration(rec.duration_seconds)}
                                    </span>
                                    <span>•</span>
                                    <span>{formattedDate}</span>
                                  </div>
                                </div>

                                {/* Action: Watch button OR Recording processing label */}
                                <div className="self-start sm:self-center">
                                  {isProcessing ? (
                                    <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 font-mono text-[11px] text-amber-400 uppercase tracking-wider">
                                      <Hourglass className="w-3.5 h-3.5 animate-spin" />
                                      <span>Recording processing</span>
                                    </div>
                                  ) : (
                                    <Link
                                      href={`/student/recordings/${rec.id}`}
                                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#29d9ff]/10 hover:bg-[#29d9ff] text-[#29d9ff] hover:text-[#04060a] border border-[#29d9ff]/30 font-mono text-xs uppercase tracking-wider font-semibold transition-all duration-200 shadow-sm"
                                    >
                                      <Play className="w-3 h-3 fill-current" />
                                      <span>Watch</span>
                                    </Link>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="py-5 text-center space-y-1">
                            <p className="text-xs font-mono text-slate-500">No recordings yet</p>
                            <p className="text-[11px] text-slate-600">
                              Lectures for this module will be uploaded once sessions conclude.
                            </p>
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
              <p className="text-sm font-semibold text-white">No topics in this course</p>
              <p className="text-xs text-slate-500">
                Course curriculum modules are currently being prepared.
              </p>
            </div>
          )}
        </div>

        {/* ───────────────────────────────────────────────────────────
            RIGHT COLUMN (Narrow Stacked Cards)
            Mobile: Appears below lessons
            1. Course ends
            2. Bookmarks
            3. Important dates
        ──────────────────────────────────────────────────────────── */}
        <div className="w-full lg:col-span-5 xl:col-span-4 space-y-6">
          {/* Card 1: Course Ends */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-5 sm:p-6 space-y-3 transition-all hover:border-[#29d9ff]/20">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <span className="font-mono text-xs uppercase tracking-wider font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#29d9ff]" />
                <span>Course ends</span>
              </span>
              <span
                className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                  daysRemainingInfo.isEnded
                    ? "text-rose-400 bg-rose-500/10 border-rose-500/20"
                    : "text-[#29d9ff] bg-[#29d9ff]/10 border-[#29d9ff]/20"
                }`}
              >
                {daysRemainingInfo.text}
              </span>
            </div>

            <div className="pt-1">
              <div className="text-lg font-bold text-white">
                {course.ends_on
                  ? new Date(course.ends_on).toLocaleDateString(undefined, {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "Continuous Enrollment"}
              </div>
              <p className="text-xs font-mono text-slate-500 mt-1">
                Started on{" "}
                {course.starts_on
                  ? new Date(course.starts_on).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "Course launch"}
              </p>
            </div>
          </div>

          {/* Card 2: Bookmarks */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-[#29d9ff]" />
                <h3 className="text-sm font-bold uppercase tracking-wider font-mono text-white">
                  Bookmarks
                </h3>
              </div>
              <span className="font-mono text-[10px] text-slate-500">
                {bookmarks.length} saved
              </span>
            </div>

            {bookmarks.length > 0 ? (
              <div className="space-y-3">
                {bookmarks.map((bm) => (
                  <Link
                    key={bm.id}
                    href={`/student/recordings/${bm.recording_id}?t=${bm.position_seconds}`}
                    className="block p-3 rounded-xl border border-white/[0.06] bg-[#04060a]/70 hover:border-[#29d9ff]/40 hover:bg-[#29d9ff]/5 transition-all duration-200 group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-semibold text-slate-200 group-hover:text-[#29d9ff] transition-colors truncate">
                        {bm.recordingTitle}
                      </h4>
                      <span className="flex-shrink-0 font-mono text-[11px] text-[#29d9ff] bg-[#29d9ff]/10 px-2 py-0.5 rounded border border-[#29d9ff]/20">
                        {formatTimestamp(bm.position_seconds)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                      {bm.note}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-white/[0.06] bg-[#04060a]/50 p-6 text-center space-y-1">
                <Bookmark className="w-5 h-5 text-slate-600 mx-auto" />
                <p className="text-xs font-semibold text-slate-300">No bookmarks yet</p>
                <p className="text-[11px] text-slate-500">
                  Save important timestamps while watching lesson recordings.
                </p>
              </div>
            )}
          </div>

          {/* Card 3: Important Dates */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#29d9ff]" />
                <h3 className="text-sm font-bold uppercase tracking-wider font-mono text-white">
                  Important dates
                </h3>
              </div>
              <span className="font-mono text-[10px] text-slate-500">Upcoming schedule</span>
            </div>

            {importantDates.length > 0 ? (
              <div className="space-y-3">
                {importantDates.map((item) => {
                  const itemDate = new Date(item.date);
                  const formattedDate = itemDate.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });

                  // Badge style by kind: exam / deadline / holiday / other
                  const badgeStyle =
                    item.kind === "exam"
                      ? "text-rose-400 bg-rose-500/10 border-rose-500/20"
                      : item.kind === "deadline"
                      ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                      : item.kind === "holiday"
                      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                      : "text-[#29d9ff] bg-[#29d9ff]/10 border-[#29d9ff]/20";

                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl border border-white/[0.06] bg-[#04060a]/70 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs text-white font-semibold">
                          {formattedDate}
                        </span>
                        <span
                          className={`font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${badgeStyle}`}
                        >
                          {item.kind}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-snug">{item.title}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-white/[0.06] bg-[#04060a]/50 p-6 text-center space-y-1">
                <Calendar className="w-5 h-5 text-slate-600 mx-auto" />
                <p className="text-xs font-semibold text-slate-300">No important dates</p>
                <p className="text-[11px] text-slate-500">
                  No upcoming deadlines or examination milestones posted yet.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
