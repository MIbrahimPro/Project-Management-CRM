"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Zap, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

export default function OtpPage() {
  const router = useRouter();
  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [shaking, setShaking] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    setMounted(true);
    fetch("/api/auth/otp/check")
      .then((res) => {
        if (!res.ok) {
          router.replace("/forgot-password");
        }
      })
      .catch(() => {
        router.replace("/forgot-password");
      });
  }, [router]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleChange = (index: number, value: string) => {
    if (!/^[0-9]?$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, 6);
    if (pasted.length > 0) {
      const newOtp = [...otp];
      for (let i = 0; i < 6; i++) {
        newOtp[i] = pasted[i] || "";
      }
      setOtp(newOtp);
      const focusIndex = Math.min(pasted.length, 5);
      inputRefs.current[focusIndex]?.focus();
    }
  }, [otp]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setShaking(false);

    const code = otp.join("");
    if (code.length < 6) {
      setError("Please enter all 6 digits");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: code }),
      });

      const data = await res.json();

      if (res.status === 429) {
        if (data.code === "OTP_BLOCKED") {
          setError("Too many attempts. Try again in 30 minutes.");
        } else {
          setError("Too many attempts. Please try again later.");
        }
        setShaking(true);
        setTimeout(() => setShaking(false), 600);
        return;
      }

      if (res.status === 401) {
        router.replace("/forgot-password");
        return;
      }

      if (res.status === 400) {
        setError(data.error || "Invalid or expired code");
        setShaking(true);
        setTimeout(() => setShaking(false), 600);
        return;
      }

      if (res.ok) {
        router.replace("/reset-password");
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    setResendCooldown(60);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "" }),
      });
    } catch {}
  }

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-100 p-4">
        <div className="card w-full max-w-md bg-base-200 shadow-xl">
          <div className="card-body gap-6">
            <div className="skeleton h-8 w-48 mx-auto" />
            <div className="flex justify-center gap-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="skeleton w-12 h-14 rounded-lg" />
              ))}
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
          <Link href="/forgot-password" className="btn btn-ghost btn-sm gap-1 self-start">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>

          <div className="flex justify-center">
            <Zap className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold text-base-content ml-2">DevRolin</span>
          </div>

          <h1 className="text-xl font-semibold text-center text-base-content">Verification code</h1>
          <p className="text-sm text-center text-base-content/60 -mt-4">
            Enter the 6-digit code sent to your email
          </p>

          {error && (
            <div role="alert" className="alert alert-error text-sm py-2">
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col items-center gap-6">
            <motion.div
              className="flex justify-center gap-2"
              animate={shaking ? { x: [0, -8, 8, -8, 8, 0] } : {}}
              transition={{ duration: 0.4 }}
              onPaste={handlePaste}
            >
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="input input-bordered w-12 h-14 text-center text-xl font-mono"
                  autoFocus={index === 0}
                />
              ))}
            </motion.div>

            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
              {loading && <span className="loading loading-spinner loading-sm" />}
              Verify code
            </button>
          </form>

          <div className="text-center">
            <button
              type="button"
              className="btn btn-ghost btn-sm text-primary"
              onClick={handleResend}
              disabled={resendCooldown > 0}
            >
              {resendCooldown > 0
                ? `Resend code in ${resendCooldown}s`
                : "Didn't receive a code? Resend"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
