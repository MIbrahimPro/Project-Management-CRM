import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { verifyAccessToken } from "@/lib/tokens";
import { prisma } from "@/lib/prisma";
import { fetchDashboardData } from "@/lib/dashboard-data";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardClientStrip } from "@/components/dashboard/DashboardClientStrip";
import { StatsRow } from "@/components/dashboard/StatsRow";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { RoleWidgets } from "@/components/dashboard/RoleWidgets";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const cookieStore = cookies();
  const token = cookieStore.get("access_token")?.value;
  const payload = token ? verifyAccessToken(token) : null;

  if (!payload) {
    redirect("/login");
  }

  const role = z.nativeEnum(UserRole).safeParse(payload.role);
  if (!role.success) {
    redirect("/login");
  }

  const [data, profile] = await Promise.all([
    fetchDashboardData(payload.userId, role.data),
    prisma.user.findUnique({
      where: { id: payload.userId },
      select: { name: true },
    }),
  ]);

  if (!profile) {
    redirect("/login");
  }

  const roleLabel = role.data.toLowerCase().replace(/_/g, " ");

  return (
    <div className="space-y-6 p-4 lg:p-6 max-w-[1600px] mx-auto w-full">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <DashboardHeader userName={profile.name} roleLabel={roleLabel} />
        <DashboardClientStrip role={role.data} />
      </div>

      <StatsRow stats={data.stats} />

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        <RecentActivity items={data.recentActivity} />
        <RoleWidgets data={data} role={role.data} />
      </div>
    </div>
  );
}
