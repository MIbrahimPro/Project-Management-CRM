
## SECTION 1 — Architecture & Confirmed Tech Stack
 
### Final Stack
 
| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 14 (App Router) | TypeScript strict, src/ directory |
| Database | PostgreSQL 15+ | Self-hosted on VPS |
| ORM | Prisma 5 | Migrations, type-safe queries |
| Cache | Redis 7 (ioredis) | Sessions, blacklist, presence, rate limiting |
| File Storage | Supabase Storage | devrolin-files bucket (private) |
| Real-time | Socket.io 4 | Attached to custom Express server |
| Collaborative Docs | Yjs + Hocuspocus Server | Separate process, port 3001 |
| Email | Resend | Transactional email only |
| Push Notifications | Web Push API (VAPID) | No Firebase, cross-platform |
| Meetings | Jitsi Meet (self-hosted) | JWT auth, recording enabled |
| AI | OpenRouter — qwen/qwen3-235b-a22b:free | Verify model string at openrouter.ai/models |
| UI | TailwindCSS + DaisyUI 4 | Theme-driven, CSS variables only |
| Rich Text | BlockNote latest | Open source, Mantine styling |
| Captcha | hCaptcha | Public pages only |
| Exchange Rates | frankfurter.app | Free, no key, weekly refresh |
| PWA | next-pwa | Soft install prompt, not a hard gate |
| Validation | Zod | All API inputs |
| Rate Limiting | Redis-based sliding window | Auth endpoints only |
| Process Manager | PM2 | VPS deployment |
| Reverse Proxy | Nginx | SSL termination, WebSocket proxy |
 

 
## SECTION 2 — Roles & Permissions
 
### Role Definitions
 
| Role | Description | Has Attendance | Has Check-In | Can Create Projects |
|---|---|---|---|---|
| SUPER_ADMIN | Hidden tech support, SQL-created | No | No | No |
| ADMIN | Org admin, user management | No | No | Yes |
| PROJECT_MANAGER | Manages projects | Yes | Yes | Yes |
| DEVELOPER | Software development | Yes | Yes | No |
| DESIGNER | Design work | Yes | Yes | No |
| HR | Hiring and attendance management | Yes | Yes | No |
| ACCOUNTANT | Financial management | Yes | Yes | No |
| SALES | Sales team | Yes | Yes | No |
| CLIENT | External client | No | No | No (can request) |
 
### Work Mode (applies to all roles with attendance)
- REMOTE, ONSITE, HYBRID — stored on user profile, display-only for now
 
---
 
## SECTION 3 — Technical Review & Verified Design Decisions
 
### Schema Corrections (vs v1)
 
These bugs existed in v1 and are fixed in the schema prompt below:
 
1. **`ChatRoom` WorkspaceTask FK**: Added `workspaceTaskId String?` field alongside `taskId`. Task-level chats use `taskId`, WorkspaceTask-level chats use `workspaceTaskId`.
2. **`HiringQuestion` back-relation**: Added `answers CandidateAnswer[]` to `HiringQuestion`.
3. **`Milestone` back-relation for questions**: Added `questions ProjectQuestion[]` to `Milestone`.
4. **`CheckIn.date`**: Changed to `@db.Date` for PostgreSQL date-only storage.
5. **Database indexes**: Added `@@index` on all foreign keys and frequently queried fields.
6. **`Message` soft delete**: Added `deletedContent String?` to preserve deleted message shell (shows "Message deleted" in UI while keeping the record).
7. **`PrivateNote` merged into `Document`**: Private notes now use `Document` with `access: PRIVATE` and `ownerId` field. This unifies the tree rendering.
8. **`Attendance` date**: Changed to `@db.Date`.
 
### API Design Verification
 
**Auth flow verified:**
```
Login → [access_token cookie 30m] + [refresh_token cookie 7d]
         ↓
Access expires → frontend calls /api/auth/refresh (automatic via axios interceptor)
                  ↓
            Refresh rotates → new pair issued, old blacklisted
                  ↓
            7 days pass → user must log in again
```
 
**Token theft detection verified:**
```
Normal: Token used → blacklisted with 2min grace → reused within grace → allow once
Theft:  Token used → blacklisted → reused AFTER grace → ALL sessions killed
        (or: reused within grace SECOND time → ALL sessions killed)
```
 
**OTP flow verified:**
```
/forgot-password → OTP email + otp_flow cookie (15m) → /otp page
/otp → verify OTP → reset_flow cookie (15m) set, otp_flow cleared → /reset-password
/reset-password → new password → all sessions cleared + new session created → /dashboard
```
 
**Project creation verified (4 steps, no step 3):**
```
Step 1: Details (title, team, client) → Step 2: Requirements (BlockNote) → Step 3: Milestones (BlockNote per milestone, AI pre-generates) → Step 4: Questions (AI pre-generates)
→ Single POST /api/projects with all data → atomic Prisma transaction creates all entities
```
 
### Known Constraints & Limits
 
| Constraint | Value | Where Enforced |
|---|---|---|
| Profile picture max size | 5MB before crop, 800KB after | Frontend crop + API validation |
| CV file max size | 5MB | API route |
| Chat media max size | 20MB | Socket.io + API |
| Voice note max duration | 2 minutes | Frontend MediaRecorder timer |
| PDF attachment (project request) | 5MB, 1 file | API route |
| Message history pagination | 50 per page | API route |
| Project sub-links in sidebar | 5 max | Sidebar component |
| OTP expiry | 10 minutes | DB TTL check |
| OTP resend cooldown | 60 seconds | Redis TTL |
| Invitation expiry | 7 days | DB check |
| Away check interval | 30 min (configurable via SystemConfig) | Background job |
| Exchange rate refresh | Weekly (every Monday 00:00) | server.ts cron |
| Hocuspocus doc room name | `devrolin-proj-{projectId}-doc-{docId}` | Consistent naming |
 
### Race Conditions Addressed
 
1. **Refresh token race condition**: Redis atomic operations (`SET NX`) prevent double-use.
2. **Check-in duplicate**: `@@unique([userId, date])` on Attendance prevents double attendance records.
3. **Message ordering**: Messages use `createdAt` DESC + cursor-based pagination (not offset).
4. **OTP brute force**: After 5 failed attempts in 15 minutes (tracked in Redis), block for 30 minutes.
 
---
 


 ai model is any from  
 z-ai/glm-4.5-air:free
 or openai/gpt-oss-120b:free
 or openai/gpt-oss-20b:free
 or google/gemma-4-31b-it:free
 or qwen/qwen3-coder:free
 or meta-llama/llama-3.3-70b-instruct:free
 or qwen/qwen3-next-80b-a3b-instruct:free
 or google/gemma-4-26b-a4b-it:free


 dont use qwen/qwen3.6-plus
 since that just got turned to paid
 