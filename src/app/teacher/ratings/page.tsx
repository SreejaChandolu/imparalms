"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  MessageSquare,
  ShieldCheck,
  Star,
  TrendingUp,
  UserCheck,
} from "lucide-react";

interface TeacherCourse {
  id: string;
  title: string;
}

interface TeacherSession {
  id: string;
  course_id: string;
  title: string;
  topic: string;
  scheduled_at: string;
  started_at: string | null;
}

// PRIVACY NOTICE: Strictly no student user_id, profile_id, or name is fetched or held in memory.
interface ClassRatingRecord {
  stars: number;
  comment: string | null;
  session_id: string;
  created_at: string;
}

interface CourseRatingSummary {
  course_id: string;
  course_title: string;
  average_stars: number;
  rating_count: number;
}

interface SessionRatingSummary {
  session_id: string;
  session_title: string;
  course_title: string;
  topic: string;
  date: string;
  average_stars: number;
  rating_count: number;
}

export default function TeacherRatingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<TeacherCourse[]>([]);
  const [sessions, setSessions] = useState<TeacherSession[]>([]);
  const [ratings, setRatings] = useState<ClassRatingRecord[]>([]);

  // Filters
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>("all");
  const [starFilter, setStarFilter] = useState<string>("all"); // "all", "5", "4", "3", "2", "1", "comments_only"

  useEffect(() => {
    async function loadRatingsData() {
      try {
        setLoading(true);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        // 1. Fetch teacher's courses
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

        // 2. Fetch topics for teacher's courses
        const { data: topicsData } = await supabase
          .from("topics")
          .select("id, title")
          .in("course_id", courseIds);

        const topicMap = new Map<string, string>();
        (topicsData || []).forEach((t: any) => {
          topicMap.set(t.id, t.title);
        });

        // 3. Fetch teacher's sessions (using topic_id instead of non-existent topic column)
        const { data: sessionsData, error: sessError } = await supabase
          .from("live_sessions")
          .select("id, course_id, topic_id, title, scheduled_at, started_at")
          .in("course_id", courseIds)
          .order("scheduled_at", { ascending: false });

        if (sessError) {
          console.error("Error fetching teacher sessions for ratings:", sessError);
        }

        const teacherSessions: TeacherSession[] = (sessionsData || []).map((s: any) => ({
          id: s.id,
          course_id: s.course_id,
          title: s.title || "Class Session",
          topic: s.topic_id ? topicMap.get(s.topic_id) || "Lecture" : "Lecture",
          scheduled_at: s.scheduled_at,
          started_at: s.started_at,
        }));
        setSessions(teacherSessions);

        if (teacherSessions.length === 0) {
          setLoading(false);
          return;
        }

        const sessionIds = teacherSessions.map((s) => s.id);

        // 4. Fetch ratings ONLY for these sessions
        // CRITICAL PRIVACY REQUIREMENT: Select ONLY stars, comment, session_id, created_at.
        // Absolutely do NOT select user_id or join profiles.
        const { data: ratingsData, error } = await supabase
          .from("class_ratings")
          .select("stars, comment, session_id, created_at")
          .in("session_id", sessionIds)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching class ratings:", error);
        } else {
          setRatings((ratingsData as ClassRatingRecord[]) || []);
        }
      } catch (err) {
        console.error("Error loading teacher ratings:", err);
      } finally {
        setLoading(false);
      }
    }

    loadRatingsData();
  }, [supabase, router]);

  // Session and course lookups
  const sessionLookup = useMemo(() => {
    return new Map(sessions.map((s) => [s.id, s]));
  }, [sessions]);

  const courseLookup = useMemo(() => {
    return new Map(courses.map((c) => [c.id, c.title]));
  }, [courses]);

  // Filtered ratings based on course selection
  const filteredRatings = useMemo(() => {
    return ratings.filter((r) => {
      if (selectedCourseFilter === "all") return true;
      const sess = sessionLookup.get(r.session_id);
      return sess?.course_id === selectedCourseFilter;
    });
  }, [ratings, selectedCourseFilter, sessionLookup]);

  // 1-5 Star Frequency Distribution
  const starDistribution = useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    filteredRatings.forEach((r) => {
      if (r.stars >= 1 && r.stars <= 5) {
        counts[r.stars as 1 | 2 | 3 | 4 | 5] += 1;
      }
    });

    const total = filteredRatings.length;
    return [5, 4, 3, 2, 1].map((stars) => {
      const count = counts[stars as 1 | 2 | 3 | 4 | 5];
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      return { stars, count, percentage: pct };
    });
  }, [filteredRatings]);

  // Aggregate Metrics
  const aggregateMetrics = useMemo(() => {
    if (filteredRatings.length === 0) {
      return {
        overallAverage: 0,
        totalRatings: 0,
        positivePct: 0,
        commentsCount: 0,
      };
    }

    const sum = filteredRatings.reduce((acc, r) => acc + r.stars, 0);
    const avg = Number((sum / filteredRatings.length).toFixed(1));
    const positiveCount = filteredRatings.filter((r) => r.stars >= 4).length;
    const positivePct = Math.round((positiveCount / filteredRatings.length) * 100);
    const commentsCount = filteredRatings.filter((r) => r.comment && r.comment.trim().length > 0).length;

    return {
      overallAverage: avg,
      totalRatings: filteredRatings.length,
      positivePct,
      commentsCount,
    };
  }, [filteredRatings]);

  // Average rating per course
  const courseSummaries = useMemo<CourseRatingSummary[]>(() => {
    const map = new Map<string, { sum: number; count: number }>();

    ratings.forEach((r) => {
      const sess = sessionLookup.get(r.session_id);
      if (!sess) return;
      const existing = map.get(sess.course_id) || { sum: 0, count: 0 };
      existing.sum += r.stars;
      existing.count += 1;
      map.set(sess.course_id, existing);
    });

    return courses.map((c) => {
      const stat = map.get(c.id);
      const avg = stat && stat.count > 0 ? Number((stat.sum / stat.count).toFixed(1)) : 0;
      return {
        course_id: c.id,
        course_title: c.title,
        average_stars: avg,
        rating_count: stat ? stat.count : 0,
      };
    });
  }, [courses, ratings, sessionLookup]);

  // Average rating per class / session
  const sessionSummaries = useMemo<SessionRatingSummary[]>(() => {
    const map = new Map<string, { sum: number; count: number }>();

    ratings.forEach((r) => {
      const existing = map.get(r.session_id) || { sum: 0, count: 0 };
      existing.sum += r.stars;
      existing.count += 1;
      map.set(r.session_id, existing);
    });

    const list: SessionRatingSummary[] = [];

    sessions.forEach((s) => {
      if (selectedCourseFilter !== "all" && s.course_id !== selectedCourseFilter) return;

      const stat = map.get(s.id);
      if (stat && stat.count > 0) {
        const avg = Number((stat.sum / stat.count).toFixed(1));
        const dateObj = new Date(s.started_at || s.scheduled_at);
        list.push({
          session_id: s.id,
          session_title: s.title,
          course_title: courseLookup.get(s.course_id) || "Course",
          topic: s.topic,
          date: dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          average_stars: avg,
          rating_count: stat.count,
        });
      }
    });

    // Sort by rating count or highest rating
    list.sort((a, b) => b.rating_count - a.rating_count || b.average_stars - a.average_stars);
    return list;
  }, [sessions, ratings, selectedCourseFilter, courseLookup]);

  // Filtered written student comments
  const writtenComments = useMemo(() => {
    return filteredRatings
      .filter((r) => r.comment && r.comment.trim().length > 0)
      .filter((r) => {
        if (starFilter === "all") return true;
        return r.stars.toString() === starFilter;
      })
      .map((r) => {
        const sess = sessionLookup.get(r.session_id);
        const dateObj = new Date(r.created_at);
        return {
          stars: r.stars,
          comment: r.comment as string,
          sessionTitle: sess?.title || "Class Lecture",
          topic: sess?.topic || "Topic",
          courseTitle: sess ? courseLookup.get(sess.course_id) || "Course" : "Course",
          dateStr: dateObj.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
        };
      });
  }, [filteredRatings, starFilter, sessionLookup, courseLookup]);

  return (
    <div className="space-y-8">
      {/* Header */}
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
            <span>Class Ratings & Student Feedback</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Anonymous satisfaction metrics, sentiment distribution, and qualitative feedback from attendees.
          </p>
        </div>

        {/* Privacy Callout Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-cyan-500/10 border border-[#29d9ff]/30 text-xs font-mono text-[#29d9ff] self-start sm:self-auto">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>Strictly Anonymous Telemetry</span>
        </div>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#070c18]/80 backdrop-blur-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>OVERALL AVERAGE</span>
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-white">
              {loading ? "—" : aggregateMetrics.overallAverage > 0 ? aggregateMetrics.overallAverage.toFixed(1) : "—"}
            </span>
            <span className="text-xs text-slate-400 font-mono">/ 5.0</span>
          </div>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-3.5 h-3.5 ${
                  star <= Math.round(aggregateMetrics.overallAverage)
                    ? "fill-amber-400 text-amber-400"
                    : "text-slate-600"
                }`}
              />
            ))}
            <span className="text-xs text-slate-400 ml-1.5 font-mono">
              ({aggregateMetrics.totalRatings} ratings)
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#070c18]/80 backdrop-blur-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>TOTAL REVIEWS</span>
            <MessageSquare className="w-4 h-4 text-[#29d9ff]" />
          </div>
          <div className="text-3xl font-bold font-mono text-white">
            {loading ? "—" : aggregateMetrics.totalRatings}
          </div>
          <p className="text-xs text-slate-400 font-mono">
            {aggregateMetrics.commentsCount} written qualitative comments
          </p>
        </div>

        <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#070c18]/80 backdrop-blur-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>HIGH RATING (4-5★)</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-bold font-mono text-emerald-400">
            {loading ? "—" : `${aggregateMetrics.positivePct}%`}
          </div>
          <p className="text-xs text-slate-400">Percentage of attendees rating 4 or 5 stars</p>
        </div>

        <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#070c18]/80 backdrop-blur-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>RATED COURSES</span>
            <BookOpen className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-3xl font-bold font-mono text-white">
            {loading ? "—" : courses.length}
          </div>
          <p className="text-xs text-slate-400">Courses currently accumulating reviews</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl border border-white/[0.08] bg-[#070c18] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-[#29d9ff]" />
          <span className="text-xs font-mono text-slate-300 uppercase tracking-wider">Course Filter:</span>
          <select
            value={selectedCourseFilter}
            onChange={(e) => setSelectedCourseFilter(e.target.value)}
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

        <div className="text-xs text-slate-400 font-mono">
          Showing metrics for{" "}
          <span className="text-white font-medium">
            {selectedCourseFilter === "all"
              ? "All Assigned Courses"
              : courseLookup.get(selectedCourseFilter) || "Selected Course"}
          </span>
        </div>
      </div>

      {/* Two Column Section: Star Distribution & Course Averages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Star Rating Distribution Bar Chart */}
        <div className="p-6 rounded-2xl border border-white/[0.08] bg-[#070c18] space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-mono uppercase text-[#29d9ff] tracking-wider">
                RATING SPREAD
              </div>
              <h2 className="text-lg font-bold text-white mt-0.5">1 to 5 Star Distribution</h2>
            </div>
            <span className="text-xs font-mono text-slate-400">{aggregateMetrics.totalRatings} total responses</span>
          </div>

          {loading ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-6 bg-white/[0.04] rounded-lg animate-pulse" />
              ))}
            </div>
          ) : aggregateMetrics.totalRatings === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              No ratings recorded yet for this course selection.
            </div>
          ) : (
            <div className="space-y-3">
              {starDistribution.map(({ stars, count, percentage }) => (
                <div key={stars} className="flex items-center gap-3 text-xs font-mono">
                  <div className="w-12 flex items-center gap-1 text-slate-300">
                    <span className="font-bold">{stars}</span>
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  </div>

                  <div className="flex-1 h-3 rounded-full bg-white/[0.05] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        stars >= 4
                          ? "bg-gradient-to-r from-[#29d9ff] to-cyan-400"
                          : stars === 3
                          ? "bg-amber-400"
                          : "bg-rose-500/80"
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>

                  <div className="w-16 text-right text-slate-400">
                    <span className="text-white font-medium">{count}</span>
                    <span className="text-slate-500 text-[10px] ml-1">({percentage}%)</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Course Averages Breakdown */}
        <div className="p-6 rounded-2xl border border-white/[0.08] bg-[#070c18] space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-mono uppercase text-[#29d9ff] tracking-wider">
                PROGRAM STANDING
              </div>
              <h2 className="text-lg font-bold text-white mt-0.5">Average Rating by Course</h2>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3 py-4">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 bg-white/[0.04] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : courseSummaries.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">No courses found.</div>
          ) : (
            <div className="space-y-3">
              {courseSummaries.map((c) => (
                <div
                  key={c.course_id}
                  className="p-4 rounded-xl border border-white/[0.06] bg-[#04060a]/60 flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <h3 className="font-semibold text-white text-sm">{c.course_title}</h3>
                    <div className="text-[11px] font-mono text-slate-400">
                      {c.rating_count} attendee review{c.rating_count === 1 ? "" : "s"} submitted
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      <span className="text-base font-bold font-mono text-white">
                        {c.average_stars > 0 ? c.average_stars.toFixed(1) : "—"}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">out of 5.0</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Average Rating Per Class / Session Table */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] overflow-hidden space-y-0">
        <div className="p-5 border-b border-white/[0.08] flex items-center justify-between">
          <div>
            <div className="text-xs font-mono uppercase text-[#29d9ff] tracking-wider">
              SESSION LEVEL BREAKDOWN
            </div>
            <h2 className="text-lg font-bold text-white mt-0.5">Average Rating per Class</h2>
          </div>
          <span className="text-xs font-mono text-slate-400">{sessionSummaries.length} rated classes</span>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-white/[0.04] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : sessionSummaries.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-xs">
            No class ratings recorded yet for this course filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.02] text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4">Class Session</th>
                  <th className="py-3 px-4">Course</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-center">Reviews</th>
                  <th className="py-3 px-4 text-right">Average Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {sessionSummaries.map((s) => (
                  <tr key={s.session_id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">{s.session_title}</div>
                      <div className="text-[11px] text-cyan-400 font-mono">[{s.topic}]</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">{s.course_title}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">{s.date}</td>
                    <td className="py-3.5 px-4 text-center font-mono text-white font-medium">
                      {s.rating_count}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono font-bold">
                        <Star className="w-3.5 h-3.5 fill-amber-400" />
                        <span>{s.average_stars.toFixed(1)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Written Comments List */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
          <div>
            <div className="text-xs font-mono uppercase text-[#29d9ff] tracking-wider">
              QUALITATIVE FEEDBACK
            </div>
            <h2 className="text-lg font-bold text-white mt-0.5">Written Student Comments</h2>
            <p className="text-xs text-slate-400 mt-1">
              Constructive notes and remarks submitted by students after completing the lecture.
            </p>
          </div>

          {/* Filter comments by star score */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Score:</span>
            <select
              value={starFilter}
              onChange={(e) => setStarFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[#04060a] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#29d9ff]"
            >
              <option value="all">All Stars ({writtenComments.length})</option>
              <option value="5">5 Stars only</option>
              <option value="4">4 Stars only</option>
              <option value="3">3 Stars only</option>
              <option value="2">2 Stars only</option>
              <option value="1">1 Star only</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-white/[0.03] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : writtenComments.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.04] text-slate-400 flex items-center justify-center mx-auto">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-white">No Written Comments Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No written student comments match the selected criteria.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {writtenComments.map((item, idx) => (
              <div
                key={idx}
                className="p-5 rounded-xl border border-white/[0.06] bg-[#04060a]/70 hover:border-white/[0.12] transition-colors flex flex-col justify-between space-y-3"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-3.5 h-3.5 ${
                            s <= item.stars ? "fill-amber-400 text-amber-400" : "text-slate-600"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">{item.dateStr}</span>
                  </div>

                  <p className="text-xs text-slate-200 italic leading-relaxed">
                    &ldquo;{item.comment}&rdquo;
                  </p>
                </div>

                <div className="pt-3 border-t border-white/[0.04] flex items-center justify-between gap-2 text-[11px] text-slate-400 font-mono">
                  <div className="truncate">
                    <span className="text-white font-medium">{item.sessionTitle}</span>
                    <span className="text-slate-500 mx-1">•</span>
                    <span className="text-cyan-400">{item.courseTitle}</span>
                  </div>
                  <span className="shrink-0 text-slate-500">Learner</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
