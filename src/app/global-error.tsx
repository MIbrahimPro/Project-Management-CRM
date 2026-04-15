"use client";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html>
      <body style={{ margin: 0, fontFamily: "sans-serif", background: "#0a0a0a", color: "#fff" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: "16px" }}>
          <h1 style={{ fontSize: "24px", fontWeight: "bold", color: "#f87171" }}>Critical error</h1>
          <p style={{ color: "#9ca3af", fontSize: "14px", maxWidth: "400px", textAlign: "center" }}>{error.message}</p>
          <button
            onClick={reset}
            style={{ padding: "8px 24px", background: "#f97316", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: "600" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
