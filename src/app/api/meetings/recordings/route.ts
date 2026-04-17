import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api-handler";

export const GET = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const meetingId = searchParams.get("meetingId");
  const projectId = searchParams.get("projectId");
  const workspaceId = searchParams.get("workspaceId");
  const taskId = searchParams.get("taskId");

  const recordings = await prisma.meetingRecording.findMany({
    where: {
      OR: [
        { meetingId: meetingId || undefined },
        { meeting: { projectId: projectId || undefined } },
        { meeting: { workspaceId: workspaceId || undefined } },
        { meeting: { taskId: taskId || undefined } },
      ].filter(cond => Object.values(cond)[0] !== undefined) as any,
    },
    include: {
      uploadedBy: { select: { name: true } },
      meeting: { select: { title: true } }
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: recordings });
});
