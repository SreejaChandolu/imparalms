import React from "react";
import Link from "next/link";
import { FolderOpen } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#070c18]/80 p-12 text-center backdrop-blur-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#29d9ff]/10 text-[#29d9ff] border border-[#29d9ff]/20 mb-4">
        {icon || <FolderOpen className="h-6 w-6" aria-hidden="true" />}
      </div>
      <h3 className="text-base font-medium text-slate-100">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-400">{description}</p>
      {actionLabel && (
        <div className="mt-6">
          {actionHref ? (
            <Link
              href={actionHref}
              className="inline-flex items-center justify-center rounded-full bg-[#29d9ff] px-5 py-2 text-xs font-semibold uppercase tracking-wider text-[#04060a] shadow-sm hover:bg-[#29d9ff]/90 transition-all"
            >
              {actionLabel}
            </Link>
          ) : (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex items-center justify-center rounded-full bg-[#29d9ff] px-5 py-2 text-xs font-semibold uppercase tracking-wider text-[#04060a] shadow-sm hover:bg-[#29d9ff]/90 transition-all"
            >
              {actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
