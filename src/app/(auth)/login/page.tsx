"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Zap, Eye, EyeOff } from "lucide-react";

// Skeleton shown while useSearchParams resolves
function LoginSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-base-100 p-4">
      <div className="card w-full max-w-md bg-base-200 shadow-xl">
        <div className="card-body gap-6">
          <div className="flex justify-center">
            <Zap className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold text-base-content ml-2">DevRolin</span>
          </div>
          <div className="skeleton h-10 w-full rounded-lg" />
          <div className="skeleton h-10 w-full rounded-lg" />
          <div className="skeleton h-10 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

function LoginContent() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (res.ok) {
          window.location.href = searchParams.get("redirect") || "/dashboard";
        }
      })
      .catch(() => {});
  }, [searchParams]);

  useEffect(() => {
    const errorCode = searchParams.get("error");
    if (!errorCode) return;
    const errorMap: Record<string, string> = {
      google_timeout: "Google sign-in timed out. Please try again.",
      google_no_account: "No account found for this Google email.",
      google_denied: "Google sign-in was cancelled.",
      google_token: "Google token exchange failed.",
      google_userinfo: "Could not fetch Google profile.",
      google_csrf: "Google sign-in session expired. Please retry.",
    };
    setError(errorMap[errorCode] ?? "Authentication failed. Please try again.");
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (res.status === 429) { setError("Too many attempts. Try again in 15 minutes."); return; }
      if (res.status === 401) { setError("Invalid email or password"); return; }
      if (res.ok) {
        window.location.href = searchParams.get("redirect") || "/dashboard";
        return;
      }
      setError("Sign in failed. Please try again.");
    } catch (err: unknown) {
      const isAbort = err instanceof DOMException && err.name === "AbortError";
      setError(isAbort ? "Login request timed out." : "Could not reach server. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    try {
      const res = await fetch("/api/auth/google/init?flow=login");
      const data = await res.json();
      if (data.data?.url) window.location.href = data.data.url;
    } catch {
      setError("Failed to initialize Google login");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-100 p-4">
      <div className="card w-full max-w-md bg-base-200 shadow-xl">
        <div className="card-body gap-6">
          <div className="flex justify-center items-center">
            <Zap className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold text-base-content ml-2">DevRolin</span>
          </div>

          <h1 className="text-xl font-semibold text-center text-base-content">Welcome back</h1>

          {error && (
            <div role="alert" className="alert alert-error text-sm py-2">
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="form-control gap-1">
              <label className="label"><span className="label-text">Email</span></label>
              <input
                type="email"
                placeholder="you@example.com"
                className="input input-bordered w-full"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="form-control gap-1">
              <div className="flex justify-between items-center">
                <label className="label py-0"><span className="label-text">Password</span></label>
                <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="input input-bordered w-full pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/50 hover:text-base-content"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
              {loading && <span className="loading loading-spinner loading-sm" />}
              Sign In
            </button>
          </form>

          <div className="divider text-base-content/40 text-sm">or</div>

          <button className="btn btn-outline w-full gap-2" onClick={handleGoogleLogin}>
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginContent />
    </Suspense>
  );
}
