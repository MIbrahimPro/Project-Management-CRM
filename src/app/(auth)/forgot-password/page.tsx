"use client";

import { useState } from "react";
import Link from "next/link";
import { Zap, ArrowLeft, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.status === 429) {
        setError("Too many attempts. Please try again later.");
        return;
      }

      if (res.ok) {
        setSuccess(true);
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-100 p-4">
      <div className="card w-full max-w-md bg-base-200 shadow-xl">
        <div className="card-body gap-6">
          <Link href="/login" className="btn btn-ghost btn-sm gap-1 self-start">
            <ArrowLeft className="w-4 h-4" />
            Back to login
          </Link>

          <div className="flex justify-center">
            <Zap className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold text-base-content ml-2">DevRolin</span>
          </div>

          <h1 className="text-xl font-semibold text-center text-base-content">Reset your password</h1>

          {error && (
            <div role="alert" className="alert alert-error text-sm py-2">
              <span>{error}</span>
            </div>
          )}

          {success ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center">
                <Mail className="w-8 h-8 text-success" />
              </div>
              <div>
                <p className="text-base-content font-medium">Check your email</p>
                <p className="text-sm text-base-content/60 mt-1">
                  We&apos;ve sent a 6-digit code to your email address.
                </p>
              </div>
              <Link href="/otp" className="btn btn-primary btn-sm">
                Enter verification code
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="form-control gap-1">
                <label className="label">
                  <span className="label-text">Email address</span>
                </label>
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

              <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                {loading && <span className="loading loading-spinner loading-sm" />}
                Send verification code
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
