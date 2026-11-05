"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Radio,
  Video,
  Layers,
  Sparkles,
} from "lucide-react";

interface CalendarSession {
  id: string;
  course_id: string;
  topic_id: string | null;
  teacher_id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  status: "live" | "scheduled" | "ended";
  livekit_room: string;
  courseTitle: string;
  topicTitle: string;
}

interface CalendarImportantDate {
  id: string;
  course_id: string;
  title: string;
  date: string;
  kind: "exam" | "deadline" | "holiday" | "other";
  courseTitle: string;
}

function toLocalDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ProgramCalendarPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [currentMonthDate, setCurrentMonthDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() =>
    toLocalDateKey(new Date())
  );

  const [sessions, setSessions] = useState<CalendarSession[]>([]);
  const [importantDates, setImportantDates] = useState<CalendarImportantDate[]>([]);
  const [hasEnrollments, setHasEnrollments] = useState(true);

  useEffect(() => {
    async function fetchCalendarData() {
      try {
        setLoading(true);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        // 1. Get student's enrolled courses
        const { data: enrollments } = (await supabase
          .from("enrollments")
          .select("course_id")
          .eq("student_id", user.id)) as {
          data: { course_id: string }[] | null;
          error: unknown;
        };

        const courseIds = (enrollments || []).map((e) => e.course_id);

        if (courseIds.length === 0) {
          setHasEnrollments(false);
          setLoading(false);
          return;
        }

        setHasEnrollments(true);

        // 2. Fetch course titles
        const { data: coursesData } = (await supabase
          .from("courses")
          .select("id, title")
          .in("id", courseIds)) as {
          data: { id: string; title: string }[] | null;
          error: unknown;
        };

        const courseMap = new Map((coursesData || []).map((c) => [c.id, c.title]));

        // 3. Fetch topic titles
        const { data: topicsData } = (await supabase
          .from("topics")
          .select("id, title")
          .in("course_id", courseIds)) as {
          data: { id: string; title: string }[] | null;
          error: unknown;
        };

        const topicMap = new Map((topicsData || []).map((t) => [t.id, t.title]));

        // 4. Fetch all sessions for enrolled courses
        const { data: sessionsData } = (await supabase
          .from("live_sessions")
          .select("id, course_id, topic_id, teacher_id, title, scheduled_at, duration_minutes, status, livekit_room")
          .in("course_id", courseIds)
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
                status: "live" | "scheduled" | "ended";
                livekit_room: string;
              }[]
            | null;
          error: unknown;
        };

        const enrichedSessions: CalendarSession[] = (sessionsData || []).map((s) => ({
          ...s,
          courseTitle: courseMap.get(s.course_id) || "Enrolled Course",
          topicTitle: (s.topic_id && topicMap.get(s.topic_id)) || "General Topic",
        }));
        setSessions(enrichedSessions);

        // 5. Fetch important dates for enrolled courses
        const { data: datesData } = (await supabase
          .from("important_dates")
          .select("id, course_id, title, date, kind")
          .in("course_id", courseIds)
          .order("date", { ascending: true })) as {
          data:
            | {
                id: string;
                course_id: string;
                title: string;
                date: string;
                kind: "exam" | "deadline" | "holiday" | "other";
              }[]
            | null;
          error: unknown;
        };

        const enrichedDates: CalendarImportantDate[] = (datesData || []).map((d) => ({
          ...d,
          courseTitle: courseMap.get(d.course_id) || "Enrolled Course",
        }));
        setImportantDates(enrichedDates);
      } catch (err) {
        console.error("Error loading calendar data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchCalendarData();
  }, [supabase, router]);

  // Index sessions and important dates by local date string 'YYYY-MM-DD'
  const { sessionDateMap, importantDatesMap } = useMemo(() => {
    const sMap = new Map<string, CalendarSession[]>();
    sessions.forEach((s) => {
      const key = toLocalDateKey(new Date(s.scheduled_at));
      if (!sMap.has(key)) sMap.set(key, []);
      sMap.get(key)!.push(s);
    });

    const dMap = new Map<string, CalendarImportantDate[]>();
    importantDates.forEach((d) => {
      // d.date is 'YYYY-MM-DD'
      const key = d.date.split("T")[0];
      if (!dMap.has(key)) dMap.set(key, []);
      dMap.get(key)!.push(d);
    });

    return { sessionDateMap: sMap, importantDatesMap: dMap };
  }, [sessions, importantDates]);

  // Calendar Month Grid Calculation
  const calendarDays = useMemo(() => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: {
      date: Date;
      dateKey: string;
      isCurrentMonth: boolean;
      isToday: boolean;
      hasSessions: boolean;
      hasImportantDates: boolean;
    }[] = [];

    const todayKey = toLocalDateKey(new Date());

    // Padding from previous month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrevMonth - i);
      const key = toLocalDateKey(d);
      days.push({
        date: d,
        dateKey: key,
        isCurrentMonth: false,
        isToday: key === todayKey,
        hasSessions: sessionDateMap.has(key),
        hasImportantDates: importantDatesMap.has(key),
      });
    }

    // Days in current month
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      const d = new Date(year, month, i);
      const key = toLocalDateKey(d);
      days.push({
        date: d,
        dateKey: key,
        isCurrentMonth: true,
        isToday: key === todayKey,
        hasSessions: sessionDateMap.has(key),
        hasImportantDates: importantDatesMap.has(key),
      });
    }

    // Padding for next month to complete 7-column rows (up to 35 or 42 cells)
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const key = toLocalDateKey(d);
      days.push({
        date: d,
        dateKey: key,
        isCurrentMonth: false,
        isToday: key === todayKey,
        hasSessions: sessionDateMap.has(key),
        hasImportantDates: importantDatesMap.has(key),
      });
    }

    return days;
  }, [currentMonthDate, sessionDateMap, importantDatesMap]);

  const handlePrevMonth = () => {
    setCurrentMonthDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
    );
  };

  const handleNextMonth = () => {
    setCurrentMonthDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
    );
  };

  const handleGoToToday = () => {
    const now = new Date();
    setCurrentMonthDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDateKey(toLocalDateKey(now));
  };

  // Events for the selected date
  const selectedSessions = sessionDateMap.get(selectedDateKey) || [];
  const selectedDates = importantDatesMap.get(selectedDateKey) || [];
  const totalSelectedEvents = selectedSessions.length + selectedDates.length;

  const formattedSelectedDate = useMemo(() => {
    const parts = selectedDateKey.split("-");
    if (parts.length !== 3) return selectedDateKey;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }, [selectedDateKey]);

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* ─────────────────────────────────────────────────────────────
          PAGE HEADER
      ────────────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <Link
          href="/student"
          className="inline-flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-[#29d9ff] transition-colors group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Dashboard</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-[#29d9ff]">
              ACADEMIC TIMELINE
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Program Calendar
            </h1>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs font-mono text-slate-400 bg-white/[0.04] px-4 py-2 rounded-full border border-white/[0.08] self-start sm:self-auto">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#29d9ff] shadow-[0_0_8px_rgba(41,217,255,0.6)]" />
              <span>Classes</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
              <span>Milestones</span>
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        // Loading Skeleton
        <div className="space-y-6 animate-pulse">
          <div className="h-96 rounded-2xl bg-white/[0.04] border border-white/[0.06]" />
          <div className="h-44 rounded-2xl bg-white/[0.04] border border-white/[0.06]" />
        </div>
      ) : !hasEnrollments ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-10 sm:p-14 text-center space-y-4">
          <CalendarIcon className="w-10 h-10 text-slate-600 mx-auto" />
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white">No enrolled courses</h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              You are not currently enrolled in any courses. Class schedules and academic dates will populate once you join a program.
            </p>
          </div>
          <Link
            href="/student"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#29d9ff] text-[#04060a] font-mono text-xs uppercase tracking-wider font-bold"
          >
            Go to My Courses
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {/* ───────────────────────────────────────────────────────────
              CALENDAR CARD (Month View with Navigation)
          ──────────────────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-5 sm:p-7 space-y-6">
            {/* Calendar Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  {MONTH_NAMES[currentMonthDate.getMonth()]}{" "}
                  <span className="text-[#29d9ff] font-mono">
                    {currentMonthDate.getFullYear()}
                  </span>
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleGoToToday}
                  className="px-3 py-1 rounded-full border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] font-mono text-xs text-slate-300 hover:text-white transition-all"
                >
                  Today
                </button>
                <div className="flex items-center rounded-full border border-white/10 bg-white/[0.04] p-0.5">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    aria-label="Previous Month"
                    className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    aria-label="Next Month"
                    className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Weekday Columns */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-xs font-mono uppercase tracking-wider text-slate-500 pb-2 border-b border-white/[0.06]">
              {WEEKDAYS.map((wd) => (
                <div key={wd} className="py-1">
                  {wd}
                </div>
              ))}
            </div>

            {/* Day Grid */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {calendarDays.map((cell) => {
                const isSelected = cell.dateKey === selectedDateKey;

                return (
                  <button
                    type="button"
                    key={cell.dateKey}
                    onClick={() => setSelectedDateKey(cell.dateKey)}
                    className={`min-h-[64px] sm:min-h-[82px] p-2 rounded-xl text-left flex flex-col justify-between transition-all duration-150 relative group ${
                      !cell.isCurrentMonth
                        ? "text-slate-600 bg-white/[0.01] hover:bg-white/[0.03]"
                        : "text-slate-200 bg-[#04060a]/50 hover:bg-white/[0.06]"
                    } ${
                      cell.isToday
                        ? "border border-[#29d9ff]/50 bg-[#29d9ff]/5 shadow-[0_0_12px_rgba(41,217,255,0.15)]"
                        : "border border-white/[0.04]"
                    } ${
                      isSelected
                        ? "ring-2 ring-[#29d9ff] border-transparent bg-white/[0.08]"
                        : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs sm:text-sm font-mono ${
                          cell.isToday
                            ? "font-bold text-[#29d9ff]"
                            : cell.isCurrentMonth
                            ? "text-slate-200 font-medium"
                            : "text-slate-600"
                        }`}
                      >
                        {cell.date.getDate()}
                      </span>
                      {cell.isToday && (
                        <span className="hidden sm:inline-block font-mono text-[9px] uppercase tracking-wider text-[#29d9ff] bg-[#29d9ff]/15 px-1.5 py-0.2 rounded">
                          TODAY
                        </span>
                      )}
                    </div>

                    {/* Event Dots (Cyan for Sessions, Amber for Important Dates) */}
                    <div className="flex items-center gap-1.5 pt-1">
                      {cell.hasSessions && (
                        <span
                          className="w-2 h-2 rounded-full bg-[#29d9ff] shadow-[0_0_6px_rgba(41,217,255,0.8)]"
                          title="Scheduled Class Session"
                        />
                      )}
                      {cell.hasImportantDates && (
                        <span
                          className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]"
                          title="Important Milestone / Exam / Deadline"
                        />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────
              SELECTED DAY'S EVENTS (Below Calendar)
          ──────────────────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-5 sm:p-7 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
              <div>
                <span className="font-mono text-xs uppercase tracking-wider text-[#29d9ff]">
                  SELECTED DAY
                </span>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Events for {formattedSelectedDate}
                </h3>
              </div>
              <span className="font-mono text-xs text-slate-400">
                {totalSelectedEvents} {totalSelectedEvents === 1 ? "Event" : "Events"}
              </span>
            </div>

            {totalSelectedEvents > 0 ? (
              <div className="space-y-4">
                {/* 1. Classes on Selected Date */}
                {selectedSessions.map((session) => {
                  const isLive = session.status === "live";
                  const sessionTime = new Date(session.scheduled_at).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  });

                  return (
                    <div
                      key={session.id}
                      className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        isLive
                          ? "bg-red-950/20 border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.15)]"
                          : "bg-[#04060a]/70 border-white/[0.06] hover:border-white/[0.12]"
                      }`}
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="w-2 h-2 rounded-full bg-[#29d9ff]" />
                          <span className="font-mono text-[10px] uppercase tracking-wider text-[#29d9ff] bg-[#29d9ff]/10 px-2 py-0.5 rounded-full border border-[#29d9ff]/20">
                            {session.topicTitle}
                          </span>
                          {isLive ? (
                            <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                              LIVE NOW
                            </span>
                          ) : (
                            <span className="font-mono text-[10px] text-slate-400">
                              {session.status.toUpperCase()}
                            </span>
                          )}
                        </div>

                        <h4 className="text-sm sm:text-base font-bold text-white">
                          {session.title}
                        </h4>

                        <div className="flex items-center gap-3 font-mono text-xs text-slate-400">
                          <span>{session.courseTitle}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                            {sessionTime} ({session.duration_minutes}m)
                          </span>
                        </div>
                      </div>

                      {isLive && (
                        <Link
                          href={`/live/${session.id}`}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-red-500 hover:bg-red-400 text-white font-mono text-xs uppercase tracking-wider font-bold shadow-[0_0_12px_rgba(239,68,68,0.4)] transition-all animate-pulse self-start sm:self-center"
                        >
                          <Video className="w-3.5 h-3.5" />
                          <span>Join Class</span>
                        </Link>
                      )}
                    </div>
                  );
                })}

                {/* 2. Important Dates on Selected Date */}
                {selectedDates.map((item) => {
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
                      className="p-4 rounded-xl border border-amber-400/20 bg-amber-400/[0.03] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-400" />
                          <span
                            className={`font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${badgeStyle}`}
                          >
                            {item.kind}
                          </span>
                          <span className="font-mono text-xs text-slate-400">
                            {item.courseTitle}
                          </span>
                        </div>
                        <h4 className="text-sm sm:text-base font-semibold text-white">
                          {item.title}
                        </h4>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-white/[0.06] bg-[#04060a]/40 p-8 text-center space-y-1.5">
                <CalendarIcon className="w-6 h-6 text-slate-600 mx-auto" />
                <p className="text-xs font-semibold text-slate-300">
                  No sessions or important dates scheduled for this day
                </p>
                <p className="text-[11px] text-slate-500">
                  Select a day marked with a cyan dot (class) or amber dot (milestone) above.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
