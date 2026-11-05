"use client";

import React, { Suspense, useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getFirstNameAndInitial } from "@/lib/utils";
import {
  ArrowLeft,
  CheckCircle2,
  Filter,
  Loader2,
  Plus,
  Search,
  Shield,
  ShieldAlert,
  UserCheck,
  UserX,
  Users,
  X,
  AlertCircle,
  KeyRound,
  Mail,
  UserPlus,
} from "lucide-react";

interface ManagedUser {
  id: string;
  full_name: string;
  email: string;
  role: "student" | "teacher" | "admin";
  is_active: boolean;
  student_id: string | null;
  created_at: string;
}

function UsersManagementContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<ManagedUser[]>([]);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Create Teacher Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFullName, setNewFullName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  // Status Toggle Action
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Check URL params
  const paramAction = searchParams.get("action");
  useEffect(() => {
    if (paramAction === "new") {
      setShowCreateModal(true);
    }
  }, [paramAction]);

  // Load Users
  const loadUsersList = useCallback(async () => {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/staff");
        return;
      }
      setCurrentAdminId(user.id);

      // Attempt to load from secure server API first (includes auth emails)
      try {
        const res = await fetch("/api/admin/users");
        if (res.ok) {
          const data = await res.json();
          if (data.users) {
            setUsers(data.users);
            setLoading(false);
            return;
          }
        }
      } catch (apiErr) {
        console.warn("Could not fetch via /api/admin/users, falling back to profiles:", apiErr);
      }

      // Fallback: Direct query on profiles (with admin RLS)
      const { data: profilesData, error: profError } = await supabase
        .from("profiles")
        .select("id, full_name, role, student_id, is_active, created_at")
        .order("created_at", { ascending: false });

      if (profError) {
        console.error("Error fetching profiles directly:", profError);
      } else {
        const mapped: ManagedUser[] = (profilesData || []).map((p: any) => ({
          id: p.id,
          full_name: p.full_name || "Unnamed User",
          email: p.student_id ? `${p.student_id}@student.impara.local` : "auth user",
          role: p.role,
          is_active: p.is_active ?? true,
          student_id: p.student_id || null,
          created_at: p.created_at,
        }));
        setUsers(mapped);
      }
    } catch (err) {
      console.error("Error loading users list:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase, router]);

  useEffect(() => {
    loadUsersList();
  }, [loadUsersList]);

  // Handle Toggle Active/Inactive Status
  const handleToggleStatus = async (userItem: ManagedUser) => {
    if (userItem.id === currentAdminId) {
      setActionError("Admins cannot deactivate their own account.");
      return;
    }

    const willActivate = !userItem.is_active;
    const confirmMessage = willActivate
      ? `Are you sure you want to reactivate ${userItem.full_name}? They will be permitted to log in.`
      : `Are you sure you want to deactivate ${userItem.full_name}? They will be banned from logging in immediately.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setActionError(null);
    setActionSuccess(null);
    setTogglingUserId(userItem.id);

    try {
      const res = await fetch("/api/admin/toggle-user-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userItem.id,
          is_active: willActivate,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to update user status.");
      }

      // Optimistic update
      setUsers((prev) =>
        prev.map((u) => (u.id === userItem.id ? { ...u, is_active: willActivate } : u))
      );
      setActionSuccess(
        `Account for "${userItem.full_name}" has been ${willActivate ? "reactivated" : "deactivated"}.`
      );
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      console.error("Error toggling user active status:", err);
      setActionError(err.message || "Failed to update account status.");
    } finally {
      setTogglingUserId(null);
    }
  };

  // Handle Create Teacher Account
  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);

    if (!newFullName.trim()) {
      setCreateError("Please enter the teacher's full name.");
      return;
    }

    if (!newEmail.trim() || !newEmail.includes("@")) {
      setCreateError("Please enter a valid email address.");
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setCreateError("Temporary password must be at least 6 characters long.");
      return;
    }

    try {
      setCreating(true);

      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: newFullName.trim(),
          email: newEmail.trim(),
          password: newPassword,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to create teacher account.");
      }

      setCreateSuccess(`Teacher account created successfully for ${newEmail.trim()}!`);
      setNewFullName("");
      setNewEmail("");
      setNewPassword("");

      // Add to list or reload
      if (result.user) {
        setUsers((prev) => [
          {
            id: result.user.id,
            full_name: result.user.full_name,
            email: result.user.email,
            role: "teacher",
            is_active: true,
            student_id: null,
            created_at: result.user.created_at || new Date().toISOString(),
          },
          ...prev,
        ]);
      } else {
        loadUsersList();
      }

      setTimeout(() => {
        setShowCreateModal(false);
        setCreateSuccess(null);
      }, 2500);
    } catch (err: any) {
      console.error("Error creating teacher account:", err);
      setCreateError(err.message || "Failed to create teacher account.");
    } finally {
      setCreating(false);
    }
  };

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Role filter
      if (roleFilter !== "all" && u.role !== roleFilter) {
        return false;
      }

      // Status filter
      if (statusFilter === "active" && !u.is_active) return false;
      if (statusFilter === "inactive" && u.is_active) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = u.full_name.toLowerCase().includes(q);
        const matchesEmail = u.email.toLowerCase().includes(q);
        const matchesStudentId = u.student_id ? u.student_id.toLowerCase().includes(q) : false;
        if (!matchesName && !matchesEmail && !matchesStudentId) return false;
      }

      return true;
    });
  }, [users, roleFilter, statusFilter, searchQuery]);

  return (
    <div className="space-y-8">
      {/* Header */}
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
            <span>User Management & Access Control</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Directory of platform profiles, instant role filtering, activation controls, and faculty account provisioning.
          </p>
        </div>

        {/* Primary Action Button */}
        <button
          onClick={() => {
            setCreateError(null);
            setCreateSuccess(null);
            setShowCreateModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#29d9ff] hover:bg-cyan-300 text-slate-950 text-xs font-bold shadow-[0_0_20px_rgba(41,217,255,0.25)] transition-all self-start sm:self-auto shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Create Teacher Account</span>
        </button>
      </div>

      {/* Global Alerts */}
      {actionSuccess && (
        <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-mono flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 text-xs font-mono flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl border border-white/[0.08] bg-[#070c18] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Role Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[#04060a] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#29d9ff]"
            >
              <option value="all">All Roles ({users.length})</option>
              <option value="student">Students ({users.filter((u) => u.role === "student").length})</option>
              <option value="teacher">Teachers ({users.filter((u) => u.role === "teacher").length})</option>
              <option value="admin">Admins ({users.filter((u) => u.role === "admin").length})</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[#04060a] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#29d9ff]"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Deactivated Only</option>
            </select>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search name, email, student ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#04060a] border border-white/[0.1] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#29d9ff]"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#070c18] overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            <div className="h-6 w-48 bg-white/[0.05] rounded animate-pulse" />
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-white/[0.03] rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.04] text-slate-400 flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-white">No Users Found</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              No registered user profiles match your active search or filter criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.02] text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                  <th className="py-3.5 px-4">User</th>
                  <th className="py-3.5 px-4">Email Address</th>
                  <th className="py-3.5 px-4 text-center">Role</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4">Joined Date</th>
                  <th className="py-3.5 px-4 text-right">Access Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredUsers.map((u) => {
                  const isSelf = u.id === currentAdminId;
                  const isToggling = togglingUserId === u.id;
                  const { initial } = getFirstNameAndInitial(u.full_name, "User");

                  const dateStr = new Date(u.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });

                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-white/[0.02] transition-colors ${
                        !u.is_active ? "bg-rose-500/[0.02]" : ""
                      }`}
                    >
                      {/* Name & Initial Avatar */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border ${
                              u.role === "admin"
                                ? "bg-cyan-500/10 text-[#29d9ff] border-[#29d9ff]/30"
                                : u.role === "teacher"
                                ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/30"
                                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            }`}
                          >
                            {initial}
                          </div>
                          <div>
                            <div className="font-semibold text-white flex items-center gap-1.5">
                              <span>{u.full_name}</span>
                              {isSelf && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-[#29d9ff] border border-cyan-500/30">
                                  You
                                </span>
                              )}
                            </div>
                            {u.student_id && (
                              <div className="text-[11px] font-mono text-slate-400">
                                Code: {u.student_id}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-4 px-4 whitespace-nowrap font-mono text-slate-300">
                        {u.email}
                      </td>

                      {/* Role Badge */}
                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        {u.role === "admin" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-cyan-500/10 text-[#29d9ff] border border-[#29d9ff]/30">
                            <Shield className="w-3 h-3" />
                            <span>Admin</span>
                          </span>
                        )}
                        {u.role === "teacher" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                            <UserCheck className="w-3 h-3" />
                            <span>Teacher</span>
                          </span>
                        )}
                        {u.role === "student" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <span>Student</span>
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        {u.is_active ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <UserX className="w-3 h-3" />
                            <span>Deactivated</span>
                          </span>
                        )}
                      </td>

                      {/* Created Date */}
                      <td className="py-4 px-4 whitespace-nowrap font-mono text-slate-400">
                        {dateStr}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        {isSelf ? (
                          <span className="text-[11px] font-mono text-slate-500 italic">
                            Protected Account
                          </span>
                        ) : (
                          <button
                            onClick={() => handleToggleStatus(u)}
                            disabled={isToggling}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                              u.is_active
                                ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30 hover:border-rose-500/50"
                                : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:border-emerald-500/50"
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {isToggling ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Updating...</span>
                              </>
                            ) : u.is_active ? (
                              <>
                                <UserX className="w-3.5 h-3.5" />
                                <span>Deactivate</span>
                              </>
                            ) : (
                              <>
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>Activate</span>
                              </>
                            )}
                          </button>
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

      {/* Modal: Create Teacher Account */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/[0.12] bg-[#070c18] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-white/[0.08] flex items-start justify-between gap-4 bg-[#0a1122]">
              <div>
                <div className="text-[11px] font-mono text-[#29d9ff] uppercase tracking-wider mb-1">
                  FACULTY PROVISIONING
                </div>
                <h2 className="text-xl font-bold text-white">Create Teacher Account</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Creates an authorized faculty user with confirmed email and instructor privileges.
                </p>
              </div>

              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateTeacher} className="p-6 space-y-4">
              {createSuccess && (
                <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-mono flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{createSuccess}</span>
                </div>
              )}

              {createError && (
                <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 text-xs font-mono flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{createError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-mono text-slate-300">
                  FULL NAME & TITLE <span className="text-[#29d9ff]">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Prof. Ada Lovelace"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  disabled={creating}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#04060a] border border-white/[0.1] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#29d9ff] disabled:opacity-50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-mono text-slate-300">
                  EMAIL ADDRESS <span className="text-[#29d9ff]">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    placeholder="e.g. ada.lovelace@institution.edu"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    disabled={creating}
                    required
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-[#04060a] border border-white/[0.1] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#29d9ff] disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-mono text-slate-300">
                  TEMPORARY PASSWORD <span className="text-[#29d9ff]">*</span>
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="password"
                    placeholder="Minimum 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={creating}
                    required
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-[#04060a] border border-white/[0.1] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#29d9ff] disabled:opacity-50"
                  />
                </div>
                <p className="text-[10px] text-slate-500 font-mono">
                  The instructor can sign in at /staff using this temporary password.
                </p>
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                  className="px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-medium text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#29d9ff] hover:bg-cyan-300 text-slate-950 font-bold text-xs shadow-[0_0_15px_rgba(41,217,255,0.25)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Create Teacher</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 space-y-4">
          <div className="h-6 w-48 bg-white/[0.05] rounded animate-pulse" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-white/[0.03] rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      }
    >
      <UsersManagementContent />
    </Suspense>
  );
}
