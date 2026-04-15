import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-base-100">
      <div className="text-center space-y-2">
        <p className="text-8xl font-black text-base-content/10">404</p>
        <h1 className="text-2xl font-bold text-base-content">Page not found</h1>
        <p className="text-base-content/50 text-sm">
          The page you&apos;re looking for doesn&apos;t exist or you don&apos;t have access.
        </p>
      </div>
      <Link href="/dashboard" className="btn btn-primary">
        Back to Dashboard
      </Link>
    </div>
  );
}
