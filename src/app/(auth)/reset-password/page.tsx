"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Zap, ArrowLeft, Eye, EyeOff, Check, X } from "lucide-react";

function PasswordStrength({ password }: { password: string }) {
  const checks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
  const score = Object.values(checks).filter(Boolean).length;
  const levels = ["", "Weak", "Fair", "Good", "Strong", "Very Strong"];
  const colors = ["", "bg-error", "bg-warning", "bg-warning", "bg-success", "bg-success"];

  const checkLabels: Record<string, string> = {
    length: "At least 8 characters",
    upper: "One uppercase letter",
    lower: "One lowercase letter",
    number: "One number",
    special: "One special character",
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-1 h-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`flex-1 rounded-full transition-colors ${
              i <= score ? colors[score] : "bg-base-300"
            }`}
          />
        ))}
      </div>
      {password && <p className="text-xs text-base-content/60">{levels[score]}</p>}
      <ul className="text-xs space-y-0.5">
        {Object.entries(checks).map(([k, v]) => (
          <li key={k} className={v ? "text-success" : "text-base-content/40"}>
            {v ? <Check className="w-3 h-3 inline mr-1" /> : <X className="w-3 h-3 inline mr-1" />}
            {checkLabels[k]}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetch("/api/auth/reset/check")
      .then((res) => {
        if (!res.ok) {
          router.replace("/forgot-password");
        }
      })
      .catch(() => {
        router.replace("/forgot-password");
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmPassword }),
      });

      const data = await res.json();

      if (res.status === 429) {
        setError("Too many attempts. Please try again later.");
        return;
      }

      if (res.status === 401) {
        router.replace("/forgot-password");
        return;
      }

      if (res.status === 400) {
        setError(data.error || "Password does not meet requirements");
        return;
      }

      if (res.ok) {
        window.location.href = "/dashboard";
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-100 p-4">
        <div className="card w-full max-w-md bg-base-200 shadow-xl">
          <div className="card-body gap-6">
            <div className="skeleton h-8 w-48 mx-auto" />
            <div className="skeleton h-10 w-full rounded-lg" />
            <div className="skeleton h-10 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-100 p-4">
      <div className="card w-full max-w-md bg-base-200 shadow-xl">
        <div className="card-body gap-6">
          <Link href="/forgot-password" className="btn btn-ghost btn-sm gap-1 self-start">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>

          <div className="flex justify-center">
            <Zap className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold text-base-content ml-2">DevRolin</span>
          </div>

          <h1 className="text-xl font-semibold text-center text-base-content">
            Set new password
          </h1>

          {error && (
            <div role="alert" className="alert alert-error text-sm py-2">
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="form-control gap-1">
              <label className="label">
                <span className="label-text">New password</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="input input-bordered w-full pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/50 hover:text-base-content"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <PasswordStrength password={password} />
            </div>

            <div className="form-control gap-1">
              <label className="label">
                <span className="label-text">Confirm password</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  className="input input-bordered w-full pr-10"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/50 hover:text-base-content"
                  onClick={() => setShowConfirm(!showConfirm)}
                >
                  {showConfirm ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-error mt-1">Passwords do not match</p>
              )}
            </div>

            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
              {loading && <span className="loading loading-spinner loading-sm" />}
              Reset password
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
