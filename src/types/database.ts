export type UserRole = "student" | "teacher" | "admin";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  title: string;
  description: string | null;
  teacher_id: string;
  created_at: string;
}

export interface Enrollment {
  id: string;
  student_id: string;
  course_id: string;
  status: "active" | "completed" | "dropped";
  created_at: string;
}

export interface Session {
  id: string;
  course_id: string;
  title: string;
  scheduled_at: string;
  status: "scheduled" | "live" | "ended";
  room_name: string;
  created_at: string;
}

export interface Recording {
  id: string;
  session_id: string;
  storage_path: string;
  duration_seconds: number;
  created_at: string;
}

export interface WatchProgress {
  id: string;
  student_id: string;
  recording_id: string;
  last_position_seconds: number;
  total_duration_seconds: number;
  completed: boolean;
  updated_at: string;
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          role?: UserRole;
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
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          teacher_id?: string;
          created_at?: string;
        };
      };
      enrollments: {
        Row: Enrollment;
        Insert: {
          id?: string;
          student_id: string;
          course_id: string;
          status?: "active" | "completed" | "dropped";
          created_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          course_id?: string;
          status?: "active" | "completed" | "dropped";
          created_at?: string;
        };
      };
      sessions: {
        Row: Session;
        Insert: {
          id?: string;
          course_id: string;
          title: string;
          scheduled_at: string;
          status?: "scheduled" | "live" | "ended";
          room_name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          course_id?: string;
          title?: string;
          scheduled_at?: string;
          status?: "scheduled" | "live" | "ended";
          room_name?: string;
          created_at?: string;
        };
      };
      recordings: {
        Row: Recording;
        Insert: {
          id?: string;
          session_id: string;
          storage_path: string;
          duration_seconds?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          storage_path?: string;
          duration_seconds?: number;
          created_at?: string;
        };
      };
      watch_progress: {
        Row: WatchProgress;
        Insert: {
          id?: string;
          student_id: string;
          recording_id: string;
          last_position_seconds?: number;
          total_duration_seconds?: number;
          completed?: boolean;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          recording_id?: string;
          last_position_seconds?: number;
          total_duration_seconds?: number;
          completed?: boolean;
          updated_at?: string;
        };
      };
    };
  };
};
