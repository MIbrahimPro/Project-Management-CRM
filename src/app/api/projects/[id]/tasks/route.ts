import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

/**
 * GET /api/projects/[id]/tasks
 * Returns all tasks for a specific project.
 */
export const GET = apiHandler(async (req: NextRequest, { params }) => {
  const projectId = params.id;
  
  const tasks = await prisma.task.findMany({
    where: { projectId },
    include: {
      assignees: { 
        include: { 
          user: { select: { id: true, name: true, profilePicUrl: true } } 
        } 
      },
      project: { select: { id: true, title: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ data: tasks });
});
