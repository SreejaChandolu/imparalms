"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  GraduationCap,
  Layers,
  Loader2,
  RotateCcw,
  Search,
  ShieldCheck,
  Star,
  TrendingUp,
  Users,
  AlertTriangle,
  BookOpen,
} from "lucide-react";

interface TeacherItem {
  id: string;
  full_name: string;
}

interface CourseItem {
  id: string;
  title: string;
  teacher_id: string;
  teacher_name: string;
}

interface EndedSessionItem {
  id: string;
  course_id: string;
  teacher_id: string;
  title: string;
  scheduled_at: string;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number;
}

interface CourseAttendanceMetric {
  courseId: string;
  courseTitle: string;
  teacherName: string;
  teacherId: string;
  endedClassesCount: number;
  enrolledStudentsCount: number;
  totalPresentSeats: number;
  totalPossibleSeats: number;
  attendancePercentage: number | null;
  studentsBelow75Count: number | null;
}

interface TeacherAttendanceMetric {
  teacherId: string;
  teacherName: string;
  courseCount: number;
  endedClassesCount: number;
  totalPresentSeats: number;
  totalPossibleSeats: number;
  attendancePercentage: number | null;
  studentsBelow75Count: number | null;
}

interface CourseRatingMetric {
  courseId: string;
  courseTitle: string;
  teacherName: string;
  teacherId: string;
  ratingsCount: number;
  averageStars: number | null;
  distribution: { stars: number; count: number; percentage: number }[];
}

interface TeacherRatingMetric {
  teacherId: string;
  teacherName: string;
  ratingsCount: number;
  averageStars: number | null;
  distribution: { stars: number; count: number; percentage: number }[];
}

export default function AdminReportsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [rawSessions, setRawSessions] = useState<EndedSessionItem[]>([]);
  const [enrollments, setEnrollments] = useState<{ course_id: string; student_id: string }[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<{ session_id: string; user_id: string; total_seconds: number }[]>([]);
  const [ratingsRecords, setRatingsRecords] = useState<{ session_id: string; stars: number }[]>([]);

  // Filters State
  const [selectedCourseFilter, setSelectedCourseFilter] = useState("all");
  const [selectedTeacherFilter, setSelectedTeacherFilter] = useState("all");
  const [dateRangePreset, setDateRangePreset] = useState<"all" | "7d" | "30d" | "90d" | "custom">("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "attendance" | "ratings">("all");

  // Load telemetry data from Supabase
  const loadReportsData = useCallback(async () => {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/staff");
        return;
      }

      // 1. Fetch Teachers
      const { data: teachersData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "teacher")
        .order("full_name");

      const teacherList = (teachersData as TeacherItem[]) || [];
      setTeachers(teacherList);

      const teacherMap = new Map<string, string>();
      teacherList.forEach((t) => teacherMap.set(t.id, t.full_name));

      // 2. Fetch Courses
      const { data: coursesData } = await supabase
        .from("courses")
        .select("id, title, teacher_id")
        .order("title");

      const courseList: CourseItem[] = ((coursesData as any[]) || []).map((c) => ({
        id: c.id,
        title: c.title,
        teacher_id: c.teacher_id,
        teacher_name: teacherMap.get(c.teacher_id) || "Assigned Faculty",
      }));
      setCourses(courseList);

      // 3. Fetch Ended Sessions
      const { data: sessionsData } = await supabase
        .from("live_sessions")
        .select("id, course_id, teacher_id, title, scheduled_at, started_at, ended_at, duration_minutes")
        .eq("status", "ended")
        .order("scheduled_at", { ascending: false });

      setRawSessions((sessionsData as EndedSessionItem[]) || []);

      // 4. Fetch Enrollments
      const { data: enrollmentsData } = await supabase
        .from("enrollments")
        .select("course_id, student_id");

      setEnrollments((enrollmentsData as any[]) || []);

      // 5. Fetch Attendance logs
      const { data: attendanceData } = await supabase
        .from("attendance")
        .select("session_id, user_id, total_seconds");

      setAttendanceRecords((attendanceData as any[]) || []);

      // 6. Fetch Class Ratings (CRITICAL: Strictly select ONLY session_id, stars)
      // Student names and student IDs are intentionally NEVER selected or fetched.
      const { data: ratingsData } = await supabase
        .from("class_ratings")
        .select("session_id, stars");

      setRatingsRecords((ratingsData as any[]) || []);
    } catch (err) {
      console.error("Error loading institutional reports data:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase, router]);

  useEffect(() => {
    loadReportsData();
  }, [loadReportsData]);

  // Compute Active Date Filter Window
  const dateWindow = useMemo(() => {
    const now = new Date();
    if (dateRangePreset === "all") return null;

    if (dateRangePreset === "7d") {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { start, end: now };
    }
    if (dateRangePreset === "30d") {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { start, end: now };
    }
    if (dateRangePreset === "90d") {
      const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      return { start, end: now };
    }
    if (dateRangePreset === "custom") {
      const start = customStartDate ? new Date(customStartDate) : null;
      const end = customEndDate ? new Date(`${customEndDate}T23:59:59.999Z`) : null;
      return { start, end };
    }
    return null;
  }, [dateRangePreset, customStartDate, customEndDate]);

  // Filtered Ended Sessions based on course, teacher, and date range
  const filteredSessions = useMemo(() => {
    return rawSessions.filter((s) => {
      // Course filter
      if (selectedCourseFilter !== "all" && s.course_id !== selectedCourseFilter) return false;

      // Teacher filter
      if (selectedTeacherFilter !== "all" && s.teacher_id !== selectedTeacherFilter) return false;

      // Date range filter
      if (dateWindow) {
        const sessionTime = new Date(s.started_at || s.scheduled_at).getTime();
        if (dateWindow.start && sessionTime < dateWindow.start.getTime()) return false;
        if (dateWindow.end && sessionTime > dateWindow.end.getTime()) return false;
      }

      return true;
    });
  }, [rawSessions, selectedCourseFilter, selectedTeacherFilter, dateWindow]);

  // Fast Lookup Maps
  const filteredSessionIds = useMemo(() => {
    return new Set(filteredSessions.map((s) => s.id));
  }, [filteredSessions]);

  const courseLookup = useMemo(() => {
    return new Map(courses.map((c) => [c.id, c]));
  }, [courses]);

  const teacherLookup = useMemo(() => {
    return new Map(teachers.map((t) => [t.id, t.full_name]));
  }, [teachers]);

  // Enrolled students per course
  const courseEnrollmentsMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    enrollments.forEach((e) => {
      const set = map.get(e.course_id) || new Set<string>();
      set.add(e.student_id);
      map.set(e.course_id, set);
    });
    return map;
  }, [enrollments]);

  // Session duration in seconds
  const sessionDurationSecMap = useMemo(() => {
    const map = new Map<string, number>();
    rawSessions.forEach((s) => {
      let durSec = (s.duration_minutes || 60) * 60;
      if (s.started_at && s.ended_at) {
        const diff = (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000;
        if (diff > 0) durSec = Math.round(diff);
      }
      map.set(s.id, durSec);
    });
    return map;
  }, [rawSessions]);

  // Verified attendance per student per session (75% rule)
  // Maps `${sessionId}_${userId}` -> boolean (isPresent)
  const userSessionPresenceMap = useMemo(() => {
    const secMap = new Map<string, number>();
    attendanceRecords.forEach((r) => {
      const key = `${r.session_id}_${r.user_id}`;
      secMap.set(key, (secMap.get(key) || 0) + (Number(r.total_seconds) || 0));
    });

    const presenceMap = new Map<string, boolean>();
    secMap.forEach((totalSec, key) => {
      const [sessId] = key.split("_");
      const reqSec = (sessionDurationSecMap.get(sessId) || 3600) * 0.75;
      if (reqSec > 0 && totalSec >= reqSec) {
        presenceMap.set(key, true);
      }
    });

    return presenceMap;
  }, [attendanceRecords, sessionDurationSecMap]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. ATTENDANCE METRICS PER COURSE
  // ─────────────────────────────────────────────────────────────────────────────
  const courseAttendanceMetrics = useMemo<CourseAttendanceMetric[]>(() => {
    return courses
      .filter((c) => {
        if (selectedCourseFilter !== "all" && c.id !== selectedCourseFilter) return false;
        if (selectedTeacherFilter !== "all" && c.teacher_id !== selectedTeacherFilter) return false;
        return true;
      })
      .map((c) => {
        const courseSessions = filteredSessions.filter((s) => s.course_id === c.id);
        const enrolledStudents = courseEnrollmentsMap.get(c.id) || new Set<string>();
        const enrolledCount = enrolledStudents.size;
        const endedClassesCount = courseSessions.length;

        if (endedClassesCount === 0 || enrolledCount === 0) {
          return {
            courseId: c.id,
            courseTitle: c.title,
            teacherName: c.teacher_name,
            teacherId: c.teacher_id,
            endedClassesCount,
            enrolledStudentsCount: enrolledCount,
            totalPresentSeats: 0,
            totalPossibleSeats: 0,
            attendancePercentage: null,
            studentsBelow75Count: null,
          };
        }

        let presentSeats = 0;
        const totalPossibleSeats = endedClassesCount * enrolledCount;

        // Count present seats across all course sessions
        courseSessions.forEach((sess) => {
          enrolledStudents.forEach((studentId) => {
            const key = `${sess.id}_${studentId}`;
            if (userSessionPresenceMap.get(key)) {
              presentSeats += 1;
            }
          });
        });

        const attendancePct =
          totalPossibleSeats > 0 ? Math.round((presentSeats / totalPossibleSeats) * 100) : null;

        // Calculate students below 75% for this course
        let below75Count = 0;
        enrolledStudents.forEach((studentId) => {
          let studentAttended = 0;
          courseSessions.forEach((sess) => {
            if (userSessionPresenceMap.get(`${sess.id}_${studentId}`)) {
              studentAttended += 1;
            }
          });
          const studentPct = Math.round((studentAttended / endedClassesCount) * 100);
          if (studentPct < 75) {
            below75Count += 1;
          }
        });

        return {
          courseId: c.id,
          courseTitle: c.title,
          teacherName: c.teacher_name,
          teacherId: c.teacher_id,
          endedClassesCount,
          enrolledStudentsCount: enrolledCount,
          totalPresentSeats: presentSeats,
          totalPossibleSeats,
          attendancePercentage: attendancePct,
          studentsBelow75Count: below75Count,
        };
      });
  }, [courses, filteredSessions, courseEnrollmentsMap, userSessionPresenceMap, selectedCourseFilter, selectedTeacherFilter]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. ATTENDANCE METRICS PER TEACHER
  // ─────────────────────────────────────────────────────────────────────────────
  const teacherAttendanceMetrics = useMemo<TeacherAttendanceMetric[]>(() => {
    return teachers
      .filter((t) => {
        if (selectedTeacherFilter !== "all" && t.id !== selectedTeacherFilter) return false;
        return true;
      })
      .map((t) => {
        const teacherCourses = courseAttendanceMetrics.filter((cam) => cam.teacherId === t.id);
        const endedClasses = teacherCourses.reduce((acc, c) => acc + c.endedClassesCount, 0);
        const presentSeats = teacherCourses.reduce((acc, c) => acc + c.totalPresentSeats, 0);
        const possibleSeats = teacherCourses.reduce((acc, c) => acc + c.totalPossibleSeats, 0);

        const hasSessions = endedClasses > 0 && possibleSeats > 0;
        const avgPct = hasSessions ? Math.round((presentSeats / possibleSeats) * 100) : null;

        const belowCount = hasSessions
          ? teacherCourses.reduce((acc, c) => acc + (c.studentsBelow75Count || 0), 0)
          : null;

        return {
          teacherId: t.id,
          teacherName: t.full_name,
          courseCount: teacherCourses.length,
          endedClassesCount: endedClasses,
          totalPresentSeats: presentSeats,
          totalPossibleSeats: possibleSeats,
          attendancePercentage: avgPct,
          studentsBelow75Count: belowCount,
        };
      });
  }, [teachers, courseAttendanceMetrics, selectedTeacherFilter]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. RATINGS METRICS PER COURSE & PER TEACHER (STRICT PRIVACY: NO STUDENT NAMES)
  // ─────────────────────────────────────────────────────────────────────────────
  const sessionToCourseTeacherMap = useMemo(() => {
    const map = new Map<string, { course_id: string; teacher_id: string }>();
    rawSessions.forEach((s) => {
      map.set(s.id, { course_id: s.course_id, teacher_id: s.teacher_id });
    });
    return map;
  }, [rawSessions]);

  // Filter ratings that belong to filtered sessions
  const filteredRatings = useMemo(() => {
    return ratingsRecords.filter((r) => filteredSessionIds.has(r.session_id));
  }, [ratingsRecords, filteredSessionIds]);

  const courseRatingMetrics = useMemo<CourseRatingMetric[]>(() => {
    const courseRatingsMap = new Map<string, number[]>();

    filteredRatings.forEach((r) => {
      const meta = sessionToCourseTeacherMap.get(r.session_id);
      if (!meta) return;
      const list = courseRatingsMap.get(meta.course_id) || [];
      list.push(r.stars);
      courseRatingsMap.set(meta.course_id, list);
    });

    return courses
      .filter((c) => {
        if (selectedCourseFilter !== "all" && c.id !== selectedCourseFilter) return false;
        if (selectedTeacherFilter !== "all" && c.teacher_id !== selectedTeacherFilter) return false;
        return true;
      })
      .map((c) => {
        const starList = courseRatingsMap.get(c.id) || [];
        const count = starList.length;

        if (count === 0) {
          return {
            courseId: c.id,
            courseTitle: c.title,
            teacherName: c.teacher_name,
            teacherId: c.teacher_id,
            ratingsCount: 0,
            averageStars: null,
            distribution: [5, 4, 3, 2, 1].map((s) => ({ stars: s, count: 0, percentage: 0 })),
          };
        }

        const sum = starList.reduce((acc, curr) => acc + curr, 0);
        const avg = Number((sum / count).toFixed(1));

        const distCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        starList.forEach((s) => {
          if (s >= 1 && s <= 5) distCounts[s as 1 | 2 | 3 | 4 | 5] += 1;
        });

        const distribution = [5, 4, 3, 2, 1].map((s) => ({
          stars: s,
          count: distCounts[s as 1 | 2 | 3 | 4 | 5],
          percentage: Math.round((distCounts[s as 1 | 2 | 3 | 4 | 5] / count) * 100),
        }));

        return {
          courseId: c.id,
          courseTitle: c.title,
          teacherName: c.teacher_name,
          teacherId: c.teacher_id,
          ratingsCount: count,
          averageStars: avg,
          distribution,
        };
      });
  }, [courses, filteredRatings, sessionToCourseTeacherMap, selectedCourseFilter, selectedTeacherFilter]);

  const teacherRatingMetrics = useMemo<TeacherRatingMetric[]>(() => {
    const teacherRatingsMap = new Map<string, number[]>();

    filteredRatings.forEach((r) => {
      const meta = sessionToCourseTeacherMap.get(r.session_id);
      if (!meta) return;
      const list = teacherRatingsMap.get(meta.teacher_id) || [];
      list.push(r.stars);
      teacherRatingsMap.set(meta.teacher_id, list);
    });

    return teachers
      .filter((t) => {
        if (selectedTeacherFilter !== "all" && t.id !== selectedTeacherFilter) return false;
        return true;
      })
      .map((t) => {
        const starList = teacherRatingsMap.get(t.id) || [];
        const count = starList.length;

        if (count === 0) {
          return {
            teacherId: t.id,
            teacherName: t.full_name,
            ratingsCount: 0,
            averageStars: null,
            distribution: [5, 4, 3, 2, 1].map((s) => ({ stars: s, count: 0, percentage: 0 })),
          };
        }

        const sum = starList.reduce((acc, curr) => acc + curr, 0);
        const avg = Number((sum / count).toFixed(1));

        const distCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        starList.forEach((s) => {
          if (s >= 1 && s <= 5) distCounts[s as 1 | 2 | 3 | 4 | 5] += 1;
        });

        const distribution = [5, 4, 3, 2, 1].map((s) => ({
          stars: s,
          count: distCounts[s as 1 | 2 | 3 | 4 | 5],
          percentage: Math.round((distCounts[s as 1 | 2 | 3 | 4 | 5] / count) * 100),
        }));

        return {
          teacherId: t.id,
          teacherName: t.full_name,
          ratingsCount: count,
          averageStars: avg,
          distribution,
        };
      });
  }, [teachers, filteredRatings, sessionToCourseTeacherMap, selectedTeacherFilter]);

  // Overall platform stat rollups in current filtered view
  const platformSummary = useMemo(() => {
    const totalPossible = courseAttendanceMetrics.reduce((acc, c) => acc + c.totalPossibleSeats, 0);
    const totalPresent = courseAttendanceMetrics.reduce((acc, c) => acc + c.totalPresentSeats, 0);
    const overallAttPct = totalPossible > 0 ? Math.round((totalPresent / totalPossible) * 100) : null;

    const totalRatings = courseRatingMetrics.reduce((acc, c) => acc + c.ratingsCount, 0);
    const totalStars = filteredRatings.reduce((acc, r) => acc + r.stars, 0);
    const overallRating = totalRatings > 0 ? Number((totalStars / totalRatings).toFixed(1)) : null;

    return {
      totalEndedSessions: filteredSessions.length,
      overallAttendancePct: overallAttPct,
      overallRating,
      totalRatings,
    };
  }, [courseAttendanceMetrics, courseRatingMetrics, filteredRatings, filteredSessions]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. CSV EXPORT HANDLER (Exports exactly what is shown)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleDownloadCSV = () => {
    const lines: string[] = [];
    const timestamp = new Date().toISOString();

    lines.push(`"IMPARA LMS - INSTITUTIONAL COMPLIANCE & PERFORMANCE AUDIT REPORT"`);
    lines.push(`"Generated At","${timestamp}"`);
    lines.push(`"Date Range Filter","${dateRangePreset}"`);
    lines.push(`"Course Filter","${selectedCourseFilter}"`);
    lines.push(`"Teacher Filter","${selectedTeacherFilter}"`);
    lines.push("");

    // 1. Attendance: Per Course
    lines.push(`"=== SECTION 1A: ATTENDANCE AUDIT PER COURSE (75% COMPLIANCE RULE) ==="`);
    lines.push([
      "Course Title",
      "Assigned Faculty",
      "Ended Classes",
      "Enrolled Students",
      "Verified Attended Seats",
      "Total Possible Seats",
      "Attendance Compliance %",
      "Students Below 75% Target",
    ].join(","));

    courseAttendanceMetrics.forEach((cam) => {
      lines.push([
        `"${cam.courseTitle.replace(/"/g, '""')}"`,
        `"${cam.teacherName.replace(/"/g, '""')}"`,
        cam.endedClassesCount,
        cam.enrolledStudentsCount,
        cam.totalPresentSeats,
        cam.totalPossibleSeats,
        cam.attendancePercentage !== null ? `"${cam.attendancePercentage}%"` : `"No classes yet"`,
        cam.studentsBelow75Count !== null ? cam.studentsBelow75Count : `"No classes yet"`,
      ].join(","));
    });

    lines.push("");

    // 2. Attendance: Per Teacher
    lines.push(`"=== SECTION 1B: ATTENDANCE AUDIT PER FACULTY ==="`);
    lines.push([
      "Faculty Instructor",
      "Assigned Courses",
      "Ended Classes Conducted",
      "Verified Attended Seats",
      "Total Possible Seats",
      "Aggregate Attendance %",
      "Total Students Below 75%",
    ].join(","));

    teacherAttendanceMetrics.forEach((tam) => {
      lines.push([
        `"${tam.teacherName.replace(/"/g, '""')}"`,
        tam.courseCount,
        tam.endedClassesCount,
        tam.totalPresentSeats,
        tam.totalPossibleSeats,
        tam.attendancePercentage !== null ? `"${tam.attendancePercentage}%"` : `"No classes yet"`,
        tam.studentsBelow75Count !== null ? tam.studentsBelow75Count : `"No classes yet"`,
      ].join(","));
    });

    lines.push("");

    // 3. Ratings: Per Course
    lines.push(`"=== SECTION 2A: STUDENT SATISFACTION & RATINGS PER COURSE (ANONYMOUS TELEMETRY) ==="`);
    lines.push([
      "Course Title",
      "Assigned Faculty",
      "Average Rating (Stars)",
      "Total Ratings Count",
      "5 Star Count",
      "5 Star %",
      "4 Star Count",
      "4 Star %",
      "3 Star Count",
      "3 Star %",
      "2 Star Count",
      "2 Star %",
      "1 Star Count",
      "1 Star %",
    ].join(","));

    courseRatingMetrics.forEach((crm) => {
      const getDist = (stars: number) => crm.distribution.find((d) => d.stars === stars) || { count: 0, percentage: 0 };
      lines.push([
        `"${crm.courseTitle.replace(/"/g, '""')}"`,
        `"${crm.teacherName.replace(/"/g, '""')}"`,
        crm.averageStars !== null ? crm.averageStars : `"No ratings yet"`,
        crm.ratingsCount,
        getDist(5).count,
        `"${getDist(5).percentage}%"`,
        getDist(4).count,
        `"${getDist(4).percentage}%"`,
        getDist(3).count,
        `"${getDist(3).percentage}%"`,
        getDist(2).count,
        `"${getDist(2).percentage}%"`,
        getDist(1).count,
        `"${getDist(1).percentage}%"`,
      ].join(","));
    });

    lines.push("");

    // 4. Ratings: Per Teacher
    lines.push(`"=== SECTION 2B: STUDENT SATISFACTION & RATINGS PER FACULTY ==="`);
    lines.push([
      "Faculty Instructor",
      "Average Rating (Stars)",
      "Total Ratings Count",
      "5 Star Count",
      "5 Star %",
      "4 Star Count",
      "4 Star %",
      "3 Star Count",
      "3 Star %",
      "2 Star Count",
      "2 Star %",
      "1 Star Count",
      "1 Star %",
    ].join(","));

    teacherRatingMetrics.forEach((trm) => {
      const getDist = (stars: number) => trm.distribution.find((d) => d.stars === stars) || { count: 0, percentage: 0 };
      lines.push([
        `"${trm.teacherName.replace(/"/g, '""')}"`,
        trm.averageStars !== null ? trm.averageStars : `"No ratings yet"`,
        trm.ratingsCount,
        getDist(5).count,
        `"${getDist(5).percentage}%"`,
        getDist(4).count,
        `"${getDist(4).percentage}%"`,
        getDist(3).count,
        `"${getDist(3).percentage}%"`,
        getDist(2).count,
        `"${getDist(2).percentage}%"`,
        getDist(1).count,
        `"${getDist(1).percentage}%"`,
      ].join(","));
    });

    const csvContent = "data:text/csv;charset=utf-8," + lines.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `impara-institutional-report-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8">
      {/* ─────────────────────────────────────────────────────────────
          HEADER & EXPORT
      ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-[#29d9ff] transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Admin Dashboard</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <span>Institutional Reports & Compliance</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-[#29d9ff]/30 text-[#29d9ff] font-mono">
              Audit Grade
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Aggregated 75% attendance compliance telemetries and strictly anonymous satisfaction distributions across faculty and programs.
          </p>
        </div>

        <button
          type="button"
          onClick={handleDownloadCSV}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.12] text-xs font-mono uppercase tracking-wider font-semibold text-white hover:border-[#29d9ff]/50 transition-all shadow-sm self-start sm:self-auto cursor-pointer disabled:opacity-50"
        >
          <Download className="w-4 h-4 text-[#29d9ff]" />
          <span>Download CSV Report</span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SUMMARY STAT METRIC CARDS
      ────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-white/[0.08] bg-[#070c18]/80 backdrop-blur-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>ENDED CLASSES (WINDOW)</span>
            <Clock className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {loading ? "—" : platformSummary.totalEndedSessions}
          </div>
          <p className="text-[10px] text-slate-400 font-mono">Matching filtered criteria</p>
        </div>

        <div className="p-4 rounded-2xl border border-white/[0.08] bg-[#070c18]/80 backdrop-blur-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>PLATFORM ATTENDANCE</span>
            <CheckCircle2
              className={`w-4 h-4 ${platformSummary.overallAttendancePct !== null ? "text-emerald-400" : "text-slate-500"}`}
            />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {loading ? "—" : platformSummary.overallAttendancePct !== null ? `${platformSummary.overallAttendancePct}%` : "—"}
          </div>
          <p className="text-[10px] text-slate-400 font-mono">
            {platformSummary.overallAttendancePct !== null ? "75% rule compliance" : "No classes yet"}
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-white/[0.08] bg-[#070c18]/80 backdrop-blur-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>AVERAGE RATING</span>
            <Star
              className={`w-4 h-4 ${platformSummary.overallRating !== null ? "text-amber-400 fill-amber-400" : "text-slate-500"}`}
            />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {loading ? "—" : platformSummary.overallRating !== null ? `${platformSummary.overallRating.toFixed(1)} ★` : "—"}
          </div>
          <p className="text-[10px] text-slate-400 font-mono">
            {platformSummary.overallRating !== null ? `From ${platformSummary.totalRatings} ratings` : "No ratings yet"}
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-white/[0.08] bg-[#070c18]/80 backdrop-blur-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>TELEMETRY PRIVACY</span>
            <ShieldCheck className="w-4 h-4 text-[#29d9ff]" />
          </div>
          <div className="text-sm font-semibold text-white mt-1">
            Zero PII In Reviews
          </div>
          <p className="text-[10px] text-slate-400 font-mono">Student names scrubbed from ratings</p>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          FILTER CONTROLS BAR
      ────────────────────────────────────────────────────────────── */}
      <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#070c18] space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Section Tab Buttons */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#04060a] border border-white/[0.08] self-start">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                activeTab === "all"
                  ? "bg-[#29d9ff] text-[#04060a] shadow-sm font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              All Sections
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("attendance")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                activeTab === "attendance"
                  ? "bg-[#29d9ff] text-[#04060a] shadow-sm font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Attendance
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ratings")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                activeTab === "ratings"
                  ? "bg-[#29d9ff] text-[#04060a] shadow-sm font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Ratings & Feedback
            </button>
          </div>

          {/* Quick Reset */}
          {(selectedCourseFilter !== "all" || selectedTeacherFilter !== "all" || dateRangePreset !== "all") && (
            <button
              type="button"
              onClick={() => {
                setSelectedCourseFilter("all");
                setSelectedTeacherFilter("all");
                setDateRangePreset("all");
                setCustomStartDate("");
                setCustomEndDate("");
              }}
              className="inline-flex items-center gap-1.5 text-xs font-mono text-[#29d9ff] hover:underline self-start md:self-center"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset All Filters</span>
            </button>
          )}
        </div>

        {/* Dropdowns Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2 border-t border-white/[0.06]">
          {/* Course Filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
              Filter by Course
            </label>
            <select
              value={selectedCourseFilter}
              onChange={(e) => setSelectedCourseFilter(e.target.value)}
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

          {/* Teacher Filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
              Filter by Faculty Instructor
            </label>
            <select
              value={selectedTeacherFilter}
              onChange={(e) => setSelectedTeacherFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#04060a] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#29d9ff]"
            >
              <option value="all">All Faculty ({teachers.length})</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Preset */}
          <div className="space-y-1">
            <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
              Date Range
            </label>
            <select
              value={dateRangePreset}
              onChange={(e) => setDateRangePreset(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-[#04060a] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#29d9ff]"
            >
              <option value="all">All Recorded Sessions</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="custom">Custom Calendar Range...</option>
            </select>
          </div>
        </div>

        {/* Custom Date Pickers */}
        {dateRangePreset === "custom" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/[0.04] animate-in fade-in duration-150">
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-slate-400 block">START DATE</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-[#04060a] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#29d9ff]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-slate-400 block">END DATE</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-[#04060a] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#29d9ff]"
              />
            </div>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 1: ATTENDANCE (Per Course and Per Teacher)
      ────────────────────────────────────────────────────────────── */}
      {(activeTab === "all" || activeTab === "attendance") && (
        <div className="space-y-6">
          <div className="border-b border-white/[0.08] pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
              <h2 className="text-lg font-bold text-white tracking-tight">
                Attendance Compliance Report (75% Rule Engine)
              </h2>
            </div>
            <span className="font-mono text-xs text-slate-500">
              Students present if attending at least 75% of session duration
            </span>
          </div>

          {/* 1A: Attendance Per Course */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] overflow-hidden space-y-0">
            <div className="p-4 border-b border-white/[0.06] bg-[#04060a]/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#29d9ff]" />
                <span className="font-mono text-xs font-semibold uppercase text-slate-300">
                  Attendance by Course ({courseAttendanceMetrics.length})
                </span>
              </div>
            </div>

            {loading ? (
              <div className="p-8 space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 bg-white/[0.03] rounded-xl animate-pulse" />
                ))}
              </div>
            ) : courseAttendanceMetrics.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No courses matching filter criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.08] bg-white/[0.02] text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                      <th className="py-3 px-4">Course</th>
                      <th className="py-3 px-4">Instructor</th>
                      <th className="py-3 px-4 text-center">Ended Classes</th>
                      <th className="py-3 px-4 text-center">Enrolled</th>
                      <th className="py-3 px-4 text-center">Attendance %</th>
                      <th className="py-3 px-4 text-right">Students &lt; 75%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {courseAttendanceMetrics.map((cam) => {
                      const hasData = cam.attendancePercentage !== null;
                      const isBelow = hasData && cam.attendancePercentage! < 75;

                      return (
                        <tr key={cam.courseId} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3.5 px-4 font-semibold text-white">
                            {cam.courseTitle}
                          </td>
                          <td className="py-3.5 px-4 text-slate-300">
                            {cam.teacherName}
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono text-white">
                            {cam.endedClassesCount}
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono text-slate-400">
                            {cam.enrolledStudentsCount}
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {hasData ? (
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${
                                  isBelow
                                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                    : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                }`}
                              >
                                {cam.attendancePercentage}%
                              </span>
                            ) : (
                              <div className="flex flex-col items-center">
                                <span className="font-mono text-slate-500">—</span>
                                <span className="text-[10px] text-slate-500 font-mono">No classes yet</span>
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            {cam.studentsBelow75Count !== null ? (
                              cam.studentsBelow75Count > 0 ? (
                                <span className="inline-flex items-center gap-1 text-xs font-mono text-amber-400 font-bold">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  <span>{cam.studentsBelow75Count} At Risk</span>
                                </span>
                              ) : (
                                <span className="text-emerald-400 font-mono text-xs">0 (All Compliant)</span>
                              )
                            ) : (
                              <span className="text-slate-500 font-mono text-xs">— No classes yet</span>
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

          {/* 1B: Attendance Per Teacher */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] overflow-hidden space-y-0">
            <div className="p-4 border-b border-white/[0.06] bg-[#04060a]/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-emerald-400" />
                <span className="font-mono text-xs font-semibold uppercase text-slate-300">
                  Attendance by Faculty Instructor ({teacherAttendanceMetrics.length})
                </span>
              </div>
            </div>

            {loading ? (
              <div className="p-8 space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="h-14 bg-white/[0.03] rounded-xl animate-pulse" />
                ))}
              </div>
            ) : teacherAttendanceMetrics.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No educators matching filter criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.08] bg-white/[0.02] text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                      <th className="py-3 px-4">Faculty Instructor</th>
                      <th className="py-3 px-4 text-center">Assigned Courses</th>
                      <th className="py-3 px-4 text-center">Ended Classes</th>
                      <th className="py-3 px-4 text-center">Attended / Total Seats</th>
                      <th className="py-3 px-4 text-center">Average Attendance %</th>
                      <th className="py-3 px-4 text-right">Students Below 75%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {teacherAttendanceMetrics.map((tam) => {
                      const hasData = tam.attendancePercentage !== null;
                      const isBelow = hasData && tam.attendancePercentage! < 75;

                      return (
                        <tr key={tam.teacherId} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3.5 px-4 font-semibold text-white">
                            {tam.teacherName}
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono text-slate-300">
                            {tam.courseCount}
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono text-white">
                            {tam.endedClassesCount}
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono text-slate-400">
                            {tam.totalPresentSeats} / {tam.totalPossibleSeats}
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {hasData ? (
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${
                                  isBelow
                                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                    : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                }`}
                              >
                                {tam.attendancePercentage}%
                              </span>
                            ) : (
                              <div className="flex flex-col items-center">
                                <span className="font-mono text-slate-500">—</span>
                                <span className="text-[10px] text-slate-500 font-mono">No classes yet</span>
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            {tam.studentsBelow75Count !== null ? (
                              tam.studentsBelow75Count > 0 ? (
                                <span className="inline-flex items-center gap-1 text-xs font-mono text-amber-400 font-bold">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  <span>{tam.studentsBelow75Count} At Risk</span>
                                </span>
                              ) : (
                                <span className="text-emerald-400 font-mono text-xs">0 (All Compliant)</span>
                              )
                            ) : (
                              <span className="text-slate-500 font-mono text-xs">— No classes yet</span>
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
      )}

      {/* ─────────────────────────────────────────────────────────────
          SECTION 2: RATINGS & SATISFACTION (STRICT PRIVACY: NO STUDENT NAMES)
      ────────────────────────────────────────────────────────────── */}
      {(activeTab === "all" || activeTab === "ratings") && (
        <div className="space-y-6">
          <div className="border-b border-white/[0.08] pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
              <h2 className="text-lg font-bold text-white tracking-tight">
                Quality & Rating Telemetry (Institutional Reviews)
              </h2>
            </div>
            <span className="font-mono text-xs text-[#29d9ff] bg-[#29d9ff]/10 px-2.5 py-0.5 rounded-full border border-[#29d9ff]/20">
              Strictly Anonymous Telemetry
            </span>
          </div>

          {/* 2A: Ratings Per Course */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] overflow-hidden space-y-0">
            <div className="p-4 border-b border-white/[0.06] bg-[#04060a]/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-amber-400" />
                <span className="font-mono text-xs font-semibold uppercase text-slate-300">
                  Ratings by Course ({courseRatingMetrics.length})
                </span>
              </div>
            </div>

            {loading ? (
              <div className="p-8 space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-white/[0.03] rounded-xl animate-pulse" />
                ))}
              </div>
            ) : courseRatingMetrics.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No courses matching filter criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.08] bg-white/[0.02] text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                      <th className="py-3 px-4">Course</th>
                      <th className="py-3 px-4">Instructor</th>
                      <th className="py-3 px-4 text-center">Average Stars</th>
                      <th className="py-3 px-4 text-center">Reviews Count</th>
                      <th className="py-3 px-4 min-w-[280px]">1 to 5 Star Distribution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {courseRatingMetrics.map((crm) => (
                      <tr key={crm.courseId} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-white">
                          {crm.courseTitle}
                        </td>
                        <td className="py-3.5 px-4 text-slate-300">
                          {crm.teacherName}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {crm.averageStars !== null ? (
                            <span className="font-mono font-bold text-amber-400 text-sm">
                              {crm.averageStars.toFixed(1)} ★
                            </span>
                          ) : (
                            <div className="flex flex-col items-center">
                              <span className="font-mono text-slate-500">—</span>
                              <span className="text-[10px] text-slate-500 font-mono">No ratings yet</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono text-slate-300">
                          {crm.ratingsCount}
                        </td>
                        <td className="py-3.5 px-4">
                          {crm.ratingsCount > 0 ? (
                            <div className="flex items-center gap-2">
                              {crm.distribution.map((d) => (
                                <div key={d.stars} className="flex-1 space-y-1">
                                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        d.stars >= 4
                                          ? "bg-[#29d9ff]"
                                          : d.stars === 3
                                          ? "bg-amber-400"
                                          : "bg-rose-500/80"
                                      }`}
                                      style={{ width: `${d.percentage}%` }}
                                    />
                                  </div>
                                  <div className="text-[9px] font-mono text-slate-500 text-center">
                                    {d.stars}★: {d.count} ({d.percentage}%)
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-500 text-[11px] font-mono">— No responses recorded</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 2B: Ratings Per Teacher */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] overflow-hidden space-y-0">
            <div className="p-4 border-b border-white/[0.06] bg-[#04060a]/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-amber-400" />
                <span className="font-mono text-xs font-semibold uppercase text-slate-300">
                  Ratings by Faculty Instructor ({teacherRatingMetrics.length})
                </span>
              </div>
            </div>

            {loading ? (
              <div className="p-8 space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="h-16 bg-white/[0.03] rounded-xl animate-pulse" />
                ))}
              </div>
            ) : teacherRatingMetrics.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No faculty members matching filter criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.08] bg-white/[0.02] text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                      <th className="py-3 px-4">Faculty Instructor</th>
                      <th className="py-3 px-4 text-center">Average Stars</th>
                      <th className="py-3 px-4 text-center">Reviews Count</th>
                      <th className="py-3 px-4 min-w-[280px]">1 to 5 Star Distribution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {teacherRatingMetrics.map((trm) => (
                      <tr key={trm.teacherId} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-white">
                          {trm.teacherName}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {trm.averageStars !== null ? (
                            <span className="font-mono font-bold text-amber-400 text-sm">
                              {trm.averageStars.toFixed(1)} ★
                            </span>
                          ) : (
                            <div className="flex flex-col items-center">
                              <span className="font-mono text-slate-500">—</span>
                              <span className="text-[10px] text-slate-500 font-mono">No ratings yet</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono text-slate-300">
                          {trm.ratingsCount}
                        </td>
                        <td className="py-3.5 px-4">
                          {trm.ratingsCount > 0 ? (
                            <div className="flex items-center gap-2">
                              {trm.distribution.map((d) => (
                                <div key={d.stars} className="flex-1 space-y-1">
                                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        d.stars >= 4
                                          ? "bg-[#29d9ff]"
                                          : d.stars === 3
                                          ? "bg-amber-400"
                                          : "bg-rose-500/80"
                                      }`}
                                      style={{ width: `${d.percentage}%` }}
                                    />
                                  </div>
                                  <div className="text-[9px] font-mono text-slate-500 text-center">
                                    {d.stars}★: {d.count} ({d.percentage}%)
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-500 text-[11px] font-mono">— No responses recorded</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
