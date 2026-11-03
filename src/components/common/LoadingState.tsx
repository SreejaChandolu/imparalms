import React from "react";

interface LoadingStateProps {
  message?: string;
  size?: "sm" | "md" | "lg";
  fullHeight?: boolean;
}

export function LoadingState({
  message = "Loading...",
  size = "md",
  fullHeight = false,
}: LoadingStateProps) {
  const sizeClasses = {
    sm: "w-5 h-5 border-2",
    md: "w-8 h-8 border-2",
    lg: "w-12 h-12 border-3",
  };

  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center ${
        fullHeight ? "min-h-[60vh]" : ""
      }`}
      role="status"
      aria-live="polite"
    >
      <div
        className={`${sizeClasses[size]} border-white/10 border-t-[#29d9ff] rounded-full animate-spin mb-3`}
      />
      <p className="font-mono text-xs tracking-wider text-slate-400 uppercase animate-pulse">{message}</p>
      <span className="sr-only">{message}</span>
    </div>
  );
}
