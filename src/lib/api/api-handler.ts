import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

type Handler = (req: NextRequest, ctx?: { params: Record<string, string> }) => Promise<NextResponse>;

export function apiHandler(handler: Handler): Handler {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json(
          { error: "Validation failed", code: "VALIDATION_ERROR", details: error.errors },
          { status: 400 }
        );
      }
      if (error instanceof Error && error.message === "FORBIDDEN") {
        return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
      }
      if (error instanceof Error && error.message === "NOT_FOUND") {
        return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
      }
      if (process.env.NODE_ENV === "development") {
        console.error("[API Handler] Unhandled error:", error);
        if (error instanceof Error) {
          console.error("[API Handler] Stack:", error.stack);
        }
      } else {
        console.error("[API Error]", error);
      }
      return NextResponse.json(
        { error: "Internal server error", code: "INTERNAL_ERROR" },
        { status: 500 }
      );
    }
  };
}

/** Throw from handlers to return 403 (narrows control flow as `never`). */
export const forbidden = (): never => {
  throw new Error("FORBIDDEN");
};

/** Throw from handlers to return 404 (narrows control flow as `never`). */
export const notFound = (): never => {
  throw new Error("NOT_FOUND");
};
