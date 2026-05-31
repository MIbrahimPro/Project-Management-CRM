<!-- reporose:start -->
> **AI agents:** read `.reporose/map.json` for the full file map, dependency graph, and per-file descriptions. Use it as your project context before answering questions about this repo.
>
> **Note:** If you make changes to files, you can regenerate the map (and thus update file descriptions) by running `reporose analyze` again in the project root.
<!-- reporose:end -->

---

## Real-Time Updates Guideline

This project is built around **real-time updates**. All major data changes should be reflected live across clients without requiring page refreshes.

### Socket.IO Namespaces

- `/chat` - Chat messages, reactions, typing indicators
- `/presence` - User online/offline status
- `/notifications` - System notifications
- `/projects` - Project create/update/cancel events

### When to Emit Socket Events

Always emit socket events when:
1. **Creating** resources (projects, tasks, meetings, etc.)
2. **Updating** resource status (project cancelled, task completed, etc.)
3. **Deleting** resources
4. **Assigning** users to resources

### Pattern for API Routes

```typescript
import type { Server } from "socket.io";

declare global {
  var io: Server;
}

// After DB operation:
if (global.io) {
  global.io.of("/namespace").emit("event_name", { data });
}
```

### Pattern for Client Components

```typescript
import { useSocket } from "@/hooks/useSocket";

const { socket } = useSocket("/projects");

useEffect(() => {
  if (!socket) return;
  
  socket.on("project_updated", handleUpdate);
  return () => socket.off("project_updated", handleUpdate);
}, [socket]);
```

### Rule of Thumb

> **If a user action changes data that might be visible to another user, emit a socket event.**

This ensures the CRM feels responsive and collaborative across all users.

---

## Completed Tasks

### Dashboard Charts Fix (2026-05-05)
- Fixed chart colors for dark mode contrast in both `DashboardCharts.tsx` and `HrDashboardCharts.tsx`
- Updated pie/bar colors to bright hex colors: blue, purple, cyan, green, orange, pink
- Changed line stroke to bright blue (#3B82F6)
- Updated axis text and grid to gray tones (#9CA3AF, #374151) for dark mode visibility
- Updated legend text color to gray (#9CA3AF)

### Projects Page - Remove Cancel Button (2026-05-05)
- Removed the cancel project icon/button from the main projects list page
- Removed `cancellingId` state, `Ban` import, `cancelProject` function, and `showCancel` prop
- Projects can now only be archived from inside the project details (three dots menu → Archive)

### Questions - Live Updates & Sidebar Badge Fix (2026-05-05)
- Fixed API `GET /api/projects/[id]` to return `pendingApprovalCount` for all non-client roles (not just managers)
- Fixed sidebar badge formula in `layout.tsx`:
  - **Client**: shows unanswered count (approved + no answers)
  - **Manager / Developer / all non-client**: shows sum of unapproved + unanswered
- Added `question_updated` socket listener to layout for real-time badge refresh on edits
- Removed stale `user` closure bug in questions page socket handlers (refresh would silently skip when user wasn't loaded yet)
- Added optimistic state removal after deleting a question (instant UI feedback)
- All question operations now fully live: add, delete, answer, edit, approve — changes propagate to all viewers in real time

---

## Access Control Rules

- **Client**: Not part of organization, separate role
- **Admin / Project Manager**: Same access controls (treat as one)
- **Developer / Designer / HR / Accountant / Sales**: Equal access with minor variations
- **SUPERADMIN**: Future use, currently hidden/not accessible in the system
