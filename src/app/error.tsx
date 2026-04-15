"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-base-100">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-error">Something went wrong</h1>
        <p className="text-base-content/60 text-sm max-w-md">{error.message}</p>
      </div>
      <button className="btn btn-primary" onClick={reset}>Try again</button>
    </div>
  );
}
