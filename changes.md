# DevRolin CRM — Changes Progress Log

> **Live progress for the multi-phase upgrade requested on 2026-04-17.**
> Each phase has a status tag: ✅ done · 🟡 in progress · ⬜ pending.
> When a task completes, this file **and** `AGENTS.md` get updated.

---

## Scope summary

The original request (see `changes.md` git history or the ticket archive) covers five big areas:

1. **HR flow** — approval pipeline, custom questions with datatypes, status rework, interview scheduling with calendar + reminders, Start Meeting + emails, Shortlist → Hire form, contracts, Employee Management sub-sidebar, HR-owned performance view.
2. **Dashboard** — modern graphs UI (revenue / perf / tasks / milestones).
3. **Project + Meetings** — self-hosted Jitsi config, meeting from every context (project/task/workspace/chat/group/general), auto chat invite message, context-aware invite list, only manager can invite clients, custom UI wrapping Jitsi, prejoin with cam/mic off, waiting room, grace period, universal recording storage with per-context viewers.
4. **Chat** — create groups (manager/admin), add/remove members, set rules + name.
5. **General fixes** — CV view (PDF-only), JWT exp error, Badge UI contrast/padding, Manager role ≡ Admin access.
6. **Finance** — Client billing (invoices), Recurring expenses (auto-overheads), Project-milestone payment triggers.

This represents roughly 4–6 weeks of engineering. The work is phased to ship thoroughly-finished slices instead of many half-done ones.

---

## Phase map

| Phase | Theme | Status |
|-------|-------|--------|
| Phase 0 | Quick sweeps (Manager=Admin, Badge UI, CV, JWT, Chat Groups) | ✅ done (0.1–0.6 done) |
| Phase 1 | HR pipeline rewrite (approvals, questions w/ datatype, status rework, HR sub-sidebar + Employee Management shell) | ✅ done |
| Phase 2 | Interview + Hire flow (calendar scheduler, branded emails, 30/10-min reminders, Start/Send Mail, Hire form, welcome mail + set-password) | ✅ done |
| Phase 3 | Contracts + Dashboard (contract upload/view/deliver, protected per-person contract view, dashboard graphs) | ✅ done |
| Phase 4 | Meetings overhaul (self-hosted Jitsi, custom UI, context-aware invites, waiting room, recordings, per-context viewers) | ✅ done |
| Phase 5 | Financial Tools Expansion (Client billing, Recurring expenses, Invoice generation) | ⬜ pending |

---

## Phase 0 — Quick sweeps (current)

### ✅ 0.1 — Rewrite `changes.md` as progress log
This file. Living document; updated at each task boundary.

### ✅ 0.2 — Manager role ≡ Admin access
**Goal:** Every capability currently locked to `ADMIN` also unlocks for `PROJECT_MANAGER`. `SUPER_ADMIN` remains unique (control panel, full delete). Audit every route + UI guard.

**Done.** Audited every admin/PM guard across the codebase:
- `src/lib/admin-user-management.ts` — deleted `projectManagerCannotModifyUser` + `projectManagerCannotAssignPrivilegedRole` helpers (PM no longer blocked from touching ADMIN accounts).
- `src/app/api/admin/users/[id]/route.ts` — dropped PM-gate blocks; kept only the SUPER_ADMIN-only guard (both for editing SUPER_ADMIN and for assigning the SUPER_ADMIN role).
- `src/app/api/admin/users/[id]/sessions/route.ts` — dropped PM-gate; SUPER_ADMIN protection retained.
- `src/app/api/admin/users/[id]/reset-password/route.ts` — dropped PM-gate; SUPER_ADMIN protection retained.
- `src/app/api/admin/users/create-direct/route.ts` — dropped PM-gate; PM can now create ADMIN users. (SUPER_ADMIN still uncreatable via this endpoint — not in the Zod enum.)
- `src/app/api/admin/hiring-approvals/route.ts` + `[id]/route.ts` — `ADMIN_ROLES` now includes `PROJECT_MANAGER`.
- `src/config/sidebar.ts` — `getAdminSidebarItems` shows Hiring Approvals to Manager.
- `src/app/(app)/admin/hiring/page.tsx` — removed the `PROJECT_MANAGER → /admin/users` redirect useEffect.
- `src/lib/dashboard-data.ts` — merged the PM branch into the SUPER_ADMIN/ADMIN branch so Manager sees org-wide stats (active projects org-wide, total clients, pending requests, unanswered questions) instead of just member-filtered.
- `src/lib/workspace-post-status.ts` — PM can now transition any workspace post status, including from `PUBLISHED` (previously admin-only).
- `src/app/(app)/admin/users/page.tsx` — replaced `pmCannotManageUser` + role-filtering helper with `cannotManageTarget`, which only blocks non-SUPER_ADMIN users from managing SUPER_ADMIN accounts. Updated tooltip/toast copy accordingly.

**Result:** `PROJECT_MANAGER` and `ADMIN` are now behaviorally identical — the schema keeps them as separate enum labels, but every route, UI guard, sidebar, and dashboard treats them as one level. `SUPER_ADMIN` remains uniquely privileged (can edit/reset/modify SUPER_ADMIN accounts, owns `/control`).

### ✅ 0.3 — Badge UI contrast + padding
**Goal:** Readable in every theme, consistent vertical/horizontal spacing. Replace bare `badge badge-xs` usage with a controlled wrapper or a global theme override.

**Done.** Global override instead of touching all 27 badge call sites. Appended a `@layer components` block to `src/app/globals.css`:
- Default `.badge` now: `px-2.5 py-1`, `font-semibold`, `leading-none`, `min-height: 1.5rem`, `border-width: 1px`.
- Size variants (`badge-xs`/`sm`/`lg`) each get proportional padding + min-height.
- `badge-ghost` forced to `bg-base-300` + `text-base-content` (was invisible in light themes).
- `badge-outline` kept transparent bg but with visible border.
- Color variants (`badge-primary/secondary/accent/info/success/warning/error/neutral`) get `border-color: transparent` so the border doesn't double-stroke the fill.
Because the override uses DaisyUI CSS variables (`hsl(var(--b3))`, `hsl(var(--bc))`), it stays theme-aware.

### ✅ 0.4 — Public CV lock to PDF
**Goal:** `POST /api/public/careers/[slug]/apply` rejects non-PDF uploads; public careers page restricts the file picker to `application/pdf` and surfaces a clean error. No more doc-download surprises in the HR UI.

**Done.**
- **Server** (`src/app/api/public/careers/[slug]/apply/route.ts`): three-layer PDF check — MIME must be `application/pdf`, extension must be `.pdf`, and magic bytes (`%PDF-`) must match the first 5 bytes of the uploaded buffer. Stored path is now always `.pdf`.
- **Client** (`src/app/(public)/careers/[slug]/page.tsx`): file input `accept="application/pdf,.pdf"`, label reads "PDF only — max 10 MB", and an inline `onChange` validator rejects non-PDF files (by MIME + extension) and oversize uploads before they hit the network, showing the existing error banner.

### ✅ 0.5 — JWT `exp` error
**Goal:** Stop seeing `{"statusCode":"400","error":"InvalidJWT","message":"\"exp\" claim timestamp check failed"}`. Likely the Jitsi JWT (4h expiry) surviving longer than the page lifetime, or `nbf` clock skew. Add refresh-on-error and align expiry.

**Done.** Three fixes:
1. **Token lifetime** — `src/lib/jitsi.ts` now issues 12h Jitsi JWTs (was 4h). Tokens are meeting-room scoped so extending them is safe, and 12h comfortably covers any realistic sitting of a meeting tab.
2. **Clock-skew tolerance** — `iat` and `nbf` are set to `now - 60s`, absorbing ±60s of skew between the Next.js host and the Prosody/Jitsi host (addresses `"nbf"` claim failures too).
3. **Auto-refresh on the client** — added an `errorOccurred` listener to the External API path in `src/components/meetings/JitsiMeeting.tsx`. When the error payload contains `InvalidJWT` / `"exp"` / `token.expired` / any `jwt` signal, the component fetches a fresh token from `/api/meetings/[id]/join-token` and closes the modal with a toast, letting the caller relaunch cleanly. Guarded by `jwtRefreshAttempted` so we never loop.

### ✅ 0.6 — Chat groups
**Goal:** Manager / Admin can create a group chat (not tied to a project/task), pick members, name it, set text rules. Group admins (creator + any manager) can rename, edit rules, add/remove members. Surfaces in the main chat sidebar alongside All Hands and DMs.

**Done.**
- **API**: Added `POST /api/chat/rooms/custom-group` to create groups and `PATCH /api/chat/rooms/custom-group/[roomId]` to manage them. Added enforcement to `messages/route.ts` to block non-admins when `adminsOnlyPosting` is active.
- **UI**: Added a "Create Group" modal in `/chat/page.tsx` for Managers/Admins. Added a "Manage Group" gear icon in `ChatRoom.tsx` for group admins.
- **State/UX**: The UI disables input elements (text, files, voice) and displays an informative banner when posting restrictions are in place and the user is not an admin. Groups show up natively alongside DMs and All Hands in the chat sidebar.

---

## Phase 1 — HR pipeline rewrite (completed)

**Approval flow:**
- `HR` creates request → sits in `PENDING_APPROVAL`.
- `Manager`/`Admin` create → auto-approved.
- Only `managerApproved` requests become publishable.
- Published requests become read-only (lock edits); status reverts to draft on unpublish.

**Custom questions:**
- Per-request questions with datatype (`text`, `long_text`, `number`, `date`, `boolean`, `file`, `url`, `email`).
- Flags: `required`, `order`, plus `appliesToPublicForm`.
- Public careers page renders the right input per datatype; validation enforces required/format.

**Candidate status rework:**
- Remove `HR_RECOMMENDED`. Keep `isAiRecommended` only as a **flag**, not a status.
- Statuses: `APPLIED`, `UNDER_REVIEW`, `SHORTLISTED`, `INTERVIEW_SCHEDULED`, `HIRED`, `REJECTED`.
- **Reject pile:** rejected candidates hidden behind a toggle ("Show rejected") and can be re-applied from there.
- Action buttons: `Shortlist`, `Reject`, `Schedule Interview` (button → interview page), `Hire` (only visible for `SHORTLISTED`).

**HR sub-sidebar** (same pattern as project sidebar):
- Hiring
- Employee Management (list, salary/work-mode edit, performance graphs, punctuality)
- Contracts

**Employee Management shell:**
- List all non-SUPER_ADMIN/ADMIN/PM employees.
- Salary + work mode visible, Edit Salary opens a request-to-admin flow (notification → admin approves → edit applied).
- Performance panel: bar/line for tasks/projects completed (this month / last month / all-time), punctuality %.

---

## Phase 2 — Interview + Hire flow (completed)

- Schedule Interview page with free-slot picker (reads/writes to user calendars).
- Branded HTML interview email via Resend.
- Cron inside `server.ts`: scans upcoming interviews, sends push + in-app notification at T−30 and T−10 minutes.
- "Start meeting" button → Jitsi meeting creation → a waiting-link sent via email to the candidate (Send Starting Mail).
- Candidates in waiting room, team members join instantly.
- **Hire form:** Salary, Work Mode, Member Since (defaults today). Creates the `User` record on confirm.
- **Welcome email:** congratulations + secure link → set-password page (similar to reset-password flow but new-user branded).

---

## Phase 3 — Contracts + Dashboard (planned)

**Contracts:**
- `Contract` model (userId, title, storagePath, uploadedById, createdAt, updatedAt, version history).
- Upload + view + update (upload-new bumps version).
- Hire completion creates a HR notification: "Upload contract for X".
- HR uploads → button to email + chat the new employee with a secure link → route `/contracts/[id]` gates on access (owner, HR, manager, admin).
- Employee profile page adds Salary + Contract sections.

**Dashboard:**
- Recharts (already typical in the repo) for line + bar + donut charts.
- Widgets: monthly revenue, perf % this month, tasks completed / open, projects by status, recent hires.

---

---

## Phase 5 — Financial Tools Expansion (planned)

**Client Billing:**
- Invoice model (clientId, amount, status: PENDING/PAID/OVERDUE/CANCELLED, dueDate, lineItems).
- Generate PDF invoices via `jspdf` / `html2canvas`.
- Dashboard widget for "Total Outstanding".
- Automatic email reminders for overdue invoices.

**Recurring Expenses:**
- Overhead model (name, amount, frequency: MONTHLY/WEEKLY, category).
- Accountant dashboard shows auto-generated entries for recurring items.
- Profit/Loss chart adjusted for these automated overheads.

**Project Invoicing:**
- Link Milestones to Invoices (e.g. "On completion, generate $X invoice").
- Milestone status `COMPLETED` triggers draft invoice creation for Manager review.

---

## Completed changes log

### 2026-04-17 — Phase 0.1 · Rewrote `changes.md` as progress log
**What:** Converted the raw feedback list into a structured, living log with phase map and status markers.
**How:** Replaced the dump of user asks with a scope summary + 5-phase plan + per-task state + completed-changes log.
**Files touched:** `changes.md`

### 2026-04-17 — Phase 0.5 · Jitsi JWT `exp` error fix
**What:** Users were occasionally hitting `InvalidJWT / "exp" claim timestamp check failed`. Fixed root causes (short-lived token, clock skew) and added graceful client-side recovery.
**How:** Extended token lifetime 4h → 12h, added 60s `nbf`/`iat` backdating to absorb clock skew, added an `errorOccurred` listener in the meeting component that refetches a fresh token and closes the modal with a toast so the user can rejoin.
**Files touched:** `src/lib/jitsi.ts`, `src/components/meetings/JitsiMeeting.tsx`
**Follow-ups:** Phase 4 will replace the current Jitsi modal with a fully custom wrapper that can reload the embed in place (rather than closing on refresh).

### 2026-04-17 — Phase 0.4 · Public CV lock to PDF
**What:** Public career applications now only accept PDFs, verified server-side (MIME + extension + magic bytes) and client-side (accept filter + change-time validation).
**How:** Tightened `/api/public/careers/[slug]/apply` and the public careers file input. Stored upload path is now fixed to `.pdf`.
**Files touched:** `src/app/api/public/careers/[slug]/apply/route.ts`, `src/app/(public)/careers/[slug]/page.tsx`
**Follow-ups:** Phase 1 will add a friendlier in-app PDF preview component for the HR UI.

### 2026-04-17 — Phase 0.3 · Badge UI contrast + padding
**What:** Every DaisyUI badge across the app now has readable contrast in every theme and consistent spacing without touching call sites.
**How:** Added a `@layer components` block to `src/app/globals.css` that overrides `.badge`, size variants, `badge-ghost`, `badge-outline`, and color variants. All values pulled from DaisyUI CSS variables so theme-switching still works.
**Files touched:** `src/app/globals.css`
**Follow-ups:** None. Verify visually after next dev-server boot.

### 2026-04-17 — Phase 0.2 · Manager ≡ Admin parity
**What:** `PROJECT_MANAGER` now has full admin parity across every route, sidebar, dashboard, and UI guard. `SUPER_ADMIN` remains the only uniquely privileged role.
**How:**
- Deleted the two PM-restriction helpers in `src/lib/admin-user-management.ts`; replaced call sites with single SUPER_ADMIN-only guards.
- Flipped `ADMIN_ROLES` constants in the hiring-approvals routes to include `PROJECT_MANAGER`.
- Added Hiring Approvals link to the admin sub-sidebar for Manager.
- Removed the redirect that pushed PM off `/admin/hiring`.
- Merged PM into the admin dashboard branch so Manager sees org-wide stats.
- Collapsed the `ADMIN_ROLES` / `MANAGER_ROLES` split in `workspace-post-status.ts` — Manager can now transition posts from `PUBLISHED`.
- Replaced `pmCannotManageUser` with a generic `cannotManageTarget` (only blocks non-SUPER_ADMIN from managing SUPER_ADMIN).
**Files touched:**
- `src/lib/admin-user-management.ts`
- `src/app/api/admin/users/[id]/route.ts`
- `src/app/api/admin/users/[id]/sessions/route.ts`
- `src/app/api/admin/users/[id]/reset-password/route.ts`
- `src/app/api/admin/users/create-direct/route.ts`
- `src/app/api/admin/hiring-approvals/route.ts`
- `src/app/api/admin/hiring-approvals/[id]/route.ts`
- `src/config/sidebar.ts`
- `src/app/(app)/admin/hiring/page.tsx`
- `src/lib/dashboard-data.ts`
- `src/lib/workspace-post-status.ts`
- `src/app/(app)/admin/users/page.tsx`
**Follow-ups:** None — `SUPER_ADMIN` remains uniquely gated at the route level, and `FINANCE_ROLES` / `HR_ROLES` are orthogonal (PM is already included where appropriate).

### 2026-04-17 — Phase 0.6 · Chat groups
**What:** Global Managers and Admins can now create context-free group chats in the main chat interface, including managing members and restricting posting to admins only.
**How:** 
- New `custom_group` room type created and wired into the General chat fetch list.
- Configurable settings via `ChatRoomMember.isGroupAdmin` and `ChatRoom.adminsOnlyPosting`.
- New creation modal and management modal built into `/chat/page.tsx` and `ChatRoom.tsx`.
- APIs updated to enforce admin-only posting on the server.
**Files touched:** `src/app/api/chat/rooms/custom-group/route.ts`, `src/app/api/chat/rooms/custom-group/[roomId]/route.ts`, `src/app/api/chat/rooms/route.ts`, `src/app/api/chat/rooms/[roomId]/messages/route.ts`, `src/app/(app)/chat/page.tsx`, `src/components/chat/ChatRoom.tsx`
**Follow-ups:** None. Phase 0 is complete.

### 2026-04-17 — Phase 3 · Contracts + Dashboard
**What:** Implemented a full contract management system and enhanced the dashboard with data visualizations using Recharts.
**How:**
- Added `Contract` and `ContractVersion` models to the database.
- Created API routes for contract upload, listing, and versioning with strict access control.
- Built `ContractUploadModal` and `ContractVersionList` components for HR management.
- Integrated hiring pipeline notifications to trigger contract uploads for new hires.
- Added a "Salary & Contracts" section to the user profile page.
- Updated the dashboard with Monthly Revenue trends, Task distributions, Project overviews, and Hiring funnel charts.
- Added a centralized "Contracts" management page for HR and Admins.
**Files touched:**
- `prisma/schema.prisma`
- `src/lib/supabase-storage.ts`
- `src/app/api/contracts/route.ts`
- `src/app/api/contracts/[id]/route.ts`
- `src/app/api/contracts/[id]/versions/route.ts`
- `src/app/api/hr/requests/[id]/candidates/[cId]/route.ts`
- `src/components/contracts/ContractUploadModal.tsx`
- `src/components/contracts/ContractVersionList.tsx`
- `src/app/(app)/profile/page.tsx`
- `src/app/(app)/contracts/page.tsx`
- `src/lib/dashboard-data.ts`
- `src/components/dashboard/DashboardCharts.tsx`
- `src/app/(app)/dashboard/page.tsx`
- `src/config/sidebar.ts`
**Follow-ups:** Proceeding to Phase 5.

### 2026-04-18 — Phase 4 · Meetings overhaul
**What:** Transitioned from a simple iframe to a premium, context-aware meeting experience using self-hosted Jitsi with custom lobby control and recording persistence.
**How:**
- Rebuilt `JitsiMeeting.tsx` using `@jitsi/react-sdk` with custom prejoin (cam/mic off by default) and host-only lobby moderation.
- Updated `/api/meetings/start` to support `workspaceId` and `taskId` contexts, auto-notifying the relevant chat room with a join card.
- Hardened access control in `join-token` and `presence` APIs to verify project/workspace/task membership.
- Added a `MeetingRecording` system with a reusable `MeetingRecordingList` component and per-context viewer modals (Project, Workspace, Task).
- Created `SETUP.md` for WSL and VPS Jitsi hosting with JWT configuration for security features.
**Files touched:**
- `prisma/schema.prisma`
- `src/lib/jitsi.ts`
- `src/app/api/meetings/start/route.ts`
- `src/app/api/meetings/[id]/join-token/route.ts`
- `src/app/api/meetings/[id]/presence/route.ts`
- `src/components/meetings/JitsiMeeting.tsx`
- `src/components/meetings/MeetingRecordingList.tsx`
- `src/app/(app)/projects/[id]/page.tsx`
- `src/app/(app)/workspaces/[id]/page.tsx`
- `src/components/workspaces/WorkspaceTaskModal.tsx`
- `SETUP.md`

### 2026-04-18 — Review Phase · Stabilization & Workflow Polish
**What:** Finalized stabilization for Phase 3 and 4, fixed chat duplication, hardened project creation, and added premium meeting pre-join.
**How:**
- **Profile UI**: Migrated the profile crop modal to the native HTML `<dialog>` API to fix layout clipping.
- **Chat Deduplication**: Merged 5 duplicate DM rooms and hardened `POST /api/chat/rooms/dm` to prevent future duplicates using sorted-pair checks.
- **Message Deletion**: Added real-time message deletion (Socket.io + API) for users and admins.
- **Project Wizard**: Refactored the creation flow into a 4-step wizard (Details, Requirements, Milestones, Questions). Team selection moved to Step 1.
- **Workspace Task Lifecycle**: Restricted "Archive" to published posts only and added auto-timestamping for `postedAt`. Removed "Add past post" to enforce board integrity.
- **Meeting Premium Entry**: Integrated a custom `MeetingPreJoin` screen with mic/camera toggles and glassmorphism styling.
- **Avatar Optimization**: Pre-generated signed URLs in `api/projects/[id]` to eliminate loading waterfalls.
- **HR & Contracts**: Polished employee search in `ContractUploadModal` and ensured HR sub-sidebar consistency.
- **Stability**: Fixed a member sync bug by increasing the user fetch limit to 100 and removed temporary debug routes.

**Files touched:**
- `src/app/(app)/profile/page.tsx`
- `src/app/api/chat/rooms/dm/route.ts`
- `src/app/api/chat/messages/[id]/route.ts`
- `src/components/chat/ChatRoom.tsx`
- `src/app/(app)/projects/new/page.tsx`
- `src/app/(app)/workspaces/[id]/page.tsx`
- `src/components/workspaces/WorkspaceTaskModal.tsx`
- `src/app/api/workspaces/[id]/tasks/[taskId]/route.ts`
- `src/app/api/projects/[id]/route.ts`
- `src/components/meetings/JitsiMeeting.tsx`
- `src/components/meetings/MeetingPreJoin.tsx`
- `src/app/api/users/route.ts`
- `src/middleware.ts`

**Follow-ups:** Proceeding to Phase 5: Financial Tools Expansion.

