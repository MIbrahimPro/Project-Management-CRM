"use client";

import { AlertTriangle } from "lucide-react";

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  const isDbError = error.message?.includes("database") || error.message?.includes("prisma");

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
      <AlertTriangle className="w-12 h-12 text-warning" />
      <div className="text-center space-y-2 max-w-md">
        <h2 className="text-xl font-bold text-base-content">
          {isDbError ? "Database Unavailable" : "Something went wrong"}
        </h2>
        <p className="text-base-content/60 text-sm">
          {isDbError
            ? "Could not reach the database. If using Supabase free tier, your project may have been paused. Check your Supabase dashboard."
            : error.message || "An unexpected error occurred."}
        </p>
      </div>
      <button className="btn btn-primary btn-sm" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
