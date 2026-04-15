import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/tokens";
import { ClientLayout } from "@/components/layout/ClientLayout";
import { getSidebarItems } from "@/config/sidebar";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = cookies();
  const accessToken = cookieStore.get("access_token")?.value;

  if (!accessToken) {
    redirect("/login");
  }

  const payload = verifyAccessToken(accessToken);

  if (!payload) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      name: true,
      role: true,
      profilePicUrl: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  const sidebarItems = getSidebarItems(user.role);

  return (
    <ClientLayout user={user} sidebarItems={sidebarItems}>
      {children}
    </ClientLayout>
  );
}
