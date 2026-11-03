import React from "react";
import { AlertCircle, RotateCcw } from "lucide-react";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  actionLabel?: string;
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  actionLabel = "Try again",
}: ErrorStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-950/20 p-8 text-center backdrop-blur-sm"
      role="alert"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 mb-3">
        <AlertCircle className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="text-base font-medium text-rose-200">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-rose-300/80">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-rose-400/30 bg-rose-500/20 px-5 py-2 text-xs font-semibold uppercase tracking-wider text-rose-200 hover:bg-rose-500/30 transition-all"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {actionLabel}
        </button>
      )}
    </div>
  );
}
