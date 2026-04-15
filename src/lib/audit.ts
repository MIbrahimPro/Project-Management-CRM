import { prisma } from "./prisma";

export async function logAction(
  userId: string | null,
  action: string,
  entity: string,
  entityId?: string,
  metadata?: Record<string, unknown> | null,
  ipAddress?: string
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId,
        metadata: metadata as unknown as Parameters<typeof prisma.auditLog.create>[0]["data"]["metadata"],
        ipAddress,
      },
    });
  } catch (error) {
    console.error("[Audit Log Error]", error);
  }
}

