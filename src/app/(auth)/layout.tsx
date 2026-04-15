import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ThemeToggle } from "@/components/auth/ThemeToggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <div className="relative min-h-screen bg-base-100">
        <ThemeToggle />
        {children}
      </div>
    </ThemeProvider>
  );
}
