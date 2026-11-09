"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getFirstNameAndInitial } from "@/lib/utils";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit2,
  Filter,
  GraduationCap,
  Layers,
  Loader2,
  MoreVertical,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

interface TeacherProfile {
  id: string;
  full_name: string;
  email?: string;
}

interface StudentProfile {
  id: string;
  full_name: string;
  student_id: string | null;
  email?: string;
  is_active: boolean;
}

interface TopicItem {
  id: string;
  course_id: string;
  title: string;
  position: number;
}

interface EnrolledStudentItem {
  enrollment_id: string;
  student_id: string;
  student_name: string;
  student_code: string | null;
  enrolled_at: string;
}

interface CourseItem {
  id: string;
  title: string;
  description: string | null;
  teacher_id: string;
  teacher_name: string;
  starts_on: string | null;
  ends_on: string | null;
  created_at: string;
  enrolled_count: number;
  topics_count: number;
}

export default function AdminCoursesPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [activeStudents, setActiveStudents] = useState<StudentProfile[]>([]);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "ended">("all");

  // Create / Edit Course Modal State
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [courseTitle, setCourseTitle] = useState("");
  const [courseDescription, setCourseDescription] = useState("");
  const [courseTeacherId, setCourseTeacherId] = useState("");
  const [courseStartsOn, setCourseStartsOn] = useState("");
  const [courseEndsOn, setCourseEndsOn] = useState("");
  const [courseSaving, setCourseSaving] = useState(false);
  const [courseError, setCourseError] = useState<string | null>(null);

  // Topics Modal State
  const [topicsModalOpen, setTopicsModalOpen] = useState(false);
  const [selectedCourseForTopics, setSelectedCourseForTopics] = useState<CourseItem | null>(null);
  const [topicsList, setTopicsList] = useState<TopicItem[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editingTopicTitle, setEditingTopicTitle] = useState("");
  const [topicsSaving, setTopicsSaving] = useState(false);
  const [topicError, setTopicError] = useState<string | null>(null);

  // Enrolments Modal State
  const [enrolmentsModalOpen, setEnrolmentsModalOpen] = useState(false);
  const [selectedCourseForEnrolments, setSelectedCourseForEnrolments] = useState<CourseItem | null>(null);
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudentItem[]>([]);
  const [enrolmentsLoading, setEnrolmentsLoading] = useState(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [enrollingStudentId, setEnrollingStudentId] = useState<string | null>(null);
  const [removingEnrollmentId, setRemovingEnrollmentId] = useState<string | null>(null);
  const [enrolmentFeedback, setEnrolmentFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Load all initial data
  const loadPlatformData = useCallback(async () => {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/staff");
        return;
      }

      // 1. Fetch Teachers (profiles where role = 'teacher')
      const { data: teachersData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "teacher")
        .order("full_name");

      const rawTeachers = (teachersData as TeacherProfile[]) || [];
      setTeachers(rawTeachers);

      const teacherMap = new Map<string, string>();
      rawTeachers.forEach((t) => teacherMap.set(t.id, t.full_name));

      // 2. Fetch Active Students (profiles where role = 'student' and is_active = true)
      const { data: studentsData } = await supabase
        .from("profiles")
        .select("id, full_name, student_id, is_active")
        .eq("role", "student")
        .eq("is_active", true)
        .order("full_name");

      const rawStudents = (studentsData as StudentProfile[]) || [];
      setActiveStudents(rawStudents);

      // 3. Fetch Courses
      const { data: coursesData, error: coursesError } = await supabase
        .from("courses")
        .select("id, title, description, teacher_id, starts_on, ends_on, created_at")
        .order("created_at", { ascending: false });

      if (coursesError) {
        console.error("Error loading courses:", coursesError);
      }

      const rawCourses = coursesData || [];

      // 4. Fetch Enrollments count per course
      const { data: enrollmentsData } = await supabase
        .from("enrollments")
        .select("course_id");

      const enrollmentCountMap = new Map<string, number>();
      (enrollmentsData || []).forEach((e: any) => {
        enrollmentCountMap.set(e.course_id, (enrollmentCountMap.get(e.course_id) || 0) + 1);
      });

      // 5. Fetch Topics count per course
      const { data: topicsCountData } = await supabase
        .from("topics")
        .select("course_id");

      const topicCountMap = new Map<string, number>();
      (topicsCountData || []).forEach((t: any) => {
        topicCountMap.set(t.course_id, (topicCountMap.get(t.course_id) || 0) + 1);
      });

      const formattedCourses: CourseItem[] = rawCourses.map((c: any) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        teacher_id: c.teacher_id,
        teacher_name: teacherMap.get(c.teacher_id) || "Unassigned Instructor",
        starts_on: c.starts_on,
        ends_on: c.ends_on,
        created_at: c.created_at,
        enrolled_count: enrollmentCountMap.get(c.id) || 0,
        topics_count: topicCountMap.get(c.id) || 0,
      }));

      setCourses(formattedCourses);
    } catch (err) {
      console.error("Error loading courses management data:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase, router]);

  useEffect(() => {
    loadPlatformData();
  }, [loadPlatformData]);

  // Filtered courses
  const filteredCourses = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return courses.filter((c) => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = c.title.toLowerCase().includes(q);
        const matchesTeacher = c.teacher_name.toLowerCase().includes(q);
        const matchesDesc = c.description ? c.description.toLowerCase().includes(q) : false;
        if (!matchesTitle && !matchesTeacher && !matchesDesc) return false;
      }

      // Teacher filter
      if (teacherFilter !== "all" && c.teacher_id !== teacherFilter) {
        return false;
      }

      // Status filter
      if (statusFilter === "active") {
        if (c.ends_on && c.ends_on < todayStr) return false;
      } else if (statusFilter === "ended") {
        if (!c.ends_on || c.ends_on >= todayStr) return false;
      }

      return true;
    });
  }, [courses, searchQuery, teacherFilter, statusFilter]);

  // Open Create Course Modal
  const handleOpenCreateModal = () => {
    setEditingCourseId(null);
    setCourseTitle("");
    setCourseDescription("");
    setCourseTeacherId(teachers.length > 0 ? teachers[0].id : "");
    setCourseStartsOn("");
    setCourseEndsOn("");
    setCourseError(null);
    setCourseModalOpen(true);
  };

  // Open Edit Course Modal
  const handleOpenEditModal = (course: CourseItem) => {
    setEditingCourseId(course.id);
    setCourseTitle(course.title);
    setCourseDescription(course.description || "");
    setCourseTeacherId(course.teacher_id);
    setCourseStartsOn(course.starts_on || "");
    setCourseEndsOn(course.ends_on || "");
    setCourseError(null);
    setCourseModalOpen(true);
  };

  // Save Course (Create or Update)
  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseTitle.trim()) {
      setCourseError("Course title is required.");
      return;
    }
    if (!courseTeacherId) {
      setCourseError("Please assign an instructor to this course.");
      return;
    }

    try {
      setCourseSaving(true);
      setCourseError(null);

      const payload = {
        title: courseTitle.trim(),
        description: courseDescription.trim() || null,
        teacher_id: courseTeacherId,
        starts_on: courseStartsOn || null,
        ends_on: courseEndsOn || null,
      };

      if (editingCourseId) {
        // Update existing course
        const { error: updateError } = await (supabase.from("courses") as any)
          .update(payload)
          .eq("id", editingCourseId);

        if (updateError) throw updateError;
      } else {
        // Create new course
        const { error: insertError } = await (supabase.from("courses") as any)
          .insert(payload);

        if (insertError) throw insertError;
      }

      setCourseModalOpen(false);
      await loadPlatformData();
    } catch (err: any) {
      console.error("Error saving course:", err);
      setCourseError(err.message || "Failed to save course. Please try again.");
    } finally {
      setCourseSaving(false);
    }
  };

  // Delete Course
  const handleDeleteCourse = async (courseId: string, title: string) => {
    if (!confirm(`Are you sure you want to permanently delete the course "${title}"? All associated topics, sessions, and enrolments will be removed.`)) {
      return;
    }

    try {
      const { error } = await supabase.from("courses").delete().eq("id", courseId);
      if (error) throw error;
      await loadPlatformData();
    } catch (err: any) {
      console.error("Error deleting course:", err);
      alert(err.message || "Failed to delete course.");
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // TOPICS MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────
  const loadTopicsForCourse = async (course: CourseItem) => {
    try {
      setSelectedCourseForTopics(course);
      setTopicsLoading(true);
      setTopicsModalOpen(true);
      setNewTopicTitle("");
      setEditingTopicId(null);
      setTopicError(null);

      const { data, error } = await supabase
        .from("topics")
        .select("id, course_id, title, position")
        .eq("course_id", course.id)
        .order("position", { ascending: true });

      if (error) throw error;
      setTopicsList((data as TopicItem[]) || []);
    } catch (err: any) {
      console.error("Error loading topics:", err);
      setTopicError(err.message || "Failed to load topics.");
    } finally {
      setTopicsLoading(false);
    }
  };

  const handleAddTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseForTopics || !newTopicTitle.trim()) return;

    try {
      setTopicsSaving(true);
      setTopicError(null);

      const nextPosition = topicsList.length > 0 ? Math.max(...topicsList.map((t) => t.position)) + 1 : 1;

      const { data, error } = await (supabase.from("topics") as any)
        .insert({
          course_id: selectedCourseForTopics.id,
          title: newTopicTitle.trim(),
          position: nextPosition,
        })
        .select()
        .single();

      if (error) throw error;

      setTopicsList((prev) => [...prev, data as TopicItem]);
      setNewTopicTitle("");
      // Update parent course topics count in state
      setCourses((prev) =>
        prev.map((c) => (c.id === selectedCourseForTopics.id ? { ...c, topics_count: c.topics_count + 1 } : c))
      );
    } catch (err: any) {
      console.error("Error adding topic:", err);
      setTopicError(err.message || "Failed to add topic.");
    } finally {
      setTopicsSaving(false);
    }
  };

  const handleRenameTopic = async (topicId: string) => {
    if (!editingTopicTitle.trim()) return;

    try {
      setTopicsSaving(true);
      setTopicError(null);

      const { error } = await (supabase.from("topics") as any)
        .update({ title: editingTopicTitle.trim() })
        .eq("id", topicId);

      if (error) throw error;

      setTopicsList((prev) =>
        prev.map((t) => (t.id === topicId ? { ...t, title: editingTopicTitle.trim() } : t))
      );
      setEditingTopicId(null);
      setEditingTopicTitle("");
    } catch (err: any) {
      console.error("Error updating topic:", err);
      setTopicError(err.message || "Failed to rename topic.");
    } finally {
      setTopicsSaving(false);
    }
  };

  const handleMoveTopic = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= topicsList.length) return;

    const currentTopic = topicsList[index];
    const targetTopic = topicsList[targetIndex];

    try {
      setTopicsSaving(true);
      // Swap positions
      const newPosCurrent = targetTopic.position;
      const newPosTarget = currentTopic.position;

      await (supabase.from("topics") as any)
        .update({ position: newPosCurrent })
        .eq("id", currentTopic.id);

      await (supabase.from("topics") as any)
        .update({ position: newPosTarget })
        .eq("id", targetTopic.id);

      // Re-order local list
      const updated = [...topicsList];
      updated[index] = { ...currentTopic, position: newPosCurrent };
      updated[targetIndex] = { ...targetTopic, position: newPosTarget };
      updated.sort((a, b) => a.position - b.position);
      setTopicsList(updated);
    } catch (err: any) {
      console.error("Error reordering topics:", err);
      setTopicError("Failed to reorder topics.");
    } finally {
      setTopicsSaving(false);
    }
  };

  const handleDeleteTopic = async (topicId: string, title: string) => {
    if (!confirm(`Are you sure you want to remove topic "${title}"?`)) return;

    try {
      setTopicsSaving(true);
      const { error } = await supabase.from("topics").delete().eq("id", topicId);
      if (error) throw error;

      setTopicsList((prev) => prev.filter((t) => t.id !== topicId));
      if (selectedCourseForTopics) {
        setCourses((prev) =>
          prev.map((c) =>
            c.id === selectedCourseForTopics.id ? { ...c, topics_count: Math.max(0, c.topics_count - 1) } : c
          )
        );
      }
    } catch (err: any) {
      console.error("Error deleting topic:", err);
      setTopicError(err.message || "Failed to delete topic.");
    } finally {
      setTopicsSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // ENROLMENTS MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────
  const loadEnrolmentsForCourse = async (course: CourseItem) => {
    try {
      setSelectedCourseForEnrolments(course);
      setEnrolmentsLoading(true);
      setEnrolmentsModalOpen(true);
      setStudentSearchQuery("");
      setEnrolmentFeedback(null);

      // Fetch enrolled students for this course
      const { data, error } = await supabase
        .from("enrollments")
        .select("id, student_id, created_at")
        .eq("course_id", course.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const rawEnrollments = data || [];
      const studentIds = rawEnrollments.map((e: any) => e.student_id);

      if (studentIds.length === 0) {
        setEnrolledStudents([]);
        return;
      }

      // Fetch profile details for enrolled students
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, student_id")
        .in("id", studentIds);

      const profileMap = new Map<string, { full_name: string; student_id: string | null }>();
      (profilesData || []).forEach((p: any) => {
        profileMap.set(p.id, { full_name: p.full_name, student_id: p.student_id });
      });

      const list: EnrolledStudentItem[] = rawEnrollments.map((e: any) => {
        const prof = profileMap.get(e.student_id);
        return {
          enrollment_id: e.id,
          student_id: e.student_id,
          student_name: prof?.full_name || "Enrolled Student",
          student_code: prof?.student_id || null,
          enrolled_at: e.created_at,
        };
      });

      setEnrolledStudents(list);
    } catch (err: any) {
      console.error("Error loading enrolments:", err);
      setEnrolmentFeedback({ type: "error", message: "Failed to load enrolments list." });
    } finally {
      setEnrolmentsLoading(false);
    }
  };

  // Candidates for enrolment: Active students NOT already enrolled in this course
  const enrolledStudentIdSet = useMemo(() => {
    return new Set(enrolledStudents.map((s) => s.student_id));
  }, [enrolledStudents]);

  const candidateStudents = useMemo(() => {
    if (!studentSearchQuery.trim()) return [];

    const q = studentSearchQuery.toLowerCase();
    return activeStudents
      .filter((s) => !enrolledStudentIdSet.has(s.id))
      .filter((s) => {
        const matchesName = s.full_name.toLowerCase().includes(q);
        const matchesCode = s.student_id ? s.student_id.toLowerCase().includes(q) : false;
        return matchesName || matchesCode;
      })
      .slice(0, 10); // Show top 10 matches
  }, [activeStudents, enrolledStudentIdSet, studentSearchQuery]);

  const handleEnrolStudent = async (student: StudentProfile) => {
    if (!selectedCourseForEnrolments) return;

    // Guard: double enrollment prevention
    if (enrolledStudentIdSet.has(student.id)) {
      setEnrolmentFeedback({ type: "error", message: `${student.full_name} is already enrolled.` });
      return;
    }

    try {
      setEnrollingStudentId(student.id);
      setEnrolmentFeedback(null);

      const { data, error } = await (supabase.from("enrollments") as any)
        .insert({
          course_id: selectedCourseForEnrolments.id,
          student_id: student.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Add to local state
      const newItem: EnrolledStudentItem = {
        enrollment_id: data.id,
        student_id: student.id,
        student_name: student.full_name,
        student_code: student.student_id,
        enrolled_at: data.created_at || new Date().toISOString(),
      };

      setEnrolledStudents((prev) => [newItem, ...prev]);
      setEnrolmentFeedback({ type: "success", message: `Successfully enrolled ${student.full_name}.` });

      // Update parent course enrolled count
      setCourses((prev) =>
        prev.map((c) =>
          c.id === selectedCourseForEnrolments.id ? { ...c, enrolled_count: c.enrolled_count + 1 } : c
        )
      );
    } catch (err: any) {
      console.error("Error enrolling student:", err);
      setEnrolmentFeedback({ type: "error", message: err.message || "Failed to enrol student." });
    } finally {
      setEnrollingStudentId(null);
    }
  };

  const handleRemoveEnrollment = async (enrollmentId: string, studentName: string) => {
    if (!confirm(`Are you sure you want to remove ${studentName} from this course?`)) return;

    try {
      setRemovingEnrollmentId(enrollmentId);
      setEnrolmentFeedback(null);

      const { error } = await supabase.from("enrollments").delete().eq("id", enrollmentId);
      if (error) throw error;

      setEnrolledStudents((prev) => prev.filter((e) => e.enrollment_id !== enrollmentId));
      setEnrolmentFeedback({ type: "success", message: `Removed ${studentName} from the course roster.` });

      if (selectedCourseForEnrolments) {
        setCourses((prev) =>
          prev.map((c) =>
            c.id === selectedCourseForEnrolments.id
              ? { ...c, enrolled_count: Math.max(0, c.enrolled_count - 1) }
              : c
          )
        );
      }
    } catch (err: any) {
      console.error("Error removing enrollment:", err);
      setEnrolmentFeedback({ type: "error", message: err.message || "Failed to remove student." });
    } finally {
      setRemovingEnrollmentId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* ─────────────────────────────────────────────────────────────
          HEADER & TOP ACTIONS
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
            <span>Courses & Enrolments</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-[#29d9ff]/30 text-[#29d9ff] font-mono">
              Curriculum Core
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Create academic courses, assign faculty instructors, structure modular topics, and manage student rosters.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#29d9ff] hover:bg-[#6be4ff] text-[#04060a] font-mono text-xs uppercase tracking-wider font-bold transition-all shadow-[0_0_15px_rgba(41,217,255,0.3)] self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create Course</span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          METRICS CARDS ROW
      ────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-white/[0.08] bg-[#070c18]/80 backdrop-blur-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>TOTAL COURSES</span>
            <BookOpen className="w-4 h-4 text-[#29d9ff]" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {loading ? "—" : courses.length}
          </div>
          <p className="text-[10px] text-slate-400 font-mono">Institutional catalogue</p>
        </div>

        <div className="p-4 rounded-2xl border border-white/[0.08] bg-[#070c18]/80 backdrop-blur-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>FACULTY INSTRUCTORS</span>
            <GraduationCap className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {loading ? "—" : teachers.length}
          </div>
          <p className="text-[10px] text-slate-400 font-mono">Assigned educators</p>
        </div>

        <div className="p-4 rounded-2xl border border-white/[0.08] bg-[#070c18]/80 backdrop-blur-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>TOTAL ENROLMENTS</span>
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {loading ? "—" : courses.reduce((acc, c) => acc + c.enrolled_count, 0)}
          </div>
          <p className="text-[10px] text-slate-400 font-mono">Active student placements</p>
        </div>

        <div className="p-4 rounded-2xl border border-white/[0.08] bg-[#070c18]/80 backdrop-blur-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>ACTIVE STUDENTS</span>
            <UserCheck className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {loading ? "—" : activeStudents.length}
          </div>
          <p className="text-[10px] text-slate-400 font-mono">Eligible for cohort enrol</p>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          FILTER TOOLBAR
      ────────────────────────────────────────────────────────────── */}
      <div className="p-4 rounded-2xl border border-white/[0.08] bg-[#070c18] flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by course title or instructor..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#04060a] border border-white/[0.1] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#29d9ff] transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Teacher:</span>
            <select
              value={teacherFilter}
              onChange={(e) => setTeacherFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[#04060a] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#29d9ff]"
            >
              <option value="all">All Faculty ({teachers.length})</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-1.5 rounded-xl bg-[#04060a] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#29d9ff]"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active (Ongoing)</option>
              <option value="ended">Concluded</option>
            </select>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          COURSES TABLE / LIST
      ────────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-white/[0.03] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <BookOpen className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-base font-semibold text-white">No courses found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {courses.length === 0
                ? "No academic courses have been created yet. Click 'Create Course' to start building your curriculum."
                : "No courses match your active search and filter criteria."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.02] text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                  <th className="py-3.5 px-4">Course Name & Details</th>
                  <th className="py-3.5 px-4">Assigned Instructor</th>
                  <th className="py-3.5 px-4 text-center">Enrolled Students</th>
                  <th className="py-3.5 px-4 text-center">Curriculum Topics</th>
                  <th className="py-3.5 px-4">Timeline</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredCourses.map((c) => {
                  const todayStr = new Date().toISOString().slice(0, 10);
                  const isConcluded = c.ends_on && c.ends_on < todayStr;
                  const { firstName, initial } = getFirstNameAndInitial(c.teacher_name, "Teacher");

                  return (
                    <tr key={c.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="py-4 px-4">
                        <div className="font-semibold text-white text-sm group-hover:text-[#29d9ff] transition-colors">
                          {c.title}
                        </div>
                        {c.description && (
                          <p className="text-xs text-slate-400 line-clamp-1 mt-0.5 max-w-md">
                            {c.description}
                          </p>
                        )}
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#29d9ff]/10 text-[#29d9ff] font-bold text-[10px] flex items-center justify-center border border-[#29d9ff]/20">
                            {initial}
                          </div>
                          <div>
                            <div className="font-medium text-white">{c.teacher_name}</div>
                            <div className="text-[10px] font-mono text-slate-500">Instructor</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => loadEnrolmentsForCourse(c)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 text-[#29d9ff] border border-[#29d9ff]/30 font-mono text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>{c.enrolled_count} Enrolled</span>
                        </button>
                      </td>

                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => loadTopicsForCourse(c)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/[0.08] font-mono text-xs transition-colors cursor-pointer"
                        >
                          <Layers className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{c.topics_count} Topics</span>
                        </button>
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap font-mono text-[11px]">
                        <div className="text-slate-300">
                          {c.starts_on ? new Date(c.starts_on).toLocaleDateString() : "Immediate"} —{" "}
                          {c.ends_on ? new Date(c.ends_on).toLocaleDateString() : "Open ended"}
                        </div>
                        <div className="mt-0.5">
                          {isConcluded ? (
                            <span className="text-amber-400/80">Concluded</span>
                          ) : (
                            <span className="text-emerald-400/80">Active</span>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => loadEnrolmentsForCourse(c)}
                            title="Manage Student Enrolments"
                            className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-[#29d9ff]/10 hover:text-[#29d9ff] text-slate-400 transition-colors"
                          >
                            <UserPlus className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => loadTopicsForCourse(c)}
                            title="Manage Topics"
                            className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-[#29d9ff]/10 hover:text-[#29d9ff] text-slate-400 transition-colors"
                          >
                            <Layers className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(c)}
                            title="Edit Course Details"
                            className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] hover:text-white text-slate-400 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteCourse(c.id, c.title)}
                            title="Delete Course"
                            className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-rose-500/10 hover:text-rose-400 text-slate-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODAL 1: CREATE OR EDIT COURSE
      ────────────────────────────────────────────────────────────── */}
      {courseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-2xl border border-white/[0.12] bg-[#070c18] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-white/[0.08] flex items-center justify-between bg-[#0a1122]">
              <div>
                <div className="text-xs font-mono text-[#29d9ff] uppercase tracking-wider">
                  {editingCourseId ? "CURRICULUM REVISION" : "NEW CURRICULUM"}
                </div>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  {editingCourseId ? "Edit Course Details" : "Create New Course"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCourseModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCourse} className="p-6 space-y-4">
              {courseError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{courseError}</span>
                </div>
              )}

              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300 uppercase tracking-wider block">
                  Course Title <span className="text-[#29d9ff]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={courseTitle}
                  onChange={(e) => setCourseTitle(e.target.value)}
                  placeholder="e.g. Autonomous Systems & Machine Learning"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#04060a] border border-white/[0.1] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#29d9ff]"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300 uppercase tracking-wider block">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={courseDescription}
                  onChange={(e) => setCourseDescription(e.target.value)}
                  placeholder="Comprehensive curriculum overview and learning outcomes..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#04060a] border border-white/[0.1] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#29d9ff] resize-none"
                />
              </div>

              {/* Assigned Teacher */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300 uppercase tracking-wider block">
                  Assigned Faculty Instructor <span className="text-[#29d9ff]">*</span>
                </label>
                <select
                  required
                  value={courseTeacherId}
                  onChange={(e) => setCourseTeacherId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#04060a] border border-white/[0.1] text-sm text-white focus:outline-none focus:border-[#29d9ff]"
                >
                  <option value="" disabled>
                    Select an instructor
                  </option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name}
                    </option>
                  ))}
                </select>
                {teachers.length === 0 && (
                  <p className="text-[11px] text-amber-400 mt-1">
                    No teacher accounts exist yet. Create a teacher account in Manage Users first.
                  </p>
                )}
              </div>

              {/* Dates Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300 uppercase tracking-wider block">
                    Starts On
                  </label>
                  <input
                    type="date"
                    value={courseStartsOn}
                    onChange={(e) => setCourseStartsOn(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#04060a] border border-white/[0.1] text-sm text-white focus:outline-none focus:border-[#29d9ff]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300 uppercase tracking-wider block">
                    Ends On
                  </label>
                  <input
                    type="date"
                    value={courseEndsOn}
                    onChange={(e) => setCourseEndsOn(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#04060a] border border-white/[0.1] text-sm text-white focus:outline-none focus:border-[#29d9ff]"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setCourseModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={courseSaving || teachers.length === 0}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#29d9ff] hover:bg-[#6be4ff] text-[#04060a] font-mono text-xs uppercase tracking-wider font-bold transition-all disabled:opacity-50"
                >
                  {courseSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>{editingCourseId ? "Save Changes" : "Create Course"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 2: TOPICS MANAGEMENT (Add, Rename, Reorder)
      ────────────────────────────────────────────────────────────── */}
      {topicsModalOpen && selectedCourseForTopics && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl max-h-[90vh] rounded-2xl border border-white/[0.12] bg-[#070c18] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-6 border-b border-white/[0.08] flex items-center justify-between bg-[#0a1122]">
              <div>
                <div className="text-xs font-mono text-[#29d9ff] uppercase tracking-wider">
                  TOPICS & MODULES
                </div>
                <h3 className="text-lg font-bold text-white mt-0.5 truncate max-w-sm">
                  {selectedCourseForTopics.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTopicsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content & Add Form */}
            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              {topicError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{topicError}</span>
                </div>
              )}

              {/* Add New Topic Input */}
              <form onSubmit={handleAddTopic} className="space-y-2">
                <label className="text-xs font-mono text-slate-300 uppercase tracking-wider block">
                  Add New Topic (e.g. AI, ML, IoT, Cloud)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={newTopicTitle}
                    onChange={(e) => setNewTopicTitle(e.target.value)}
                    placeholder="Enter topic name..."
                    className="flex-1 px-3.5 py-2 rounded-xl bg-[#04060a] border border-white/[0.1] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#29d9ff]"
                  />
                  <button
                    type="submit"
                    disabled={topicsSaving || !newTopicTitle.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#29d9ff] hover:bg-[#6be4ff] text-[#04060a] font-mono text-xs uppercase tracking-wider font-bold transition-all disabled:opacity-50 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </form>

              {/* Existing Topics List */}
              <div className="space-y-2.5">
                <div className="text-xs font-mono text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Course Topics ({topicsList.length})</span>
                  <span className="text-[10px] text-slate-500">Use arrows to reorder</span>
                </div>

                {topicsLoading ? (
                  <div className="space-y-2 py-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-12 bg-white/[0.04] rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : topicsList.length === 0 ? (
                  <div className="p-8 rounded-xl border border-dashed border-white/[0.1] text-center space-y-2 text-slate-400 text-xs">
                    <Layers className="w-8 h-8 mx-auto text-slate-600" />
                    <p>No topics added yet. Add topics to organise classes and curriculum modules.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {topicsList.map((topic, index) => {
                      const isEditing = editingTopicId === topic.id;

                      return (
                        <div
                          key={topic.id}
                          className="p-3 rounded-xl border border-white/[0.08] bg-[#04060a] flex items-center justify-between gap-3 group"
                        >
                          {/* Left: Position and Title */}
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="w-6 h-6 rounded-lg bg-white/[0.05] border border-white/[0.08] text-[11px] font-mono font-bold text-slate-400 flex items-center justify-center shrink-0">
                              {index + 1}
                            </span>

                            {isEditing ? (
                              <div className="flex items-center gap-2 flex-1">
                                <input
                                  type="text"
                                  value={editingTopicTitle}
                                  onChange={(e) => setEditingTopicTitle(e.target.value)}
                                  className="flex-1 px-2.5 py-1 rounded-lg bg-black border border-[#29d9ff] text-xs text-white focus:outline-none"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRenameTopic(topic.id)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-mono hover:bg-emerald-500/30"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingTopicId(null)}
                                  className="px-2.5 py-1 rounded-lg bg-white/[0.05] text-slate-400 text-[11px] font-mono hover:text-white"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <span className="font-medium text-white text-xs truncate">
                                {topic.title}
                              </span>
                            )}
                          </div>

                          {/* Right: Reorder & Actions */}
                          {!isEditing && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                disabled={index === 0 || topicsSaving}
                                onClick={() => handleMoveTopic(index, "up")}
                                title="Move Up"
                                className="p-1 rounded-lg text-slate-400 hover:text-[#29d9ff] hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              >
                                <ChevronUp className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                disabled={index === topicsList.length - 1 || topicsSaving}
                                onClick={() => handleMoveTopic(index, "down")}
                                title="Move Down"
                                className="p-1 rounded-lg text-slate-400 hover:text-[#29d9ff] hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              >
                                <ChevronDown className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTopicId(topic.id);
                                  setEditingTopicTitle(topic.title);
                                }}
                                title="Rename Topic"
                                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors ml-1"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteTopic(topic.id, topic.title)}
                                title="Delete Topic"
                                className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/[0.08] bg-[#0a1122] flex justify-end">
              <button
                type="button"
                onClick={() => setTopicsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-xs font-medium text-white transition-colors"
              >
                Close Topics
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 3: ENROLMENTS PANEL (Roster & Enrol Student Search)
      ────────────────────────────────────────────────────────────── */}
      {enrolmentsModalOpen && selectedCourseForEnrolments && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[90vh] rounded-2xl border border-white/[0.12] bg-[#070c18] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-6 border-b border-white/[0.08] flex items-center justify-between bg-[#0a1122]">
              <div>
                <div className="text-xs font-mono text-[#29d9ff] uppercase tracking-wider flex items-center gap-2">
                  <span>COHORT ENROLMENTS</span>
                  <span>•</span>
                  <span>{enrolledStudents.length} Students Active</span>
                </div>
                <h3 className="text-lg font-bold text-white mt-0.5 truncate max-w-md">
                  {selectedCourseForEnrolments.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEnrolmentsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              {enrolmentFeedback && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    enrolmentFeedback.type === "success"
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                  }`}
                >
                  {enrolmentFeedback.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{enrolmentFeedback.message}</span>
                </div>
              )}

              {/* Enrol Students Search Box */}
              <div className="p-4 rounded-xl border border-white/[0.08] bg-[#04060a]/70 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono text-slate-300 uppercase tracking-wider block">
                    Enrol Students to Course
                  </label>
                  <span className="text-[10px] font-mono text-slate-500">
                    Active students only • Double enrol protected
                  </span>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={studentSearchQuery}
                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                    placeholder="Search candidate students by name or code (e.g. STU-1002)..."
                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#070c18] border border-white/[0.1] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#29d9ff]"
                  />
                  {studentSearchQuery && (
                    <button
                      onClick={() => setStudentSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Candidate Results */}
                {studentSearchQuery.trim() && (
                  <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-[#070c18] divide-y divide-white/[0.04]">
                    {candidateStudents.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500">
                        No non-enrolled active students matching &quot;{studentSearchQuery}&quot;.
                      </div>
                    ) : (
                      candidateStudents.map((st) => (
                        <div
                          key={st.id}
                          className="p-3 flex items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors"
                        >
                          <div>
                            <div className="font-semibold text-white text-xs">{st.full_name}</div>
                            {st.student_id && (
                              <div className="text-[10px] font-mono text-slate-400">{st.student_id}</div>
                            )}
                          </div>

                          <button
                            type="button"
                            disabled={enrollingStudentId === st.id}
                            onClick={() => handleEnrolStudent(st)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#29d9ff] hover:bg-[#6be4ff] text-[#04060a] font-mono text-xs font-bold transition-all disabled:opacity-50"
                          >
                            {enrollingStudentId === st.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <UserPlus className="w-3.5 h-3.5" />
                            )}
                            <span>Enrol</span>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Current Enrolled Roster */}
              <div className="space-y-3">
                <div className="text-xs font-mono text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Enrolled Roster ({enrolledStudents.length})</span>
                  <span className="text-[10px] text-slate-500">Click Remove to revoke access</span>
                </div>

                {enrolmentsLoading ? (
                  <div className="space-y-2 py-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-12 bg-white/[0.04] rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : enrolledStudents.length === 0 ? (
                  <div className="p-8 rounded-xl border border-dashed border-white/[0.1] text-center space-y-2 text-slate-400 text-xs">
                    <Users className="w-8 h-8 mx-auto text-slate-600" />
                    <p>No students enrolled in this course yet. Use the search box above to enrol learners.</p>
                  </div>
                ) : (
                  <div className="border border-white/[0.08] rounded-xl overflow-hidden divide-y divide-white/[0.04]">
                    {enrolledStudents.map((st) => (
                      <div
                        key={st.enrollment_id}
                        className="p-3.5 flex items-center justify-between gap-4 bg-[#04060a]/50 hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="space-y-0.5">
                          <div className="font-semibold text-white text-xs flex items-center gap-2">
                            <span>{st.student_name}</span>
                            {st.student_code && (
                              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-400/10 px-1.5 py-0.2 rounded border border-cyan-400/20">
                                {st.student_code}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500">
                            Enrolled on {new Date(st.enrolled_at).toLocaleDateString()}
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={removingEnrollmentId === st.enrollment_id}
                          onClick={() => handleRemoveEnrollment(st.enrollment_id, st.student_name)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          {removingEnrollmentId === st.enrollment_id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <UserMinus className="w-3.5 h-3.5" />
                          )}
                          <span>Remove</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/[0.08] bg-[#0a1122] flex justify-end">
              <button
                type="button"
                onClick={() => setEnrolmentsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-xs font-medium text-white transition-colors"
              >
                Close Enrolments
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
