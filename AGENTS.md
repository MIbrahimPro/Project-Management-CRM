# DevRolin CRM — Agent Memory

## Project Overview
DevRolin is a full-stack CRM and project management application for a software agency.
It manages projects, clients, hiring, attendance, chat, documents, and finance.

## Tech Stack (DO NOT DEVIATE FROM THIS)
- Framework: Next.js 14, App Router, TypeScript strict mode
- Database: PostgreSQL via Prisma ORM
- Cache/Sessions: Redis (ioredis)
- File Storage: Supabase Storage
- Real-time Chat: Socket.io on custom Next.js server (server.ts)
- Collaborative Docs: Yjs + Hocuspocus (separate process, port 3001)
- Email: Resend API
- Push Notifications: Web Push API (VAPID keys, NO Firebase)
- Meetings: Self-hosted Jitsi Meet
- AI: OpenRouter — qwen/qwen3.6-plus:free
- UI: TailwindCSS + DaisyUI (ALWAYS use DaisyUI CSS variables, NEVER hardcode colors)
- Rich Text: BlockNote (open source)
- Captcha: hCaptcha (public hiring pages only)
- Exchange Rates: frankfurter.app (no API key needed)
- PWA: next-pwa

## Roles (actual Prisma UserRole enum values)
SUPER_ADMIN, ADMIN, PROJECT_MANAGER, DEVELOPER, DESIGNER, HR, ACCOUNTANT, SALES, CLIENT
CRITICAL: The schema does NOT have TEAM_LEADER, SENIOR_DEV, JUNIOR_DEV, or INTERN. All existing code that used those names is wrong and will fail at runtime. Always use the schema values above.

### Role Equivalence (as of Phase 0.2, 2026-04-17)
**`PROJECT_MANAGER` ≡ `ADMIN`** — behaviorally identical everywhere. Both labels describe the same access level; the enum distinction is cosmetic only. When adding a guard, always pair them: `["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"]`.
`SUPER_ADMIN` is the ONLY uniquely privileged role — it alone may:
- access `/control` (super-admin panel)
- edit / reset-password / kill-sessions on SUPER_ADMIN users
- assign the SUPER_ADMIN role
All other admin/management capabilities (hiring approvals, user CRUD, workspace transitions including from `PUBLISHED`, org-wide dashboard stats, creating ADMIN users, etc.) are available to Manager and Admin equally.

Helpers: `src/lib/admin-user-management.ts` exports `requireUserManagement(req)` (guards user-mgmt APIs) and `USER_MANAGEMENT_ROLES`. The old `projectManagerCannot*` helpers are gone.

## Critical Rules
1. NEVER hardcode colors — always use DaisyUI CSS variables (bg-base-100, text-primary, etc.)
2. ALWAYS use Prisma transactions ($transaction) when creating/updating multiple related entities
3. ALWAYS validate all API inputs with Zod before processing
4. ALWAYS wrap API route handlers in the apiHandler() utility (src/lib/api-handler.ts)
5. NEVER delete records — only change state (isActive, status, deletedAt fields)
6. ALWAYS log significant actions via logAction() from src/lib/audit.ts
7. ALL monetary values stored in USD in the database, converted for display only
8. DaisyUI theme data-theme attribute on <html> element — managed by ThemeProvider
9. Access tokens: 30 min expiry. Refresh tokens: 7 days. Both as HttpOnly cookies.
10. ALWAYS check user role AND resource ownership before any data mutation
11. Rate limit all auth endpoints using the rateLimiter middleware
12. TypeScript: never use `any` — use `unknown` and type guards

## File Structure
src/
  app/
    (auth)/         — unauthenticated pages (login, forgot-password, otp, reset)
    (app)/          — authenticated pages (dashboard, projects, chat, etc.)
    (public)/       — fully public pages (careers/[slug], install)
    (super-admin)/  — super admin only (/control route)
    api/            — all API routes
  components/
    layout/         — Sidebar, Navbar, ThemeProvider
    ui/             — reusable UI components (Button, Modal, etc.)
    auth/           — RoleGuard, etc.
    pwa/            — InstallPrompt, NotificationPermissionPrompt
    meetings/       — JitsiMeeting
    ai/             — AISidebar
  lib/
    redis.ts        — Redis client and helpers
    tokens.ts       — JWT generation/verification
    auth-helpers.ts — Cookie helpers
    ai.ts           — OpenRouter AI service
    push.ts         — Web Push notifications
    audit.ts        — Audit logging
    notify.ts       — Notification system (DB + Socket.io + Push)
    supabase-storage.ts
    api-handler.ts  — API route wrapper with error handling
    rate-limiter.ts — Rate limiting middleware
    work-hours.ts   — Work hours validation utilities
    currency.ts     — Currency conversion utilities
  hooks/            — React custom hooks
  middleware.ts     — Next.js middleware (auth, route protection)
  types/            — Shared TypeScript types

## Key Decisions Made
- PWA install is a SOFT prompt (not a hard gate) — hiring public pages must stay accessible
- Device security: compare User-Agent family (Mobile/Desktop/Tablet) on token refresh
- Scoring system: REMOVED. Reports use task names, counts, attendance stats instead.
- Step 3 in project creation: DOES NOT EXIST. Form has 4 steps: Details → Requirements → Milestones → Questions
- Super admin URL: /control (returns 404 to non-super-admins, never linked in UI)
- WorkspaceTask chat rooms use a separate FK (workspaceTaskId) in ChatRoom, not taskId
- All times stored as UTC in DB. Work hours (HH:MM) are local-time strings relative to user.
- Exchange rates refreshed weekly, cached in CurrencyRate table

## Current Build Status
[UPDATE THIS AS YOU BUILD — mark each prompt as DONE]
- [x] Prompt 1: Project Init — Express+Socket.io custom server created. Key files: server.ts, src/lib/prisma.ts, src/lib/api-handler.ts, src/lib/rate-limiter.ts. DaisyUI theme name is 'devrolin' (not 'dark')
- [x] Prompt 2: Schema — Complete Prisma schema with all enums, models, relations. Seed file created with SystemConfig defaults. Database synced via `prisma db push` (migrate timed out on Supabase advisory lock). All 7 SystemConfig defaults seeded.
- [x] Prompt 4: Socket Server — socket-server.ts created with /chat, /presence, /notifications namespaces, auth middleware, AI slash commands, typing indicators, reactions, presence tracking.
- [x] Prompt 5: Auth API Routes — All 12 routes verified & fixed: login, refresh (full theft detection), logout, logout-all (with Redis blacklist), forgot-password, verify-otp (dynamic block message), reset-password, change-password (rate limited, $transaction), me (single query with include), google (login/connect), google/init, google/callback (cookie forwarding for connect flow). Middleware updated with google routes in PUBLIC_ROUTES. TypeScript compiles clean.
- [x] Prompt 6: Core Application Layout — ThemeProvider, Sidebar, Navbar, ClientLayout, (app)/layout.tsx, UserAvatar, sidebar config all created. TypeScript compiles clean.
- [x] Prompt 7: Authentication Pages — All auth pages built: login (with Google), forgot-password, otp (6-digit auto-advance, paste, shake animation, resend cooldown), reset-password (with PasswordStrength indicator), invite/[token] (name validation, accept flow). Shared auth layout with ThemeToggle. OTP/reset check API routes added. TypeScript compiles clean.
- [x] Dashboard — GET `/api/dashboard` returns `{ data }` with Zod role validation; `src/lib/dashboard-data.ts` centralizes queries. `(app)/dashboard/page.tsx` server-rendered with `StatsRow`, `RoleWidgets`, `RecentActivity`, `DashboardClientStrip` (check-in + notifications link). Shared `ProjectCard`, `AvatarStack`, `StatusBadge`. Middleware forwards `x-user-id` / `x-user-role` on the **request** for RSC/API. Prisma: `Project.client`, `Project.tasks`, `Project.accountEntries`, `Task.project`, `AccountEntry.project`, `User.clientProjects`.
- [x] Bootstrap Accounts — Added `npm run bootstrap:users` (`src/scripts/bootstrap-users.js`) to upsert initial privileged users without public signup: `SUPER_ADMIN` + `ADMIN` with password hashes and active status. Supports env overrides (`SUPER_ADMIN_EMAIL/PASSWORD/NAME`, `ADMIN_EMAIL/PASSWORD/NAME`), with development defaults for first run.
- [x] Stability + Theme Polish — Removed Next metadata warning by moving `themeColor` into `viewport` export; hardened Google OAuth callback with timeout-protected fetches and graceful redirects on network failures; removed deprecated `url.parse()` usage in custom server; updated `devrolin` DaisyUI theme to neutral black/gray/white with subtle orange accents. Upserted `mibrahimpro.1@gmail.com` as active `ADMIN`.
- [x] Theme Expansion + Auth Reliability — Neutral dark changed to strict monochrome (black/white, no accent color). Added `pink` and `pale` themes while keeping legacy themes. Login UX now surfaces Google callback errors from query string and uses request timeout to avoid endless spinner. `/api/auth/login` rate-limit check now fails open on Redis slowness (prevents login hangs). Google callback internal handoff timeout increased to avoid false `google_timeout` during dev compile.
- [x] Auth Timeout Root Fix — Removed global `express.json()` from `server.ts` so Next App Router API handlers can safely read request bodies (`req.json()`) without stream conflicts. This resolves hanging `/api/auth/login` and `/api/auth/google` POST requests that caused client-side `status: 0`/timeout symptoms. Also made Google OAuth redirect URI origin-aware (`req.url` origin) and improved login UI error messaging to distinguish timeout vs network failures.
- [x] Profile Page + Self-Service Profile APIs — Full profile page rebuilt. API routes: `GET /api/users/me` (unified: user data + avatarSignedUrl in one call), `PATCH /api/users/me/name` (regex validated, logAction), `PATCH /api/users/me/phone` (nullable, logAction), `POST /api/users/me/avatar` (sharp server-side JPEG conversion, old avatar deleted, logAction), `GET /api/users/me/avatar-url` (1-hour signed URL). Components: `InlineEditField` reusable presentational component (`src/components/ui/InlineEditField.tsx`), `useInlineEdit` hook updated (return-based errors, skip-equal, `syncValue`). Page (`(app)/profile/page.tsx`): avatar hover-to-change, crop in DaisyUI modal with zoom+rotate, inline name/phone edit, shows role/workMode/statedRole/memberSince. Note: `GET /api/auth/me` also exists and returns the same user shape (without avatarSignedUrl) — used by the app layout. Do not remove it.
- [x] Auth System Debug & Hardening — Diagnosed login timeout. Issues found and fixed:
  - **Redis config** (`src/lib/redis.ts`): Added `connectTimeout: 5000`, `commandTimeout: 3000`, lowered `maxRetriesPerRequest` from 3 → 1, added `retryStrategy` (stops after 3 attempts). Changed `REDIS_URL!` to fallback `|| "redis://localhost:6379"` to prevent crash on missing env var.
  - **Prisma early failure** (`src/lib/prisma.ts`): Added `prisma.$connect().catch()` so DB connection failures crash the process immediately with a clear error instead of silently hanging later.
  - **JWT secrets guard** (`src/app/api/auth/login/route.ts`): Added early check — returns 500 with clear log if `ACCESS_TOKEN_SECRET` or `REFRESH_TOKEN_SECRET` is missing.
  - **apiHandler error visibility** (`src/lib/api-handler.ts`): Now logs full stack trace in development instead of swallowing it.
  - **notify.ts push safety**: Wrapped `sendPushNotification` in try/catch so a push failure is non-fatal.
  - **socket-server.ts Redis safety**: All `setPresence`, `updateLastActive`, `setTyping`, `clearTyping` calls wrapped in try/catch — Redis failure no longer crashes socket connections.
  - **Middleware dev logging** (`src/middleware.ts`): Added `[Middleware] METHOD /path` log in development to verify route matching.
  - **Issues confirmed already correct** (no changes needed): `bcryptjs` was already installed/imported correctly (not native `bcrypt`); cookie paths correct (`refresh_token` → `/api/auth/refresh`, `access_token` → `/`); `setAuthCookies` already used correct `res.headers.append` pattern; `/api/auth/login` already in `PUBLIC_ROUTES`; route file/export already correct.
  - **Debug endpoint** created at `src/app/api/debug/route.ts` — visit `/api/debug` to check DB/Redis connectivity and env var presence. **Delete this file after diagnosing.**
- Known working: `/api/auth/login` endpoint (POST, returns 200 + Set-Cookie headers for access_token + refresh_token)
- [x] Notifications Page (Prompt 11) — API: `GET /api/notifications` (grouped by Today/Yesterday/date, paginated), `POST /api/notifications/mark-all-read` (emits `has_unread: false` via Socket.io), `GET /api/notifications/has-unread`. Libs: `src/lib/notification-icons.ts` (icon+color map for all 11 NotificationTypes), `src/lib/format-notification-body.tsx` (parses **bold** and [link](url) syntax). Page: loads 100 at once, captures unread IDs before auto-marking-all-read, shows unread items highlighted with primary/5 bg.
- [x] Projects List Page (Prompt 12) — API: `GET /api/projects` (role-filtered: SUPER_ADMIN/ADMIN/PROJECT_MANAGER see all; CLIENT sees own; others see member projects only; client relation included directly — no N+1 loop), `GET /api/projects/client-requests` (PENDING only, batch-fetches clients), `PATCH /api/projects/client-requests/[id]/ignore`, `POST /api/projects/requests` (CLIENT only, optional PDF upload, notifies all admins/PMs). Components: StatusBadge, AvatarStack, ProjectCard already existed and are unchanged. Page: role-aware header buttons, client requests modal (manager/admin), new request modal (client), empty state with role-appropriate CTAs.
- [x] Project Creation Page (Prompt 13) — APIs: `GET /api/users/team-members` (roles: TEAM_LEADER/SENIOR_DEV/JUNIOR_DEV/DESIGNER/INTERN), `GET /api/users/clients`, `POST /api/projects` added to existing route (creates project + milestones + members + questions in $transaction, notifies team + client, marks request ACCEPTED), `POST /api/ai/generate-milestones`, `POST /api/ai/generate-questions`, `GET /api/projects/client-requests/[id]` (single request for prefill). Page: `(app)/projects/new/page.tsx` — 4-step wizard (Basic Info, Milestones, Team, Review), wrapped in Suspense for useSearchParams, DnD milestone sorting via @dnd-kit, AI generation buttons, prefill from ?requestId query param.
- [x] Project Details Layout + Dashboard (Prompt 14) — ClientLayout updated with SidebarOverrideContext + useSidebarOverride export. `(app)/projects/[id]/layout.tsx` (client component, sets project sidebar on mount, clears on unmount). `GET /api/projects/[id]` (canAccess check for all roles, returns full project with unreadMessages via ChatRoomMember.lastReadAt, unansweredQuestions count, doc/question counts). `PATCH /api/projects/[id]` (managers only, Zod validated). `(app)/projects/[id]/page.tsx` — progress bar, milestone list with status icons, quick-nav cards (chat/docs/questions/team), client + team cards.
- [x] Questions Page (Prompt 15) — APIs: `GET /api/projects/[id]/questions` (access-checked; clients see approved only; grouped by partOf), `POST /api/projects/[id]/questions` (non-CLIENT only; auto-approves for managers, pending for others; notifies managers), `PATCH /api/projects/[id]/questions/[qId]/approve`, `POST /api/projects/[id]/questions/[qId]/answer` (client + manager only; cross-notifies). Page wrapped in Suspense for useSearchParams. Questions grouped by "Needed to Start" (partOf != milestone_N) and milestone groups (partOf = "milestone_N"). ?highlight= scroll+pulse animation. History toggle for previous answers. Approve button for managers, pending badge for others.
- [x] Project Chat (Prompt 16) — APIs: `GET /api/chat/rooms` (?projectId filter, includes unread count via ChatRoomMember.lastReadAt), `GET /api/chat/rooms/[roomId]/messages` (cursor-based pagination, updates lastReadAt, oldest-first display), `POST /api/chat/upload` (multipart, max 20MB, returns signed URL), `GET /api/storage/signed-url` (1-hour URL for any storage path). Hook: `src/hooks/useSocket.ts` (module-level socket cache, one socket per namespace). Component: `src/components/chat/ChatRoom.tsx` — full-featured chat: Socket.io real-time, typing indicators, reactions (built-in emoji grid, no emoji-mart dependency), reply-to, voice recording (MediaRecorder, 2-min max), file upload, media display (image/video/audio/document). Page: CLIENT sees only project_client_manager room; team sees room list sidebar + chat panel. Mobile-responsive with back button.
- [x] General Chat (Prompt 17) — `POST /api/chat/rooms/dm` (finds existing general_dm between two users by checking members.length === 2, or creates new one). `GET /api/users?q=` (name search, excludes self, max 20). `(app)/chat/page.tsx`: All Hands room pinned first (type=general_group), DMs sorted by last message, New DM button opens user search modal with 300ms debounce.
- [x] Documents Page (Prompt 18) — `hocuspocus-server.ts` (root): uses @hocuspocus/server v2 built-in hooks (no extension-database needed), stores Yjs state as base64 in Document.content, auth via verifyAccessToken. `GET /api/auth/collab-token` returns access_token cookie value for HocuspocusProvider. Document APIs: `GET /api/projects/[id]/documents` (access-filtered: managers see all, clients see CLIENT_VIEW/EDIT, team sees INTERNAL + own PRIVATE), `POST /api/projects/[id]/documents` (title, docType, access, milestoneId), `GET/PATCH/DELETE /api/projects/[id]/documents/[docId]` (PATCH: access=manager only, title=manager or owner; DELETE: manager only, not requirements doc). Components: `DocTree.tsx` (milestone folders collapsible, private section locked, access color badges), `DocumentEditor.tsx` (HocuspocusProvider + useCreateBlockNote + BlockNoteView, loaded via dynamic import ssr:false, key=docId for remount). Page: DocTree sidebar + editor panel, inline title edit, access dropdown for managers, print button, new doc modal.
- [x] Accountant Module (Prompt 21) — Currency cron in `server.ts` (startup + weekly setInterval, hits frankfurter.app, stores in CurrencyRate table). `GET /api/currencies/rates` (returns latest rates JSON + USD=1 baseline). `GET /api/accountant/entries` (filters: type, category, projectId, from/to date, page; returns entries + summary meta {incomeTotal, expenseTotal, profit}). `POST /api/accountant/entries` (multipart: type, category, amountUsd, originalAmount, originalCurrency, description, date, projectId, receipt file → receipts/ path). `PATCH /api/accountant/entries/[id]` (isVoid, voidReason, description). Page `(app)/accountant/page.tsx`: currency switcher (USD/PKR/AUD/GBP/EUR/CAD/AED), summary cards (income/expense/profit), filter bar, paginated table with void action. `formatAmount(usdAmount, currency, rates)` uses Intl.NumberFormat. Void confirmation modal with optional reason. Roles: SUPER_ADMIN, ADMIN, ACCOUNTANT.
- [x] HR Module (Prompt 20) — APIs: `GET/POST /api/hr/requests` (HR_ROLES: SUPER_ADMIN/ADMIN/PROJECT_MANAGER/HR), `GET/PATCH /api/hr/requests/[id]` (publish: generates publicSlug via nanoid, sets status=OPEN), `PATCH /api/hr/requests/[id]/candidates/[cId]` (status, isHrRecommended, internalNotes, interviewAt), `GET /api/hr/attendance-alerts` (manager only; absent 2+ days or VERY_LATE 3+ times in last 7 days), `POST /api/ai/hr-recommend-candidates` (sends candidate answers to AI, scores 1-10, marks score>=7 as AI_RECOMMENDED), `GET /api/public/careers/[slug]` (public, no auth), `POST /api/public/careers/[slug]/apply` (multipart: name, email, phone, cv file, captchaToken, answer_{questionId}; hCaptcha server-side verify; dupe check by email; CV upload to cv-files/). Pages: `(app)/hr/page.tsx` (pipeline summary + attendance alerts + new request modal), `(app)/hr/[id]/page.tsx` (candidate list with AI ranking overlay, detail panel with status dropdown + internal notes + answer history + publish/share). Public: `(public)/careers/[slug]/page.tsx` (HCaptcha from @hcaptcha/react-hcaptcha, application form, expired deadline guard). SCHEMA FIX: Prisma UserRole enum actual values are SUPER_ADMIN/ADMIN/PROJECT_MANAGER/DEVELOPER/DESIGNER/HR/ACCOUNTANT/SALES/CLIENT — NOT TEAM_LEADER/SENIOR_DEV etc. Fixed sidebar.ts to use correct roles.
- [x] Admin Panel (Prompt 28) — Route group `(app)/admin/` with layout using `useSidebarOverride(getAdminSidebarItems())`. APIs: `GET /api/admin/users?q=` (search, includes session count), `GET/PATCH /api/admin/users/[id]` (PATCH: name/role/workMode/statedRole/isActive; blocks editing SUPER_ADMIN by non-SUPER_ADMIN), `DELETE /api/admin/users/[id]/sessions` (body: {sessionId} or {all:true}), `POST /api/admin/users/[id]/reset-password` (creates OTP, sends Resend email), `POST /api/admin/users/create-direct` (auto-password, welcome email, creates NotificationPreference), `GET /api/admin/hiring-approvals` (adminApproved=false, status!=DRAFT), `PATCH /api/admin/hiring-approvals/[id]` (approve/reject, rejection sets status=DRAFT). Pages: `admin/users/page.tsx` (split panel: user table + detail with sessions + edit modal + create modal), `admin/hiring/page.tsx` (approval cards with 3-chip status row). `sidebar.ts` exports `getAdminSidebarItems(viewerRole)`.
- [x] Admin user management for Project Manager (2026-04-14) — `PROJECT_MANAGER` sees **Admin** in main sidebar and can use `/admin/users` (list, create non-admin users, edit non-administrator accounts). `getAdminSidebarItems(role)` omits Hiring Approvals for PM; `(app)/admin/hiring/page.tsx` redirects PM to `/admin/users`. Shared guards in `src/lib/admin-user-management.ts`: user-management APIs allow PM except changes to `SUPER_ADMIN`/`ADMIN` users or assigning `ADMIN`/`SUPER_ADMIN`; hiring-approval APIs remain SUPER_ADMIN/ADMIN only.
- [x] Super Admin Panel (Prompt 27) — Route group `(super-admin)/` with layout guard (notFound for non-SUPER_ADMIN). APIs at `/api/super-admin/*` all return 404 (not 403) for non-SUPER_ADMIN via header check. Routes: `GET/PATCH /api/super-admin/system-config`, `GET /api/super-admin/audit-logs` (filter by action/entity, last 200), `GET/DELETE /api/super-admin/sessions` (DELETE body: {sessionId} or {userId}), `GET /api/super-admin/blacklist` (counts + theft attempts where reusedOnce=true), `POST /api/super-admin/push-test`, `GET /api/super-admin/db-stats` ($queryRawUnsafe row counts for 16 tables). Page `(super-admin)/control/page.tsx`: tab nav (Settings/Audit/Sessions/Blacklist/Push/DB), each section is a self-loading component, audit auto-refresh toggle (30s setInterval), sessions grouped by user with kill-all button, push test has user search.
- [x] Check-In & Attendance + AI Sidebar (Prompts 24 & 25) — Background jobs in `server.ts`: `awayCheckJob` (every 30min: finds active check-ins, checks Redis lastActive, sends push+creates AwayPing if inactive >= intervalMin, respects `prefs.awayCheck`), `autoCheckoutJob` (every 15min: checks workHoursEnd + 2h, auto-checkouts). APIs: `POST /api/attendance/check-in` (determines PRESENT/LATE/VERY_LATE from workHoursStart, $transaction: CheckIn+Attendance), `POST /api/attendance/check-out` (LEFT_EARLY if before workHoursEnd), `GET /api/attendance/status` (today's checkIn+attendance), `GET /api/attendance/confirm-active?pingId=` (redirects to /dashboard, marks AwayPing responded), `GET /api/attendance` (paginated history, managers can filter by userId). Page `(app)/attendance/page.tsx`: check-in/out card with live duration, stat cards, history table. AI routes: `POST /api/ai/chat` (general assistant, non-CLIENT, not persisted), `POST /api/ai/document` (draft/improve/summarize/expand), `POST /api/ai/hr-notes` (candidate evaluation notes). `src/components/ai/AISidebar.tsx`: framer-motion slide-in panel (360px desktop/full mobile), floating Sparkles button z-30, conversation in React state, New button clears messages, hidden for CLIENT. Wired into ClientLayout.
- [x] Workspaces / Social Media (Prompt 22) — UI: sidebar **Social Media**; list copy “social media section”; routes `/workspaces`. Board page: two horizontal sections — **Current posts** (IDEA / IN_PROGRESS / IN_REVIEW) and **Past posts** (APPROVED / PUBLISHED / ARCHIVED), equal-size `WorkspacePostCard` grid with media thumbnail, BlockNote plain-text preview, assignees, created + optional posted date. Post status rules enforced in API (`src/lib/workspace-post-status.ts`) and modal UI: primary “Change to …” + overflow menu + dustbin to archive; Super Admin/Admin may set any status; PM any except from **Published**; others restricted (tri-state freedom; only managers approve/archive; anyone may publish after approved; only admins edit after published). `WorkspaceTask`: optional `postedAt`, `thumbnailPath`; attachments via `POST …/tasks/[taskId]/media`; description debounced auto-save + **Save details** for meta.
- [x] Tasks Module (Prompt 23) — APIs: `GET /api/tasks` (role-filtered: manager sees all, others see created+assigned; filters: status, projectId, workspaceId, mine), `POST /api/tasks` ($transaction: creates Task + task_group ChatRoom, notifies assignees), `GET/PATCH /api/tasks/[id]` (access: manager/creator/assignee; PATCH fields: status, title, description, dueDate, assigneeIds—replaces all+syncs chat members), `GET /api/tasks/[id]/chat-room` (creates on demand, upserts current user as member). Components: `src/components/tasks/TaskKanban.tsx` (DnD: DndContext+useDroppable columns+useDraggable cards+DragOverlay, same pattern as WorkspaceKanban). Pages: `(app)/tasks/page.tsx` (list/kanban toggle, new task modal with assignee chips), `(app)/tasks/[id]/page.tsx` (desktop 60/40 split: details+StandaloneEditor left, ChatRoom right; mobile: Details|Chat tab toggle; status select with optimistic update; manual Save for description).
- [x] Jitsi Meetings (Prompt 19) — `src/lib/jitsi.ts`: `generateJitsiToken(roomName, user)` HS256 JWT (4h expiry, context.user affiliation=owner|member, features.recording for moderators). `POST /api/meetings/start` (non-CLIENT only; creates Meeting + first MeetingParticipant; jitsiRoomId=devrolin-{nanoid(12)}; returns {meetingId, jitsiRoomId, domain, token, isModerator}). `GET /api/meetings/[id]/join-token` (access-checked; upserts participant; 410 if endedAt set). `src/components/meetings/JitsiMeeting.tsx` (dynamic ssr:false; loads Jitsi External API via script injection; fixed z-50 full-screen overlay; End/Leave + optional Record button for moderators). Project dashboard page: "Start Meeting" btn in header (non-client); renders JitsiMeeting overlay. Project chat page: onStartMeeting prop wired to ChatRoom showMeetingButton. isModerator roles: SUPER_ADMIN, ADMIN, PROJECT_MANAGER, TEAM_LEADER, SENIOR_DEV.
- [x] Phase 4: Meetings Overhaul (2026-04-18) — Premium Jitsi SDK integration with custom prejoin (mic/video toggle), host-managed lobby (Waiting Room), and universal recording storage. Context-aware meetings for Projects, Workspaces, and Tasks with auto-chat notifications. Integrated `MeetingRecordingList` for playback across all contexts. Role-based access hardened in `join-token` and `presence` APIs.
- [x] Settings Page — Full settings page at `(app)/settings/page.tsx`. Wrapped in Suspense (required for useSearchParams). Reads `?highlight=google-connect` to scroll+pulse the Google section. Sections: Security (link to /password-change), Appearance (theme select via ThemeProvider + clientColor picker), Currency (select + save), Notifications (push permission banner + 8 toggles), Google Integration (connect/disconnect), Work Hours (attendance roles only: ADMIN, PROJECT_MANAGER, TEAM_LEADER, SENIOR_DEV, JUNIOR_DEV, DESIGNER, INTERN). API routes created: `PATCH /api/users/me/settings` (splits user fields vs notif prefs, uses Promise.all not $transaction), `POST /api/auth/google/disconnect` (clears googleRefreshToken + isGoogleConnected, logAction), `POST /api/push/subscribe` (saves push subscription JSON to User.pushSubscription). Bugs fixed vs spec: Google init response is `{ data: { url } }` not `{ url }`; Notification.permission is SSR-unsafe direct access → uses useState+useEffect; $transaction no-op queries replaced with Promise.all; role list uses schema values (TEAM_LEADER/SENIOR_DEV/etc.) not AGENTS.md values.
- [x] Auth Rate-Limit Resilience (Network + Redis) — Added `src/lib/request-ip.ts` with `getClientIp()` to parse `x-forwarded-for` safely (first hop) and fall back through `x-real-ip`/`cf-connecting-ip`/`true-client-ip`. Updated login route and shared `rateLimiter()` to use it (avoids all clients collapsing to `unknown` bucket). Hardened `checkRateLimit()` in `src/lib/redis.ts` to fail open when Redis is unavailable or returns unexpected pipeline data, preventing false `429` blocks during Redis outages. Improved Redis error logging to always print a concrete message.
- [x] Local prod-like dev — `npm run dev:prod` runs `next build` then `npm run start` (production Next + `server.ts` on port 3000) for faster UI testing; restart after changes. Use `npm run dev` when you need HMR/fast iteration on every save. `start` / `hocuspocus:start` use `cross-env` so `NODE_ENV=production` works on Windows (cmd/PowerShell).
- [x] Session refresh + Redis — `refresh_token` cookie path is `/` so middleware can rotate tokens on full page loads; `src/lib/middleware-refresh.ts` + `resolveAuth` in `middleware.ts` call `POST /api/auth/refresh` and forward merged cookies. `src/lib/redis.ts` uses `maxRetriesPerRequest: null`, longer timeouts, default `redis://127.0.0.1:6379` for stable Windows/WSL access. **Log in again once** after deploy so old path-scoped refresh cookies are replaced.
- [x] Milestone AI JSON reliability + BlockNote-ready formatting — `src/lib/ai.ts` now strips accidental `<think>...</think>`/fence output and extracts the first balanced JSON payload before parsing, preventing frequent milestone parse failures. `POST /api/ai/generate-milestones` no longer hard-caps token output (supports long requirement descriptions), defaults to lower temperature for stable structure, and now asks for 3-4 milestones by default while allowing more for complex projects. `src/app/(app)/projects/new/page.tsx` converts AI milestone content into multi-paragraph BlockNote JSON blocks (split by blank lines) instead of collapsing everything into one paragraph.
- [x] Milestone depth + rich BlockNote structure + create-time transaction timeout fix — `POST /api/ai/generate-milestones` now explicitly requests markdown-like structure (headings + bullet/numbered lists), prioritizes depth over brevity, and uses the complex Groq model for higher-quality planning output. `src/app/(app)/projects/new/page.tsx` now converts markdown-style AI output into BlockNote JSON with `heading`, `bulletListItem`, `numberedListItem`, and paragraph blocks. `POST /api/projects` moved `ensureProjectChatRooms(...)` outside the interactive Prisma transaction to prevent `P2028` timeout/closed transaction errors observed around 5s.
- [x] changes.md Full Implementation (2026-04-12) — All items from changes.md implemented:
  - **Session persistence**: `refresh/route.ts` now extends `session.expiresAt` on each refresh (sliding window).
  - **Notification bell**: Click-outside/Escape close, toggle behavior, auto mark-all-read on open, per-row Bell icon removed, clickable notifications link to their target.
  - **Chat image modal**: Images open in a lightbox modal with download button instead of new tab.
  - **CV modal**: Hiring CV opens in iframe modal instead of new tab.
  - **Chat improvements**: All employees pre-listed in sidebar (users without DM rooms shown with role), socket real-time room updates, meeting button in general chat for managers, search/filter bar.
  - **Resizable sidebars**: `ResizablePanel` component (`src/components/ui/ResizablePanel.tsx`) with localStorage persistence. Applied to chat sidebar (200-500px) and documents DocTree sidebar (180-480px). AI sidebar was already resizable.
  - **Attendance**: Auto check-in on login (localStorage date guard), navbar widget shows expected checkout time, PM ping API (`POST /api/attendance/ping`).
  - **BlockNote**: Dynamic theme from ThemeProvider (light/dark), CSS overrides using DaisyUI variables (`src/styles/blocknote-overrides.css`), collaboration cursor CSS, file upload to Supabase, export buttons (Print/PDF, Markdown, Clipboard copy).
  - **AI system**: Persistent conversations per project/task/workspace (`AIConversation` model), context gathering (milestones, tasks, docs), code block rendering in responses, no maxTokens cap, context badge in sidebar.
  - **Workspaces**: CUSTOM type added to enum, manager/admin-only creation, workspace type in creation modal.
  - **Tasks dashboard**: Tab filter (All/General/Project) on tasks page.
  - **Projects**: Custom AI prompt for milestone generation, auto Testing & QA milestone, edit team after creation (PATCH supports teamMemberIds, edit modal on dashboard).
  - **Schema**: Added `AIContext`, `AIConversation` models. Added `CUSTOM` to `WorkspaceType` enum. Added `hiringRequestId` to `ChatRoom`. Run `prisma db push` to sync.
  - **Hiring**: Chat room auto-created per hiring request. Real-time candidate application events via Socket.io.
  - **Push**: Graceful VAPID key check (no crash if env vars missing).
- [x] Auth cookie + refresh hardening (2026-04-12) — Fixed duplicate refresh-cookie edge cases and logout reliability: `setAuthCookies` now actively clears legacy `refresh_token` at `/api/auth/refresh`, `clearAuthCookies` clears both `/` and `/api/auth/refresh` paths, middleware refresh now forwards `user-agent` and `x-forwarded-for` to avoid false device-family mismatches, and logout no longer depends on `x-user-id` being present to clear session/cookies.
- [x] Auth refresh/logout resilience follow-up (2026-04-12) — Fixed refresh/logout failures during Redis disconnects by making blacklist helpers fail-open (`blacklistToken`, `getBlacklistEntry`, `markTokenReused`) so session rotation and cookie clearing still proceed. Hardened middleware refresh Set-Cookie parsing for combined header fallback to ensure rotated `access_token` is captured and forwarded. Added `/api/auth/logout` to middleware public routes so explicit logout can always clear cookies even if current access token is missing/expired.
- [x] Groq AI migration + quality upgrade (2026-04-12) — Replaced OpenRouter usage with Groq Chat Completions in `src/lib/ai.ts`, added task-based model routing (`openai/gpt-oss-20b`, `openai/gpt-oss-120b`, `qwen/qwen3-32b`), strengthened strict-JSON prompting with schema examples, removed `/api/ai/chat` message-count cap and history truncation for long conversations, and updated env/docs to `GROQ_*` variables.
- [x] Project flow overhaul (2026-04-12) — Fixed end-to-end project lifecycle gaps: project description is now persisted and shown on project dashboard; project chat rooms auto-provision and auto-sync (`project_team_group` excluding client, `project_client_manager` for client+managers); project chat UI is role-based (client/developer direct room, PM/ADMIN sidebar with both rooms); managers can change project client and fully edit/add/remove milestones after creation; milestone descriptions now use BlockNote in project creation and are mirrored with `milestone_doc` requirement documents.
- [x] BlockNote UX + project context polish (2026-04-12) — Improved BlockNote experience with safer spacing and proper floating-menu backgrounds, added custom `/ai` slash action in project documents with prompt modal insertion, added selection-level AI actions (summarize/professionalize replace), added explicit in-editor copy handling for selected text, and introduced project breadcrumbs/title context in project layout pages.
- [x] Runtime env + Jitsi compatibility fixes (2026-04-12) — Updated runtime env validation to require `GROQ_API_KEY` instead of legacy OpenRouter key, aligned debug env check to Groq, and hardened Jitsi integration for both public `meet.jit.si` and self-hosted setups by normalizing domains and making JWT optional (auto-disabled on `meet.jit.si` or missing secret). General chat meeting start now opens in-app Jitsi overlay instead of returning only a JSON response.
- [x] DocumentEditor BlockNote context (2026-04-14) — `SuggestionMenuController` in `DocumentEditor.tsx` is rendered as a **child** of `BlockNoteView` so `useBlockNoteEditor()` runs inside `BlockNoteContext` (fixes “useBlockNoteEditor was called outside of a BlockNoteContext provider” when opening project documents).
- [x] Redis + DB pool stability (2026-04-14) — `server.ts` uses shared `prisma` from `src/lib/prisma.ts` (removes duplicate `PrismaClient` that exhausted Supabase session pool / `MaxClientsInSessionMode`). `prisma.ts` appends `connection_limit`/`pool_timeout` for Supabase hosts when missing. Redis: throttled error logs, broader `reconnectOnError`, presence/typing/last-active helpers are no-throw; socket-server no longer logs stacks on every Redis blip.
- [x] Chat media / voice persistence (2026-04-14) — Media and voice notes now save via `POST /api/chat/rooms/[roomId]/messages` (shared `createNormalChatMessage` in `src/lib/chat-send-message.ts`) so the DB row is always written even when Socket.io was not ready; socket path handles media first (skips `@ai` / slash-AI branches that dropped attachments). `useSocket` keeps the client in state so `socket` is not stuck `null` until unrelated re-renders. `MessageMedia` uses `credentials: "include"` for signed URLs and shows an error if loading fails.
- [x] Profile avatars display (2026-04-14) — DB stores private storage paths (`profile-pics/...`), not browser-loadable URLs. `UserAvatar` now resolves paths via `GET /api/storage/signed-url` (credentials included); https URLs still work. Avatar upload API returns `{ profilePicUrl: storagePath, avatarSignedUrl }`. Profile page uses path-only for `UserAvatar`. Chat message bubbles use `UserAvatar` for self and others; project dashboard client/team use `UserAvatar` instead of raw `<img src={path}>`. Task/project chat pass `profilePicUrl` on `currentUser` from `/api/users/me`.

## Auth Pages (for fresh agents)
- (auth)/layout.tsx: Wraps all auth pages, centered layout, ThemeToggle fixed top-right
- login/page.tsx: Email/password + Google login, redirects if already authenticated via /api/auth/me
- forgot-password/page.tsx: Email form, shows success message regardless of email existence, form disabled after success
- otp/page.tsx: 6-digit input with auto-advance, backspace navigation, paste handler, framer-motion shake on error, 60s resend cooldown. Verifies /api/auth/otp/check on mount
- reset-password/page.tsx: Password strength indicator (5 checks), confirm password match validation. Verifies /api/auth/reset/check on mount
- invite/[token]/page.tsx: Fetches /api/invite/[token] on load, shows inviter info, name validation (letters/spaces/hyphens 2-50 chars), POST /api/invite/accept
- ThemeToggle: Fixed top-right, dropdown to cycle themes via ThemeProvider

## Auth API Routes Added
- GET /api/auth/otp/check — verifies otp_flow cookie exists and is valid JWT
- GET /api/auth/reset/check — verifies reset_flow cookie exists and is valid JWT
- GET /api/invite/[token] — returns invitation details (email, role, inviter info, expiry)

## Library API Reference (for fresh agents)

### redis.ts — All helpers
- `setSession(deviceId, data, ttlSeconds)` / `getSession(deviceId)` / `deleteSession(deviceId)` / `deleteAllUserSessions(userId, deviceIds[])`
- `blacklistToken(tokenHash, userId, gracePeriodMs, expiresInMs)` / `getBlacklistEntry(tokenHash)` / `markTokenReused(tokenHash)`
- `setPresence(userId, "online"|"away"|"offline")` / `getPresence(userId)` / `updateLastActive(userId)` / `getLastActive(userId)`
- `setTyping(roomId, userId)` / `clearTyping(roomId, userId)` / `getTypingUsers(roomId)` → string[]
- `checkRateLimit(key, maxRequests, windowSeconds)` → boolean (sliding window via sorted set)
- `incrementOtpAttempts(userId)` → number / `blockOtpUser(userId, blockMinutes)` / `isOtpBlocked(userId)` → boolean / `clearOtpAttempts(userId)`
- Key patterns: `session:{deviceId}`, `blacklist:{tokenHash}`, `presence:{userId}`, `typing:{roomId}:{userId}`, `rate:{key}`, `otp_attempts:{userId}`, `otp_blocked:{userId}`, `last_active:{userId}`

### tokens.ts
- `generateAccessToken(userId, role)` → JWT string (30 min expiry)
- `generateRefreshToken()` → random hex string (7 day expiry, stored as SHA-256 hash in DB)
- `hashToken(token)` → SHA-256 hex
- `verifyAccessToken(token)` → AccessTokenPayload | null
- `generateDeviceId()` → UUID v4
- `parseUserAgentFamily(userAgent)` → "Mobile" | "Desktop" | "Tablet"

### auth-helpers.ts
- `setAuthCookies(res, refreshToken, accessToken)` → sets HttpOnly cookies (refresh_token path=/api/auth/refresh, access_token path=/)
- `clearAuthCookies(res)` → expires both cookies
- `setFlowCookie(res, "otp_flow"|"reset_flow", value)` → 15 min TTL for auth flow state
- `clearFlowCookies(res)` → expires both flow cookies
- `getCookie(req, name)` → string | undefined

### middleware.ts
- PUBLIC_ROUTES: /login, /forgot-password, /otp, /reset-password, /invite, /careers, /install, /offline, /api/auth/*, /api/invite/*, /api/public/*
- SUPER_ADMIN_ROUTES: /control, /api/super-admin → returns 404 to non-super-admins (never linked in UI)
- Injects `x-user-id` and `x-user-role` headers for API routes
- Skips: /_next, /icons, /manifest.json, /sw.js

### ai.ts
- `callAI(messages[], { maxTokens?, temperature?, systemPrompt? })` → string
- `callAIJson<T>(messages[], options?)` → T | null (strips markdown fences, auto-parses)
- Model from env: `AI_MODEL` or `qwen/qwen3-235b-a22b:free` (can be overridden by SystemConfig)
- Graceful fallback: returns "AI is temporarily unavailable..." on errors

### audit.ts
- `logAction(userId, action, entity, entityId?, metadata?, ipAddress?)` — never throws, catches internally

### notify.ts
- `sendNotification(userId, type, title, body, linkUrl?)` — checks prefs, creates DB record, emits via Socket.io, sends push
- Socket.io namespace: `/notifications`, events: `new_notification`, `has_unread`
- Pref mapping: CHAT_MESSAGE → chatInWorkHours/chatOutWorkHours, TASK_ASSIGNED → taskAssigned, MEETING_SCHEDULED → meetingScheduled

### push.ts
- `sendPushNotification(userId, { title, body, url? })` — auto-cleans stale subscriptions (410/404)
- VAPID details set from env on import

### supabase-storage.ts
- Bucket: `devrolin-files`
- `uploadFile(buffer, path, contentType)` → returns path (not URL)
- `getSignedUrl(path, expiresInSeconds?)` → signed URL
- `deleteFile(path)` — silent failure (doesn't throw)
- StoragePath type: profile-pics/, project-pdfs/, chat-media/, cv-files/, photos/, receipts/, recordings/

### work-hours.ts
- `getWorkHoursWarning({ workHoursStart, workHoursEnd, name })` → string | null (handles overnight shifts)
- `getAttendanceStatus(checkInTime, workHoursStart, lateThresholdMin, veryLateThresholdMin)` → "PRESENT" | "LATE" | "VERY_LATE"

## Architecture Patterns

### Custom Server
- server.ts: Express + Socket.io on top of Next.js
- `global.io` is available to all API routes for real-time emits
- Socket.io namespaces configured in src/lib/socket-server.ts
- Hocuspocus runs separately on port 3001 (collaborative docs)

### API Route Pattern
- ALL routes wrapped in `apiHandler()` from src/lib/api-handler.ts
- Zod validation before processing — throws ZodError on invalid input
- Use `forbidden()` and `notFound()` helper throws for consistent error responses
- User context from middleware headers: `req.headers.get("x-user-id")`, `req.headers.get("x-user-role")`

### Auth Flow
1. Login → generates access token (JWT, 30min) + refresh token (random, 7 days)
2. Both stored as HttpOnly cookies (different paths for security)
3. Refresh endpoint: verify refresh token hash in DB, check blacklist grace period, rotate tokens
4. Logout: blacklist refresh token with 2-min grace window (allows in-flight requests), delete session from Redis + DB
5. Device security: compare User-Agent family on refresh — reject if mismatched

### Prisma Patterns
- Use `prisma.$transaction()` for multi-entity operations
- NEVER soft-delete — use status/isActive/deletedAt fields
- AuditLog metadata field requires casting: `metadata as unknown as Parameters<typeof prisma.auditLog.create>[0]["data"]["metadata"]`
- Global prisma singleton in src/lib/prisma.ts (prevents connection pool exhaustion in dev)

### Database
- Supabase PostgreSQL (remote): db.wjzskrpqoiaeupsyuris.supabase.co
- Use `prisma db push` instead of `prisma migrate dev` (migrate advisory lock times out on Supabase)
- Seed: `prisma/seed.ts` — inserts SystemConfig defaults via upsert

### Redis
- Local Redis: redis://localhost:6379
- `maxRetriesPerRequest: 3`, `lazyConnect: true`, `enableReadyCheck: false`
- Presence: 65s TTL, client pings every 30s
- Typing: 4s TTL (auto-expire)
- Rate limiting: sliding window via sorted sets (zremrangebyscore + zadd + zcard)
- OTP: 15-min attempt window, block key with configurable TTL

### Socket.io
- `global.io` declared in server.ts, available to API routes
- Namespaces: `/notifications` (push + DB notifications), `/chat` (real-time messaging)
- Room pattern: `user:{userId}` for targeted emits
- Typing indicators via Redis (not Socket.io rooms) — allows cross-server consistency

### File Upload Flow
1. Client uploads to API route (multipart/form-data, max 20MB via server.ts express.json limit)
2. Server validates file type/size, uploads to Supabase Storage
3. Returns storage path (not URL) — use `getSignedUrl()` for access
4. Store path in DB (profilePicUrl, pdfUrl, cvUrl, receiptUrl, recordingUrl, mediaUrl)

### Notification Flow
1. Action triggers `sendNotification()` from notify.ts
2. Checks user's NotificationPreference — skips if disabled
3. Creates Notification record in DB
4. Emits via Socket.io to `user:{userId}` in `/notifications` namespace
5. Sends Web Push if user has pushSubscription
6. Client shows toast + updates unread badge

### Currency/Finance
- All amounts stored in USD (Decimal(12,2))
- CurrencyRate table stores weekly rates from frankfurter.app
- Display conversion done at API layer, not stored
- Original amount/currency preserved for reference on AccountEntry

### Work Hours & Attendance
- Work hours stored as "HH:MM" strings (local time, not UTC)
- Overnight shifts supported: start > end (e.g., 19:00-02:00)
- CheckIn: one per user per work date (unique constraint on userId + date)
- AwayPing: sent during check-in to verify user is still present
- Attendance: daily record with status (PRESENT/LATE/VERY_LATE/ABSENT/LEFT_EARLY)
- Thresholds from SystemConfig: late_threshold_minutes (30), very_late_threshold_minutes (120)

### Hiring Pipeline
- HiringRequest: DRAFT → PENDING_APPROVAL → OPEN → CLOSED/CANCELLED
- Candidate: APPLIED → UNDER_REVIEW → (AI_RECOMMENDED|HR_RECOMMENDED) → SHORTLISTED → INTERVIEW_SCHEDULED → HIRED/REJECTED
- Public slug for job postings (unique, set when publishing)
- hCaptcha on public application forms only
- BlockNote JSON for internal hiring request description and candidate notes

### Chat System
- ChatRoom types: project_team_group, project_client_manager, project_dm, general_group, general_dm, workspace_group, workspace_dm, task_group, workspace_task_group
- Messages support: replies (self-relation), reactions, media, forwarding, AI responses, soft delete (content nullified, deletedContent preserved)
- ChatRoomMember tracks lastReadAt for unread counts
- Typing indicators via Redis (4s TTL)

### Layout Components
- ThemeProvider: wraps entire app in src/app/layout.tsx, persists theme to localStorage as "devrolin-theme", themes: devrolin/light/corporate/retro
- (app)/layout.tsx: Server component, verifies access_token cookie, fetches user from DB, passes user + sidebarItems to ClientLayout
- ClientLayout: "use client", manages sidebar collapsed state (persisted as "sidebar-collapsed"), mobile open/close state, responsive layout
- Sidebar: desktop collapsed=64px, expanded=240px, transition-all duration-300. Mobile: fixed, translate-x transitions. Expandable sections (only 1 open), tooltips when collapsed
- Navbar: desktop (hidden lg:flex, justify-end), mobile (flex lg:hidden, justify-between). Contains CheckInButton, NotificationBell, SettingsButton, ProfilePill
- UserAvatar: supports sizes 24|28|32|48|64|96|128, shows initials fallback with hash-based color, optional online indicator
- Sidebar config: src/config/sidebar.ts — getSidebarItems(role) returns role-based items, getProjectSidebarItems(projectId) for project-specific nav

## Change Log
- 2026-04-17 — **Phase 0.1** · `changes.md` rewritten as living progress log with phase map.
- 2026-04-17 — **Phase 0.2** · Manager ≡ Admin parity completed. See `changes.md` for full file list. `src/lib/admin-user-management.ts` trimmed to one helper (`requireUserManagement`) + `USER_MANAGEMENT_ROLES`. `src/lib/workspace-post-status.ts` no longer separates `ADMIN_ROLES` from `MANAGER_ROLES`. Dashboard PM branch merged into admin branch.
- 2026-04-17 — **Phase 0.3** · Badge UI polish. Appended a `@layer components` block to `src/app/globals.css` tightening padding + contrast for `.badge`, size variants, `badge-ghost`, `badge-outline`, and color variants. Uses DaisyUI CSS variables — stays theme-aware. No call sites touched.
- 2026-04-17 — **Phase 0.4** · Public CV locked to PDF. Server: MIME + extension + magic-byte (`%PDF-`) check in `src/app/api/public/careers/[slug]/apply/route.ts`. Client: `accept="application/pdf,.pdf"` and inline validation in `src/app/(public)/careers/[slug]/page.tsx`. Stored path fixed to `.pdf`.
- 2026-04-17 — **Phase 0.5** · Jitsi JWT `exp` error fix. Token lifetime 4h → 12h, added 60s `nbf`/`iat` backdating (`src/lib/jitsi.ts`), and an `errorOccurred` listener in `src/components/meetings/JitsiMeeting.tsx` that refetches a fresh token + closes the modal so the user can rejoin. Guard `jwtRefreshAttempted` prevents loops.
