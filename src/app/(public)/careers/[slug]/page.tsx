"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { Briefcase, Calendar, CheckCircle2, Loader2 } from "lucide-react";

type QuestionType = "TEXT" | "LONG_TEXT" | "NUMBER" | "DATE" | "BOOLEAN" | "FILE" | "URL" | "EMAIL";
type Question = { id: string; text: string; type: QuestionType; appliesToPublicForm: boolean; required: boolean; order: number };
type Job = {
  id: string;
  statedRole: string;
  publicTitle: string | null;
  publicDescription: string | null;
  deadline: string | null;
  questions: Question[];
};

export default function CareersPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? "";
  const captchaRef = useRef<HCaptcha>(null);

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | File>>({});
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/public/careers/${slug}`)
      .then((r) => r.json())
      .then((d: { data?: Job; error?: string }) => {
        if (!d.data) {
          setNotFound(true);
        } else {
          setJob(d.data);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!job || !captchaToken) {
      setError("Please complete the captcha.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("email", email.trim());
      if (phone.trim()) fd.append("phone", phone.trim());
      if (cvFile) fd.append("cv", cvFile);
      fd.append("captchaToken", captchaToken);
      for (const [qId, answer] of Object.entries(answers)) {
        if (answer instanceof File) {
          fd.append(`answer_${qId}`, answer);
        } else {
          fd.append(`answer_${qId}`, String(answer));
        }
      }

      const res = await fetch(`/api/public/careers/${slug}/apply`, {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Submission failed. Please try again.");
        captchaRef.current?.resetCaptcha();
        setCaptchaToken(null);
      } else {
        setSubmitted(true);
      }
    } catch {
      setError("Network error. Please try again.");
      captchaRef.current?.resetCaptcha();
      setCaptchaToken(null);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !job) {
    return (
      <div className="min-h-screen bg-base-100 flex flex-col items-center justify-center gap-4 px-4">
        <Briefcase className="w-16 h-16 text-base-content/20" />
        <h1 className="text-2xl font-bold text-base-content">Position Not Found</h1>
        <p className="text-base-content/50 text-center max-w-md">
          This job listing may have closed or the link may be incorrect.
        </p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-base-100 flex flex-col items-center justify-center gap-4 px-4">
        <CheckCircle2 className="w-16 h-16 text-success" />
        <h1 className="text-2xl font-bold text-base-content">Application Submitted!</h1>
        <p className="text-base-content/60 text-center max-w-md">
          Thank you for applying for <strong>{job.publicTitle ?? job.statedRole}</strong>. We&apos;ll be in touch soon.
        </p>
      </div>
    );
  }

  const isExpired = job.deadline && new Date(job.deadline) < new Date();

  return (
    <div className="min-h-screen bg-base-100">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Briefcase className="w-5 h-5 text-primary" />
            <span className="text-sm text-primary font-medium">We&apos;re Hiring</span>
          </div>
          <h1 className="text-3xl font-bold text-base-content mb-3">
            {job.publicTitle ?? job.statedRole}
          </h1>
          {job.deadline && (
            <div className="flex items-center gap-2 text-sm text-base-content/50">
              <Calendar className="w-4 h-4" />
              <span>
                Apply by {new Date(job.deadline).toLocaleDateString()}
                {isExpired && (
                  <span className="ml-2 badge badge-error badge-sm">Closed</span>
                )}
              </span>
            </div>
          )}
          {job.publicDescription && (
            <div className="mt-4 prose prose-sm max-w-none text-base-content/80">
              <p className="whitespace-pre-wrap">{job.publicDescription}</p>
            </div>
          )}
        </div>

        {isExpired ? (
          <div className="alert alert-error">
            <span>This position is no longer accepting applications.</span>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
            <div className="card bg-base-200 shadow-sm">
              <div className="card-body gap-4">
                <h2 className="font-semibold text-base-content">Your Information</h2>

                <div className="form-control gap-1">
                  <label className="label py-0">
                    <span className="label-text">Full Name <span className="text-error">*</span></span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered bg-base-100"
                    placeholder="Jane Smith"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-control gap-1">
                  <label className="label py-0">
                    <span className="label-text">Email <span className="text-error">*</span></span>
                  </label>
                  <input
                    type="email"
                    className="input input-bordered bg-base-100"
                    placeholder="jane@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="form-control gap-1">
                  <label className="label py-0">
                    <span className="label-text">Phone (optional)</span>
                  </label>
                  <input
                    type="tel"
                    className="input input-bordered bg-base-100"
                    placeholder="+1 555 000 0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>

                <div className="form-control gap-1">
                  <label className="label py-0">
                    <span className="label-text">CV / Resume (PDF only — max 10 MB)</span>
                  </label>
                  <input
                    type="file"
                    className="file-input file-input-bordered bg-base-100 w-full"
                    accept="application/pdf,.pdf"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      if (!f) {
                        setCvFile(null);
                        return;
                      }
                      const isPdf = f.type === "application/pdf" && f.name.toLowerCase().endsWith(".pdf");
                      if (!isPdf) {
                        setError("CV must be a PDF file.");
                        e.target.value = "";
                        setCvFile(null);
                        return;
                      }
                      if (f.size > 10 * 1024 * 1024) {
                        setError("CV must be under 10 MB.");
                        e.target.value = "";
                        setCvFile(null);
                        return;
                      }
                      setError(null);
                      setCvFile(f);
                    }}
                  />
                  <span className="label-text-alt text-base-content/60 mt-1">Only PDF files are accepted.</span>
                </div>
              </div>
            </div>

            {job.questions.length > 0 && (
              <div className="card bg-base-200 shadow-sm">
                <div className="card-body gap-4">
                  <h2 className="font-semibold text-base-content">Application Questions</h2>
                  {job.questions.filter(q => q.appliesToPublicForm).map((q) => (
                    <div key={q.id} className="form-control gap-1">
                      <label className="label py-0">
                        <span className="label-text font-medium">
                          {q.text}
                          {q.required && <span className="text-error ml-1">*</span>}
                        </span>
                      </label>
                      {q.type === "LONG_TEXT" ? (
                        <textarea
                          className="textarea textarea-bordered bg-base-100 min-h-[80px]"
                          placeholder="Your answer..."
                          value={(answers[q.id] as string) ?? ""}
                          onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                          required={q.required}
                        />
                      ) : q.type === "BOOLEAN" ? (
                        <div className="flex items-center gap-6 mt-1">
                          <label className="cursor-pointer flex items-center gap-2">
                            <input type="radio" name={`q_${q.id}`} className="radio radio-primary radio-sm" required={q.required} onChange={() => setAnswers(prev => ({ ...prev, [q.id]: "true" }))} />
                            <span className="text-sm">Yes</span>
                          </label>
                          <label className="cursor-pointer flex items-center gap-2">
                            <input type="radio" name={`q_${q.id}`} className="radio radio-primary radio-sm" required={q.required} onChange={() => setAnswers(prev => ({ ...prev, [q.id]: "false" }))} />
                            <span className="text-sm">No</span>
                          </label>
                        </div>
                      ) : q.type === "FILE" ? (
                        <input
                          type="file"
                          className="file-input file-input-bordered bg-base-100 w-full"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) setAnswers((prev) => ({ ...prev, [q.id]: f }));
                            else {
                              setAnswers((prev) => {
                                const newAns = { ...prev };
                                delete newAns[q.id];
                                return newAns;
                              });
                            }
                          }}
                          required={q.required}
                        />
                      ) : (
                        <input
                          type={q.type === "NUMBER" ? "number" : q.type === "DATE" ? "date" : q.type === "EMAIL" ? "email" : q.type === "URL" ? "url" : "text"}
                          className="input input-bordered bg-base-100"
                          placeholder={q.type === "DATE" ? "" : "Your answer..."}
                          value={(answers[q.id] as string) ?? ""}
                          onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                          required={q.required}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* hCaptcha */}
            <div className="flex justify-center">
              <HCaptcha
                ref={captchaRef}
                sitekey={process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY ?? ""}
                onVerify={(token) => setCaptchaToken(token)}
                onExpire={() => setCaptchaToken(null)}
              />
            </div>

            {error && (
              <div className="alert alert-error text-sm">
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={submitting || !captchaToken}
            >
              {submitting && <span className="loading loading-spinner loading-sm" />}
              Submit Application
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
