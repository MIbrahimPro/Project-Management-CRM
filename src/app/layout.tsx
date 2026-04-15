import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

export const metadata: Metadata = {
  title: "DevRolin",
  description: "DevRolin Project Management CRM",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DevRolin",
  },
};

export const viewport: Viewport = {
  themeColor: "#111111",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="neutral-dark">
      <body className="min-h-screen bg-base-100 text-base-content">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
