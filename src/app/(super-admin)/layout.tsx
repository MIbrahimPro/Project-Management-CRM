import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { verifyAccessToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies();
  const token = cookieStore.get("access_token")?.value;
  const payload = token ? verifyAccessToken(token) : null;

  if (!payload || payload.role !== "SUPER_ADMIN") {
    notFound();
  }

  return <>{children}</>;
}
