# Two-factor reset: when a member has lost her phone and her recovery codes

**Read before pressing the button.** This is the one way back into an account for a member who can no longer answer the second-factor question. It is also exactly what someone trying to take over her account would ask for, so it is slow on purpose and it leaves a record.

> **Status: the policy below is a proposal and needs the owner's approval.** The code is built and enforces the parts that can be enforced (who may press it, never on your own account, a reason on the record, the member told). *What proof of identity staff must see first* is a human decision the code cannot make. Until the owner signs it off, use the proposal as the default and do not relax it.

## What members have, so most never need this

- On turning two-factor on, she is shown **ten recovery codes, once**. Each signs her in one time if she loses her authenticator. She can type one into the same box as the six-digit code, at sign-in, on Google and Facebook sign-in, and to turn two-factor off.
- She can make a new set any time she is signed in (Settings, Security), which retires the old set.
- Only a member who has **lost the phone and the saved codes together** needs staff.

## What the reset does, and does not do

It does:

- remove the authenticator and delete every recovery code, so she can sign in with her password alone;
- **end every session on the account**, on every device, because a reset follows "I have lost my phone" and a session on a lost phone must not outlive it;
- tell her, in the app and **by email to the address on the account**, whoever asked, with what to do if she did not ask for it;
- when the account is staff (a moderator or an administrator), tell the **other administrators** as well;
- write an audit row (see "The record").

It does not:

- change her password. Whoever asks must still know it, or reset it the ordinary way, by an email to her own address;
- unlink Google or Facebook, or sign anybody in;
- work on your own account. **An administrator cannot reset her own factor**, so removing a staff member's factor always takes two people.

A moderator cannot use it. It is administrators only.

## Before you press it: the proof of identity (proposal)

Do all of the first two. Do the third for any staff account.

1. **Reply only to the address on the account.** The request is answered by an email to the address ATHENA holds for her, and she replies from it. Never act on a different address given in the request, a message on social media, a comment, or a phone number that is not on file. A woman whose partner has her phone or her email is in the group most at risk of someone else asking on her behalf.
2. **Something only she would know, that is not in the email.** For example the date she joined, the month and amount of her last invoice if she has paid, or the name of a mentor or group she has used. Do not accept something that can be read off her public profile. Do not ask for a document: photo ID would put one more sensitive record in a support inbox, and ATHENA's own identity check is run by Stripe, not by staff.
3. **A second administrator, for any staff account.** The second administrator speaks to the member (or the staff colleague) separately and says so in the reason, naming themselves. The other administrators are also told automatically, so a reset nobody expected is seen at once.

Stop, and do not reset, if any of these are true, and tell the owner (whoever is named for safety reports; until someone is, the owner):

- the person asking is **in a hurry** or says it is an emergency, and cannot wait for the reply to the email;
- the account is in **Safe Mode** or has a safe-chat or safety plan, and the request does not come from the address on file: someone who has her may be asking;
- she has reported someone for unwanted contact and the request references that person.

## How to press it

The route is `POST /api/admin/users/<member id>/two-factor/reset`, signed in as an administrator whose own two-factor is on. The body has exactly two fields:

```json
{ "reason": "Replied from the address on file; gave the month and amount of her last invoice; second admin <name> spoke to her.", "identityChecked": true }
```

- `reason`: at least a sentence, at most 500 characters. Say **what you checked and who witnessed it**. It is kept on the audit row for good, so do not write anything about her you would not want read back to a regulator, and no codes or passwords.
- `identityChecked`: the literal `true`. It is you saying you did the above. Anything else is refused.

It answers `409` for your own account and for an account with no two-factor to reset, `404` for an id that is not there, and `403` for anyone who is not an administrator. Nothing is changed in any of those cases.

## What to tell her afterwards

- She is signed out everywhere. She signs in with her **password**, then turns two-factor back on from Settings, Security.
- She must **save the new recovery codes where her phone is not**. A printed copy or a password manager, not a screenshot on the phone she just lost.
- If she did not ask for it, the email tells her to choose a new password straight away. If it turns out she did not, that is a possible account takeover: follow `docs/security/incident-response.md` and tell the owner.

## The record

Every reset is an audit row, filed under the user-update action with the verb `USER_TWO_FACTOR_RESET` in its metadata, naming the administrator, the member, the reason you wrote, whether the account was staff and how many recovery codes went with the factor. Find them in the admin console under Audit logs, or ask for rows whose `adminAction` is `USER_TWO_FACTOR_RESET`. Review them monthly: a reset on a staff account without a named second administrator in the reason is something to ask about.

## If every administrator has lost their factor

Then nobody is left who can use this route, and there is deliberately no back door in the app. Make sure there are **at least two administrators**, so one can always reset the other. If it has happened anyway, it is an operations decision for the owner, who holds the production database credentials, and it must be done by the owner under the care described in `SHARED-DATABASE-HAZARD.md`: the production database is shared with another application, so nothing is run against it casually, and what was done is written down afterwards.

## Decisions the owner needs to make

- [ ] Approve or change the proof of identity above (in particular whether a verified-email round trip plus a fact only she knows is enough for an ordinary member).
- [ ] Decide whether a reset on a **staff** account needs more than a second administrator's word (for example both administrators on a call, or a delay of 24 hours before the first sign-in).
- [ ] Name who holds the break-glass access if all administrators lose their factors.
