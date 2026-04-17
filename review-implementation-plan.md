# Review Implementation Plan

Tracking document for all issues and feature requests from `review.md`. Work is divided into **Sections** (feature areas) and **Chunks** (bite-sized, independently shippable units). Tick boxes as chunks are completed.

## Legend
- `[ ]` not started
- `[~]` in progress
- `[x]` done
- `[!]` blocked / needs decision

---

## Section 1 — Profile & Misc UI

### Chunk 1.1: Profile picture overlay fix
- [x] Make avatar upload/preview overlay cover full viewport (currently not fullscreen)
  - Files: `src/app/(app)/profile/page.tsx`, avatar modal component

---

## Section 2 — Chat Structure & Rooms

### Chunk 2.1: Dedupe Manager/HR chat rooms
- [x] Investigate why manager↔HR has 2 `general_dm` rooms (both functional, but duplicated)
- [x] Write migration/cleanup script to merge duplicate DM rooms (preserve all messages)
- [x] Harden `POST /api/chat/rooms/dm` to prevent future duplicates (atomic find-or-create)
  - Files: `src/app/api/chat/rooms/dm/route.ts`

### Chunk 2.2: Expand meeting-start permission
- [x] Allow any non-CLIENT role to start a meeting in DMs and team rooms (not just manager)
- [x] Keep block on client-facing rooms — clients can't initiate
  - Files: `src/app/api/meetings/start/route.ts`, `src/components/chat/ChatRoom.tsx`

### Chunk 2.3: Chat info/settings modal (shell)
- [ ] Make chat name/header clickable → opens `<ChatInfoModal />`
- [ ] Scaffold modal with tabs: Overview, Members, Media, Links, Recordings
  - Files: new `src/components/chat/ChatInfoModal.tsx`, `src/components/chat/ChatRoom.tsx`

### Chunk 2.4: Chat info modal — Overview tab
- [ ] Show group/DM name and pfp (click pfp → enlarge lightbox)
- [ ] If group + current user is admin → inline-edit name and pfp upload
  - Files: `ChatInfoModal.tsx`, `src/app/api/chat/rooms/[roomId]/route.ts`

### Chunk 2.5: Chat info modal — Members tab
- [ ] List all members with roles
- [ ] Click member → open DM with them **only if allowed** (dev cannot DM client, etc.)
- [ ] Apply role-based DM policy
  - Files: `ChatInfoModal.tsx`, `src/app/api/chat/rooms/dm/route.ts`

### Chunk 2.6: Leave / delete group
- [ ] Add "Leave Group" action — removes membership, preserves all messages
- [ ] Post-leave: show ghost view with "Delete for me" option
- [ ] Ensure other members unaffected and leaver's old messages remain visible
  - Files: new `src/app/api/chat/rooms/[roomId]/leave/route.ts`, `ChatInfoModal.tsx`

### Chunk 2.7: Media & Links tabs
- [ ] Query messages where `mediaUrl` is not null → grid view with lightbox
- [ ] Parse message bodies for URLs (regex) → list with previews
  - Files: `ChatInfoModal.tsx`, new `GET /api/chat/rooms/[roomId]/media`, `/links`

### Chunk 2.8: Recordings tab
- [ ] List all `Meeting` records for this `chatRoomId` with `recordingUrl` not null
- [ ] Playback / download
  - Files: new `GET /api/chat/rooms/[roomId]/recordings`

---

## Section 3 — Chat Features

### Chunk 3.1: Delete message (for all)
- [x] Add `DELETE /api/chat/messages/[id]` — sender-only, soft-delete with "message deleted" placeholder
- [x] Socket emit `message_deleted` to `/chat` namespace
  - Files: new route, `ChatRoom.tsx`, `src/lib/socket-server.ts`

### Chunk 3.2: Cross-platform emoji picker
- [ ] Replace built-in emoji grid with `emoji-mart` (Apple/Google/Twitter sets)
- [ ] Let user pick emoji style in settings (or detect OS)
  - Files: `ChatRoom.tsx`, `package.json`

### Chunk 3.3: Linkify URLs and phone numbers
- [x] Use `react-markdown` + `remark-gfm` to auto-link http(s), www., phone numbers
  - Files: `ChatRoom.tsx` message-render path

### Chunk 3.4: Long message "Read more"
- [x] Collapse messages > 500 chars with expandable toggle
  - Files: `ChatRoom.tsx`

### Chunk 3.5: Context menu (right-click / long-press)
- [ ] Menu options: Copy, Delete (if sender), Reply, React
- [ ] Mobile long-press handler + haptic
  - Files: `ChatRoom.tsx`, new `src/components/chat/MessageContextMenu.tsx`

### Chunk 3.6: WhatsApp-style reactions
- [x] Quick-bar: 👍 ❤️ 😂 😮 😢 🙏 + "+" for full picker
- [ ] Use the font 
  ```
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&display=swap" rel="stylesheet">
  ``` 
  for emojis
- [x] Reaction chips under message with counts and tap-to-toggle
  - Files: `ChatRoom.tsx`, existing `react` socket event

### Chunk 3.7: Delivery/read receipts
- [ ] Add `deliveredAt`, `readBy` tracking on Message
- [ ] Single tick (sent), double tick (delivered), blue double tick (read)
  - Files: `prisma/schema.prisma`, socket handlers, `ChatRoom.tsx`

### Chunk 3.8: Voice player theme
- [x] Replace hardcoded colors in voice waveform with DaisyUI variables (Custom VoicePlayer)
  - Files: voice component inside `ChatRoom.tsx`

### Chunk 3.9: AI button overlap + dockable
- [x] Make floating AI widget draggable (framer-motion `drag`)
- [x] "Dock to side" action → puts AI in sidebar mode
- [x] "Pop out" action → returns float + opens sidebar-AI pane
  - Files: `src/components/ai/AISidebar.tsx`, `src/components/layout/ClientLayout.tsx`

### Chunk 3.10: Reply/react bubble contrast
- [x] Fix color contrast for own-message-side action bubbles
  - Files: `ChatRoom.tsx` CSS / Tailwind classes

---

## Section 4 — Meetings (Jitsi)

### Chunk 4.1: Fix external_api.js script load error
- [x] Investigate `https://localhost:8443/external_api.js` 404
- [x] Verify docker container exposes `external_api.js` and `JITSI_DOMAIN` env matches
- [x] Add retry + clear error UI on script load failure
  - Files: `src/components/meetings/JitsiMeeting.tsx`, `.env`, `docker-compose.*`

### Chunk 4.2: Custom pre-join (replace Jitsi pre-join)
- [x] Build `src/components/meetings/PreJoinScreen.tsx` — camera preview, mic level bar, readonly display name, theme-aware
- [x] Pass `prejoinPageEnabled: false` to Jitsi config
  - Files: new PreJoinScreen, `JitsiMeeting.tsx`

### Chunk 4.3: Lobby / waiting room
- [ ] Enable Jitsi lobby; moderators auto-admit; others wait
- [ ] If current user is meeting creator → go directly in
  - Files: `JitsiMeeting.tsx` (config), `api/meetings/start/route.ts`

### Chunk 4.4: Remove Jitsi branding & fix meeting name
- [x] Hide watermark/logo via Jitsi interfaceConfig
- [x] Use `Meeting.title` or plain "DevRolin Meeting" as subject (not raw `jitsiRoomId`)
  - Files: `JitsiMeeting.tsx`

### Chunk 4.5: Theme-sync the meeting UI
- [ ] Read user's DaisyUI theme, inject Jitsi CSS variables on mount
  - Files: `JitsiMeeting.tsx`

### Chunk 4.6: Identity cleanup
- [ ] Hide Profile name-edit in Jitsi settings
- [ ] Override displayed "Logged in as" — use user's email or hide
  - Files: `JitsiMeeting.tsx`

### Chunk 4.7: Invite with link + copy link
- [ ] Add "Invite with link" and "Copy link" buttons in meeting toolbar
- [ ] Shareable URL hits `/meetings/[id]/join` → calls `GET /api/meetings/[id]/join-token`
  - Files: `JitsiMeeting.tsx`, new `src/app/(app)/meetings/[id]/join/page.tsx`

### Chunk 4.8: Manager-can-join-own-meeting bug
- [ ] Investigate why creator (manager) cannot rejoin own meeting
- [ ] Ensure join-token route upserts participant even for creator
  - Files: `src/app/api/meetings/[id]/join-token/route.ts`

### Chunk 4.9: Meeting recording
- [ ] Add "Record" button (moderator-only, already flagged in `isModerator`)
- [ ] Enable Jibri or use client-side MediaRecorder as fallback
- [ ] On stop → upload to Supabase `meeting-recordings/` and save `Meeting.recordingUrl`
  - Files: `JitsiMeeting.tsx`, new `api/meetings/[id]/recording` route

---

## Section 5 — Projects

### Chunk 5.1: Project creation — creator always member
- [x] Admins & PMs don't appear in team-selection list (they're implicit)
- [x] Server-side: always add creator + all PMs/admins as members regardless of selection
  - Files: `src/app/api/projects/route.ts`, project create form component

### Chunk 5.2: Reduce AI-generated client questions
- [ ] Tune prompt in `POST /api/ai/generate-questions` for fewer, higher-signal questions (max ~5)
  - Files: `src/app/api/ai/generate-questions/route.ts`

### Chunk 5.3: AI milestones reads existing descriptions
- [ ] Accept `existingMilestones[]`; prompt says "rewrite/improve these if provided"
  - Files: `src/app/api/ai/generate-milestones/route.ts`, UI

---

## Section 6 — Documents

### Chunk 6.1: AI-created documents are empty
- [ ] Trace milestone-doc creation path — AI generates content but doc `content` stays null
- [ ] Persist AI output as initial Yjs state (base64) on doc create
  - Files: milestone/document creation flow, `POST /api/projects/[id]/documents`

### Chunk 6.2: Long doc scroll bug
- [ ] Document editor container must scroll independently (`overflow-y: auto` on wrapper, not cursor-driven)
  - Files: `src/components/documents/DocumentEditor.tsx`

### Chunk 6.3: Slash menu visual fix
- [ ] Add theme-aware background, border, shadow to BlockNote slash menu
  - Files: `DocumentEditor.tsx`, `src/app/globals.css`

### Chunk 6.4: Slash menu — AI action
- [ ] Add "Ask AI" slash item → opens small prompt input
- [ ] Backend receives: project id, all project docs, current doc, cursor context
- [ ] Live-inserts AI response at cursor via Yjs (Hocuspocus)
  - Files: `DocumentEditor.tsx`, new `POST /api/ai/document-inline`

### Chunk 6.5: Selection menu visual fix
- [ ] Theme-aware bg on BlockNote formatting toolbar
  - Files: `DocumentEditor.tsx`

### Chunk 6.6: Selection menu — Summarize / Professionalize
- [ ] Always appear INSIDE existing selection menu (not a separate popup)
  - Files: `DocumentEditor.tsx`

---

## Section 7 — Project AI Chat

### Chunk 7.1: Remove floating AI widget inside projects
- [x] Hide `AISidebar` when route matches `/projects/[id]/*`
  - Files: `src/components/ai/AISidebar.tsx`, `src/components/layout/ClientLayout.tsx`

### Chunk 7.2: Project sidebar — "AI Chat" link
- [ ] Add item to `getProjectSidebarItems()` — visible only to non-CLIENT
  - Files: `src/config/sidebar.ts`

### Chunk 7.3: Shared persistent chat thread
- [ ] New `ProjectAIConversation` (one per project) + `ProjectAIMessage` models
- [ ] `GET/POST /api/projects/[id]/ai-chat`
- [ ] No reset; all team members read/write same thread
  - Files: `prisma/schema.prisma`, new routes, new `(app)/projects/[id]/ai/page.tsx`

### Chunk 7.4: Project AI — context & tools
- [ ] Tool-calling loop: read milestones, tasks, chat messages, documents, budget, questions
- [ ] Maintain `NOTES.md` per project via a "write_notes" tool (Document with `docType="ai_notes"`)
- [ ] Use `GROQ_MODEL_COMPLEX` (high-context)
  - Files: `src/lib/ai.ts` (tool-call support), project-ai route

---

## Section 8 — Project Tasks View

### Chunk 8.1: Project page Tasks section
- [x] Render tasks filtered to current project
- [x] "Add Task" pre-fills project & auto-assigns project members; no project/team pickers
  - Files: `src/app/(app)/projects/[id]/page.tsx`, `src/app/api/projects/[id]/tasks/route.ts`

---

## Section 9 — Global Tasks

### Chunk 9.1: Task creation — skip state picker
- [ ] Remove status field from create form; default to `TODO`
  - Files: `src/components/tasks/TaskForm.tsx`

### Chunk 9.2: Task list card UI
- [ ] Port workspace social-media card style to `/tasks` list (current on top, past below)
  - Files: `src/app/(app)/tasks/page.tsx`, new `TaskCard.tsx` inspired by `WorkspacePostCard.tsx`

### Chunk 9.3: Task meetings
- [ ] Add "Start Meeting" on task detail
- [ ] Recordings list per task
  - Files: `src/app/(app)/tasks/[id]/page.tsx`, reuse meetings infra

---

## Section 10 — Social Media Workspace

### Chunk 10.1: Remove "Create past task" button
- [x] Strip the CTA from workspace UI
  - Files: workspace task UI components

### Chunk 10.2: Add/remove members to workspace
- [x] Member management modal with add/remove + confirmation
  - Files: `src/app/(app)/workspaces/[id]/page.tsx`

---

## Section 11 — Dashboard

### Chunk 11.1: Theme-aware dashboard colors
- [~] Replace hardcoded `#hex` / Tailwind grays with DaisyUI variables
- [ ] Verify across `devrolin`, `neutral-dark`, `neutral-light`, `pink`, `pale`
  - Files: `src/app/(app)/dashboard/page.tsx`, dashboard components

---

## Section 12 — Infrastructure

### Chunk 12.1: Kill Redis errors in logs
- [ ] Make Redis optional OR document as required in setup
- [ ] Graceful fallback: if `REDIS_URL` unreachable, log once and disable typing-indicators / theft detection cleanly
  - Files: `src/lib/redis.ts` (or wherever client inits), `server.ts`

---

## Section 13 — Attendance (rework)

### Chunk 13.1: Work hours default & backfill
- [x] Every attendance-eligible user has `workHoursStart/End`
- [x] Backfill script created and run
  - Files: `src/scripts/backfill-work-hours.js`

### Chunk 13.2: Sunday holiday rule
- [x] All auto-mark jobs skip Sunday (PKT)
  - Files: `server.ts`

### Chunk 13.3: Manual early check-in
- [x] Record exact timestamp, 8h timer starts from check-in
  - Files: `POST /api/attendance/check-in`

### Chunk 13.4: Auto check-in (within 1h of start)
- [x] If user online within 1h of start -> mark as shift start
  - Files: `src/lib/attendance-helpers.ts`, socket server

### Chunk 13.5: Auto check-in (late)
- [x] If user online > 1h after start -> mark LATE/VERY_LATE
  - Files: `src/lib/attendance-helpers.ts`

### Chunk 13.6: Absence auto-mark
- [x] Daily cron marks no-check-in users ABSENT (except Sunday)
  - Files: `server.ts`

### Chunk 13.7: Auto checkout
- [x] Auto-checkout after 8h + grace or at shift end
  - Files: `server.ts`

### Chunk 13.8: Overtime popup flow
- [x] Socket-triggered modal for Check Out / +1h Overtime
- [x] Accumulate `overtimeHours` in `Attendance`
  - Files: `AttendanceOvertimeModal.tsx`, overtime API

### Chunk 13.9: Manager/admin attendance page
- [x] Management dashboard with team list, filtering, and messaging
  - Files: `attendance/page.tsx`, management API

### Chunk 13.10: Ping system
- [x] Manager can ping user; sends notification + DM + web push
- [x] Expired ping penalty -> LEFT_EARLY
  - Files: ping API, confirm-active API, server cron

### Chunk 13.11: Manual early checkout -> Left Early
- [x] Mark LEFT_EARLY if > 1h remaining; otherwise waived
  - Files: `POST /api/attendance/check-out`

---

## Section 14 — HR / Employee Management

### Chunk 14.1: HR employee list PFPs
- [x] Fix: employee list not showing profile pictures
  - Files: `hr/employees/page.tsx`, HR employee API

### Chunk 14.2: HR dashboard data wiring
- [x] Populate empty graphs from real attendance/hiring/project data
  - Files: HR dashboard components

### Chunk 14.3: Salary edit permission
- [x] Ensure auto-approve for Admin/PM, pending for HR
  - Files: salary edit route + UI gating

### Chunk 14.4: Contract model rework (1 contract per person)
- [x] Enforce uniqueness: one active Contract per user
- [x] HR/Manager page lists all users; users without contract → red border
- [x] "Create Contract for {user}" button on each row
- [x] Replace-contract action overwrites + sets status to PENDING
  - Files: `prisma/schema.prisma` (unique constraint), contracts UI, API

### Chunk 14.5: Exclude admin/manager from contracts
- [x] Hide admin/PM rows from contract list
  - Files: contracts UI / API filter

### Chunk 14.6: Fix contract download error
- [x] Error: "can't access property 'name', e.uploadedBy is undefined"
- [x] Include `uploadedBy` in contract GET response, or null-guard the UI
  - Files: contract download component + API

### Chunk 14.7: Contract sign flow
- [x] On new/replaced contract → notify target user with deeplink to profile page
- [x] Profile shows contract card with "Sign Contract" button → status SIGNED
- [x] HR/Manager update of signed contract → resets to PENDING, re-notifies
- [x] HR/Manager panel shows Signed / Pending chip
  - Files: profile page, contract routes, notification dispatcher

---

## Verification approach (per chunk)
1. **Unit check**: `npm run dev` and exercise the feature in-browser
2. **Theme check** (UI): cycle all 5 DaisyUI themes
3. **Role check**: test with SUPER_ADMIN, PROJECT_MANAGER, DEVELOPER, CLIENT, HR where relevant
4. **Socket check** (real-time): open 2 browser sessions, confirm events fire
5. **Log check**: tail dev server logs for errors/warnings
