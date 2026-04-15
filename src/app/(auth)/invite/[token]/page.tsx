"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Zap, Check, AlertCircle, UserPlus } from "lucide-react";

export default function InvitePage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inviteData, setInviteData] = useState<{
    email: string;
    role: string;
    inviterName: string;
    inviterEmail: string;
    expiresAt: string;
  } | null>(null);

  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch(`/api/invite/${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Invalid invitation");
          return;
        }
        setInviteData(data.data);
        setName(data.data.email.split("@")[0].replace(/[^a-zA-Z\s-]/g, ""));
      })
      .catch(() => {
        setError("Failed to load invitation");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  function validateName(value: string): boolean {
    if (!/^[a-zA-Z\s-]{2,50}$/.test(value)) {
      setNameError("Name must be 2-50 characters, letters, spaces, and hyphens only");
      return false;
    }
    setNameError("");
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateName(name)) return;

    setSubmitLoading(true);
    try {
      const res = await fetch("/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to accept invitation");
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setSubmitLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-100 p-4">
        <div className="card w-full max-w-md bg-base-200 shadow-xl">
          <div className="card-body gap-6">
            <div className="skeleton h-8 w-48 mx-auto" />
            <div className="skeleton h-4 w-64 mx-auto" />
            <div className="skeleton h-10 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-100 p-4">
        <div className="card w-full max-w-md bg-base-200 shadow-xl">
          <div className="card-body gap-6">
            <div className="flex justify-center">
              <Zap className="w-8 h-8 text-primary" />
              <span className="text-2xl font-bold text-base-content ml-2">DevRolin</span>
            </div>

            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-error/20 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-error" />
              </div>
              <h2 className="text-xl font-semibold text-base-content">Invitation Error</h2>
              <p className="text-sm text-base-content/60">{error}</p>
              <a href="/login" className="btn btn-primary btn-sm">
                Go to login
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-100 p-4">
        <div className="card w-full max-w-md bg-base-200 shadow-xl">
          <div className="card-body gap-6">
            <div className="flex justify-center">
              <Zap className="w-8 h-8 text-primary" />
              <span className="text-2xl font-bold text-base-content ml-2">DevRolin</span>
            </div>

            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center">
                <Check className="w-8 h-8 text-success" />
              </div>
              <h2 className="text-xl font-semibold text-base-content">Welcome aboard!</h2>
              <p className="text-sm text-base-content/60">
                Your account has been created. Redirecting to login...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-100 p-4">
      <div className="card w-full max-w-md bg-base-200 shadow-xl">
        <div className="card-body gap-6">
          <div className="flex justify-center">
            <Zap className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold text-base-content ml-2">DevRolin</span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <UserPlus className="w-10 h-10 text-primary" />
            <h1 className="text-xl font-semibold text-center text-base-content">
              You&apos;re invited!
            </h1>
            <p className="text-sm text-base-content/60 text-center">
              {inviteData?.inviterName} invited you to join DevRolin
            </p>
          </div>

          <div className="bg-base-300 rounded-lg p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-base-content/60">Email:</span>
              <span className="text-base-content font-medium">{inviteData?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-base-content/60">Role:</span>
              <span className="text-base-content font-medium capitalize">
                {inviteData?.role.toLowerCase().replace("_", " ")}
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="form-control gap-1">
              <label className="label">
                <span className="label-text">Your name</span>
              </label>
              <input
                type="text"
                placeholder="John Doe"
                className={`input input-bordered w-full ${nameError ? "input-error" : ""}`}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (nameError) validateName(e.target.value);
                }}
                required
              />
              {nameError && <p className="text-xs text-error mt-1">{nameError}</p>}
            </div>

            <button type="submit" className="btn btn-primary w-full" disabled={submitLoading}>
              {submitLoading && <span className="loading loading-spinner loading-sm" />}
              Accept invitation
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
