import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

export default function UnauthorizedPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
      <ShieldAlert className="w-16 h-16 text-warning" />
      <div className="text-center space-y-2 max-w-md">
        <h1 className="text-2xl font-bold text-base-content">Access denied</h1>
        <p className="text-base-content/60 text-sm">
          You don&apos;t have permission to view this page. Contact your manager if you believe this is a mistake.
        </p>
      </div>
      <Link href="/dashboard" className="btn btn-primary btn-sm">
        Back to Dashboard
      </Link>
    </div>
  );
}
