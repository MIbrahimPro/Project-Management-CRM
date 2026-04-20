# Meetings

## Implementation Status (2026-04-20)

### UI Customization
- Theme-aware Jitsi colors based on the CRM user theme: **Completed**
- Minimalist toolbar cleanup in self-hosted Jitsi (Help / Feedback / Invite removed): **Completed**
- Read-only participant name + virtual backgrounds disabled in self-hosted Jitsi: **Completed**
- Agency-logo watermark wiring: **In Progress** (plumbing is done; final logo path is still needed)

### Projects
- Project meetings page (schedule, start, join, client meetings, recordings list): **Completed**
- Project meeting prejoin/join flow: **Completed**
- Project-scoped meeting invite modal in CRM shell: **Completed**

### Project Tasks
- Start meeting directly from a project task page: **Completed**
- Task recordings modal on the project task page: **Completed**

### Not Finished In This Pass
- 1:1 meeting special rules: **Pending**
- General group meeting special invite/waiting-room rules: **Pending**
- Social media/general task meeting parity: **Pending**
- Empty-room auto-end timers / host-return grace timers: **Pending**
- Full subtype-specific invite restrictions across every meeting type: **Pending**

## 0. General
- Roles Managers and Admin are equal,,, so whereever I say manager,,, I mean admins to
- NO Virtual Backgrounds, 
- NO performance tuning, It will be auto (static or dynamic) done,, and priority smooth over quality 
- NO name changing, 
- NO Breakout rooms, 
- Minimal whiteboarding, 
- Meeting Ends means that if someone joins the meeting, he gets a toast saying meeting was ended, and can't join it

## 1. Types
- A meeting can of the different types, like a Project meeting, or a general task meeting, or social media meeting, hiring meeting,, ALl of which  can be started from their own pages
- In general 1:1 chat, there is a video call button, it starts a meeting, this is a private 1:1 meeting
    - You can't add people in it,,
    - This isnt recorded, and can't be recorded, 
    - NO one is host,, both have control over themselves
    - It is more of a video call,,
    - YOu can see each other perfectly, and clean UI, and camera mic, and screen raise, 
    - NO hand rasise
    - No invite button
    - NO meeting chat 
    - Anyone in chat can start it, it send a join request with a button to the other person, also sends notification
    - The meeting ends as soon as both leave the meeting,, so if there is 0 people in meeting it ends (maybe a 20 something second buffer for errors)
    - Manangers and Admins can have 1:1 meetings with clients,, but this one will be recorded, and be present in the chat, and through clicking client name in chat, and going to meetings recordings section 
- General chat has groups,
    - Everygroup has admin or managers and they can start the meeting,, no one else can,
    - Anyone can click the join page and go to waiting list
    - If there is a Manager or admin in group,, they all are hosts,, and anyone joining can be admitted by them and also kicking out, (If no admin or manager,,, then no one is host, and anyone can join, no waiting list)
    - Handraise, invite, link copy, meeting chat, all features available
    - Whe meeting is started the request and button to join is sent in group,,, 
    - The manager can click invite button, which will open a list of all persons in the organization minus clients, and everyone has a invite button in front,, which will send inite request to the personal chat with them and notify them,,,, there will also be a copy invite link button, and you can send that to anyone, 
    - As soon as the Meeting is started,, a server side recording is started, and the recording stops when the meeting ends,,, the meeting recording is sent to the group in chat,, and also available by clicking on group name and seeing the meeting recordings section 
    - Meetings end when there is no one in meeting for 10 minutes straight
- Projects, Tasks, Social Media 
    - These have team and client meetings
    - Projects have a meetings section,,, social media and general tasks should have that too 
    - ANyone (who is not client) can start or schedule a Team meeting, 
        - A team meeting is normal, and client can't be invited into it,, also anyone not in the Project can't be invited into it
        - The meetings is recorded and is saved, and is visible to all project members, even if they didnt join it,,, but not visible to client
        - There is still a copy link t oinvite button,, but it will still try to block if it recognizes him as client or non project etc,,,, guests are allowed
        - Meetings and recording ends if empty for 10 minutes, 
        - All are equal, but if Manager or admin joins, they become host,,, and they anyone else joining f=gose to waiting list, 
    - Client Meetings can only be started by Project Managersor Admin, 
        - Clients can not immediatly start a meeting but can schedule it
        - NO one can join this meeting,,, even if no one is inside, 
        - Admins and managers can join, and then they can admit other, 
        - If Managers and admins are not in the Meeting, People joining get a message Meeting not started yet, 
            - Although if admin comes and leaves,,, then the person is in waitlist, and admin can come back and admit him
            - If admin Leaves a silent timmer startes for 5 minutes,, if admin or manager doesnt come back,, meeting ends, 
        - Meeting recorded and available to all in Project including client.
        - Invite can be sent to team members by anyone,, even normal members to admin
        - INvite to client can only be sent by Managers
        - CLient can't invite anyone
        - CLient and all people can however copy invite link and send to anyone
- General ALl Meeting   
    - A new section appears in general sidebar,, available to all except clients, 
    - This holds all meets recordings you have access to as cards, 
    - A start meeting button appears here, but only for HR, manager or admin
    - This can be used to start a meeting ot Schedule a meeting, 
    - NO one is notified, about this meeting started, 
    - THe one who scheduled it, can decide who is invited,,, and then they are invited and notificied, 
    - Managers and Admins and invited by default and can't be exempted, 
    - AFter meeting is started you can invite anyone over from the members 
    - Recording only available to people who joined

 


## 2. Scheduling and STarting and UI

- A scheduled Meeting will be availble and anyone (who have access) can see time and how much time reamining for it to start
- Once started,, you can see join button and join it
- And then that admin logic and everything 
- Scheduled meeting can be cancelled by the one who created them,, or by managers admins
- When you schedule a meeting, you are asked for the Name of the meeting and time of meeting 
- When you start a meeting,, name of meeting, 
- Meeting notification is sent to people and also, 10 minutes before meeting again, and then when started again 
- WHen joining you first get shifted to a new tab, where you see a white page, with Meetign title and your name and Camera and Microphone settings, 
- You can't change your name,,, it is the Name in use in the organization, (FOr guests,,, we go for a random astronomical non existant name,,, like silver fish and etc,, )
- When you turn on or off your microphone and video,,, and permissions management,,
- There is a join button,, when clicked turns to waiting to be admitted,,, or depending on state and type,, you get admitted, 
- IN the meeting, YOu can see 1 main big tile,,, multiple persons can share screen, but you click on the screenshares to see them in the middle as big one,
- If no one is sharing,, you see enlarged of the person speaking etc
- Ui is mostly like Google meet, except,, it has themes,,, the daisy theme setting of the person in his settings (like light, dark, retro, pink etc)
- It has bottom BAR (not a doc) which has clean UI for following
    - middle
        - microphone, (with options to mute unmute and a little arrow to pick input device, and test input device in a little model)
        - VIdeo same as microphone
        - end meeting or leave 
        - screenshare
    - Right
        - View participants (which opens sidebar left with prticipants) more on this sidebar below
        - Admit (bubble to show people waiting,, and pulsing if not seen a new one), opens a model which can be used to select people who will join and etc
        - 
    - Left
        - Hand Raise
        - Message Opens sidebar from right
- Top has meeting name and timer,,, but goes away and only comes when mooving mouse,,, same with bottom bar
- The participants sidebar has list of all participants, and shows mic and video staus, and you can click it to turn of (if you are host,, normally the manager or admin,,, othervise on one can do that)
    - It will also have invite button (depending on the type), which will close sidebar and open model  
        - this model will have all the people allowed to be inbited, 
        - It will also have invite link copy button 
