# DevRolin CRM - Requirements & Feature Checklist

> **MOST IMPORTANT FEATURE:**  
> **THE CRM WILL BE LIVE.** 
> All data changes reflect instantly across all connected clients via Socket.io real-time updates.

---

## 🏗️ Platform Requirements

- [ ] **Desktop Support**: Linux, Windows, macOS
- [ ] **Mobile Support**: iOS, Android (responsive design)
- [ ] **Real-time Architecture**: Socket.io for live updates across all modules
- [ ] **Design Language**: Apple Design Language for default light & dark themes
- [ ] **Multiple Themes**: Support for devrolin, neutral-dark, neutral-light, pink, pale
- [ ] **Responsive Layout**: Desktop sidebar with icon-collapse on hover → Phone bottom navbar
- [ ] **Keyboard Awareness**: On mobile, detect keyboard open/close and adjust view to prevent content hiding behind keyboard

---

## 📐 UI/Navigation Architecture

### Desktop Layout
- **Sidebar** (left): Always collapses into icons; full text shown on hover
- **Main Content Area** (center): Dynamic based on current section
- **User Menu** (top-right): Profile, theme, settings, logout

### Mobile Layout
- **Bottom Navbar**: Navigation tabs (chat, projects, tasks, dashboard, etc.)
- **User Profile Indicator**: Profile picture only in navbar
- **Full-Screen Pages**: Each section opens as full-screen page
- **Keyboard Handling**: View adjusts when keyboard appears/disappears

---

## 👥 User Roles & Access Control

- [ ] **SUPER_ADMIN** - System-wide control, hidden/future use (access to `/control` panel)
- [ ] **ADMIN** - Full organization access (same permissions as PROJECT_MANAGER currently)
- [ ] **PROJECT_MANAGER** - Project creation, user management, approval workflows
- [ ] **DEVELOPER** - Project work, task execution, document collaboration
- [ ] **DESIGNER** - Project work, social media content creation
- [ ] **HR** - Hiring, attendance management, candidate pipeline
- [ ] **ACCOUNTANT** - Financial tracking, invoicing, budget management
- [ ] **SALES** - Business development, CRM functions
- [ ] **CLIENT** - External stakeholder (limited access: approved chat & project updates)
- [ ] **HIRING_CANDIDATE** - Temporary role for job applicants (separate table, can escalate or apply)

---

## 👤 Profile System

### Profile Page Components

**User Information Display (Live Updated):**
- [ ] Profile Picture (circular, editable)
- [ ] Full Name (editable)
- [ ] Role Badge (display only)
- [ ] Work Mode: Remote/Onsite/Hybrid (display only)
- [ ] Phone Number (editable with formatting)
- [ ] Email Address (editable, requires OTP verification to old email via Resend)
- [ ] Member Since (display only, formatted date)
- [ ] Salary Information (display only)
- [ ] Work Timings (display only: start time - end time)
- [ ] Contract Status (display only)

**Editable Fields:**
- [ ] Name (inline edit)
- [ ] Profile Picture (upload, auto-crop to 800KB JPEG via sharp)
- [ ] Email (requires OTP sent to current email for verification)
- [ ] Phone Number (with validation)

**Display-Only Fields:**
- [ ] Salary
- [ ] Role
- [ ] Member Since
- [ ] Work Mode (Remote/Onsite/Hybrid)
- [ ] Work Timings
- [ ] Contract Status

**Contracts Section:**
- [ ] Show Contract State (Internship/Employed)
- [ ] "View Contracts" Button → Opens contract page
- [ ] Display currently active contract info (if exists)

**Real-Time Updates:**
- [ ] If another user changes your salary/work mode/role → live update on profile
- [ ] If you change profile picture/name/email → all connected users see update instantly
- [ ] Socket.io listener for profile change events

**Mobile Behavior:**
- [ ] Click profile picture in navbar → opens profile page
- [ ] All editable fields inline-edit with Enter/Escape navigation
- [ ] Full-screen layout on mobile

---

## 📋 Contracts Page

**Contract Card Layout:**
- [ ] Display as grid of cards (desktop) or list (mobile)
- [ ] Newest active contract shown at top
- [ ] Each card shows:
  - [ ] Contract Title
  - [ ] Contract Type: Employment/Internship
  - [ ] Date From (formatted)
  - [ ] Date Expiry (formatted, highlight if expiring soon)
  - [ ] Status Badge: Active/Inactive/Expired
  - [ ] Signed Status: Visual indicator (checkmark/cross)
  - [ ] PDF File Preview/Download Button

**Contract Details (Modal or Full Page):**
- [ ] View PDF in embedded viewer (or modal with PDF viewer)
- [ ] Full contract information
- [ ] Download PDF button
- [ ] Print option

**Access Control:**
- [ ] Users can only view their own contracts (display only)
- [ ] HR/Managers can upload/manage contracts
- [ ] No edit capability for regular users

**Real-Time Updates:**
- [ ] New contract added → appears instantly on all connected devices
- [ ] Contract status changed → updates live across all viewers
- [ ] Contract expired → status updates automatically

---

## ⚙️ Settings Page

**Password Management:**
- [ ] Change Password Form:
  - [ ] Current Password field (masked)
  - [ ] New Password field (with strength indicator)
  - [ ] Repeat New Password field
  - [ ] Save button with validation
- [ ] Forgot Password Link:
  - [ ] Sends OTP to registered email via Resend
  - [ ] Verify OTP form
  - [ ] Set new password
  - [ ] Confirmation message

**Preferences:**
- [ ] **Currency Preference**:
  - [ ] Dropdown with major currencies (USD, EUR, GBP, CAD, AED, PKR, AUD, etc.)
  - [ ] Auto-applied to all financial displays and reports
  - [ ] Live sync across all pages
  
- [ ] **Theme Selection**:
  - [ ] Radio buttons: devrolin, neutral-dark, neutral-light, pink, pale
  - [ ] Preview thumbnail for each theme
  - [ ] Instant theme switch
  - [ ] Persisted to localStorage and server

**Notification Preferences:**
- [ ] **Push Notifications** (master toggle)
  - [ ] Enable/Disable push notifications globally
  - [ ] Browser permission handling

- [ ] **Notification Categories**:
  - [ ] Chat notifications (toggle)
  - [ ] Project notifications (toggle)
  - [ ] Meeting notifications (toggle)
  - [ ] Task notifications (toggle)
  - [ ] HR notifications (toggle)
  - [ ] System notifications (toggle)

- [ ] **Time-Based Rules**:
  - [ ] During Work Hours (separate settings):
    - [ ] Enabled/Disabled toggle per category
    - [ ] Sound toggle
    - [ ] Desktop/Mobile priority
  - [ ] Outside Work Hours (separate settings):
    - [ ] Enabled/Disabled toggle per category
    - [ ] Sound toggle
    - [ ] Desktop/Mobile priority

- [ ] **Work Hours Configuration**:
  - [ ] Start time picker (HH:MM format)
  - [ ] End time picker (HH:MM format)
  - [ ] Timezone selector
  - [ ] Save button

**Data Sync:**
- [ ] All settings saved to server immediately
- [ ] Live updates to other connected sessions
- [ ] Offline changes queue and sync when reconnected

---

## 🔔 Notifications System

### Notifications Page

**Header/Navigation:**
- [ ] Navbar (desktop) or topbar (mobile)
- [ ] Notification count badge (unread only)
- [ ] Search bar (search notification text, user, or type)
- [ ] Filter options (all, unread, read, by type)

**Notification List:**
- [ ] Grouped by date (Today, Yesterday, "Month Day, Year")
- [ ] Infinite scroll or pagination (50 per page)
- [ ] Each notification shows:
  - [ ] Icon (category-specific)
  - [ ] Avatar (sender if applicable)
  - [ ] Title and body text (with bold/link parsing)
  - [ ] Timestamp (relative: "2m ago", "1h ago", etc.)
  - [ ] Read/Unread indicator (visual dot or highlight)
  - [ ] Action button (if applicable: View, Accept, Decline, etc.)

**Smart Notifications:**
- [ ] If you receive notification for unread chat → click chat to read → notification auto-marks as read
- [ ] If you receive notification for pending task → complete task → notification auto-marks as read
- [ ] If you receive notification for project update → visit project → notification auto-marks as read

**Mark as Read:**
- [ ] Click notification → marks as read
- [ ] Swipe notification (mobile) → mark as read/delete
- [ ] Mark all as read button (top-right)
- [ ] Clicking action button auto-marks notification

**Real-Time Updates:**
- [ ] New notifications appear at top of list instantly
- [ ] Notification count updates live
- [ ] Read/unread status syncs across all devices
- [ ] Socket.io listener for `notification_received` event

**Notification Icons & Colors:**
- [ ] Chat: Message bubble icon (blue)
- [ ] Project: Folder icon (orange)
- [ ] Task: Checkmark icon (green)
- [ ] Meeting: Video call icon (purple)
- [ ] Approval: Star icon (yellow)
- [ ] System: Bell icon (gray)
- [ ] HR: People icon (pink)
- [ ] Mention: @ symbol (red)

---

## 💬 Chat System

### Chat Sidebar / Contact List

**Desktop View:**
- [ ] Inner wider sidebar showing:
  - [ ] Search bar (search by name, email, recent messages)
  - [ ] "Create Group" button (manager/admin only)
  - [ ] Tabs: Direct Messages | Groups
  - [ ] Contact list with:
    - [ ] Profile picture (circular, smaller)
    - [ ] Name and role (small text)
    - [ ] Last message preview (truncated, grayed if read)
    - [ ] Timestamp of last message
    - [ ] Unread message count badge (if >0)
    - [ ] Online status indicator (green dot)
  - [ ] Sticky pinned/favorite conversations at top
  - [ ] Scrollable list of others

**Mobile View:**
- [ ] Full-page contact list
- [ ] Same structure as desktop sidebar
- [ ] Back button to main dashboard
- [ ] Swipe right to open contact

### Chat Permissions by Role

**Manager/Admin:**
- [ ] Chat with anyone (all roles)
- [ ] Chat with any group
- [ ] Create groups

**Client:**
- [ ] Chat ONLY with Manager/Admin
- [ ] Chat with groups they're part of
- [ ] Cannot create groups

**Sales/Accountant/Developer/Designer/HR:**
- [ ] Chat with everyone EXCEPT Client
- [ ] Chat with any group they're part of
- [ ] Cannot chat with external clients (if not invited to project group)

**Developers/Designers within Projects:**
- [ ] Auto-added to project team group chat
- [ ] Can see client-manager group (read only, cannot send to client-facing groups unless explicitly added)

### Create Group Modal

**Fields:**
- [ ] Group Name (text input)
- [ ] Group Picture (image upload or emoji select)
- [ ] Member Selection (multi-select):
  - [ ] Shows all users EXCEPT current user
  - [ ] Search box to filter members
  - [ ] Selected members show with checkmark
- [ ] Group Mode (radio buttons):
  - [ ] "Anyone Can Message" - all members can send messages
  - [ ] "Admin Only Messages" - only managers and admins can message, others view-only
- [ ] Create button (or Save)

### Chat Room Interface

**Header (Chat Open):**
- [ ] For Direct Message:
  - [ ] Contact name
  - [ ] Online/Last Online status (e.g., "Online", "Last seen 5m ago")
  - [ ] Profile button (click to see profile)
  - [ ] Call/Video call button (if meetings enabled)
  - [ ] Menu (options, mute, pin, etc.)
  
- [ ] For Group:
  - [ ] Group name and picture
  - [ ] Member count badge (e.g., "5 members")
  - [ ] Online members indicator (e.g., "3 online")
  - [ ] Group info button → opens group details
  - [ ] Group settings button (manager/admin only)
  - [ ] Menu

**Message List:**
- [ ] Oldest messages first (chronological order)
- [ ] Messages grouped by sender (same sender's messages grouped together)
- [ ] For groups: sender name and picture shown above each message (like WhatsApp)
- [ ] For DMs: no sender name (implied)
- [ ] Timestamp shown on hover or for message groups
- [ ] Message read receipts (checkmarks) for group messages
- [ ] Scrollable history with "Load earlier messages" at top

**Message Features:**
- [ ] **Text Messages**: Full formatting support
  - [ ] Markdown support (bold, italic, code blocks)
  - [ ] Mentions: @username mentions highlight person
  - [ ] Links: auto-linkify URLs, clickable
  - [ ] Emoji support
  
- [ ] **Message Reactions**:
  - [ ] Click emoji reaction button → emoji picker (emoji-mart or custom grid)
  - [ ] Click emoji on message to react
  - [ ] Show reaction count under message
  - [ ] Hover to see who reacted
  - [ ] Click to see all reactions or remove own reaction
  
- [ ] **Message Actions**:
  - [ ] Reply to (quote message above)
  - [ ] React (emoji picker)
  - [ ] Star/Pin message
  - [ ] Copy text
  - [ ] Delete own message (soft delete, shows "[deleted]" placeholder)
  - [ ] Edit own message (within 5 minutes, shows "[edited]" indicator)
  
- [ ] **File Attachments**:
  - [ ] Drag-and-drop file upload
  - [ ] Click attachment button → file browser
  - [ ] Paste image/file from clipboard
  - [ ] File type indicators (image, document, video, audio, etc.)
  - [ ] Max sizes:
    - [ ] Image: 10MB (JPEG/PNG/WebP)
    - [ ] Video/Document: 20MB
    - [ ] Voice/GIF: 5MB
  - [ ] Thumbnail preview for images
  - [ ] Download button on attachment
  - [ ] Signed URL generated (1 hour validity)
  
- [ ] **Voice Messages**:
  - [ ] Click microphone button to start recording
  - [ ] Recording timer shown (max 2 minutes)
  - [ ] Send/Cancel buttons on recording UI
  - [ ] Playback with audio player controls
  - [ ] Waveform visualization during recording/playback
  - [ ] Automatic transcription (if AI enabled)

- [ ] **Typing Indicators**:
  - [ ] Shows "User is typing..." below message area
  - [ ] Multiple users: "User1 and User2 are typing..."
  - [ ] Disappears after 3 seconds of inactivity
  - [ ] Redis-backed for real-time synchronization

**Message Input Area:**
- [ ] Text input field (auto-expand as text grows, max height before scroll)
- [ ] Attachment button (image, file, emoji, voice)
- [ ] Send button (active only when message has text or attachment)
- [ ] Character counter (for SMS-style limits if applicable)
- [ ] Emoji picker (quick access button)
- [ ] Format toolbar (bold, italic, code, link)

**Group-Specific Features:**
- [ ] Member list sidebar (click group name to toggle)
  - [ ] Shows all members with online status
  - [ ] Admin badge for managers/admins
  - [ ] Click member to view profile
  
- [ ] Group Settings (admin/manager only):
  - [ ] Edit group name
  - [ ] Edit group picture
  - [ ] Change group mode (anyone/admin-only)
  - [ ] Add/remove members
  - [ ] Leave group button
  - [ ] Delete group (warning modal)
  
- [ ] Group Info View:
  - [ ] Group media gallery (all images/videos sent)
  - [ ] Shared links (all URLs mentioned)
  - [ ] Starred messages
  - [ ] Pin important messages (admin only)

**Message Read Status:**
- [ ] For groups: show "✓" (sent), "✓✓" (delivered), "✓✓" (read)
- [ ] For DMs: double checkmark when read
- [ ] "Seen at [time]" tooltip on checkmarks

**Real-Time Features:**
- [ ] New messages appear instantly via Socket.io (`/chat` namespace)
- [ ] Typing indicators update in real-time
- [ ] Online status updates live
- [ ] Reactions update instantly for all users
- [ ] Read receipts appear instantly

---

## 🎨 Social Media Module

### Access Control
- [ ] **Visible to**: ADMIN, PROJECT_MANAGER, DESIGNER
- [ ] **Creator privilege**: Only ADMIN and PROJECT_MANAGER can create social media sections
- [ ] **Full access**:
  - [ ] ADMIN/PROJECT_MANAGER: create, edit, delete, manage members, all sections
  - [ ] DESIGNER: view assigned sections, create/edit posts in assigned sections

### Social Media Sections List Page

**Header:**
- [ ] "Create Social Media Section" button (admin/manager only)
- [ ] Search bar (search by name, description)
- [ ] Filter by status (active, archived)
- [ ] View toggle (grid, list)

**Section Cards:**
- [ ] Display in responsive grid (3 columns desktop, 2 mobile, 1 small mobile)
- [ ] Each card shows:
  - [ ] Section Icon (image or emoji - left side)
  - [ ] Section Name (title)
  - [ ] Description (2-3 lines, truncated)
  - [ ] Member Avatars (PFP Jumbo: max 3 circular pics, half-overlapping):
    - [ ] If 1-3 members: show all PFPs
    - [ ] If 4+ members: show 3 PFPs + "+X more" badge
  - [ ] Total Posts Count (e.g., "12 posts")
  - [ ] Online Members Count (e.g., "3 online")
  - [ ] Created Date (small, gray text)
  - [ ] Click anywhere to open section details

### Create Social Media Section Modal

**Fields:**
- [ ] **Section Name** (text input):
  - [ ] Examples: Instagram, LinkedIn, TikTok, Facebook, Twitter, YouTube
  - [ ] Required field
  
- [ ] **Icon Selection** (two modes):
  - [ ] **Icon Upload**: Drag-and-drop or browse for image (max 2MB, square preferred)
  - [ ] **Icon Library**: Select from pre-provided icons (Instagram, LinkedIn, TikTok, etc.)
  
- [ ] **Description** (textarea):
  - [ ] Optional
  - [ ] Max 500 characters
  - [ ] Shows remaining character count
  
- [ ] **Member Selection** (multi-select):
  - [ ] Shows all DESIGNER users (auto-includes all ADMIN/PROJECT_MANAGER)
  - [ ] Search/filter by name
  - [ ] Checkboxes for selection
  - [ ] Selected count shown
  
- [ ] **Buttons**:
  - [ ] Create (saves section)
  - [ ] Cancel (closes modal)

**Real-Time Updates:**
- [ ] New section appears instantly on all connected users' pages (all 3 roles)
- [ ] All users get notification

### Social Media Section Details Page

**Header Section:**
- [ ] Section Icon (left side, larger)
- [ ] Section Name (title)
- [ ] Description (full text, editable by admin/manager)
- [ ] Member PFP Jumbo (max 3, half-overlapping, with "+X more" if needed)
- [ ] Online Members Count
- [ ] "Manage Members" Button (admin/manager only):
  - [ ] Opens modal to add/remove members
  - [ ] Current members listed with remove button (X)
  - [ ] Add button to select new members
  - [ ] Save changes
  
- [ ] Edit Section Button (admin/manager only):
  - [ ] Edit name, description, icon
  - [ ] Same fields as create modal
  
- [ ] Archive Section Button (admin/manager only):
  - [ ] Confirmation modal
  - [ ] Moves section to archived view

**Ongoing Posts Section:**
- [ ] Heading: "📋 Ongoing Posts"
- [ ] Description: "In Progress, Under Review, or in Ideation"
- [ ] "Add Post" Button (all members):
  - [ ] Opens modal with single field: "Post Title"
  - [ ] Creates post with status "Idea" and timestamp
  
- [ ] Post Cards (grid or list):
  - [ ] Display posts in reverse-chronological order (newest first)
  - [ ] Each card shows:
    - [ ] Thumbnail (latest active media or placeholder)
    - [ ] Post Title
    - [ ] Status Badge (Idea, Progress, Under Review, Approved, Rejected)
    - [ ] Created Date
    - [ ] Author Name
    - [ ] Click to open post details

### Post Details Modal/Page

**Post Information:**
- [ ] Post Title (editable by post creator or admin/manager)
- [ ] Created Date (display only)
- [ ] Author Name (display only)
- [ ] Post Status (display with change button for admin/manager)

**Status Management:**
- [ ] Current Status Display (with background color indicating status)
- [ ] Status Change Button (admin/manager only):
  - [ ] Primary button: "Change to [Next Status]" (contextual)
    - [ ] Idea → Progress
    - [ ] Progress → Under Review
    - [ ] Under Review → Approved
    - [ ] Approved → Publish (with date picker modal for publish date)
    - [ ] Rejected → Under Review (reopen)
  - [ ] Dropdown menu: "More options" - shows all available statuses with descriptions
  - [ ] Publish status is final (no status changes after published)

**Description Section:**
- [ ] AppFlowy/BlockNote rich text editor
- [ ] Markdown support
- [ ] Mentions and links supported
- [ ] Live auto-save (indicated by "Saving..." → "Saved")
- [ ] Edit permissions: creator or admin/manager
- [ ] View permissions: all section members

**Media Section:**
- [ ] Heading: "📸 Media"
- [ ] Grid layout showing all attached media
- [ ] Each media item (thumbnail):
  - [ ] Square cover image (click to view full-screen)
  - [ ] Status badge below (Active/Inactive)
  - [ ] Hover overlay with:
    - [ ] View full-screen button
    - [ ] Toggle Active/Inactive button
    - [ ] Delete button (soft delete, moves to archived)
- [ ] "Add Media" Button (all members):
  - [ ] Drag-and-drop image/video upload
  - [ ] Browse file dialog
  - [ ] Paste from clipboard
  - [ ] Max 20MB per file
  - [ ] Auto-preview after upload
  - [ ] Immediately appears as "Active" by default
  
- [ ] **Latest Active Media Rule**:
  - [ ] The most recently added active media is used as post thumbnail
  - [ ] If no active media, use placeholder icon
  - [ ] Updated dynamically as media status changes

**Action Buttons (Bottom):**
- [ ] **Save Button**: Saves all changes (description, media status)
- [ ] **Delete Button** (admin/manager only):
  - [ ] Soft delete (moves post to archived section)
  - [ ] Confirmation modal: "Move this post to archived?"
  - [ ] Post disappears from current view, appears in Archived section

**Archived Posts Management:**
- [ ] Button to toggle "Show Archived Posts"
- [ ] Separate section below showing archived posts with status badges
- [ ] Each archived post has "Unarchive" button
- [ ] Click unarchive → post returns to appropriate section (Ongoing/Past)

### Past Posts Section

- [ ] Heading: "📅 Past Posts"
- [ ] Description: "Published and Completed Posts"
- [ ] Shows posts with status: Published
- [ ] Same card layout as Ongoing Posts
- [ ] Each card shows:
  - [ ] Thumbnail
  - [ ] Post Title
  - [ ] Published Date (formatted: "May 15, 2026")
  - [ ] Status: "Published"
  - [ ] Author Name
  - [ ] Archive button (admin/manager only)
  - [ ] Click to view details (read-only)

### Post Status Workflow Visualization

- [ ] Optional: Timeline/flowchart showing post progression through statuses
- [ ] Idea → Progress → Review → Approved → Publish (Final)
- [ ] Alternative path: Rejected → Review (reopens)
- [ ] Visual indicator of current status on timeline

**Real-Time Updates:**
- [ ] New posts appear instantly in Ongoing Posts
- [ ] Status changes update live for all section members
- [ ] Media additions/changes appear instantly
- [ ] Member count and online status update live
- [ ] All changes emit Socket.io events to `/projects` namespace

---

## 💰 Accounting & Finance Module

### Access Control
- [ ] **Visible to**: SUPER_ADMIN, ADMIN, ACCOUNTANT
- [ ] Role-based view filters automatically applied
- [ ] Export data (CSV, PDF) - ADMIN/ACCOUNTANT only

### Header & Navigation
- [ ] **Currency Selector** (top-right):
  - [ ] Dropdown showing all supported currencies
  - [ ] Reads user's `currencyPreference` setting as default
  - [ ] Switching currency updates all displays instantly
  - [ ] Uses live exchange rates (updated daily via CurrencyRate in database)
  
- [ ] **Date Range Picker**:
  - [ ] Start date and end date fields
  - [ ] Quick presets: Today, This Week, This Month, Last Month, Last 3 Months, This Year
  - [ ] Apply button to filter all displays
  - [ ] URL query params to persist selection

### Dashboard Summary Cards

- [ ] **Total Income** (current period):
  - [ ] Large number display in selected currency
  - [ ] Trend indicator (↑ green or ↓ red) with percentage vs. previous period
  - [ ] Mini sparkline chart (optional)
  
- [ ] **Total Expenses** (current period):
  - [ ] Large number display in selected currency
  - [ ] Trend indicator
  - [ ] Mini sparkline chart (optional)
  
- [ ] **Net Profit/Loss** (Income - Expenses):
  - [ ] Large number (green if profit, red if loss)
  - [ ] Percentage margin calculation
  - [ ] Trend indicator
  
- [ ] **Budget Remaining** (if budget defined):
  - [ ] Shows allocated budget vs. spent
  - [ ] Progress bar (filled amount = spent)
  - [ ] Remaining amount prominently displayed
  - [ ] Warning indicator if >80% spent

### Filter Section

- [ ] **Entry Type Filter**:
  - [ ] Checkbox group: Income, Expense, or both (default: both)
  - [ ] Filter applies to all sections below

- [ ] **Category Filter**:
  - [ ] Multi-select dropdown with all categories:
    - [ ] Income: Sales, Services, Retainer, Investment, Other
    - [ ] Expense: Salary, Tools/Software, Hosting, Marketing, Office, Travel, Utilities, Other
  - [ ] Select multiple categories
  - [ ] "Clear all" option

- [ ] **Project Filter**:
  - [ ] Multi-select dropdown showing all active projects
  - [ ] Optional: exclude unassigned entries
  - [ ] "All projects" option (default)

- [ ] **Date Range** (already above in header)

- [ ] **Apply Filters Button**:
  - [ ] Updates all displays below
  - [ ] Shows active filter count badge

### Entries Ledger Table

- [ ] **Columns**:
  - [ ] Date (sortable, formatted as "May 15, 2026")
  - [ ] Description (truncated, hover shows full text)
  - [ ] Category (formatted badge: color-coded by type)
  - [ ] Type (Income/Expense badge)
  - [ ] Project (if linked, shows project name with link)
  - [ ] Original Amount (in original currency, e.g., "1500 PKR")
  - [ ] Amount (in selected currency, converted via live rates)
  - [ ] Status (Pending, Approved, Voided - badge)
  - [ ] Receipt (attachment icon, clickable to view/download)
  - [ ] Actions (dropdown menu)

- [ ] **Sorting**:
  - [ ] Click column header to sort ascending/descending
  - [ ] Date sorted newest-first by default
  - [ ] Amount sortable numerically

- [ ] **Pagination**:
  - [ ] Show 25, 50, or 100 entries per page
  - [ ] Page navigation buttons
  - [ ] Current page indicator

- [ ] **Row Actions** (right-click or dropdown menu):
  - [ ] View Receipt (if attached)
  - [ ] Download Receipt
  - [ ] Edit Entry (accountant/admin only)
  - [ ] Void Entry (accountant/admin only):
    - [ ] Opens modal: "Are you sure?"
    - [ ] Reason dropdown: Duplicate, Correction, Other
    - [ ] Optional notes field
    - [ ] Confirm button
    - [ ] Entry marked as "Voided" in status column
  - [ ] Delete Entry (admin only, hard delete after confirmation)
  - [ ] View Details (full modal)

- [ ] **Filtering Display**:
  - [ ] "Showing X-Y of Z entries" text below table
  - [ ] Applied filters shown as pills (removable)

### Summary by Category

- [ ] **Pie/Doughnut Chart**:
  - [ ] Shows breakdown of expenses by category (percentage)
  - [ ] Click slice to filter entries by that category
  - [ ] Legend on side showing category name and total amount

- [ ] **Bar Chart Alternative**:
  - [ ] Horizontal bars showing category totals
  - [ ] Hover to see exact amount and percentage

- [ ] **Summary Table** (below chart):
  - [ ] Category, Count, Total Amount, Percentage
  - [ ] Sortable by amount or count
  - [ ] Subtotals for Income/Expense sections

### Monthly Trends

- [ ] **Line Chart**:
  - [ ] X-axis: Months (Jan, Feb, Mar, etc.)
  - [ ] Y-axis: Amount in selected currency
  - [ ] Three lines: Income (green), Expenses (red), Net Profit (blue)
  - [ ] Hover shows exact amounts and date
  - [ ] Zoom capability to focus on date range

- [ ] **Year-over-Year Comparison** (optional):
  - [ ] Show current year vs. previous year in same chart
  - [ ] Different colors or line styles
  - [ ] Legend

### Add Entry Form

- [ ] **Entry Type** (radio buttons):
  - [ ] Income / Expense (default: Expense)

- [ ] **Category** (dropdown):
  - [ ] Populated based on entry type
  - [ ] Income: Sales, Services, Retainer, Investment, Other
  - [ ] Expense: Salary, Tools/Software, Hosting, Marketing, Office, Travel, Utilities, Other

- [ ] **Description** (text input, required):
  - [ ] Up to 255 characters
  - [ ] Example: "Monthly hosting for main server"
  - [ ] Character counter

- [ ] **Date** (date picker, required):
  - [ ] Default: today
  - [ ] Allows selecting past dates for backdated entries
  - [ ] Calendar picker on click

- [ ] **Amount in Original Currency** (number input, required):
  - [ ] Decimal places (2 places default)
  - [ ] Minimum 0.01
  - [ ] Formatted with thousands separator

- [ ] **Original Currency** (dropdown):
  - [ ] All supported currencies
  - [ ] Default: USD
  - [ ] Shows converted amount in user's preferred currency below

- [ ] **Converted Amount** (display only):
  - [ ] Automatically calculated from live exchange rates
  - [ ] Format: "= [amount] [user currency]"
  - [ ] Live updates if exchange rates change

- [ ] **Project Link** (optional dropdown):
  - [ ] Multi-select or single-select projects
  - [ ] Can leave blank for general expenses
  - [ ] Search to filter projects

- [ ] **Receipt/Invoice Attachment** (file upload):
  - [ ] Optional drag-and-drop area
  - [ ] Accepted formats: PDF, JPG, PNG, DOCX
  - [ ] Max 20MB per file
  - [ ] Shows filename after upload
  - [ ] Delete attachment button

- [ ] **Notes** (textarea, optional):
  - [ ] Additional context or memo
  - [ ] Max 1000 characters
  - [ ] Character counter

- [ ] **Buttons**:
  - [ ] "Save & Add Another" (clears form, stays on page)
  - [ ] "Save" (saves and returns to ledger)
  - [ ] "Cancel" (discards changes)

### Recurring Entries (Advanced)

- [ ] **Toggle: "Make This Recurring"**
  - [ ] Reveals additional fields

- [ ] **Recurrence Pattern** (radio buttons):
  - [ ] Weekly
  - [ ] Bi-weekly
  - [ ] Monthly (on same day)
  - [ ] Quarterly
  - [ ] Yearly

- [ ] **Start Date** (date picker):
  - [ ] When recurring entry begins

- [ ] **End Date** (date picker, optional):
  - [ ] When recurring entry stops
  - [ ] "Never end" option (checkbox)

- [ ] **Set Reminder** (checkbox):
  - [ ] If checked, shows reminder time options
  - [ ] Days before due: 1, 3, 7 days
  - [ ] Time: HH:MM (default 09:00)
  - [ ] Sends push notification at specified time

- [ ] **Duplicate Pattern**:
  - [ ] On each recurrence date, duplicate the entry
  - [ ] New entries start in "Draft" state (if applicable)
  - [ ] Background job processes recurring entries daily

### Receipt Management

- [ ] **Receipt Viewer Modal**:
  - [ ] Embedded PDF viewer or image viewer (depending on file type)
  - [ ] Full-screen button
  - [ ] Download button
  - [ ] Print button
  - [ ] Filename and upload date shown

- [ ] **Receipt Archive**:
  - [ ] All receipts stored in Supabase Storage (`receipts/` folder)
  - [ ] Accessible via signed URL (1-hour validity)
  - [ ] Linked to specific entry

### Budget Management (Optional Advanced Feature)

- [ ] **Set Budget** (admin/accountant only):
  - [ ] Modal to set total budget for period
  - [ ] Category-level budgets (optional)
  - [ ] Notification when 80% of budget spent
  - [ ] Alert color coding on dashboard

- [ ] **Budget vs. Actual**:
  - [ ] Show allocated vs. spent side-by-side
  - [ ] Variance analysis (over/under budget)
  - [ ] Forecast if current spend rate continues

### Reports & Export

- [ ] **Generate Report Button**:
  - [ ] Report type: Summary, Detailed, Tax Report
  - [ ] Date range selector
  - [ ] Currency selector
  - [ ] Format: PDF or CSV

- [ ] **Export Entries**:
  - [ ] Export current filtered view as CSV
  - [ ] Includes all visible columns and filters applied
  - [ ] CSV headers: Date, Description, Category, Type, Project, Amount, Currency, Status

### Real-Time Updates

- [ ] New entries appear instantly on ledger
- [ ] Summary cards update live
- [ ] Charts refresh when new data added
- [ ] Recurring entries created automatically per schedule
- [ ] Exchange rates update daily (CurrencyRate cron job)
- [ ] All changes emit Socket.io events to `/projects` namespace
- [ ] Multiple users editing entries see updates in real-time

### Compliance & Audit

- [ ] **Audit Trail**:
  - [ ] All changes logged via `logAction()` function
  - [ ] SUPER_ADMIN can view audit logs showing: user, action, timestamp, entry details
  - [ ] Voided entries marked with void reason
  - [ ] Hard deletes recorded in audit trail

- [ ] **Void Entry Rules**:
  - [ ] Once voided, cannot be re-voided or modified
  - [ ] Reason and notes recorded
  - [ ] Still appears in ledger (with "Voided" status) for audit purposes

---

## 👥 Admin User Management

### Admin Panel Access
- [ ] Route: `/admin`
- [ ] Access: SUPER_ADMIN, ADMIN only
- [ ] Unauthorized access returns 404 (not 403)

### Users Management Page

**Header:**
- [ ] Tab navigation (Users, Hiring Approvals, Audit Logs)
- [ ] Search bar with debounce

**User Table (Left Panel - Desktop):**
- [ ] Columns:
  - [ ] Name (searchable)
  - [ ] Email (searchable)
  - [ ] Role (badge, color-coded)
  - [ ] Status (Active/Inactive toggle)
  - [ ] Active Sessions (count)
  - [ ] Member Since (date)
  - [ ] Last Activity (timestamp)
  - [ ] Actions (dropdown menu)

- [ ] Sorting:
  - [ ] Click column headers to sort
  - [ ] Default: sorted by last activity (newest first)

- [ ] Pagination:
  - [ ] Show 25 users per page
  - [ ] Page navigation

- [ ] Filter Bar:
  - [ ] Role filter (multi-select): ADMIN, PROJECT_MANAGER, DEVELOPER, etc.
  - [ ] Status filter: Active, Inactive
  - [ ] Search box (name or email)

- [ ] Row Actions (dropdown menu):
  - [ ] View Profile
  - [ ] Edit User (opens modal)
  - [ ] Reset Password (sends OTP email)
  - [ ] Manage Sessions (view/kill sessions)
  - [ ] Deactivate User
  - [ ] Delete User (hard delete with confirmation)

**User Detail Panel (Right Panel - Desktop / Modal - Mobile):**
- [ ] Information Grid:
  - [ ] Name
  - [ ] Email
  - [ ] Phone
  - [ ] Role (with badge)
  - [ ] Status (Active/Inactive)
  - [ ] Work Mode (Remote/Onsite/Hybrid)
  - [ ] Member Since (date)
  - [ ] Last Active (timestamp)

- [ ] Edit Button (admin only):
  - [ ] Opens modal with editable fields:
    - [ ] Name (text input)
    - [ ] Email (email input, requires confirmation)
    - [ ] Phone (tel input)
    - [ ] Role (dropdown):
      - [ ] Cannot edit SUPER_ADMIN unless you are SUPER_ADMIN
      - [ ] Available roles: ADMIN, PROJECT_MANAGER, DEVELOPER, DESIGNER, HR, ACCOUNTANT, SALES, CLIENT
    - [ ] Work Mode (radio buttons): Remote, Onsite, Hybrid
    - [ ] Status (radio buttons): Active, Inactive
  - [ ] Save button (validates and updates)
  - [ ] Cancel button

- [ ] **Sessions Section**:
  - [ ] Heading: "Active Sessions"
  - [ ] List of sessions with:
    - [ ] Device info (Browser, OS)
    - [ ] IP Address
    - [ ] Last activity (timestamp)
    - [ ] Session ID (truncated)
    - [ ] "Kill Session" button (removes this session)
    - [ ] "Kill All Sessions" button (removes all sessions for user)
  - [ ] Confirmation modal before killing sessions

### Create User Modal

- [ ] Button: "Create User" (top-right of page)
- [ ] Fields:
  - [ ] Name (text input, required)
  - [ ] Email (email input, required, unique check)
  - [ ] Role (dropdown, required):
    - [ ] All roles except SUPER_ADMIN (unless SUPER_ADMIN creating)
  - [ ] Work Mode (radio buttons, required): Remote, Onsite, Hybrid
  - [ ] Stated Role (optional text input for custom title)

- [ ] **Create & Send Email** Button:
  - [ ] Creates user with auto-generated 16-char password
  - [ ] Sends welcome email via Resend with:
    - [ ] Login credentials (email + password)
    - [ ] Welcome message
    - [ ] Link to login page
  - [ ] Creates default NotificationPreference for user
  - [ ] Shows success message with generated password (display once, no copy button for security)

- [ ] Cancel button

### Hiring Approvals Tab

- [ ] List of HiringRequests needing admin approval
- [ ] Status filter: Pending, Approved, Rejected
- [ ] Each request shows:
  - [ ] Job title
  - [ ] Status badges: Manager Approved, HR Approved, Admin Approved
  - [ ] Created date
  - [ ] Description (preview)
  - [ ] Candidate count

- [ ] **Approval Actions**:
  - [ ] "Approve" button (sets `adminApproved: true`, notifies HR/Manager)
  - [ ] "Reject" button (sets status back to DRAFT, notifies creator)
  - [ ] Rejection reason modal

- [ ] Click request to view full details

### Audit Logs Tab

- [ ] Displays last 200 audit log entries
- [ ] Columns:
  - [ ] Timestamp (sortable)
  - [ ] User (who performed action)
  - [ ] Action (created, updated, deleted, voided, etc.)
  - [ ] Entity Type (User, Project, Task, Entry, etc.)
  - [ ] Entity ID / Description
  - [ ] Changes (shows before/after values)
  - [ ] IP Address (if available)

- [ ] Filters:
  - [ ] Action type (dropdown)
  - [ ] Entity type (dropdown)
  - [ ] User (search)
  - [ ] Date range picker
  - [ ] "Apply Filters" button

- [ ] Auto-refresh toggle (optional):
  - [ ] Checkbox: "Auto-refresh every 30 seconds"
  - [ ] Shows "Last updated: [timestamp]"

---

## 📊 Dashboard

(To be completed in next iteration)

---

## 📁 Projects Module

(To be completed in next iteration)

---

## 📋 Tasks Module

(To be completed in next iteration)

---

## 📞 Attendance & Check-In

(To be completed in next iteration)

---

## 💼 HR Module

(To be completed in next iteration)

---

## 📋 Meetings & Calls

(To be completed in next iteration)

---

## 📝 Documents & Collaboration

(To be completed in next iteration)

---

## ⚡ General Features & Cross-Module

- [ ] **Real-time Updates**: All modules use Socket.io for live data sync
- [ ] **Offline Support**: Progressive Web App (PWA) with service workers
- [ ] **Push Notifications**: Web Push API integration with Vapid keys
- [ ] **Dark/Light Mode**: DaisyUI CSS variables for themeing
- [ ] **Mobile Responsiveness**: Bottom navbar, full-screen pages, keyboard awareness
- [ ] **Search**: Global search across users, projects, documents, etc.
- [ ] **AI Assistant**: Floating sidebar with chat history per user
- [ ] **Export Functionality**: CSV/PDF exports for reports and data

---

## 🔐 Security & Performance

- [ ] JWT-based authentication (access + refresh tokens)
- [ ] HttpOnly cookies for token storage
- [ ] CSRF protection via token rotation
- [ ] Rate limiting on API endpoints
- [ ] Input validation with Zod on all routes
- [ ] Role-based access control (RBAC) on every endpoint
- [ ] Encrypted sensitive fields (passwords, tokens)
- [ ] Audit logging for compliance

---

**Last Updated**: June 5, 2026  
**Status**: In Progress - Accounting Section Completed
