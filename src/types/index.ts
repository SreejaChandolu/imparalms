export * from "./database";

export interface NavItem {
  label: string;
  href: string;
  icon?: string;
  roles?: ("student" | "teacher" | "admin")[];
}

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
}
