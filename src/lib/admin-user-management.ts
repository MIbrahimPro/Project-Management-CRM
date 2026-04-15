import { NextRequest, NextResponse } from "next/server";

export const USER_MANAGEMENT_ROLES = ["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"] as const;

/**
 * Allows Super Admin, Admin, and Project Manager to access user-management APIs and `/admin/users`.
 * Returns a 403 JSON response if unauthorized, otherwise `null`.
 */
export function requireUserManagement(req: NextRequest): NextResponse | null {
  const role = req.headers.get("x-user-role") ?? "";
  if (!USER_MANAGEMENT_ROLES.includes(role as (typeof USER_MANAGEMENT_ROLES)[number])) {
    return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
  }
  return null;
}

/**
 * Project managers must not change administrator accounts (Super Admin / Admin).
 */
export function projectManagerCannotModifyUser(actorRole: string, targetUserRole: string): boolean {
  return actorRole === "PROJECT_MANAGER" && (targetUserRole === "SUPER_ADMIN" || targetUserRole === "ADMIN");
}

/**
 * Project managers cannot assign Super Admin or Admin roles.
 */
export function projectManagerCannotAssignPrivilegedRole(actorRole: string, newRole: string | undefined): boolean {
  if (actorRole !== "PROJECT_MANAGER" || newRole === undefined) return false;
  return newRole === "SUPER_ADMIN" || newRole === "ADMIN";
}
