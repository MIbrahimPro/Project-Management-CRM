# CRM Live Cleanup Checklist

Status legend: `[ ]` pending, `[~]` in progress, `[x]` done.

## Projects
- [x] Add temporary feature flags for meetings, AI, attendance, and task board.
- [x] Hide meetings/recordings/AI/attendance surfaces without deleting code.
- [x] Improve project cards so milestone progress reads clearly without milestone status suffix.
- [x] Keep project statuses and document their current meaning in UI/code comments where helpful.

## Project Dashboard
- [x] Redesign the manager "Edit Details" modal.
- [x] Always render the Client block, showing "No Client" when empty.
- [x] Remove dashboard milestone edit modal/button; milestone add/remove stays in docs flow.
- [x] Make project title, description, client, team, milestones, and tasks update live.
- [x] Redirect viewers to `/dashboard` if their project access is removed live.

## Project Tasks
- [x] Fix Manage Assignees loading by providing a real project members source.
- [x] Emit and listen for live task create/update/assignee events.
- [x] Hide task meetings/recordings actions.
- [x] Keep task description save-based live updates.

## General Tasks
- [x] Keep list view only and remove board view switch.
- [x] Open task pages directly instead of the task detail modal.
- [x] Use BlockNote-style description editing on task pages.
- [x] Make general task create/status updates live.

## Chat
- [x] Fix unread sidebar badge count.
- [x] Remove hover reaction toolbar and keep right-click/long-press reactions.
- [x] Enforce one reaction per user per message.
- [x] Add pinned messages tab to chat info.
- [x] Fix member/profile hover z-index/overflow.
- [x] Replace notification sound with a classic two-tone tone.
- [x] Check file/media message persistence path.

## Documents
- [x] Hide all BlockNote AI toolbar/slash-menu actions.
- [x] Fix Markdown export to serialize real markdown instead of plain text.
- [x] Print only document content, not the whole application/editor chrome.
- [x] Keep Hocuspocus collaboration intact.

## Performance
- [x] Avoid full-page refreshes where socket updates can patch/refetch a small resource.
- [x] Prevent failed async loads from spinning forever.

## Verification
- [x] Run `npm run typecheck`.
- [x] Run `npm run build`.
- [ ] Smoke test two-session live updates for Project Manager, Developer, Client, and Admin.
- [x] Run `reporose analyze` after implementation.

---

# Raw Dictation Notes

‌The sidebar UI needs a bit of tuning. Not much but the padding of the individual buttons needs to be adjusted a bit to look more clean. 
‌The Projects page: when you land on it and you see the current projects or even the past projects, you can see in the cards there is milestone, current over total, then there is a dash, and then there is a status. Remove this status and make the milestone 0 out of 7 or 1 or 5, whatever the number is. I mean it is project dependent but make it better represented, not like this. It should be better represented instead of like this. 
‌The project status: I see two of them, pending and active, and I also see completed. I see three of them: completed, pending, and active. What do these mean and do they need to exist? Can you explain to me what they mean and everything so I can tell you whether to keep them or not keep them? 
‌When the project manager tries to edit the details by going into the project dashboard page, clicking the three dots, and then clicking Edit details, the UI is very bad. I want you to change it to look better. This pop-up is looking ugly. I want it to look better. 
‌And this is a major task but I will keep reminding you as we go through this document. For example if we are in the project dashboard and the project manager changes the project name or project description, it should be live updated in every other person's view. For example I changed the description for one project and I had the developer open in another browser and I did not see it live change the description.

The major change is that all of the pages should be live. The static information is, of course, static but anything that is dynamic should be live. If the data is changed it should be live changed on the person's UI too. Everything should be live. This is a major rule: everything should be live, no need to reload. Anything dynamic on the page should be live changed as you were going through it.

Also about this some things that live change but you are not on its page may give you a notification about that. You can think about what should make sense and what should not. Let me just give you some examples:
- Chats give you a notification.
- Milestone changing gives you a notification.
- Project description changing does not give you a notification.
- Project team members changing does not give you a notification.
- Client changing does not give you a notification.
- A question getting answered gives you a notification and stuff like that.
 This should also work with live access control. For example if I remove your access for this project and you are currently seeing that thing, you are logged out of that page and directly into the main dashboard page so everything is live. 

Now I don't know how you implement it but it should be lightweight. I don't know: is it a master socket or something, or does everything get an individual socket, or some event loops or whatever? It should be light and it should be for everything that is dynamic, whether it is the DP of someone else, whether it is chat or a document updating, questions or answers or anything. 


‌We are removing meetings not permanently. I don't want you to permanently remove meetings. I want you to temporarily remove meetings so that for now we do not have meetings but when we want to add them we can just add them later on.

For now in the project side panel there is a meeting button. Also in the dashboard there is a meeting button. Don't remove them permanently. Just remove them so we can later on get them back. For now just hide them or something like 




When a Project Manager is editing a project in the dashboard page and he clicks the Client edit button and he selects No Client, the client field block goes away. That should not happen. Rather we should see the client field block but it should say No Client.

The block is gone. How do I add the client back? There is no way to add the client back or a different client or anything. The client is totally gone now. The block should remain but it would say No Client. 

Also check this error with that team editing, although I know for that team you cannot remove the manager or the admin so it would happen. Still you should check it out. Also the recording view clips etc., because we are removing meetings, so hide that recording part too. Then the milestones part. Okay let me check this.

When we have the edit button for the milestones, when we click it, it opens a little pop-up where it says "Edit milestones" and it opens milestone one. There is the title and then there is the block not section and then etc.

Remove this edit button. For us to create, I mean add a milestone or stuff like that, it should not happen through here. Rather it should happen from the milestone docs page. From there you should be able to add a milestone or remove a milestone, not from here. From here remove this pop-up and everything. 

Also for this whole project dashboard page I want you to check that everything dynamic should be live between client, project manager, and developer. For now our main objective is developer, client, and project manager, and of course project manager and admin are the same so only four of these should be good and then we can work our way to get the other ones good as well.

For now get this project dashboard page all live:
- everything
- task creation
- the same milestones
- milestone statuses
- the name of the milestones


Even if someone adds the milestone from the milestone box, because it will change, it will be from there. If someone adds or removes everything, it should be edited here to be live. Also editing milestones does give the team members a notification. The notification, of course, it is a browser-based application PWA
So I don't know how much you can do for it but the PWA should be able to send out push notifications. If it can't, I don't know what you should do but if it can then just make it be able to send out. 

Also creating a project task should get us a notification and I think it does but the dashboard project task section does not get live updates so that should be fixed. 


In the project then task and task details page, there are still the start meeting and recordings buttons and you need to hide those buttons. 


So why is everything so slow? Is it because of super base something or is it because of neon or something like that, or is it because I am running it locally? I mean I did the `npm run dev:prod` so it is already compiled. Still the data is loading up too slowly. 


I mean especially the part when I'm logged in as a manager and go to Projects > Tasks and then I go to Assignees > Manage. The Manage Assignees loading members is not loading. It is just spinning around forever. 


The block note section for the tasks, task details page, the description block note section is not live. It should be live. Why is it not live? 

Changing the status of the task does something but it does not do anything in anyone else's view. It is not live updated or something like that. That should be fixed. 

As I'm thinking most of the things are because of not live updating so everything should be live updating. 

I did check the vault page before but I want you to double check that everything is being live updated:
- everything in the vaults page
- everything in the assets page
- everything in the questions page


in the assets stuff like the SVG, I mean hidden from client and client visible, and even stuff like added, deleted, or stuff like that. Everything should be live or updated on everyone's view even in the questions page:
- question adding
- question approved
- question answered
- question re-answered
- anything
- everything


should be live updated. 


Even stuff like these sidebar numbers, for example the number with the chat that is coming along, should be the number of unread messages. For example right now I am seeing a 30 in the managers view but there aren't even 30 total messages in the chat. There are only three messages that I did during testing and there are only two messages and it shows 30 over there. I don't know what bug it is but it needs to be fixed.

Other than that if you go into the project managers chat, into any chat team chat or client and manager chat, and you hover over it, the hover over the name of the members, the drop-down Z index is very wrong. Also when you hover over the profiles, the Z index over overflow is wrong. Also about the chats, when you hover over them we get this reactions panel but the reactions have a bug. I don't know what kind of bug it is but you can add as many reactions as you want. You can add thumbs up, hearts, laughing, all of them. For each one you can add only one heart but you can also add a thumbs up. This is a bug. You could only be allowed to add one.

Also when you right-click we have that reaction that everything on it so it should only work from there. Except for a hover one, remove the hover one. Only when you right-click they should be the copy text, reply pane, and everything, and there should be those reactions and you should only be able to do one. Once that is done that is the selected one for you.

Also when you open the chat info page, the overview, members, everything, they should also be a thing for pinned messages, where you can see all the pinned messages and go to the message to go to that message. I also want you to double-check everything, like the emojis and everything, that everything is working, even files. Sometimes the file does not get, really, once you send it. Next time you reload it and the file is not present. I did notice it once. I don't know if it is a bug or I just happened to have it one time or something like that but I want you to check it too. 

The notification sound is very ugly. It should be a classic notification sound. Note this ugly sound which is happening right now.

Also in the desktop view the AI bubble covers the record audio button. Just like we removed the meeting, we did not completely remove it but we did hide it. Same like that I want you to hide the AI button, the AI widget. I want you to remove it and not remove it entirely but hide it so later we can add it back. For now we are hiding this AI button. 


The milestone docs page, when you select, we have that in this toolbar, which has the format select text and also write with AI text. Hide them for now. Don't remove them entirely.

Also when you want to add a new block and you do a /, there comes a little menu. It has a write with AI button. Hide it for now. We are removing all the AI features for now at least. Also all the live ones should still work. The document is live but just keep it good, okay? 

- Export as MD file is not correctly exporting as an MD file; rather just text is being exported. The export button "Export as MD file" should work correctly.
- About the print button, it kind of wants to print the whole page instead of just the document. That should be fixed. It should print the document instead of the whole page.
- The document should be custom rendered instead. I am also seeing other people's cursors, the live editing cursors. I am also seeing those and also the other everything UI that should not be shown.
 

The dashboard, also the project dashboard, everything should be correctly identifiable and everything should be correctly laid out.

The other main thing that we are focusing on, other than projects, is the chat page. On the chat page the same changes as I said earlier should be made, but here I mean:
- the hover thing
- the bugs, etc.


Also remove the AI widget from here and hide the video call button, etc. 

Also the General Tasks page should correctly show everything. There are two views: a list view and a board view. Make list view the default view and remove board view and this changing views thing. This should only be a list view and you should be able to do anything with it but only list view, and creating the husk and everything should be live. Also project-wise tasks, I know they are showing but please re-check it so everything is correctly being shown and live editing and everything.

Also when you click a project task, when it opens up in a pop-up, I don't want that. When you click a project task it should take you to that project task page. As for other types of non-project tasks, they should open up in a new page. For now the description isn't even a block note so that should also be fixed then. I mean re-check everything in this page.

For now only focus on the projects, chat, and tasks and everything inside projects. Also maybe hide attendance in the main page. There is this attendance section; hide it. Also in the top bar there is this check-in and everything; hide that too. Other than that user management and everything, we'll come back to that later.
