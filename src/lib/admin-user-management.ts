import { NextRequest, NextResponse } from "next/server";

export const USER_MANAGEMENT_ROLES = ["ADMIN", "PROJECT_MANAGER", "HR"] as const;

/**
 * Allows Admin and Project Manager to access user-management APIs and `/admin/users`.
 * Returns a 403 JSON response if unauthorized, otherwise `null`.
 */
export function requireUserManagement(req: NextRequest): NextResponse | null {
  const role = req.headers.get("x-user-role") ?? "";
  if (!USER_MANAGEMENT_ROLES.includes(role as (typeof USER_MANAGEMENT_ROLES)[number])) {
    return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
  }
  return null;
}
