# Phase 7 — Meetings Module — Session Notes

## What Has Been Done

### Schema
- Added `scheduledAt DateTime?` to `Meeting` model in `prisma/schema.prisma`
- Pushed with `npx prisma db push` — no migration file, schema is live

### API Routes
- `src/app/api/meetings/route.ts` — NEW — GET list of meetings for a project
  - Query: `?projectId=...`
  - Returns: id, title, jitsiRoomId, scheduledAt, startedAt, endedAt, createdById, participants, recordings
- `src/app/api/meetings/start/route.ts` — MODIFIED — now accepts `scheduledAt` in body (datetime ISO string)
- `src/app/api/meetings/[id]/join-token/route.ts` — EXISTS — returns { token, domain, serverUrl, isModerator, canInviteUsers, canInviteClients }

### Frontend
- `src/config/sidebar.ts` — MODIFIED — Added "Meetings" (icon: "Video") to `getProjectSidebarItems()` for non-CLIENT roles
- `src/app/(app)/projects/[id]/meetings/page.tsx` — NEW — Full meetings page:
  - Loads meetings from `/api/meetings?projectId=...`
  - Top section: "Upcoming & In Progress" — scheduled + in-progress with Join button
  - Bottom section: "Past Meetings & Recordings" — card grid with thumbnails, recording links
  - Schedule modal (manager-only): "Start Now" toggle or date/time picker
  - On join: calls `/api/meetings/${id}/join-token` then opens `JitsiMeeting` overlay
  - Uses `JitsiMeeting` from `src/components/meetings/JitsiMeeting.tsx` (dynamic import, ssr: false)
- `src/app/(app)/projects/[id]/chat/page.tsx` — MODIFIED:
  - Removed `showMeetingButton` and `onStartMeeting` from all ChatRoom usages (meetings moved to dedicated page)
  - Removed `startMeeting()` function and related state
  - Passes `roomDetails` prop to ChatRoom for stacked avatars in header

### Video Call Removal from Chat
- Meeting/video call button REMOVED from project chat header
- General chat page (`(app)/chat/page.tsx`) still has meeting button (via `showMeetingButton={canStartMeeting}`)

## What Still Needs to Be Done

### 7.2 (partial)
- [ ] Link dashboard "Start Meeting" button → `/projects/${projectId}/meetings`
- [ ] Link dashboard "View Recordings" → `/projects/${projectId}/meetings`
- Check `src/app/(app)/projects/[id]/page.tsx` for meeting-related buttons

### 7.4 (partial)
- [ ] Notify all project members (except client) when meeting is scheduled/started
  - In `createNormalChatMessage` or in meetings/start route: call `sendNotification` for each member
- [ ] Auto-end meeting if no one in room for 2 min (background job in server.ts)
- [ ] Auto-start recording on join (Jitsi API event: `recordingStatusChanged` or via `startRecording()`)

### 7.5 — Client Meeting (Manager/Admin only)
- [ ] "Start Meeting with Client" button — separate from team meetings
- [ ] 2 options modal: "Start Now" or "Schedule"
- [ ] Member selection step (which project members to include)
- [ ] Only client + manager/admin + selected members are notified
- [ ] Invite-only: enforce membership in the join-token route (already partially done via project.clientId check)
- [ ] Recordings visible to client

### 7.6 — Pre-Join Page
- [ ] `/projects/[id]/meetings/join/[meetingId]` — page before Jitsi
  - Camera/mic permission test (getUserMedia)
  - Video preview
  - Toggle camera/mic on/off before joining
  - "Join" button → calls join-token API then opens JitsiMeeting
  - Waiting room: if room empty/only client → auto-admit; else → need org member to admit
- The `JitsiMeeting` component has `MeetingPreJoin` imported from `./MeetingPreJoin` — check if this already handles it
- Check `src/components/meetings/MeetingPreJoin.tsx`

### 7.7 — Custom Jitsi UI
- Check `src/components/meetings/JitsiMeeting.tsx` — what's already customized
- Key items:
  - Remove Jitsi logo/default toolbar
  - Custom bottom bar: camera, mic, screen share, chat sidebar, settings, hand raise, participants
  - Top left: invite modal, recording indicator
  - Theme sync with app theme
  - Fix "Script load error: external_api.js" — check `JITSI_DOMAIN` env var format

### 7.8 — Meeting Management
- [ ] Edit scheduled meeting (PATCH /api/meetings/[id]) — title, scheduledAt
- [ ] Delete scheduled meeting (DELETE /api/meetings/[id])
- [ ] Notifications on edit/cancel
- [ ] Copy join link button (URL: `/projects/${projectId}/meetings/join/${meetingId}`)
- [ ] In-meeting invite (already exists in JitsiMeeting invite modal)

## Key Files to Read When Resuming

1. `src/components/meetings/JitsiMeeting.tsx` — main Jitsi component, see what's already custom
2. `src/components/meetings/MeetingPreJoin.tsx` — pre-join screen
3. `src/app/(app)/projects/[id]/page.tsx` — project dashboard, find meeting buttons
4. `src/app/api/meetings/[id]/join-token/route.ts` — already handles access control
5. `src/lib/notify.ts` — how to send notifications to users

## Important Notes

- `JitsiMeeting` is in `src/components/meetings/JitsiMeeting.tsx` and uses `@jitsi/react-sdk`
- The `isModerator` logic: `ADMIN | PROJECT_MANAGER | isCreator`  
- Meeting join URL pattern (from current code): `/meetings/${meetingId}` (standalone meeting page)
- For project meetings, consider `/projects/${projectId}/meetings/join/${meetingId}`
- `getJitsiDomain()` and `getJitsiServerUrl()` from `src/lib/jitsi.ts`
- Notification sending: `sendNotification(userId, type, title, body, link)` from `src/lib/notify.ts`
- Auto-end background job could use: `prisma.meetingParticipant.findMany({ where: { meetingId, leftAt: null } })` to check active participants

## Meeting Status Logic (meetings page)
- Meeting is "upcoming/scheduled" if: `!m.endedAt && m.scheduledAt && new Date(m.scheduledAt) > now`
- Meeting is "in progress" if: `!m.endedAt && (!m.scheduledAt || new Date(m.scheduledAt) <= now)`
- Meeting is "past" if: `m.endedAt !== null`
