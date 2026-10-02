# Safety-critical breach notice — wording template

_Status: **draft for privacy counsel to approve.** Nothing here has been approved by counsel, and nothing here is legal advice. Do not send any of it to a member until counsel has approved the wording and confirmed whether any email may go at all. Counsel is the "Legal / privacy counsel" line in the contacts table of `incident-response.md`, which is still to be appointed._

Use this when a breach may have exposed **Safe Mode, safe chat or safety-report data**: SEV-1 under the Safety-critical addendum of `incident-response.md`. It is the wording for the members who may share a phone or an inbox with someone they are protecting themselves from. Everyone else is told the usual way.

## Who gets this wording

Members in the list you give the breach register who use Safe Mode (a Safe Mode profile with Safe Mode on, or with private notifications on, which is the profile's default) or who have filed a safety report (a report, from the app or from the public report form, about harassment, hate, violence or a threat, something harmful or unsafe, impersonation, sexual content, self-harm or something illegal; reports about spam, fraud or misinformation do not count). A report made without an account has no member behind it, so it cannot put anyone in this group. The register works this out for you and says how many there are before you send anything. It sends them an in-app notice and **does not email them**, unless you also tick that counsel has approved an email and give the subject counsel approved.

There is no separate banner at sign-in. The notice is a notification in her notifications list, with the unread badge, under the title **Account security update**, and it links to her security settings. It is not pushed to her lock screen: push notifications are not used for this.

## Rules for the wording

Write as if anyone could read it, because someone might.

- Do not mention Safe Mode, safety reports, safe chats, violence, abuse, refuges, panic alerts or any support service. Not in the title, the subject, the body or the link text. The register refuses to send these members wording that contains the plainest of those words (Safe Mode, safety report or plan, domestic, violence, abuse, panic, refuge, stalking, coercive); it cannot catch every way of saying it, so counsel reads the whole text.
- Do not say who exposed it, who it may be shared with, or anything that implies a person is a risk to her.
- Say what happened in plain, general terms, what of hers was involved, and what we have done. Keep the legal requirement in mind: under the Privacy Act 1988 s 26WL the notice must tell her what happened and what she can do about it, so the steps below are required for an Australian breach. Counsel decides how much detail the notice must carry and how to carry it neutrally.
- Give steps she can take on her own and without being seen to ask for help: review her sign-in details, sign other devices out, change her password. Do not tell her to contact a support service by a route that could be seen.
- Never put the notice, or anything like it, in a push notification, a text message or a phone call.
- Do not use the words "breach", "exposed", "leaked" or "hacked" in an email subject. The register refuses a subject that does.

## Draft wording for counsel to approve

**In-app notice.** The title is fixed by the register as **Account security update**. Message:

> We found and fixed a problem that may have let some account details be read between [DATE] and [DATE]. We have no sign that anything was misused. The details involved were [KINDS OF INFORMATION, in general terms counsel approves].
>
> What you can do: open your security settings, check the devices signed in to your account and sign out any you do not recognise, and change your password if you are not sure it is private. If you have any questions, you can reach our privacy team through [PRIVACY CONTACT, as published on the website].

**Email, only if counsel has approved sending one.** Subject, as counsel approves: _Account security update_. Body: the same words as above, with no greeting that names her, no signature that names a team, and no link other than her security settings.

Fill the square brackets from the breach record and the OAIC statement. Do not paste in the description of the breach from the register: it will mention the data involved in the language of the incident.

## How to send it

1. Counsel has approved the wording above (and the email, if there is to be one). Write that down in the incident log with who, and when.
2. In the admin area, open **Data breach register**, pick the breach and go to **Tell the people affected**. Paste the member ids.
3. Read the line that says how many will be told in the app only. Check it matches what the investigation found.
4. Put the neutral wording in **Neutral wording for them**. The wording above the box is for everyone else and may say more.
5. Leave **Email them as well** unticked unless counsel has said an email may go. If it may, tick it, tick that counsel has approved it, and type the exact subject counsel approved.
6. Send. The page says how many were emailed and how many were told in the app, and puts back in the box any member who could not be reached, so that sending again reaches them and nobody else.

The breach record then says `IN_APP` or `EMAIL+IN_APP` as the way members were told, and the privacy log records how many members were told by each route and whether counsel's approval was given. It never records which members were in the safety group.

The same route can be called directly: `POST /api/admin/breaches/:id/notify-users` with `userIds`, `notificationContent`, `recommendedSteps` and, for the safety group, `safetyNotificationContent`, and only with counsel's approval `emailSafetyMembers: true`, `counselConsulted: true` and `neutralSubject`.

## What this does not do

- It does not tell a member who has no account, or whose account was erased.
- It does not reach a member who never opens the app. Whether to try another way, and how, is a decision for counsel, because every other way can be seen by someone else.
- It does not replace the notice to the OAIC. That is a separate step in the same register.
