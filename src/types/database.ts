export type UserRole = "student" | "teacher" | "admin";

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  student_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  title: string;
  description: string | null;
  teacher_id: string;
  starts_on: string | null;
  ends_on: string | null;
  created_at: string;
}

export interface Topic {
  id: string;
  course_id: string;
  title: string;
  position: number;
  created_at: string;
}

export interface Enrollment {
  id: string;
  course_id: string;
  student_id: string;
  created_at: string;
}

export interface LiveSession {
  id: string;
  course_id: string;
  topic_id: string | null;
  teacher_id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  status: "scheduled" | "live" | "ended";
  livekit_room: string;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

export interface Recording {
  id: string;
  session_id: string;
  course_id: string;
  topic_id: string | null;
  storage_path: string;
  duration_seconds: number;
  status: "processing" | "ready" | "hidden";
  created_at: string;
}

export interface LessonProgress {
  id: string;
  user_id: string;
  recording_id: string;
  watched_seconds: number;
  watched_segments: number[][];
  completed: boolean;
  updated_at: string;
}

export interface Attendance {
  id: string;
  session_id: string;
  user_id: string;
  joined_at: string;
  left_at: string | null;
  total_seconds: number;
  created_at: string;
}

export interface CourseAttendancePercentage {
  course_id: string;
  student_id: string;
  student_name: string;
  student_code: string | null;
  course_title: string;
  total_ended_sessions: number;
  sessions_attended: number;
  attendance_percentage: number;
}

export interface ClassRating {
  id: string;
  session_id: string;
  user_id: string;
  stars: number;
  comment: string | null;
  created_at: string;
}

export interface Bookmark {
  id: string;
  user_id: string;
  recording_id: string;
  position_seconds: number;
  note: string;
  created_at: string;
}

export interface ImportantDate {
  id: string;
  course_id: string;
  title: string;
  date: string;
  kind: "exam" | "deadline" | "holiday" | "other";
  created_at: string;
}

export interface Assessment {
  id: string;
  course_id: string;
  title: string;
  due_date: string;
  created_at: string;
}

export interface AssessmentQuestion {
  id: string;
  assessment_id: string;
  question: string;
  options: string[];
  correct_index: number;
  created_at: string;
}

export interface AssessmentAttempt {
  id: string;
  assessment_id: string;
  user_id: string;
  answers: Record<string, number>;
  score: number;
  taken_at: string;
}

export interface HelpTicket {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  status: "open" | "answered" | "closed";
  reply: string | null;
  created_at: string;
}

export interface SecurityEvent {
  id: string;
  user_id: string | null;
  event: string;
  created_at: string;
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: {
          id: string;
          full_name?: string;
          role?: UserRole;
          student_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          role?: UserRole;
          student_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      courses: {
        Row: Course;
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          teacher_id: string;
          starts_on?: string | null;
          ends_on?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          teacher_id?: string;
          starts_on?: string | null;
          ends_on?: string | null;
          created_at?: string;
        };
      };
      topics: {
        Row: Topic;
        Insert: {
          id?: string;
          course_id: string;
          title: string;
          position?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          course_id?: string;
          title?: string;
          position?: number;
          created_at?: string;
        };
      };
      enrollments: {
        Row: Enrollment;
        Insert: {
          id?: string;
          course_id: string;
          student_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          course_id?: string;
          student_id?: string;
          created_at?: string;
        };
      };
      live_sessions: {
        Row: LiveSession;
        Insert: {
          id?: string;
          course_id: string;
          topic_id?: string | null;
          teacher_id: string;
          title: string;
          scheduled_at: string;
          duration_minutes?: number;
          status?: "scheduled" | "live" | "ended";
          livekit_room: string;
          started_at?: string | null;
          ended_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          course_id?: string;
          topic_id?: string | null;
          teacher_id?: string;
          title?: string;
          scheduled_at?: string;
          duration_minutes?: number;
          status?: "scheduled" | "live" | "ended";
          livekit_room?: string;
          started_at?: string | null;
          ended_at?: string | null;
          created_at?: string;
        };
      };
      recordings: {
        Row: Recording;
        Insert: {
          id?: string;
          session_id: string;
          course_id: string;
          topic_id?: string | null;
          storage_path: string;
          duration_seconds?: number;
          status?: "processing" | "ready" | "hidden";
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          course_id?: string;
          topic_id?: string | null;
          storage_path?: string;
          duration_seconds?: number;
          status?: "processing" | "ready" | "hidden";
          created_at?: string;
        };
      };
      lesson_progress: {
        Row: LessonProgress;
        Insert: {
          id?: string;
          user_id: string;
          recording_id: string;
          watched_seconds?: number;
          watched_segments?: number[][];
          completed?: boolean;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          recording_id?: string;
          watched_seconds?: number;
          watched_segments?: number[][];
          completed?: boolean;
          updated_at?: string;
        };
      };
      attendance: {
        Row: Attendance;
        Insert: {
          id?: string;
          session_id: string;
          user_id: string;
          joined_at?: string;
          left_at?: string | null;
          total_seconds?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          user_id?: string;
          joined_at?: string;
          left_at?: string | null;
          total_seconds?: number;
          created_at?: string;
        };
      };
      class_ratings: {
        Row: ClassRating;
        Insert: {
          id?: string;
          session_id: string;
          user_id: string;
          stars: number;
          comment?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          user_id?: string;
          stars?: number;
          comment?: string | null;
          created_at?: string;
        };
      };
      bookmarks: {
        Row: Bookmark;
        Insert: {
          id?: string;
          user_id: string;
          recording_id: string;
          position_seconds?: number;
          note: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          recording_id?: string;
          position_seconds?: number;
          note?: string;
          created_at?: string;
        };
      };
      important_dates: {
        Row: ImportantDate;
        Insert: {
          id?: string;
          course_id: string;
          title: string;
          date: string;
          kind?: "exam" | "deadline" | "holiday" | "other";
          created_at?: string;
        };
        Update: {
          id?: string;
          course_id?: string;
          title?: string;
          date?: string;
          kind?: "exam" | "deadline" | "holiday" | "other";
          created_at?: string;
        };
      };
      assessments: {
        Row: Assessment;
        Insert: {
          id?: string;
          course_id: string;
          title: string;
          due_date: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          course_id?: string;
          title?: string;
          due_date?: string;
          created_at?: string;
        };
      };
      assessment_questions: {
        Row: AssessmentQuestion;
        Insert: {
          id?: string;
          assessment_id: string;
          question: string;
          options: string[];
          correct_index: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          assessment_id?: string;
          question?: string;
          options?: string[];
          correct_index?: number;
          created_at?: string;
        };
      };
      assessment_attempts: {
        Row: AssessmentAttempt;
        Insert: {
          id?: string;
          assessment_id: string;
          user_id: string;
          answers?: Record<string, number>;
          score?: number;
          taken_at?: string;
        };
        Update: {
          id?: string;
          assessment_id?: string;
          user_id?: string;
          answers?: Record<string, number>;
          score?: number;
          taken_at?: string;
        };
      };
      help_tickets: {
        Row: HelpTicket;
        Insert: {
          id?: string;
          user_id: string;
          subject: string;
          message: string;
          status?: "open" | "answered" | "closed";
          reply?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          subject?: string;
          message?: string;
          status?: "open" | "answered" | "closed";
          reply?: string | null;
          created_at?: string;
        };
      };
      security_events: {
        Row: SecurityEvent;
        Insert: {
          id?: string;
          user_id?: string | null;
          event: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          event?: string;
          created_at?: string;
        };
      };
    };
    Views: {
      course_attendance_percentage: {
        Row: CourseAttendancePercentage;
      };
    };
  };
};
