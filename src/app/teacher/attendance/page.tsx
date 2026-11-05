"use client";

import React, { Suspense, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  Search,
  Users,
  XCircle,
  X,
  AlertTriangle,
  ChevronRight,
  BookOpen,
  Info,
} from "lucide-react";

interface TeacherCourse {
  id: string;
  title: string;
}

interface EndedSession {
  id: string;
  course_id: string;
  course_title: string;
  title: string;
  topic: string;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number;
  scheduled_at: string;
  effective_duration_seconds: number;
}

interface StudentAttendanceRecord {
  student_id: string;
  student_name: string;
  student_code: string | null;
  joined_at: string | null;
  left_at: string | null;
  total_seconds: number;
  isPresent: boolean;
}

interface StudentSummaryItem {
  student_id: string;
  student_name: string;
  student_code: string | null;
  course_id: string;
  course_title: string;
  total_ended_sessions: number;
  sessions_attended: number;
  attendance_percentage: number;
}

function AttendanceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<TeacherCourse[]>([]);
  const [sessions, setSessions] = useState<EndedSession[]>([]);
  const [sessionPresentCounts, setSessionPresentCounts] = useState<Map<string, number>>(new Map());
  const [courseEnrollmentCounts, setCourseEnrollmentCounts] = useState<Map<string, number>>(new Map());
  const [studentSummaries, setStudentSummaries] = useState<StudentSummaryItem[]>([]);

  // Detailed attendance records indexed by session_id
  const [sessionStudentRecords, setSessionStudentRecords] = useState<Map<string, StudentAttendanceRecord[]>>(
    new Map()
  );

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<"classes" | "students">("classes");
  const [selectedCourseId, setSelectedCourseId] = useState<string>("all");
  const [dateRangePreset, setDateRangePreset] = useState<"all" | "7d" | "30d" | "custom">("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal for per-class student roster
  const [selectedSessionForModal, setSelectedSessionForModal] = useState<EndedSession | null>(null);

  // Check query params on mount
  const paramSessionId = searchParams.get("session");
  const paramCourseId = searchParams.get("course");

  useEffect(() => {
    if (paramCourseId) {
      setSelectedCourseId(paramCourseId);
    }
  }, [paramCourseId]);

  useEffect(() => {
    async function loadAttendanceData() {
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
        const { data: coursesData, error: coursesError } = await supabase
          .from("courses")
          .select("id, title")
          .eq("teacher_id", user.id)
          .order("title");

        console.log("[Attendance Debug] Query 1 (courses):", {
          rowCount: coursesData?.length ?? 0,
          error: coursesError,
          data: coursesData,
        });

        const teacherCourses = (coursesData as TeacherCourse[]) || [];
        setCourses(teacherCourses);

        if (teacherCourses.length === 0) {
          setLoading(false);
          return;
        }

        const courseIds = teacherCourses.map((c) => c.id);
        const courseMap = new Map(teacherCourses.map((c) => [c.id, c.title]));

        // 2. Fetch enrollments for teacher courses
        const { data: enrollmentsData, error: enrollError } = await supabase
          .from("enrollments")
          .select("course_id, student_id")
          .in("course_id", courseIds);

        console.log("[Attendance Debug] Query 2 (enrollments):", {
          rowCount: enrollmentsData?.length ?? 0,
          error: enrollError,
          data: enrollmentsData,
        });

        // 3. Fetch student profiles for these enrolled students
        const studentIds = Array.from(
          new Set((enrollmentsData || []).map((e: any) => e.student_id))
        );

        const profilesMap = new Map<string, { full_name: string; student_code: string | null }>();
        if (studentIds.length > 0) {
          const { data: profilesData, error: profError } = await supabase
            .from("profiles")
            .select("id, full_name, student_id")
            .in("id", studentIds);

          console.log("[Attendance Debug] Query 3 (profiles):", {
            rowCount: profilesData?.length ?? 0,
            error: profError,
            data: profilesData,
          });

          (profilesData || []).forEach((p: any) => {
            profilesMap.set(p.id, {
              full_name: p.full_name || "Enrolled Student",
              student_code: p.student_id || null,
            });
          });
        }

        // Map course -> array of enrolled students
        const enrollmentsByCourse = new Map<
          string,
          Array<{ student_id: string; full_name: string; student_code: string | null }>
        >();
        const courseEnrolledCountMap = new Map<string, number>();

        (enrollmentsData || []).forEach((row: any) => {
          const cId = row.course_id;
          const prof = profilesMap.get(row.student_id);
          const studentInfo = {
            student_id: row.student_id,
            full_name: prof?.full_name || "Enrolled Student",
            student_code: prof?.student_code || null,
          };

          const list = enrollmentsByCourse.get(cId) || [];
          list.push(studentInfo);
          enrollmentsByCourse.set(cId, list);
        });

        teacherCourses.forEach((c) => {
          courseEnrolledCountMap.set(c.id, (enrollmentsByCourse.get(c.id) || []).length);
        });
        setCourseEnrollmentCounts(courseEnrolledCountMap);

        // 4. Fetch topics for teacher courses to resolve topic names
        const { data: topicsData, error: topicsError } = await supabase
          .from("topics")
          .select("id, title, course_id")
          .in("course_id", courseIds);

        console.log("[Attendance Debug] Query 4 (topics):", {
          rowCount: topicsData?.length ?? 0,
          error: topicsError,
          data: topicsData,
        });

        const topicMap = new Map<string, string>();
        (topicsData || []).forEach((t: any) => {
          topicMap.set(t.id, t.title);
        });

        // 5. Fetch ended sessions for teacher's courses (using topic_id instead of non-existent topic column)
        const { data: sessionsData, error: sessError } = await supabase
          .from("live_sessions")
          .select("id, course_id, topic_id, title, started_at, ended_at, duration_minutes, scheduled_at, status")
          .in("course_id", courseIds)
          .eq("status", "ended")
          .order("scheduled_at", { ascending: false });

        console.log("[Attendance Debug] Query 5 (ended live_sessions):", {
          rowCount: sessionsData?.length ?? 0,
          error: sessError,
          data: sessionsData,
        });

        const endedSessionsList: EndedSession[] = (sessionsData || []).map((s: any) => {
          let effSec = (s.duration_minutes || 60) * 60;
          if (s.started_at && s.ended_at) {
            const diff = (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000;
            if (diff > 0) effSec = Math.round(diff);
          }
          const topicName = s.topic_id ? topicMap.get(s.topic_id) || "Lecture" : "Lecture";

          return {
            id: s.id,
            course_id: s.course_id,
            course_title: courseMap.get(s.course_id) || "Course",
            title: s.title || "Class Session",
            topic: topicName,
            started_at: s.started_at,
            ended_at: s.ended_at,
            duration_minutes: s.duration_minutes || 60,
            scheduled_at: s.scheduled_at,
            effective_duration_seconds: effSec,
          };
        });

        setSessions(endedSessionsList);

        const sessionIds = endedSessionsList.map((s) => s.id);

        // 6. Fetch attendance telemetry rows
        let attendanceData: any[] = [];
        let attError: any = null;
        if (sessionIds.length > 0) {
          const res = await supabase
            .from("attendance")
            .select("id, session_id, user_id, joined_at, left_at, total_seconds")
            .in("session_id", sessionIds);
          attendanceData = res.data || [];
          attError = res.error;
        }

        console.log("[Attendance Debug] Query 6 (attendance telemetry):", {
          rowCount: attendanceData.length,
          error: attError,
          data: attendanceData,
        });

        // Aggregate student telemetry per session
        // Map: session_id -> Map of student_id -> aggregated record
        const sessionStudentMap = new Map<
          string,
          Map<
            string,
            {
              joined_at: string | null;
              left_at: string | null;
              total_seconds: number;
            }
          >
        >();

        (attendanceData || []).forEach((att: any) => {
          const sMap = sessionStudentMap.get(att.session_id) || new Map();
          const existing = sMap.get(att.user_id) || {
            joined_at: att.joined_at,
            left_at: att.left_at,
            total_seconds: 0,
          };

          // Earliest joined, latest left
          if (att.joined_at && (!existing.joined_at || new Date(att.joined_at) < new Date(existing.joined_at))) {
            existing.joined_at = att.joined_at;
          }
          if (att.left_at && (!existing.left_at || new Date(att.left_at) > new Date(existing.left_at))) {
            existing.left_at = att.left_at;
          }
          existing.total_seconds += Number(att.total_seconds) || 0;

          sMap.set(att.user_id, existing);
          sessionStudentMap.set(att.session_id, sMap);
        });

        // 7. Build per-session student rosters and count verified present (75% rule)
        const presCounts = new Map<string, number>();
        const fullRosters = new Map<string, StudentAttendanceRecord[]>();

        endedSessionsList.forEach((sess) => {
          const enrolledStudents = enrollmentsByCourse.get(sess.course_id) || [];
          const sessionLogs = sessionStudentMap.get(sess.id);
          let sessionPresent = 0;
          const roster: StudentAttendanceRecord[] = [];

          enrolledStudents.forEach((student) => {
            const log = sessionLogs?.get(student.student_id);
            const totalSec = log?.total_seconds || 0;
            const isPres = sess.effective_duration_seconds > 0 && totalSec >= 0.75 * sess.effective_duration_seconds;

            if (isPres) sessionPresent += 1;

            roster.push({
              student_id: student.student_id,
              student_name: student.full_name,
              student_code: student.student_code,
              joined_at: log?.joined_at || null,
              left_at: log?.left_at || null,
              total_seconds: totalSec,
              isPresent: isPres,
            });
          });

          // Sort roster by student name alphabetically
          roster.sort((a, b) => a.student_name.localeCompare(b.student_name));

          presCounts.set(sess.id, sessionPresent);
          fullRosters.set(sess.id, roster);
        });

        setSessionPresentCounts(presCounts);
        setSessionStudentRecords(fullRosters);

        // 8. Build By Student Summary for enrolled courses
        // A student's attendance in a course:
        // total_ended_sessions in course, count of sessions where isPresent == true
        const studentSummaryList: StudentSummaryItem[] = [];

        teacherCourses.forEach((c) => {
          const courseSessionsList = endedSessionsList.filter((s) => s.course_id === c.id);
          const enrolledStudents = enrollmentsByCourse.get(c.id) || [];
          const totalCourseSessions = courseSessionsList.length;

          enrolledStudents.forEach((student) => {
            let attendedCount = 0;
            courseSessionsList.forEach((sess) => {
              const roster = fullRosters.get(sess.id) || [];
              const rec = roster.find((r) => r.student_id === student.student_id);
              if (rec?.isPresent) {
                attendedCount += 1;
              }
            });

            const percentage =
              totalCourseSessions > 0 ? Math.round((attendedCount / totalCourseSessions) * 100) : 100;

            studentSummaryList.push({
              student_id: student.student_id,
              student_name: student.full_name,
              student_code: student.student_code,
              course_id: c.id,
              course_title: c.title,
              total_ended_sessions: totalCourseSessions,
              sessions_attended: attendedCount,
              attendance_percentage: percentage,
            });
          });
        });

        // Sort student summaries
        studentSummaryList.sort((a, b) => {
          if (a.course_title !== b.course_title) {
            return a.course_title.localeCompare(b.course_title);
          }
          return a.student_name.localeCompare(b.student_name);
        });

        setStudentSummaries(studentSummaryList);

        // If URL requested a specific session, open modal for it
        if (paramSessionId) {
          const target = endedSessionsList.find((s) => s.id === paramSessionId);
          if (target) {
            setSelectedSessionForModal(target);
          }
        }
      } catch (err) {
        console.error("Error loading attendance telemetry:", err);
      } finally {
        setLoading(false);
      }
    }

    loadAttendanceData();
  }, [supabase, router, paramSessionId]);

  // Date filtering logic
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      // Course filter
      if (selectedCourseId !== "all" && s.course_id !== selectedCourseId) {
        return false;
      }

      // Date range filter
      const sessDate = new Date(s.scheduled_at || s.started_at || "").getTime();
      const now = new Date().getTime();

      if (dateRangePreset === "7d") {
        if (sessDate < now - 7 * 24 * 60 * 60 * 1000) return false;
      } else if (dateRangePreset === "30d") {
        if (sessDate < now - 30 * 24 * 60 * 60 * 1000) return false;
      } else if (dateRangePreset === "custom") {
        if (startDate) {
          const sTime = new Date(startDate).setHours(0, 0, 0, 0);
          if (sessDate < sTime) return false;
        }
        if (endDate) {
          const eTime = new Date(endDate).setHours(23, 59, 59, 999);
          if (sessDate > eTime) return false;
        }
      }

      // Search query (title or topic)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = s.title.toLowerCase().includes(q);
        const matchesTopic = s.topic.toLowerCase().includes(q);
        const matchesCourse = s.course_title.toLowerCase().includes(q);
        if (!matchesTitle && !matchesTopic && !matchesCourse) return false;
      }

      return true;
    });
  }, [sessions, selectedCourseId, dateRangePreset, startDate, endDate, searchQuery]);

  // Filtered student summaries
  const filteredStudentSummaries = useMemo(() => {
    return studentSummaries.filter((st) => {
      if (selectedCourseId !== "all" && st.course_id !== selectedCourseId) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = st.student_name.toLowerCase().includes(q);
        const matchesCode = st.student_code ? st.student_code.toLowerCase().includes(q) : false;
        const matchesCourse = st.course_title.toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesCourse) return false;
      }
      return true;
    });
  }, [studentSummaries, selectedCourseId, searchQuery]);

  // Overall attendance calculation across filtered sessions
  const overallMetrics = useMemo(() => {
    let totalPossible = 0;
    let totalPresent = 0;

    filteredSessions.forEach((s) => {
      const enrolled = courseEnrollmentCounts.get(s.course_id) || 0;
      const present = sessionPresentCounts.get(s.id) || 0;
      totalPossible += enrolled;
      totalPresent += present;
    });

    const pct = totalPossible > 0 ? Math.round((totalPresent / totalPossible) * 100) : 100;
    return {
      totalPossible,
      totalPresent,
      percentage: pct,
    };
  }, [filteredSessions, courseEnrollmentCounts, sessionPresentCounts]);

  // CSV Export handler
  const handleDownloadCSV = () => {
    if (activeTab === "classes") {
      // Export ended classes table
      const headers = [
        "Date",
        "Course",
        "Topic",
        "Session Title",
        "Duration (Mins)",
        "Present Count",
        "Enrolled Count",
        "Attendance Rate (%)",
        "Status",
      ];

      const rows = filteredSessions.map((s) => {
        const enrolled = courseEnrollmentCounts.get(s.course_id) || 0;
        const present = sessionPresentCounts.get(s.id) || 0;
        const pct = enrolled > 0 ? Math.round((present / enrolled) * 100) : 0;
        const dateStr = s.started_at
          ? new Date(s.started_at).toLocaleDateString()
          : new Date(s.scheduled_at).toLocaleDateString();

        return [
          `"${dateStr}"`,
          `"${s.course_title.replace(/"/g, '""')}"`,
          `"${s.topic.replace(/"/g, '""')}"`,
          `"${s.title.replace(/"/g, '""')}"`,
          s.duration_minutes,
          present,
          enrolled,
          `${pct}%`,
          pct >= 75 ? "Compliant (>=75%)" : "Below 75%",
        ].join(",");
      });

      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `teacher-attendance-classes-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // Export By Student table
      const headers = [
        "Student Name",
        "Student Code",
        "Course Title",
        "Total Ended Classes",
        "Classes Attended (>=75%)",
        "Overall Attendance (%)",
        "Status",
      ];

      const rows = filteredStudentSummaries.map((st) => {
        return [
          `"${st.student_name.replace(/"/g, '""')}"`,
          `"${(st.student_code || "").replace(/"/g, '""')}"`,
          `"${st.course_title.replace(/"/g, '""')}"`,
          st.total_ended_sessions,
          st.sessions_attended,
          `${st.attendance_percentage}%`,
          st.attendance_percentage >= 75 ? "Good Standing" : "Below 75% Target (Needs Attention)",
        ].join(",");
      });

      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `teacher-attendance-students-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Export specific session modal roster
  const handleDownloadSessionModalCSV = (session: EndedSession) => {
    const roster = sessionStudentRecords.get(session.id) || [];
    const headers = [
      "Student Name",
      "Student Code",
      "Joined At",
      "Left At",
      "Minutes Attended",
      "Required Duration (Mins)",
      "Status",
    ];

    const reqMins = Math.round((session.effective_duration_seconds * 0.75) / 60);

    const rows = roster.map((r) => {
      const joined = r.joined_at ? new Date(r.joined_at).toLocaleTimeString() : "Did not join";
      const left = r.left_at ? new Date(r.left_at).toLocaleTimeString() : "—";
      const mins = Math.round(r.total_seconds / 60);
      return [
        `"${r.student_name.replace(/"/g, '""')}"`,
        `"${(r.student_code || "").replace(/"/g, '""')}"`,
        `"${joined}"`,
        `"${left}"`,
        mins,
        reqMins,
        r.isPresent ? "Present (>=75%)" : "Absent (<75%)",
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `session-${session.id.slice(0, 8)}-attendance-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8">
      {/* Top Header Navigation */}
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
            <span>Attendance Telemetry & Reports</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-cyan-500/10 border border-[#29d9ff]/30 text-[#29d9ff] font-mono font-medium">
              75% Rule Engine
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time telemetry verification, per-session attendance breakdowns, and aggregate course compliance.
          </p>
        </div>

        {/* Global Export Button */}
        <button
          onClick={handleDownloadCSV}
          disabled={loading || (activeTab === "classes" ? filteredSessions.length === 0 : filteredStudentSummaries.length === 0)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.12] text-sm font-medium text-white hover:border-[#29d9ff]/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm self-start sm:self-auto"
        >
          <Download className="w-4 h-4 text-[#29d9ff]" />
          <span>Download CSV ({activeTab === "classes" ? "Classes" : "Students"})</span>
        </button>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#070c18]/80 backdrop-blur-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>FILTERED ATTENDANCE</span>
            <Users className="w-4 h-4 text-[#29d9ff]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-white flex items-baseline gap-2">
            <span>{loading ? "—" : `${overallMetrics.percentage}%`}</span>
            {!loading && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full border font-mono ${
                  overallMetrics.percentage >= 75
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                }`}
              >
                {overallMetrics.percentage >= 75 ? "Target Met" : "Below 75%"}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            {loading ? "Loading..." : `${overallMetrics.totalPresent} attended of ${overallMetrics.totalPossible} seats`}
          </p>
        </div>

        <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#070c18]/80 backdrop-blur-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>ENDED SESSIONS</span>
            <Clock className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-white">
            {loading ? "—" : filteredSessions.length}
          </div>
          <p className="text-xs text-slate-400">Lectures concluded across your assigned courses</p>
        </div>

        <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#070c18]/80 backdrop-blur-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>STUDENTS AT RISK</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-amber-400">
            {loading ? "—" : filteredStudentSummaries.filter((s) => s.attendance_percentage < 75).length}
          </div>
          <p className="text-xs text-slate-400">Enrolled students below the mandatory 75% threshold</p>
        </div>
      </div>

      {/* Filter and Tab Bar */}
      <div className="p-4 sm:p-5 rounded-2xl border border-white/[0.08] bg-[#070c18] space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Tab Selection */}
          <div className="flex items-center p-1 rounded-xl bg-white/[0.04] border border-white/[0.08] w-fit">
            <button
              onClick={() => setActiveTab("classes")}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === "classes"
                  ? "bg-[#29d9ff] text-slate-950 font-semibold shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Ended Classes ({filteredSessions.length})
            </button>
            <button
              onClick={() => setActiveTab("students")}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === "students"
                  ? "bg-[#29d9ff] text-slate-950 font-semibold shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              By Student ({filteredStudentSummaries.length})
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={activeTab === "classes" ? "Search class, topic..." : "Search student name or code..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#04060a] border border-white/[0.1] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#29d9ff]"
            />
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-white/[0.06]">
          {/* Course Selector */}
          <div>
            <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
              Course Filter
            </label>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#04060a] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#29d9ff]"
            >
              <option value="all">All Courses ({courses.length})</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Presets */}
          <div>
            <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
              Timeframe
            </label>
            <select
              value={dateRangePreset}
              onChange={(e) => setDateRangePreset(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-[#04060a] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#29d9ff]"
            >
              <option value="all">All Recorded Sessions</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {/* Custom Date Inputs if active */}
          {dateRangePreset === "custom" ? (
            <>
              <div>
                <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                  From Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#04060a] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#29d9ff]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                  To Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#04060a] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#29d9ff]"
                />
              </div>
            </>
          ) : (
            <div className="hidden md:block col-span-2">
              <div className="h-full flex items-center text-xs text-slate-400 italic pt-5">
                <Info className="w-3.5 h-3.5 mr-1.5 text-cyan-400 inline shrink-0" />
                <span>Threshold: students must stay logged in at least 75% of class runtime.</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tab 1: Ended Classes Table */}
      {activeTab === "classes" && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-4">
              <div className="h-6 w-48 bg-white/[0.05] rounded animate-pulse" />
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-14 bg-white/[0.03] rounded-xl animate-pulse" />
                ))}
              </div>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.04] text-slate-400 flex items-center justify-center mx-auto">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-white">No Ended Classes Found</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                There are no completed lecture sessions matching your selected filters. End a live class to view
                telemetry logs.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.02] text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                    <th className="py-3.5 px-4">Date & Time</th>
                    <th className="py-3.5 px-4">Course</th>
                    <th className="py-3.5 px-4">Topic & Session Title</th>
                    <th className="py-3.5 px-4 text-center">Present / Enrolled</th>
                    <th className="py-3.5 px-4 text-center">Attendance %</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredSessions.map((sess) => {
                    const enrolled = courseEnrollmentCounts.get(sess.course_id) || 0;
                    const present = sessionPresentCounts.get(sess.id) || 0;
                    const pct = enrolled > 0 ? Math.round((present / enrolled) * 100) : 0;
                    const isBelow = pct < 75;

                    const dateObj = new Date(sess.started_at || sess.scheduled_at);
                    const formattedDate = dateObj.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });
                    const formattedTime = dateObj.toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    });

                    return (
                      <tr
                        key={sess.id}
                        onClick={() => setSelectedSessionForModal(sess)}
                        className="hover:bg-white/[0.02] transition-colors cursor-pointer group"
                      >
                        <td className="py-4 px-4 whitespace-nowrap">
                          <div className="font-medium text-white">{formattedDate}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{formattedTime}</div>
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span className="text-white font-medium">{sess.course_title}</span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="font-medium text-white group-hover:text-[#29d9ff] transition-colors">
                            {sess.title}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                            <span className="text-cyan-400">[{sess.topic}]</span>
                            <span>•</span>
                            <span>{sess.duration_minutes} mins</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center whitespace-nowrap font-mono">
                          <span className="text-white font-semibold">{present}</span>
                          <span className="text-slate-500"> / {enrolled}</span>
                        </td>
                        <td className="py-4 px-4 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-medium border ${
                              isBelow
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            }`}
                          >
                            {pct}%
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSessionForModal(sess);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-[#29d9ff] text-slate-300 hover:text-slate-950 text-xs font-medium transition-all"
                          >
                            <span>Inspect Roster</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: By Student Table */}
      {activeTab === "students" && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-4">
              <div className="h-6 w-48 bg-white/[0.05] rounded animate-pulse" />
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-14 bg-white/[0.03] rounded-xl animate-pulse" />
                ))}
              </div>
            </div>
          ) : filteredStudentSummaries.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.04] text-slate-400 flex items-center justify-center mx-auto">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-white">No Students Found</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                No enrolled students found for the active course filter.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.02] text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                    <th className="py-3.5 px-4">Student Name</th>
                    <th className="py-3.5 px-4">Course</th>
                    <th className="py-3.5 px-4 text-center">Classes Attended</th>
                    <th className="py-3.5 px-4 text-center">Total Ended</th>
                    <th className="py-3.5 px-4 text-center">Overall Attendance %</th>
                    <th className="py-3.5 px-4 text-right">Standing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredStudentSummaries.map((st, idx) => {
                    const isBelow = st.attendance_percentage < 75;

                    return (
                      <tr
                        key={`${st.student_id}_${st.course_id}_${idx}`}
                        className={`transition-colors ${
                          isBelow
                            ? "bg-amber-500/[0.03] hover:bg-amber-500/[0.06]"
                            : "hover:bg-white/[0.02]"
                        }`}
                      >
                        <td className="py-4 px-4 whitespace-nowrap">
                          <div className="font-semibold text-white flex items-center gap-2">
                            <span>{st.student_name}</span>
                            {isBelow && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                Action Required
                              </span>
                            )}
                          </div>
                          {st.student_code && (
                            <div className="text-[11px] text-slate-400 font-mono">{st.student_code}</div>
                          )}
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap text-slate-300">
                          {st.course_title}
                        </td>
                        <td className="py-4 px-4 text-center whitespace-nowrap font-mono text-white font-medium">
                          {st.sessions_attended}
                        </td>
                        <td className="py-4 px-4 text-center whitespace-nowrap font-mono text-slate-400">
                          {st.total_ended_sessions}
                        </td>
                        <td className="py-4 px-4 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-mono font-bold border ${
                              isBelow
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-[0_0_12px_rgba(251,191,36,0.15)]"
                                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            }`}
                          >
                            {st.attendance_percentage}%
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right whitespace-nowrap">
                          {isBelow ? (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-400 font-medium">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>Below 75% Target</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Good Standing</span>
                            </span>
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
      )}

      {/* Per-Session Student Roster Modal */}
      {selectedSessionForModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[90vh] rounded-2xl border border-white/[0.12] bg-[#070c18] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-white/[0.08] flex items-start justify-between gap-4 bg-[#0a1122]">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono text-[#29d9ff] uppercase tracking-wider mb-1">
                  <span>{selectedSessionForModal.course_title}</span>
                  <span>•</span>
                  <span>Topic: {selectedSessionForModal.topic}</span>
                </div>
                <h2 className="text-xl font-bold text-white">{selectedSessionForModal.title}</h2>
                <div className="flex items-center gap-4 text-xs text-slate-400 mt-2 font-mono">
                  <span>
                    Runtime: {Math.round(selectedSessionForModal.effective_duration_seconds / 60)} mins
                  </span>
                  <span>•</span>
                  <span>
                    75% Target:{" "}
                    {Math.round((selectedSessionForModal.effective_duration_seconds * 0.75) / 60)} mins minimum
                  </span>
                  <span>•</span>
                  <span className="text-emerald-400">
                    {sessionPresentCounts.get(selectedSessionForModal.id) || 0} of{" "}
                    {courseEnrollmentCounts.get(selectedSessionForModal.course_id) || 0} Present
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadSessionModalCSV(selectedSessionForModal)}
                  title="Export Roster CSV"
                  className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 hover:text-[#29d9ff] transition-colors border border-white/[0.08]"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedSessionForModal(null)}
                  className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body - Student Roster Table */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {(() => {
                const roster = sessionStudentRecords.get(selectedSessionForModal.id) || [];
                if (roster.length === 0) {
                  return (
                    <div className="text-center py-10 text-slate-400 text-xs">
                      No enrolled students recorded for this lecture.
                    </div>
                  );
                }

                return (
                  <div className="rounded-xl border border-white/[0.08] overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-white/[0.08] bg-white/[0.02] text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                          <th className="py-3 px-4">Student Name</th>
                          <th className="py-3 px-4">Joined</th>
                          <th className="py-3 px-4">Left</th>
                          <th className="py-3 px-4 text-center">Minutes Attended</th>
                          <th className="py-3 px-4 text-right">Status (75% Rule)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {roster.map((rec) => {
                          const joinedStr = rec.joined_at
                            ? new Date(rec.joined_at).toLocaleTimeString("en-US", {
                                hour: "numeric",
                                minute: "2-digit",
                              })
                            : "—";
                          const leftStr = rec.left_at
                            ? new Date(rec.left_at).toLocaleTimeString("en-US", {
                                hour: "numeric",
                                minute: "2-digit",
                              })
                            : "—";
                          const attendedMins = Math.round(rec.total_seconds / 60);

                          return (
                            <tr
                              key={rec.student_id}
                              className={rec.isPresent ? "hover:bg-white/[0.02]" : "bg-rose-500/[0.02]"}
                            >
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <div className="font-semibold text-white">{rec.student_name}</div>
                                {rec.student_code && (
                                  <div className="text-[11px] text-slate-400 font-mono">
                                    {rec.student_code}
                                  </div>
                                )}
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap font-mono text-slate-300">
                                {joinedStr}
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap font-mono text-slate-300">
                                {leftStr}
                              </td>
                              <td className="py-3.5 px-4 text-center whitespace-nowrap font-mono font-medium text-white">
                                {attendedMins} min
                              </td>
                              <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                {rec.isPresent ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Present</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                    <XCircle className="w-3.5 h-3.5" />
                                    <span>Absent</span>
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-white/[0.08] bg-[#0a1122] flex justify-end">
              <button
                onClick={() => setSelectedSessionForModal(null)}
                className="px-5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TeacherAttendancePage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 space-y-4">
          <div className="h-6 w-48 bg-white/[0.05] rounded animate-pulse" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-white/[0.03] rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      }
    >
      <AttendanceContent />
    </Suspense>
  );
}
