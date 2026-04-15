# API Route Patterns

## Standard API Route Template
```typescript
// src/app/api/[route]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

const BodySchema = z.object({
  // define your schema here
});

export const POST = apiHandler(async (req: NextRequest) => {
  // 1. Auth (userId/role already in headers from middleware)
  const userId = req.headers.get("x-user-id")!;
  const role = req.headers.get("x-user-role")!;

  // 2. Validate
  const body = BodySchema.parse(await req.json());

  // 3. Authorize (check role + ownership)
  
  // 4. Execute (use $transaction for multi-table ops)
  const result = await prisma.$transaction(async (tx) => {
    // ...
  });

  // 5. Audit
  await logAction(userId, "ACTION_NAME", "ENTITY", result.id);

  // 6. Return
  return NextResponse.json({ data: result });
});
```

## Error Codes
- AUTH_REQUIRED: not logged in
- FORBIDDEN: logged in but wrong role
- NOT_FOUND: resource does not exist
- VALIDATION_ERROR: zod schema failed
- CONFLICT: duplicate/constraint violation
- SESSION_COMPROMISED: token theft detected