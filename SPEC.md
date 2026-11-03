# Impara — Product Specification & Technical Architecture

## 1. Executive Summary & Product Overview

**Impara** is a custom Learning Management System (LMS) designed for modern online learning institutions. The platform allows students to enroll in courses, attend interactive live video classes directly inside the web application, access past class recordings in their profile, and watch recorded lectures in a secure, protected video player with granular progress tracking.

### Core Objectives
- Seamless, authenticated live learning experience embedded in Next.js using LiveKit.
- Secure, authenticated on-demand video streaming using Supabase Storage with protected signed URLs.
- Robust, tamper-proof Role-Based Access Control (RBAC) enforced at database policies and server boundary.
- Real-time video playback synchronization and completion tracking for students.

---

## 2. User Roles & Permission Model

Impara enforces a three-tier role hierarchy: `student`, `teacher`, and `admin`.

### 2.1 Role Matrix & Permissions

| Capability | Student | Teacher | Admin | Enforcement Layer |
| :--- | :---: | :---: | :---: | :--- |
| **Self-Registration (Sign Up)** | ✅ | ❌ | ❌ | Supabase Auth trigger defaults to `student` role |
| **Account Creation** | ❌ | ❌ | ✅ | Server Action / API Route restricted to Admin |
| **Manage Users & Role Assignment** | ❌ | ❌ | ✅ | Database RLS & Admin Server Actions |
| **Create & Manage Courses / Classes** | ❌ | ✅ | ✅ | Database RLS & Teacher/Admin Server Actions |
| **Host Live Video Rooms** | ❌ | ✅ (Assigned) | ✅ | LiveKit token generation policy (Server Route) |
| **Join Live Video Rooms** | ✅ (Enrolled) | ✅ | ✅ | LiveKit token generation policy (Server Route) |
| **Upload / Manage Recordings** | ❌ | ✅ | ✅ | Supabase Storage RLS + Server Action |
| **View Past Class Recordings** | ✅ (Enrolled) | ✅ | ✅ | Signed URL generator + Supabase Storage RLS |
| **Track Playback Progress** | ✅ (Personal) | ✅ (Students) | ✅ (All) | Database RLS on `watch_progress` table |

### 2.2 Security & RBAC Enforcement Rules
- **Database-Level Enforcement (PostgreSQL Row Level Security):** All database tables have RLS enabled by default. Role permissions are verified using JWT claims or lookup against the `profiles` table (`auth.uid() = profiles.id`).
- **Server Boundary Enforcement:** Every Server Action and Route Handler strictly parses the user session via Supabase Server Client, verifies identity, and asserts role authorization before performing any mutations or returning private payloads.
- **Client UI Decoupling:** Role checks in client UI components (such as hiding buttons or navigation items) are strictly for user experience and ergonomics. Security is never dependent on frontend visibility.
- **Role Elevation Guard:** Public registration flows will **always** set `role = 'student'` through an un-bypassable database trigger on `auth.users`. Only an authenticated user with `role = 'admin'` can promote an account or create `teacher`/`admin` records.

---

## 3. Technology Stack

- **Framework:** [Next.js](https://nextjs.org/) (App Router, React 19 / Server Components, Server Actions)
- **Language:** [TypeScript](https://www.typescriptlang.org/) (Strict mode enabled)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) (Utility-first responsive styling)
- **Backend & Database:** [Supabase](https://supabase.com/)
  - **PostgreSQL:** Relational data storage with Row Level Security (RLS)
  - **Auth:** Email/password authentication, session management, secure HTTP-only cookies
  - **Storage:** Private S3-compatible buckets for protected video recordings
- **Live Video Infrastructure:** [LiveKit](https://livekit.io/)
  - Real-time WebRTC live rooms embedded within the application
  - Server-side JWT token generation with role-based permissions (subscriber vs. publisher/moderator)
- **Deployment Platform:** [Vercel](https://vercel.com/) (Edge / Serverless infrastructure)
- **Icons:** [lucide-react](https://lucide.dev/) (Lightweight, accessible icon set)

---

## 4. Architecture & Folder Structure

The project follows a standard Next.js App Router structure with clean layer separation:

```
impara-lms/
├── .env.example              # Template for required environment variables (no secrets)
├── .env.local                # Local environment secrets (strictly git-ignored)
├── .gitignore                # Git ignore rules
├── package.json              # Project dependencies and run scripts
├── tsconfig.json             # TypeScript compiler configuration
├── tailwind.config.ts        # Tailwind CSS styling configuration
├── postcss.config.mjs        # PostCSS configuration
├── next.config.ts            # Next.js framework configuration
├── SPEC.md                   # Complete architectural and functional specification
└── src/
    ├── app/                  # Next.js App Router
    │   ├── layout.tsx        # Root layout with fonts, metadata, and providers
    │   ├── page.tsx          # Public landing / home page placeholder
    │   ├── globals.css       # Global styles and Tailwind base directives
    │   ├── (auth)/           # Authentication route group (login, register)
    │   ├── (dashboard)/      # Protected dashboard route group (student, teacher, admin)
    │   │   ├── student/      # Student-specific views (classes, recordings, progress)
    │   │   ├── teacher/      # Teacher-specific views (room host, class manager)
    │   │   └── admin/        # Admin-specific views (user management, system overview)
    │   └── api/              # API Route Handlers
    │       ├── auth/         # Auth callbacks
    │       └── livekit/      # LiveKit room token generation endpoints
    ├── components/           # Reusable UI & Layout Components
    │   ├── ui/               # Atomic UI primitives (Button, Input, Card, Modal, Badge)
    │   ├── common/           # Shared state displays (LoadingState, EmptyState, ErrorBoundary)
    │   ├── live/             # LiveKit video room components
    │   └── player/           # Protected video player with progress heartbeat
    ├── lib/                  # Core Utilities & SDK Clients
    │   ├── supabase/         # Supabase client helpers
    │   │   ├── client.ts     # Browser client (createBrowserClient)
    │   │   ├── server.ts     # Server client (createServerClient with cookies)
    │   │   └── middleware.ts # Session refresh and route guard helper
    │   ├── utils.ts          # Common utility functions (cn, formatters)
    │   └── constants.ts      # Application constants and configuration
    ├── types/                # TypeScript Interfaces & Database Types
    │   ├── database.ts       # Generated/manual Supabase database schema types
    │   └── index.ts          # Common shared domain types
    └── middleware.ts         # Next.js root middleware for auth token verification
```

---

## 5. Database Schema & RLS Security Design

### 5.1 Tables

1. **`profiles`**
   - `id`: UUID (Primary Key, references `auth.users.id` on delete cascade)
   - `email`: TEXT (Not null, unique)
   - `full_name`: TEXT
   - `role`: TEXT (Enum: `'student' | 'teacher' | 'admin'`, default `'student'`)
   - `created_at`: TIMESTAMPTZ (Default `now()`)
   - `updated_at`: TIMESTAMPTZ (Default `now()`)

2. **`courses`**
   - `id`: UUID (Primary Key, default `gen_random_uuid()`)
   - `title`: TEXT (Not null)
   - `description`: TEXT
   - `teacher_id`: UUID (References `profiles.id`)
   - `created_at`: TIMESTAMPTZ (Default `now()`)

3. **`enrollments`**
   - `id`: UUID (Primary Key, default `gen_random_uuid()`)
   - `student_id`: UUID (References `profiles.id`)
   - `course_id`: UUID (References `courses.id`)
   - `status`: TEXT (Enum: `'active' | 'completed' | 'dropped'`)
   - `created_at`: TIMESTAMPTZ (Default `now()`)

4. **`sessions` (Live Classes)**
   - `id`: UUID (Primary Key, default `gen_random_uuid()`)
   - `course_id`: UUID (References `courses.id`)
   - `title`: TEXT (Not null)
   - `scheduled_at`: TIMESTAMPTZ (Not null)
   - `status`: TEXT (Enum: `'scheduled' | 'live' | 'ended'`)
   - `room_name`: TEXT (Unique, used for LiveKit room identifier)
   - `created_at`: TIMESTAMPTZ (Default `now()`)

5. **`recordings`**
   - `id`: UUID (Primary Key, default `gen_random_uuid()`)
   - `session_id`: UUID (References `sessions.id`)
   - `storage_path`: TEXT (Relative path in Supabase Storage private bucket)
   - `duration_seconds`: INTEGER (Total duration)
   - `created_at`: TIMESTAMPTZ (Default `now()`)

6. **`watch_progress`**
   - `id`: UUID (Primary Key, default `gen_random_uuid()`)
   - `student_id`: UUID (References `profiles.id`)
   - `recording_id`: UUID (References `recordings.id`)
   - `last_position_seconds`: INTEGER (Current playback position)
   - `total_duration_seconds`: INTEGER (Total media length)
   - `completed`: BOOLEAN (Default `false`)
   - `updated_at`: TIMESTAMPTZ (Default `now()`)

### 5.2 Row Level Security (RLS) Policies
- `profiles`:
  - Users can read their own profile: `auth.uid() = id`.
  - Teachers and Admins can view enrolled student profiles.
  - Only Admins can update roles.
- `courses` & `sessions`:
  - Enrolled students and teachers can read course and session details.
  - Only assigned teachers or admins can create/update sessions.
- `recordings`:
  - Only students enrolled in the corresponding course can read recording metadata.
- `watch_progress`:
  - Students can only insert and update their own progress rows: `auth.uid() = student_id`.
  - Teachers and Admins have read access to monitor student completion rates.

---

## 6. Live Class & Video Player Implementation Plan

### 6.1 In-App Live Classes (LiveKit)
- LiveKit provides WebRTC connectivity with adaptive bitrate and low latency.
- When an authorized user joins a scheduled session:
  - An API route validates enrollment and session state.
  - The route generates a signed LiveKit Access Token.
  - Teachers receive tokens with publishing rights (video, audio, screen share).
  - Students receive tokens with viewing rights (and opt-in audio/video when permitted by the instructor).

### 6.2 Protected Player & Progress Tracking
- Storage bucket `class-recordings` is strictly private (no public URL).
- Next.js server-side route generates short-lived signed URLs (e.g., 60-minute expiry) verified against the user's enrollment.
- The custom video player component:
  - Dispatches heartbeat pulses to record `last_position_seconds`.
  - Flags `completed = true` when playback crosses 90% completion threshold.
  - Seamlessly resumes playback from the student's previous stopping point.

---

## 7. UX & Component Guidelines

1. **State Handling:**
   - **Loading States:** Every data-fetching route or client view must include skeleton loaders or subtle spinners.
   - **Empty States:** When lists (classes, recordings, courses) are empty, render a dedicated empty component with helpful context and next action.
   - **Error States:** Every action and data-fetch boundary must handle errors gracefully with clear user-facing messages.
2. **Component Reusability:** Common UI components (buttons, badges, modals, cards, alerts) must reside in `@/components/ui` or `@/components/common` and avoid duplicate code.
3. **Dependency Discipline:** No external library may be installed without an explicit, stated reason and verification of its footprint.

---

## 8. Deployment & Environment Strategy

- **Target Platform:** Vercel (Edge / Node.js runtime).
- **Environment Isolation:**
  - Production secrets configured in Vercel project settings.
  - Local secrets stored exclusively in `.env.local` (never committed).
  - `.env.example` committed to track required variable names without real credentials.
