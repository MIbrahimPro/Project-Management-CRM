# DevRolin CRM - Requirements & Feature Checklist

> **MOST IMPORTANT FEATURE:**  
> **THE CRM WILL BE LIVE.** 
---

## 🏗️ Platform Requirements

- [ ] Desktop: Linux, Windows, macOS
- [ ] Mobile: iOS, Android (responsive design)
- [ ] **Real-time Architecture**: Socket.io for live updates across all modules
- [ ] **Apple Design Language** for default light & dark themes
- [ ] **Multiple Themes**: Not just dark/light (support: devrolin, neutral-dark, neutral-light, pink, pale)
- [ ] **Responsive Layout**: Desktop sidebar with icon-collapse on hover → phone bottom navbar

---

## 👥 User Roles

- [ ] **SUPER_ADMIN** - System-wide control (hidden/future use)
- [ ] **ADMIN** - Full organization access (same permissions as PROJECT_MANAGER for now)
- [ ] **PROJECT_MANAGER** - Project creation, user management, approval workflows
- [ ] **DEVELOPER** - Project work, task execution, document collaboration
- [ ] **DESIGNER** - Project work, social media content creation
- [ ] **HR** - Hiring, attendance management, candidate pipeline
- [ ] **ACCOUNTANT** - Financial tracking, invoicing, budget management
- [ ] **SALES** - Business development, CRM functions
- [ ] **CLIENT** - External stakeholder (limited access: approved chat & project updates)
- [ ] **HIRING_CANDIDATE** - Temporary role for job applicants (separate from main users table, can escalate or apply)



here is a more detailed of each thing


there is a sidebar, and navbar (on a pc of course,, on the phone,, it will be responsive,, and for phone we can have a bottom bar or something)
(on a pc,, the sidebar, will always collapse into just icons, not text,,,, only shown when hovering over the icons, )

the navbar (bottom bar for phone),
will have a button with persons pfp and name and role (only pfp in phone)

for the pc, 
when you click it, it open a little menu 
here you can change the theme, open settings, logout button, open profile 

for the phone, it will direct open the profile page, 
and there you can click to go to settings, 
where you can change the theme too or logout too



the profile page will have pfp, name , role, remote/onsite/hybrid
phone, email, member since, salary, contracts, work timings

the following will be editable
name, pfp, email, phone, 
(changing email requires an otp sent to old email,, through resend)

the following is just informational
salary, role, member since, remote/onsite/hybrid(work mode), work timings 


contracts will show a state and a button 
state can be internship/employed
button will be show contracts,, and will take to contract page

(everything on profile page will be live edited,,, if someone changed your salary or work mode or anything,,, it should be live updated, 
if you change something like a pfp or name or anything,,, it will be live updated for everyone)


contract page will have cards of contracts, 
for every person 
there can be multiple contracts, but only 1 of them will be active (maximum 1, minimum 0)

newest active contract will be shown at the top

contract will have the following things, 
title
type = employement/internship
date from 
date expiry 
anda file
signed (true false)
this file will be a pdf, 
and you can click to open it in a model to view it


everything on this page should be live too
any contract changes and everything, should be live updated

the user cant change anything,,, only view



the settings page 
this will have the following options
change passowrd (old, new, repeat new etc model,,,, also a forget password mechanism using something like resend api to send otp and get the otp and etc)

currency pereference, (the user can choose any currency from major currencies,,, or even pkr)

theme change options

and 

notification perefernces
which will include 
push notification, and differenct categories of notifications, 
like, 
chat, project, meeting, task, 
also 
differnt config for during work hours and outside work hours




notifications page, 
navbar (or topbar something on phone)

it will have a list of all notification recieved and etc, 
and unread and read notifications and everything 
live page btw, 
also

smart, 
in a way that, 
if I got a notification for a chat, and I read the chat,,, then th enotification is also marked read




sidebar will have a chat page (bottom bar for phone)
this button will also have a number with it (or not if 0),, which will show the number of unread messages

CHAT PAGE

on a phone
it will open up a list of all employees you can chat to according to your role, 
and also groups you are part of
at the top we have a search bar to search for contacts etc


on a desktop,, this part will be a sidebar (like,,, an inner wider sidebar)

all the person's pfp will be shown, and name, and last message or reaction or etc 
also showing indivisual unread messages 



roles and allowed chatting

the roles 
manager, admin,  
can chat with anyone and any group

the roles client, can ONLY chat with manager or admin or any group they are part of

the roles 
sales, 
accountant,
developer, 
designer, 
hr, 

can chat with everyone, EXCEPT the client, 
and any group they are part of 


the sidebar (or the contacts etc page,,) will have a create group button too,,,, but it is only available to the manager and admin 
when creating a group, 
you specify a name, a pfp, users (this list of users have ALL the users EXCEPT the person himself,,,, ofcourse he is already part of the group he is creating)
and mode : admin messages only,,, or all can message
admin also includes managers, 
and in admin only mode, 
only the admin and managers are allowed to message,, no one else






when you click a chat, 
it opens, (for pc on the right side,,, for phone, in a new page etc)



the chat has almost all features of whatsapp,, 

proper reactions, 
file attachments, (and even image or file paste from clipboard)
voice messages,
reactions, 
star messages 

typing indicator
online and total members for group
and online or last online indicator for direct

groups will have stuff like pfp of the person who send the message and a little name along it (just ike whatsapp)


admins/managers can also change settings of a group,,
(same ones when creating)


you can also click the group name, 
and see stuff like , group media, and links, and starred messages


everything on this page (and every other page is fully live updating)



then we have a social media page
this page is not accessible to all
only to these roles

admin, manager, designer


this page 
will have a button to create a new social media Section 
(this button is only availble to admin and manager)

this opens a new model where you can choose the following 
a name (like instagram, linkedin, etc)
and icon (image upload,, or select from available,,, some default available)
and a description
and members (this will only show designers,,, all admin and managers are in all social media sections )

this will create a card on the page,,,
(with genral stuff like,, name icon descriptions, and total posts and pfp of people in it )



all of the live updated to all (the roles that are allowed to see it (just the 3), will get notification)

clicking a card will open it's details page 


this will have the following sections
starting with title desicprion 
and members pfp jumbo
(pfp members jumbo means ,,, maxximum 3 pfp,,, half overlapping each other,,, and then a + 1memebr or etc,, but if eactly three,,, then only pfp,,, if less than 3,,, then 2 or 1 pfp,,, same pfp jumbo on social media cards)

we have a manager memebrs button(only for manager and admin,, where he can add or remove memebrs in the section)

also showing how many memebrs are online



under 
we have a section 
saying ongoing posts, 

this section will also have a add post button (all can)

and you can add a post, 
the following things will be asked

post title
and that's it,,, 
post created,, (once created cannot be deleted)
a card is shown in the section 

clik to open a model (or a page for phone)

it has the following things

status (Default idea,,, alos have, progress, review, approved, published, rejected)
anc change status (only available to man and admin) 
    this button works as follows, ,, when idea,,, you have a button to change to progres,,, but also a dropdown button,,, go over it,, and you can see all other options too,,, also the default change to button is as follows
        for idea,,, change to progress, 
        for progress, change to review, 
        for review approved, 
        for approved, published, (when changing to publish,, it will also ask a date as a popup,, which will be posted date)
        for rejected, review, 
        once published,,, you cannot change status

description 
this is a appflowy section
more on how this section work under

then a media section 
showing all media,,, and each one has an image and a little status under each as active, or inactive
(view square and type cover,,, but you click to view the media full screen)

also a add media button (available to all)
by default media is active, 
you can click on a media to view full screen and also have a button to inactive it 

the latest active media is used as the post's thumbnail, 
and also 
if not media,, we have a placeholder

under it a save button,,, which will save it, 
also a delte button(ony for managers and admin)
    but we cant delete,,, it will just go into a archived section,,, and you can go into archived section(a button somewhere top pf page) and unarchive it too

the card will show stuff like, 
thumbnail, post name,, created date(or is publised,,, then published date)

published post can be archived too



after a post is approved,,, or published, 
itis not shown in ongoingin current posts section
rather below it we have another heading for past posts, and we show it there

the rejected, idea, progress, review, all show in the current sction 


everything on this page is live updated for all and etc

also 
we have a ai button (navbar for phone and floating widget etc for pc)

the ai will open up a page (or for laptop,,, a section slided in)
where you can chat,,, you can click new chat to start a new chat too,, 
old chats also saved,,, 
per user different

also 
you can click setting to open a memory prompt,,, where you set different memories for it,,, so it rememebers it accross chats


all this social media and everything will be live updating and etc


Accounting
this involves
admin, manager and accountant

this page,,, I dont have that much detail,, 
but should be able to do the following,, 

add expence and income(ontime)
add recurring expence, and also add reminders, 
store invoices, 
and everything live updating





admin user management


appflowy sections



notes

keyboard on phones should be kep in mind and when opened,,, it should be detected and the view should be brought up so it is not behind the keyboard