"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import dayjs from "dayjs";
import { Pin } from "lucide-react";

const StandaloneEditor = dynamic(() => import("@/components/documents/StandaloneEditor"), { ssr: false });

export default function PublicDocumentPage({ params }: { params: { token: string } }) {
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/public/docs/${params.token}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load document");
        setDoc(data.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="min-h-screen bg-base-100 flex flex-col items-center justify-center p-4">
        <div className="text-error mb-4">
          <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-base-content/60 text-center max-w-md">{error || "This document is not shared publicly."}</p>
        <a href="/" className="btn btn-primary mt-6">Return Home</a>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-base-100 text-base-content selection:bg-primary selection:text-primary-content">
        <header className="border-b border-base-300 bg-base-200/50 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-content font-bold">D</div>
              <div>
                <h1 className="text-sm font-bold truncate max-w-[200px] md:max-w-sm">{doc.title}</h1>
                <p className="text-[10px] uppercase tracking-wider opacity-50 font-bold">
                  {doc.project?.name || "Shared Document"}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase opacity-40 font-bold">Last Updated</p>
              <p className="text-xs font-medium">{dayjs(doc.updatedAt).format("MMM D, YYYY")}</p>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-8 md:py-12">
          <div className="bg-base-100 border border-base-300 rounded-2xl shadow-sm overflow-hidden min-h-[60vh] p-6 md:p-10">
            <StandaloneEditor initialContent={doc.content} readOnly={true} />
          </div>
          
          <footer className="mt-12 pb-12 text-center">
            <p className="text-xs text-base-content/30 font-medium">
              &copy; {new Date().getFullYear()} DevRolin CRM. All rights reserved.
            </p>
          </footer>
        </main>
      </div>
    </ThemeProvider>
  );
}
