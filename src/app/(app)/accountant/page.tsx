"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ExternalLink,
  Filter,
  Minus,
  Plus,
  Receipt,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

const TOAST_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--bc))" };
const TOAST_ERROR_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--er))" };

// ─── Types ──────────────────────────────────────────────────────────────────

type Entry = {
  id: string;
  type: "INCOME" | "EXPENSE";
  category: string;
  amountUsd: number;
  originalAmount: number | null;
  originalCurrency: string | null;
  description: string;
  date: string;
  projectId: string | null;
  receiptUrl: string | null;
  isVoid: boolean;
  project: { id: string; title: string } | null;
  createdBy: { id: string; name: string };
};

type Meta = {
  total: number;
  page: number;
  limit: number;
  incomeTotal: number;
  expenseTotal: number;
  profit: number;
};

type Project = { id: string; title: string };
type CurrentUser = { currencyPreference: string | null };

const CATEGORIES = [
  "SALARY", "PROJECT_PAYMENT", "HOSTING", "DOMAIN",
  "SOFTWARE", "OFFICE", "MARKETING", "MISCELLANEOUS",
] as const;

const CURRENCIES = ["USD", "PKR", "AUD", "GBP", "EUR", "CAD", "AED"] as const;

const CATEGORY_LABELS: Record<string, string> = {
  SALARY: "Salary", PROJECT_PAYMENT: "Project Payment", HOSTING: "Hosting",
  DOMAIN: "Domain", SOFTWARE: "Software", OFFICE: "Office",
  MARKETING: "Marketing", MISCELLANEOUS: "Miscellaneous",
};

// ─── Currency formatting ─────────────────────────────────────────────────────

function formatAmount(usdAmount: number, currency: string, rates: Record<string, number>): string {
  const rate = rates[currency] ?? 1;
  const converted = usdAmount * rate;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "PKR" ? 0 : 2,
  }).format(converted);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AccountantPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [rates, setRates] = useState<Record<string, number>>({ USD: 1 });
  const [preferredCurrency, setPreferredCurrency] = useState("USD");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Filters
  const [filterType, setFilterType] = useState<"" | "INCOME" | "EXPENSE">("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterProjectId, setFilterProjectId] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  // New entry modal
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<"INCOME" | "EXPENSE">("EXPENSE");
  const [form, setForm] = useState({
    category: "MISCELLANEOUS",
    amountUsd: "",
    originalAmount: "",
    originalCurrency: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
    projectId: "",
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Void modal
  const [voidTarget, setVoidTarget] = useState<Entry | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voiding, setVoiding] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  // ── Load currency rates + user prefs ──────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch("/api/currencies/rates").then((r) => r.json()),
      fetch("/api/users/me").then((r) => r.json()),
      fetch("/api/projects").then((r) => r.json()),
    ]).then(
      ([ratesRes, userRes, projRes]: [
        { data: { rates: Record<string, number> } },
        { data: CurrentUser },
        { data: { id: string; title: string }[] },
      ]) => {
        setRates(ratesRes.data?.rates ?? { USD: 1 });
        if (userRes.data?.currencyPreference) {
          setPreferredCurrency(userRes.data.currencyPreference);
        }
        setProjects(projRes.data ?? []);
      }
    ).catch(() => {});
  }, []);

  // ── Load entries ──────────────────────────────────────────────────────────
  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const params = new URLSearchParams();
    params.set("page", String(page));
    if (filterType) params.set("type", filterType);
    if (filterCategory) params.set("category", filterCategory);
    if (filterProjectId) params.set("projectId", filterProjectId);
    if (filterFrom) params.set("from", filterFrom);
    if (filterTo) params.set("to", filterTo);

    setLoading(true);
    fetch(`/api/accountant/entries?${params.toString()}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((d: { data: Entry[]; meta: Meta }) => {
        setEntries(d.data ?? []);
        setMeta(d.meta ?? null);
      })
      .catch((e) => {
        if ((e as Error).name !== "AbortError") {
          toast.error("Failed to load entries", { style: TOAST_ERROR_STYLE });
        }
      })
      .finally(() => setLoading(false));
  }, [page, filterType, filterCategory, filterProjectId, filterFrom, filterTo]);

  function resetFilters() {
    setFilterType("");
    setFilterCategory("");
    setFilterProjectId("");
    setFilterFrom("");
    setFilterTo("");
    setPage(1);
  }

  // ── Create entry ─────────────────────────────────────────────────────────
  async function createEntry() {
    if (!form.description.trim() || !form.amountUsd || !form.date) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("type", modalType);
      fd.append("category", form.category);
      fd.append("amountUsd", form.amountUsd);
      fd.append("description", form.description.trim());
      fd.append("date", form.date);
      if (form.projectId) fd.append("projectId", form.projectId);
      if (form.originalAmount) fd.append("originalAmount", form.originalAmount);
      if (form.originalCurrency) fd.append("originalCurrency", form.originalCurrency);
      if (receiptFile) fd.append("receipt", receiptFile);

      const res = await fetch("/api/accountant/entries", { method: "POST", body: fd });
      const data = (await res.json()) as { data?: Entry; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");

      toast.success("Entry added", { style: TOAST_STYLE });
      setShowModal(false);
      setForm({
        category: "MISCELLANEOUS", amountUsd: "", originalAmount: "", originalCurrency: "",
        description: "", date: new Date().toISOString().split("T")[0], projectId: "",
      });
      setReceiptFile(null);
      setPage(1);
      // Refresh entries
      const refresh = await fetch("/api/accountant/entries?page=1").then((r) => r.json()) as { data: Entry[]; meta: Meta };
      setEntries(refresh.data ?? []);
      setMeta(refresh.meta ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed", { style: TOAST_ERROR_STYLE });
    } finally {
      setSubmitting(false);
    }
  }

  // ── Void entry ───────────────────────────────────────────────────────────
  async function voidEntry() {
    if (!voidTarget) return;
    setVoiding(true);
    try {
      const res = await fetch(`/api/accountant/entries/${voidTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isVoid: true, voidReason: voidReason.trim() || undefined }),
      });
      if (!res.ok) throw new Error("Failed");
      setEntries((prev) => prev.filter((e) => e.id !== voidTarget.id));
      setVoidTarget(null);
      setVoidReason("");
      toast.success("Entry voided", { style: TOAST_STYLE });
    } catch {
      toast.error("Failed to void entry", { style: TOAST_ERROR_STYLE });
    } finally {
      setVoiding(false);
    }
  }

  const fmt = (usd: number) => formatAmount(usd, preferredCurrency, rates);
  const hasFilters = filterType || filterCategory || filterProjectId || filterFrom || filterTo;
  const totalPages = meta ? Math.ceil(meta.total / meta.limit) : 1;

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-base-content">Finance</h1>
            <p className="text-sm text-base-content/50 mt-0.5">Track income and expenses</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Currency picker */}
            <select
              className="select select-bordered select-sm bg-base-200"
              value={preferredCurrency}
              onChange={(e) => setPreferredCurrency(e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button
              className="btn btn-success btn-sm gap-2"
              onClick={() => { setModalType("INCOME"); setShowModal(true); }}
            >
              <ArrowUpRight className="w-4 h-4" />
              Income
            </button>
            <button
              className="btn btn-error btn-sm gap-2"
              onClick={() => { setModalType("EXPENSE"); setShowModal(true); }}
            >
              <ArrowDownLeft className="w-4 h-4" />
              Expense
            </button>
          </div>
        </div>

        {/* Summary cards */}
        {meta && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card bg-base-200 shadow-sm">
              <div className="card-body p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-base-content/50">Income</p>
                  <TrendingUp className="w-4 h-4 text-success" />
                </div>
                <p className="text-2xl font-bold text-success">{fmt(meta.incomeTotal)}</p>
              </div>
            </div>
            <div className="card bg-base-200 shadow-sm">
              <div className="card-body p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-base-content/50">Expenses</p>
                  <TrendingDown className="w-4 h-4 text-error" />
                </div>
                <p className="text-2xl font-bold text-error">{fmt(meta.expenseTotal)}</p>
              </div>
            </div>
            <div className="card bg-base-200 shadow-sm">
              <div className="card-body p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-base-content/50">Net Profit</p>
                  {meta.profit >= 0 ? (
                    <Plus className="w-4 h-4 text-primary" />
                  ) : (
                    <Minus className="w-4 h-4 text-error" />
                  )}
                </div>
                <p className={`text-2xl font-bold ${meta.profit >= 0 ? "text-primary" : "text-error"}`}>
                  {fmt(meta.profit)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body p-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-base-content/40 flex-shrink-0" />
              <select
                className="select select-bordered select-sm bg-base-100"
                value={filterType}
                onChange={(e) => { setFilterType(e.target.value as "" | "INCOME" | "EXPENSE"); setPage(1); }}
              >
                <option value="">All Types</option>
                <option value="INCOME">Income</option>
                <option value="EXPENSE">Expense</option>
              </select>
              <select
                className="select select-bordered select-sm bg-base-100"
                value={filterCategory}
                onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
              >
                <option value="">All Categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
              <select
                className="select select-bordered select-sm bg-base-100"
                value={filterProjectId}
                onChange={(e) => { setFilterProjectId(e.target.value); setPage(1); }}
              >
                <option value="">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
              <input
                type="date"
                className="input input-bordered input-sm bg-base-100"
                value={filterFrom}
                onChange={(e) => { setFilterFrom(e.target.value); setPage(1); }}
                placeholder="From"
              />
              <input
                type="date"
                className="input input-bordered input-sm bg-base-100"
                value={filterTo}
                onChange={(e) => { setFilterTo(e.target.value); setPage(1); }}
                placeholder="To"
              />
              {hasFilters && (
                <button className="btn btn-ghost btn-sm gap-1" onClick={resetFilters}>
                  <X className="w-3.5 h-3.5" />
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Entries table */}
        <div className="card bg-base-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-12">
              <span className="loading loading-spinner loading-md text-primary" />
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-base-content/40 gap-2">
              <Receipt className="w-10 h-10 opacity-30" />
              <p className="text-sm">No entries found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr className="text-base-content/50">
                    <th>Date</th>
                    <th>Type</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Project</th>
                    <th className="text-right">Amount</th>
                    <th>Receipt</th>
                    <th>By</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className={e.isVoid ? "opacity-40 line-through" : ""}>
                      <td className="text-xs text-base-content/60 whitespace-nowrap">
                        {new Date(e.date).toLocaleDateString()}
                      </td>
                      <td>
                        <span className={`badge badge-xs ${e.type === "INCOME" ? "badge-success" : "badge-error"}`}>
                          {e.type === "INCOME" ? (
                            <ArrowUpRight className="w-2.5 h-2.5 mr-0.5" />
                          ) : (
                            <ArrowDownLeft className="w-2.5 h-2.5 mr-0.5" />
                          )}
                          {e.type}
                        </span>
                      </td>
                      <td className="text-xs text-base-content/60">
                        {CATEGORY_LABELS[e.category] ?? e.category}
                      </td>
                      <td className="text-sm max-w-[200px] truncate">{e.description}</td>
                      <td className="text-xs text-base-content/50 truncate max-w-[100px]">
                        {e.project?.title ?? "—"}
                      </td>
                      <td className="text-right font-mono text-sm">
                        <span className={e.type === "INCOME" ? "text-success" : "text-error"}>
                          {e.type === "EXPENSE" ? "−" : "+"}
                          {fmt(Number(e.amountUsd))}
                        </span>
                        {e.originalCurrency && e.originalCurrency !== preferredCurrency && (
                          <p className="text-xs text-base-content/30">
                            {e.originalAmount} {e.originalCurrency}
                          </p>
                        )}
                      </td>
                      <td>
                        {e.receiptUrl ? (
                          <a
                            href={`/api/storage/signed-url?path=${encodeURIComponent(e.receiptUrl)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-ghost btn-xs gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-base-content/20">—</span>
                        )}
                      </td>
                      <td className="text-xs text-base-content/50">{e.createdBy.name}</td>
                      <td>
                        {!e.isVoid && (
                          <div className="dropdown dropdown-end">
                            <label tabIndex={0} className="btn btn-ghost btn-xs">
                              <ChevronDown className="w-3 h-3" />
                            </label>
                            <ul
                              tabIndex={0}
                              className="dropdown-content menu bg-base-200 border border-base-300 rounded-box w-32 shadow z-50"
                            >
                              <li>
                                <button
                                  className="text-error text-xs"
                                  onClick={() => { setVoidTarget(e); setVoidReason(""); }}
                                >
                                  Void
                                </button>
                              </li>
                            </ul>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2">
            <button
              className="btn btn-ghost btn-sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              ‹ Prev
            </button>
            <span className="btn btn-ghost btn-sm no-animation">
              {page} / {totalPages}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next ›
            </button>
          </div>
        )}
      </div>

      {/* ── New Entry Modal ────────────────────────────────────────────────────── */}
      <dialog className={`modal ${showModal ? "modal-open" : ""}`}>
        <div className="modal-box bg-base-200 max-w-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className={`font-bold text-lg ${modalType === "INCOME" ? "text-success" : "text-error"}`}>
              {modalType === "INCOME" ? (
                <span className="flex items-center gap-2"><ArrowUpRight className="w-5 h-5" /> Add Income</span>
              ) : (
                <span className="flex items-center gap-2"><ArrowDownLeft className="w-5 h-5" /> Add Expense</span>
              )}
            </h3>
            <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setShowModal(false)}>
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="form-control gap-1">
                <label className="label py-0"><span className="label-text">Category</span></label>
                <select
                  className="select select-bordered select-sm bg-base-100"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
              </div>
              <div className="form-control gap-1">
                <label className="label py-0"><span className="label-text">Date</span></label>
                <input
                  type="date"
                  className="input input-bordered input-sm bg-base-100"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
            </div>

            <div className="form-control gap-1">
              <label className="label py-0"><span className="label-text">Amount (USD)</span></label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="input input-bordered bg-base-100"
                placeholder="0.00"
                value={form.amountUsd}
                onChange={(e) => setForm((f) => ({ ...f, amountUsd: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="form-control gap-1">
                <label className="label py-0"><span className="label-text">Original Amount</span></label>
                <input
                  type="number"
                  step="0.01"
                  className="input input-bordered input-sm bg-base-100"
                  placeholder="Optional"
                  value={form.originalAmount}
                  onChange={(e) => setForm((f) => ({ ...f, originalAmount: e.target.value }))}
                />
              </div>
              <div className="form-control gap-1">
                <label className="label py-0"><span className="label-text">Currency</span></label>
                <select
                  className="select select-bordered select-sm bg-base-100"
                  value={form.originalCurrency}
                  onChange={(e) => setForm((f) => ({ ...f, originalCurrency: e.target.value }))}
                >
                  <option value="">USD (default)</option>
                  {CURRENCIES.filter((c) => c !== "USD").map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-control gap-1">
              <label className="label py-0"><span className="label-text">Description</span></label>
              <input
                type="text"
                className="input input-bordered bg-base-100"
                placeholder="What is this for?"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="form-control gap-1">
              <label className="label py-0"><span className="label-text">Project (optional)</span></label>
              <select
                className="select select-bordered select-sm bg-base-100"
                value={form.projectId}
                onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
              >
                <option value="">None</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>

            <div className="form-control gap-1">
              <label className="label py-0"><span className="label-text">Receipt (optional)</span></label>
              <input
                type="file"
                className="file-input file-input-bordered file-input-sm bg-base-100 w-full"
                accept="image/*,.pdf"
                onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          <div className="modal-action">
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
            <button
              className={`btn ${modalType === "INCOME" ? "btn-success" : "btn-error"}`}
              onClick={() => void createEntry()}
              disabled={submitting || !form.amountUsd || !form.description.trim()}
            >
              {submitting && <span className="loading loading-spinner loading-sm" />}
              Add {modalType === "INCOME" ? "Income" : "Expense"}
            </button>
          </div>
        </div>
        <div className="modal-backdrop" onClick={() => setShowModal(false)} />
      </dialog>

      {/* ── Void Confirmation Modal ───────────────────────────────────────────── */}
      <dialog className={`modal ${voidTarget ? "modal-open" : ""}`}>
        <div className="modal-box bg-base-200 max-w-sm">
          <h3 className="font-bold text-base-content mb-3">Void Entry?</h3>
          <p className="text-sm text-base-content/60 mb-3">
            Voiding <strong>{voidTarget?.description}</strong> cannot be undone.
            The record will remain but marked as void.
          </p>
          <div className="form-control gap-1">
            <label className="label py-0"><span className="label-text">Reason (optional)</span></label>
            <input
              type="text"
              className="input input-bordered bg-base-100"
              placeholder="Why are you voiding this?"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              autoFocus
            />
          </div>
          <div className="modal-action">
            <button className="btn btn-ghost" onClick={() => setVoidTarget(null)}>Cancel</button>
            <button
              className="btn btn-error"
              onClick={() => void voidEntry()}
              disabled={voiding}
            >
              {voiding && <span className="loading loading-spinner loading-sm" />}
              Void Entry
            </button>
          </div>
        </div>
        <div className="modal-backdrop" onClick={() => setVoidTarget(null)} />
      </dialog>
    </>
  );
}
