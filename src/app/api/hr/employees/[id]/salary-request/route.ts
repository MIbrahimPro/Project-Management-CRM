import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

const HR_ROLES = ["ADMIN", "PROJECT_MANAGER", "HR"];

const schema = z.object({
  proposedSalary: z.string().min(1),
});

export const POST = apiHandler(async (req: NextRequest, ctx) => {
  const userId = req.headers.get("x-user-id");
  const userRole = req.headers.get("x-user-role") ?? "";
  
  if (!userId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
  if (!HR_ROLES.includes(userRole)) forbidden();

  const employeeId = ctx?.params.id ?? "";
  const body = schema.parse(await req.json());

  const employee = await prisma.user.findUnique({
    where: { id: employeeId },
    select: { id: true, salary: true, name: true }
  });

  if (!employee) return NextResponse.json({ error: "Employee not found", code: "NOT_FOUND" }, { status: 404 });

  // If the requester is an ADMIN or SUPER_ADMIN, auto-approve and apply
  const isAdmin = ["ADMIN", "PROJECT_MANAGER"].includes(userRole);
  
  if (isAdmin) {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.salaryRequest.create({
        data: {
          userId: employeeId,
          requestedById: userId,
          currentSalary: employee.salary,
          proposedSalary: body.proposedSalary,
          status: "APPROVED"
        }
      });
      
      return await tx.user.update({
        where: { id: employeeId },
        data: { salary: body.proposedSalary },
        select: { id: true, salary: true }
      });
    });

    await logAction(userId, "SALARY_UPDATED", "User", employeeId, { old: employee.salary, new: body.proposedSalary });
    return NextResponse.json({ data: updated, autoApproved: true });
  }

  // Otherwise, create a pending request (HR requesting)
  const salaryReq = await prisma.salaryRequest.create({
    data: {
      userId: employeeId,
      requestedById: userId,
      currentSalary: employee.salary,
      proposedSalary: body.proposedSalary,
      status: "PENDING"
    }
  });

  await logAction(userId, "SALARY_REQUEST_CREATED", "SalaryRequest", salaryReq.id, { proposedSalary: body.proposedSalary });

  // Add notification to Admins
  const admins = await prisma.user.findMany({
    where: { role: { in: ["ADMIN"] }, isActive: true },
    select: { id: true }
  });

  if (admins.length > 0) {
    const { sendNotification } = await import("@/lib/notify");
    await Promise.all(admins.map(a => 
      sendNotification(
        a.id,
        "HIRING_UPDATE",
        "New Salary Request",
        `A salary change to ${body.proposedSalary} was requested for ${employee.name}.`,
        "/admin/users"
      )
    ));
  }

  return NextResponse.json({ data: salaryReq, autoApproved: false }, { status: 201 });
});
