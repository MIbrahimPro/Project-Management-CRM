# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DevRolin CRM is a full-stack project management and CRM application for software agencies. Built on Next.js 14 (App Router) with TypeScript strict mode, PostgreSQL via Prisma, Redis, and Socket.io.

## Commands

```bash
npm run dev               # Start dev server (ts-node server.ts + Next.js)
npm run build             # Production build
npm run start             # Production mode
npm run lint              # ESLint

npm run prisma:migrate    # Run Prisma dev migrations
npm run prisma:generate   # Regenerate Prisma client after schema changes
npm run prisma:studio     # Open Prisma Studio GUI

npm run bootstrap:users   # Upsert SUPER_ADMIN + ADMIN accounts from .env
```

## Architecture

### Entry Point & Server
`server.ts` is the entry point — it creates an HTTP server with Express + Socket.io, then passes requests to Next.js. There is no standalone `next dev`; everything goes through `server.ts`.

### Request Lifecycle
1. `src/middleware.ts` validates JWT from HttpOnly cookie, injects `x-user-id` and `x-user-role` headers
2. API route handlers read userId/role from those headers (never re-parse the token)
3. All handlers are wrapped with `src/lib/api-handler.ts`'s `apiHandler()` for consistent Zod validation, auth checks, and error responses
4. Multi-table mutations use Prisma `$transaction()`
5. Mutations call `logAction()` from `src/lib/audit.ts` for compliance logging

### Real-time Layer
Socket.io (port 3000) runs in `src/lib/socket-server.ts` with three namespaces: `/chat`, `/presence`, `/notifications`. Each namespace authenticates via the same JWT cookie as HTTP routes.

A separate Hocuspocus process (port 3001) powers collaborative document editing via Yjs.

### Authentication
- Access tokens: 30 min, HttpOnly cookie
- Refresh tokens: 7 days, HttpOnly cookie, per-device stored in Redis
- Token rotation on every refresh; grace period for network retries
- Token theft detection: reuse after grace period → invalidate all user sessions
- Google OAuth supported alongside email/password + OTP flows

### Role Hierarchy (actual Prisma UserRole enum)
`SUPER_ADMIN`, `ADMIN`, `PROJECT_MANAGER`, `DEVELOPER`, `DESIGNER`, `HR`, `ACCOUNTANT`, `SALES`, `CLIENT`

**CRITICAL**: The schema does NOT have `TEAM_LEADER`, `SENIOR_DEV`, `JUNIOR_DEV`, or `INTERN`. Earlier code incorrectly used these names. Always use the schema values above.

The `/control` route is exclusively for `SUPER_ADMIN`.

### Database
`prisma/schema.prisma` (800+ lines, 30+ tables). Key tables: `User`, `Session`, `Project`, `Milestone`, `Task`, `ChatRoom`, `Message`, `Document`, `Attendance`, `HiringRequest`, `AccountEntry`, `WorkspaceTask`.

### File Storage
Supabase Storage — private `devrolin-files` bucket. Helpers in `src/lib/supabase-storage.ts`. Files accessed via signed URLs.

### Notifications
- `GET /api/notifications` — returns `{ notifications, groups, total, page, limit }`. Groups is `Record<string, Notification[]>` keyed by "Today", "Yesterday", or "MMMM D, YYYY". Paginated (default limit 50, max 100).
- `POST /api/notifications/mark-all-read` — marks all unread for user and emits `has_unread: false` to Socket.io `/notifications` namespace.
- `GET /api/notifications/has-unread` — returns `{ hasUnread: boolean, count: number }`.
- `src/lib/notification-icons.ts` — `NOTIFICATION_ICONS` and `NOTIFICATION_COLORS` maps for all 11 `NotificationType` values.
- `src/lib/format-notification-body.tsx` — `parseNotificationBody(body)` parses `**bold**` and `[text](url)` into React nodes. File is `.tsx` (not `.ts`) because it returns JSX.

### Projects
- `GET /api/projects` — role-filtered: SUPER_ADMIN/ADMIN/PROJECT_MANAGER see all; CLIENT sees own (by `clientId`); others see projects they're a member of. Includes milestones (ordered by `order asc`), members with user info, and `client` relation directly (no N+1).
- `POST /api/projects` — managers/admins only. Creates project + milestones + members + questions in `$transaction`. Body: `{ title, description?, clientId?, requestedById?, requestId?, price?, teamMemberIds?, milestones?, questions? }`. `description` is collected for AI context only — Project model has no description field.
- `GET /api/projects/[id]` — access-checked for all roles (admin/manager always; CLIENT if `clientId` matches; others if member). Returns project + unreadMessages (via ChatRoomMember.lastReadAt) + unansweredQuestions count.
- `PATCH /api/projects/[id]` — managers/admins only. Fields: `title?`, `status?`, `price?`, `clientId?`.
- `GET /api/projects/client-requests/[id]` — single client request with client info (for form prefill).
- `POST /api/projects/requests` — CLIENT only, multipart form (`title`, `description`, `pdf?`). Creates `ClientProjectRequest`, notifies all admins/PMs.
- `GET /api/projects/client-requests` — PENDING requests with client info (batch-fetched, not N+1). Manager/admin only.
- `PATCH /api/projects/client-requests/[id]/ignore` — sets `status: "IGNORED"` (not deleted). `ClientProjectRequest.status` is a plain String field, not an enum.
- `GET /api/users/team-members` — returns users with roles TEAM_LEADER/SENIOR_DEV/JUNIOR_DEV/DESIGNER/INTERN.
- `GET /api/users/clients` — returns users with role CLIENT.
- `POST /api/ai/generate-milestones` — body: `{ title, description }`. Returns `{ data: [{ title, content }] }`.
- `POST /api/ai/generate-questions` — body: `{ title, description, milestones? }`. Returns `{ data: [{ text, partOf }] }`.
- `ProjectCard` uses `ProjectCardModel` type from `src/components/projects/ProjectCard.tsx` — extends Prisma `Project` with `milestones: Milestone[]`, `members: (ProjectMember & { user })[]`, `client: { id, name } | null`.

### Questions
- `GET /api/projects/[id]/questions` — access-checked (member, client, or manager). Clients see `isApproved: true` only. Includes `answers` (desc order with user info) and `milestone` relation.
- `POST /api/projects/[id]/questions` — non-CLIENT only. `isApproved` auto-set true for managers, false for others. Notifies managers when non-manager adds question.
- `PATCH /api/projects/[id]/questions/[qId]/approve` — manager only, sets `isApproved: true`.
- `POST /api/projects/[id]/questions/[qId]/answer` — client or manager only. All answers kept (history). Cross-notifies: client answers → notify managers; manager answers → notify client.
- `partOf` grouping: `"start"` or any non-`"milestone_N"` value → "Needed to Start" section; `"milestone_N"` → grouped under that milestone.

### Chat
- `GET /api/chat/rooms` — rooms where user is member, ?projectId filter. Includes last message + unread count via `ChatRoomMember.lastReadAt`.
- `GET /api/chat/rooms/[roomId]/messages` — cursor-based (50/page), updates `lastReadAt` on fetch, returns messages oldest-first.
- `POST /api/chat/upload` — multipart, stores in `chat-media/` path, returns path + 24hr signed URL. Max: image 10MB, video/doc 20MB, voice/gif 5MB.
- `GET /api/storage/signed-url?path=` — returns 1-hour signed URL for any storage path. Authenticated.
- `src/hooks/useSocket.ts` — module-level socket cache (one socket per namespace), exposes `{ socket, connected }`.
- `src/components/chat/ChatRoom.tsx` — full-featured reusable chat: Socket.io real-time via `/chat` namespace, typing indicators (Redis-backed via socket), reactions (built-in emoji grid — emoji-mart NOT installed), reply-to, voice recording (MediaRecorder API, 2-min max), file upload, media display. `showSenderInfo` prop controls whether sender names/avatars show (false for DMs).
- Chat room types: `project_team_group`, `project_client_manager`, `project_dm`, `general_group`, `general_dm`, `workspace_group`, `workspace_task_group`, `task_group`.
- CLIENT role: sees only `project_client_manager` room; internal team sees all project rooms with a sub-sidebar.
- Socket events emitted: `join_room`, `send_message`, `mark_read`, `typing_start`, `typing_stop`, `react`.
- Socket events received: `new_message`, `user_typing`, `user_stopped_typing`, `message_reacted`.

### General Chat
- `POST /api/chat/rooms/dm` — body: `{ targetUserId }`. Finds existing `general_dm` room between two users (checks `members.length === 2`) or creates new one. Returns room with `unreadCount: 0`.
- `GET /api/users?q=` — name search (case-insensitive), excludes self, max 20 results.
- `(app)/chat/page.tsx` — All Hands (`general_group`) pinned first, DMs sorted by last message timestamp. New DM modal with debounced user search.

### Documents
- `DocumentAccess` enum: `PRIVATE`, `INTERNAL`, `CLIENT_VIEW`, `CLIENT_EDIT`.
- `Document` model has: `id`, `projectId?`, `milestoneId?`, `title`, `content` (Yjs state as base64 String?), `access`, `docType` (String), `ownerId?`, `createdById`, `parentId?`.
- `GET /api/auth/collab-token` — returns `{ token }` (current access_token cookie value) for use with HocuspocusProvider.
- `GET /api/projects/[id]/documents` — access-filtered: managers see all; clients see CLIENT_VIEW/CLIENT_EDIT; team sees INTERNAL + own PRIVATE.
- `POST /api/projects/[id]/documents` — body: `{ title, docType?, access?, milestoneId? }`. Sets `ownerId` automatically for PRIVATE docs.
- `PATCH /api/projects/[id]/documents/[docId]` — `access` change: manager only. `title` change: manager or owner.
- `DELETE /api/projects/[id]/documents/[docId]` — manager only, `docType="requirements"` is protected.
- `hocuspocus-server.ts` (project root): `@hocuspocus/server` v2 with built-in `onAuthenticate`/`onLoadDocument`/`onStoreDocument` hooks (no extension-database package). Document name format: `project-{projectId}-doc-{docId}`. Auth uses `verifyAccessToken`. State stored as base64 in `Document.content`.
- `DocumentEditor` (`src/components/documents/DocumentEditor.tsx`) — must be `dynamic(..., { ssr: false })`. Takes `collabToken` prop. Creates `HocuspocusProvider` in `useMemo`, destroys in cleanup. Uses `useCreateBlockNote` with `collaboration` config from the start.
- `DocTree` (`src/components/documents/DocTree.tsx`) — sections: Overview (requirements), Milestones (collapsible folders), Documents (custom), Private (own PRIVATE docs, lock icon).
- `docType` values in use: `"requirements"` (system, undeletable), `"milestone_doc"`, `"custom"`.

### Project Layout (Sidebar Override Pattern)
- `ClientLayout` now exports `useSidebarOverride()` context hook and a `SidebarOverrideContext`.
- `(app)/projects/[id]/layout.tsx` is a **client component** that calls `useSidebarOverride()` on mount with `getProjectSidebarItems(id)` and clears it on unmount.
- This cleanly overrides the global sidebar without double-rendering `ClientLayout`.
- `MilestoneStatus` enum values: `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`, `BLOCKED` (not DONE/PENDING).
- `ProjectStatus` enum values: `PENDING`, `ACTIVE`, `ON_HOLD`, `COMPLETED`, `CANCELLED` (no ARCHIVED).
- `ProjectMember` has no `role` field — only `projectId`, `userId`, `joinedAt`.
- `Project` has no `description` field — only `title`, `status`, `price`, `clientId`, `requestedById`, `createdById`.
- Unread message count: via `ChatRoomMember.lastReadAt` (messages are room-based, not project-based).

### Settings Page
- `PATCH /api/users/me/settings` — accepts any combination of: `currencyPreference`, `clientColor`, `workHoursStart/End`, and all 8 notification preference booleans. Splits fields internally; uses `Promise.all` (not `$transaction`) since the two writes are independent.
- `POST /api/auth/google/disconnect` — clears `isGoogleConnected` + `googleRefreshToken`.
- `POST /api/push/subscribe` — saves Web Push subscription JSON string to `User.pushSubscription`.
- Settings page (`(app)/settings/page.tsx`): wraps inner component in `<Suspense>` (required for `useSearchParams`). `?highlight=google-connect` scrolls to and pulse-animates the Google section. Work Hours section only shown for attendance roles (not SUPER_ADMIN/CLIENT).

### Profile System
- `GET /api/users/me` — unified endpoint returning full user data + `avatarSignedUrl` (1-hour signed URL). Use this for the profile page.
- `GET /api/auth/me` — same user shape but without `avatarSignedUrl`. Used by the app layout and auth flow.
- `InlineEditField` (`src/components/ui/InlineEditField.tsx`) — reusable inline edit field (display + editing mode, Enter/Escape keys, save/cancel buttons).
- `useInlineEdit` (`src/hooks/useInlineEdit.ts`) — `saveFn` returns `Promise<{ error?: string }>`. Skips save if value unchanged. Call `syncValue(v)` to sync with external state changes.
- Avatar upload: `POST /api/users/me/avatar` (multipart), server runs `sharp` to convert to JPEG before storing. Returns `{ data: { profilePicUrl: signedUrl } }`.

### Notifications
`src/lib/notify.ts` dispatches to all three channels simultaneously: in-app (DB), Web Push (`src/lib/push.ts`), and Socket.io emission.

## Code Conventions

### UI / Styling
- **DaisyUI CSS variables only** — never hardcode colors (no `text-gray-500`, no `bg-white`). Use `bg-base-100`, `text-base-content`, `border-base-300`, `text-primary`, etc.
- Active themes: `devrolin`, `neutral-dark`, `neutral-light`, `pink`, `pale`
- Rich text uses BlockNote (open source) with Mantine styling

### API Routes
Every route must follow this pattern:
1. Auth check (userId from header)
2. Zod input validation
3. Authorization (ownership/role check)
4. Business logic execution
5. `logAction()` audit call for mutations
6. Response

Standard error codes: `AUTH_REQUIRED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT`, `SESSION_COMPROMISED`

### TypeScript
- Strict mode — no `any`, use `unknown`
- Path alias `@/*` → `src/*`
- Components: PascalCase, default exports for Next.js pages/layouts only
- Async/await exclusively (no `.then()` chains)

### Database
- Always `select: {}` explicitly — never return `passwordHash` or unnecessary fields
- Use cursor-based pagination, not offset
- Wrap multi-table writes in `$transaction()`

### Components
- Loading states: use `SkeletonCard`, `ErrorState`, `EmptyState` — never a blank screen
- Notifications: `react-hot-toast` with DaisyUI styling
- Client components follow: hooks → derived state → handlers → JSX

## Key Constraints

| Item | Limit |
|------|-------|
| Profile picture (post-crop) | 800 KB |
| Chat media | 20 MB |
| Voice note | 2 min |
| Message pagination | 50/page |
| OTP expiry | 10 min |
| Invitation expiry | 7 days |

### Accountant / Finance Module
- Roles with access: `SUPER_ADMIN`, `ADMIN`, `ACCOUNTANT`
- `GET /api/currencies/rates` — returns `{ rates: Record<string, number>, fetchedAt }`. Always includes `USD: 1`. Reads from latest `CurrencyRate` row.
- Currency cron in `server.ts` (top-level, outside `main()`): hits `frankfurter.app/latest?from=USD&to=PKR,AUD,GBP,EUR,CAD,AED`, creates a `CurrencyRate` row. Fires on startup + every 7 days via `setInterval`.
- `GET /api/accountant/entries` — filters: `type`, `category`, `projectId`, `from`, `to` (dates), `page` (50/page). Returns `{ data: [], meta: { total, page, limit, incomeTotal, expenseTotal, profit } }`. Summary uses `groupBy` on same where clause.
- `POST /api/accountant/entries` — multipart form with optional `receipt` file (stored at `receipts/`). Fields: `type`, `category`, `amountUsd`, `originalAmount?`, `originalCurrency?`, `description`, `date`, `projectId?`.
- `PATCH /api/accountant/entries/[id]` — void entry (`isVoid`, `voidReason`) or edit `description`. Cannot void an already-voided entry (409).
- `(app)/accountant/page.tsx` — currency switcher (reads user's `currencyPreference` as default), summary cards, filter bar (type/category/project/date range), paginated table with receipt link + void dropdown. `formatAmount(usd, currency, rates)` = `Intl.NumberFormat` with correct locale.

### HR Module
- HR roles with access: `SUPER_ADMIN`, `ADMIN`, `PROJECT_MANAGER`, `HR`
- `GET /api/hr/requests` — list all hiring requests with candidate counts.
- `POST /api/hr/requests` — create hiring request. Body: `{ statedRole, role, description?, publicTitle?, publicDescription?, deadline?, questions? }`.
- `GET /api/hr/requests/[id]` — full request with questions + candidates (including answers).
- `PATCH /api/hr/requests/[id]` — update status/approvals/publish. `publish: true` sets `status=OPEN` and generates `publicSlug` if none exists.
- `PATCH /api/hr/requests/[id]/candidates/[cId]` — update candidate: status, isHrRecommended, internalNotes, interviewAt.
- `GET /api/hr/attendance-alerts` — manager only. Users absent 2+ days or VERY_LATE 3+ times in last 7 days.
- `POST /api/ai/hr-recommend-candidates` — body `{ requestId }`. Sends candidates + answers to AI, scores 1-10, marks score>=7 as `AI_RECOMMENDED`. Returns ranked array.
- `GET /api/public/careers/[slug]` — public (no auth). Returns OPEN job listing with questions.
- `POST /api/public/careers/[slug]/apply` — multipart form: `name`, `email`, `phone?`, `cv?` (file, max 10MB), `captchaToken`, `answer_{questionId}`. Server-side hCaptcha verify. Dupe check by email+requestId. CV stored in `cv-files/`.
- `(app)/hr/page.tsx` — pipeline summary cards, hiring requests list, attendance alerts sidebar, new request modal.
- `(app)/hr/[id]/page.tsx` — candidate list with AI score badges, detail panel (status dropdown, internal notes, answers, CV link, publish/share buttons).
- `(public)/careers/[slug]/page.tsx` — public job page with hCaptcha. Uses `@hcaptcha/react-hcaptcha`. Deadline expiry guard. Success screen after submit.

### Meetings (Jitsi)
- `src/lib/jitsi.ts` — `generateJitsiToken(roomName, user)` signs HS256 JWT for Jitsi. Env: `JITSI_DOMAIN`, `JITSI_APP_ID`, `JITSI_APP_SECRET`.
- `POST /api/meetings/start` — body `{ title, projectId?, chatRoomId? }`. Creates `Meeting` + first `MeetingParticipant`, returns `{ meetingId, jitsiRoomId, domain, token, isModerator }`. Clients (`CLIENT` role) are blocked.
- `GET /api/meetings/[id]/join-token` — returns token for joining an existing meeting. Upserts `MeetingParticipant`. Returns 410 if `endedAt` is set.
- `src/components/meetings/JitsiMeeting.tsx` — must be `dynamic(..., { ssr: false })`. Loads Jitsi External API via script injection (`https://{domain}/external_api.js`). Fixed z-50 full-screen overlay. Props: `domain`, `roomName` (jitsiRoomId), `token`, `displayName`, `isModerator`, `onClose`. "Record" button visible only when `isModerator=true`.
- `isModerator` = `SUPER_ADMIN | ADMIN | PROJECT_MANAGER | TEAM_LEADER | SENIOR_DEV`.
- `jitsiRoomId` = `devrolin-{nanoid(12)}` — unique per meeting, used as Jitsi room name.
- "Start Meeting" button: shown on project dashboard header (non-client) and project chat header (non-client via `showMeetingButton`/`onStartMeeting` props on `ChatRoom`).

### Admin Panel (`/admin`)
- Roles with access: `SUPER_ADMIN`, `ADMIN`.
- `(app)/admin/layout.tsx` — client component using `useSidebarOverride()` to inject admin sub-sidebar (Users, Hiring Approvals).
- `(app)/admin/page.tsx` — redirects to `/admin/users`.
- `GET /api/admin/users?q=` — all users with session count, optional name/email search.
- `GET/PATCH /api/admin/users/[id]` — GET returns user with active sessions. PATCH updates `name`, `role`, `workMode`, `statedRole`, `isActive`. Non-SUPER_ADMIN cannot edit SUPER_ADMIN users.
- `DELETE /api/admin/users/[id]/sessions` — body `{ sessionId }` kills one; body `{ all: true }` kills all for user.
- `POST /api/admin/users/[id]/reset-password` — creates OTP token, sends password reset email via Resend.
- `POST /api/admin/users/create-direct` — creates user with auto-generated 16-char password, sends welcome email with credentials, creates `NotificationPreference`. Fields: `name`, `email`, `role`, `workMode`, `statedRole?`. Returns 409 on duplicate email.
- `GET /api/admin/hiring-approvals` — HiringRequests where `adminApproved=false` and `status != DRAFT`.
- `PATCH /api/admin/hiring-approvals/[id]` — body `{ adminApproved: boolean }`. Rejection sets status back to DRAFT.
- `(app)/admin/users/page.tsx` — split panel: user table (left, search, role/status badges) + detail panel (right, info grid, sessions list with kill buttons). Edit modal (name/role/workMode/statedRole). Create modal with "Create & Send Email" action.
- `(app)/admin/hiring/page.tsx` — pending requests list with Manager/HR/Admin approval chips and Approve/Reject buttons.
- `sidebar.ts` — `getAdminSidebarItems()` returns admin sub-sidebar items.

### Super Admin Panel (`/control`)
- Route group: `src/app/(super-admin)/` with layout that calls `notFound()` for non-SUPER_ADMIN.
- All `/api/super-admin/*` routes return 404 (not 403) for non-SUPER_ADMIN — checked via `x-user-role` header.
- `GET/PATCH /api/super-admin/system-config` — reads/updates `SystemConfig` rows by key.
- `GET /api/super-admin/audit-logs?action=&entity=` — last 200 logs, filterable.
- `GET /api/super-admin/sessions` — all non-expired sessions with user info. `DELETE` — body `{ sessionId }` kills one; body `{ userId }` kills all for user.
- `GET /api/super-admin/blacklist` — counts (total/active/expired) + recent `reusedOnce=true` entries (theft attempts).
- `POST /api/super-admin/push-test` — body `{ userId, title, body }` sends test push.
- `GET /api/super-admin/db-stats` — row counts via `prisma.$queryRawUnsafe` for 16 tables.
- `control/page.tsx` — tab-based single-page panel: System Config (inline edit per row), Audit Logs (filter + auto-refresh toggle every 30s), Sessions (grouped by user, kill one / kill all), Blacklist (stats + theft attempts), Push Test (user search + send), DB Stats (sorted grid).

### Check-In & Attendance
- `POST /api/attendance/check-in` — checks in for today; determines status (PRESENT/LATE/VERY_LATE) based on `workHoursStart`; creates `CheckIn` + `Attendance` in `$transaction`. Eligible roles: all except SUPER_ADMIN and CLIENT.
- `POST /api/attendance/check-out` — checks out; marks LEFT_EARLY if before `workHoursEnd`.
- `GET /api/attendance/status` — today's check-in + attendance status for current user.
- `GET /api/attendance/confirm-active?pingId=` — redirects to dashboard; updates AwayPing as responded (used from push notification URL).
- `GET /api/attendance` — paginated history (30/page); managers can pass `?userId=` to see others.
- Background jobs in `server.ts`: `awayCheckJob` (every 30 min — sends push to inactive checked-in users), `autoCheckoutJob` (every 15 min — auto-checks out if 2h past `workHoursEnd`).
- `(app)/attendance/page.tsx` — check-in/out card with duration timer, stats (days present, rate, late days), history table.

### AI Routes
- `POST /api/ai/chat` — general assistant chat (non-CLIENT only). Body: `{ messages: [{ role, content }] }`. Returns `{ data: { content } }`. Not persisted.
- `POST /api/ai/document` — document writing assistant. Body: `{ prompt, context?, type: "draft"|"improve"|"summarize"|"expand" }`.
- `POST /api/ai/hr-notes` — generates internal HR evaluation notes for a candidate. Body: `{ candidateId }`.
- `POST /api/ai/generate-milestones` — body: `{ title, description }`. Returns `{ data: [{ title, content }] }`.
- `POST /api/ai/generate-questions` — body: `{ title, description, milestones? }`. Returns `{ data: [{ text, partOf }] }`.
- `POST /api/ai/hr-recommend-candidates` — body `{ requestId }`. Scores candidates 1-10, marks score>=7 as `AI_RECOMMENDED`.

### AI Sidebar
- `src/components/ai/AISidebar.tsx` — floating `<Sparkles>` button (bottom-right, z-30). Slides in from right (framer-motion `x: 0 ↔ x: "100%"`). 360px wide on desktop, full-screen on mobile. Conversation history in React state only (not saved). "New" button clears messages. Calls `POST /api/ai/chat`. Hidden for CLIENT role. Wired into `ClientLayout`.

### Tasks
- `GET /api/tasks` — manager sees all; others see tasks they created or are assigned to. Filters: `status`, `projectId`, `workspaceId`, `mine=true`.
- `POST /api/tasks` — creates Task + `task_group` ChatRoom in `$transaction`; notifies assignees.
- `GET /api/tasks/[id]` — access check: manager, creator, or assignee.
- `PATCH /api/tasks/[id]` — fields: `status`, `title`, `description` (BlockNote JSON), `dueDate`, `assigneeIds` (replaces all + syncs chat room members).
- `GET /api/tasks/[id]/chat-room` — returns existing `task_group` room or creates on demand; upserts current user as member.
- `TaskStatus` enum: `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`, `CANCELLED`.
- `(app)/tasks/page.tsx` — list/kanban toggle; `TaskKanban` uses same `@dnd-kit` pattern as WorkspaceKanban.
- `(app)/tasks/[id]/page.tsx` — desktop: 60/40 split (details left, ChatRoom right). Mobile: tab toggle (Details | Chat). `StandaloneEditor` for description with manual Save button. Status dropdown with optimistic update.
- `src/components/tasks/TaskKanban.tsx` — `DndContext` + `useDroppable` columns + `useDraggable` cards + `DragOverlay`.

## AI Integration
Uses Groq Chat Completions API (`src/lib/ai.ts`) with task-based model routing:
- General/fast tasks: `openai/gpt-oss-20b`
- Complex planning/long chat/document/hr: `openai/gpt-oss-120b`
- Structured JSON output: `qwen/qwen3-32b`

Configured via `GROQ_API_KEY`, `GROQ_MODEL_FAST`, `GROQ_MODEL_COMPLEX`, `GROQ_MODEL_JSON`. `AI_MODEL` can be set as an optional global override.

## Required Environment Variables
`DATABASE_URL`, `REDIS_URL`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `GROQ_API_KEY`, `GROQ_MODEL_FAST`, `GROQ_MODEL_COMPLEX`, `GROQ_MODEL_JSON`, `AI_MODEL`, `HCAPTCHA_SECRET_KEY`, `NEXT_PUBLIC_HCAPTCHA_SITE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_EMAIL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_HOCUSPOCUS_WS`, `JITSI_DOMAIN`, `JITSI_APP_ID`, `JITSI_APP_SECRET`
