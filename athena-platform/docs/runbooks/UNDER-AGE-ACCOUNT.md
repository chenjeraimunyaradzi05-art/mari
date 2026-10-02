# An account that belongs to someone under 18

**Read when someone reports that a member is a child, when a member says she is one, or when a date of birth on file turns out to be under 18.**

> **Status: needs the owner's and counsel's sign-off before public launch.** The steps are written to be safe by default. The legal position (see "Decisions" at the end) is open, and nothing here is legal advice.

## What the platform's position is

- ATHENA is for **adults: 18 and over, everywhere** (Terms 2.1 and 12.4, Privacy Policy 11). There is one minimum age. There is no tier for younger people, and **no parental-consent path**, and none should be built until safeguarding, age assurance, consent, moderation and reporting duties for children have been designed properly.
- We **ask** every member for a date of birth when she joins (email, Google or Facebook), and the server refuses an account without one that is 18 or over. That date is **what she tells us**. We do not call it verified, in the Terms or anywhere else. The only thing that stamps a date as confirmed is a document check, and that is an extra step, not part of joining.
- A date a member gave that makes her under 18 cannot be on a new account. An account that is under 18 today got there by giving a false date, or is an older account, or was reported.

## What the platform does by itself

| Situation | What happens |
|---|---|
| No date of birth on the account (it was made before the date was asked) | She can read everything. The first time she tries to post, comment, join, message, buy or anything else that writes, she is asked for her date of birth once (Settings, Profile, or the prompt on the phone). Until she gives it, every write is refused with `DATE_OF_BIRTH_REQUIRED`. Her privacy rights, safety help, appeals, signing out and deleting her account always stay open. |
| A date of birth under 18 is recorded on the account | Every write is refused with `MINIMUM_AGE_NOT_MET`, wherever it is attempted. She can still read, see her settings, reach safety help and use her privacy rights. Nothing about the number is said back to her. |
| She tries to give a date under 18 | Refused, in the same words as any other bad date, so the form is not a calculator. |

The date of birth is the member's own word and can be given falsely. She cannot edit it once it is set; there is no staff screen to change it either, so a wrong date is corrected by an engineer on request.

## When you hear about a possible child

1. **Do not interrogate, and do not reply in public.** Reply only to the address on the account (or to the person who reported her, by the route they used). Do not ask for a photo of her or of a document.
2. **Is a child at risk right now?** Look first for signs that an adult is contacting her, asking her to move to another app, asking for photos or money, or that she is being harmed. If so, this is a safeguarding matter before it is an account matter: **preserve what is there, do not delete anything yet**, tell the owner at once, and ask counsel how to report. In Australia that can mean the eSafety Commissioner (esafety.gov.au), the Australian Centre to Counter Child Exploitation (accce.gov.au) and the police. Counsel confirms which, and when.
3. **Close the account to everyone else.** In the admin console, Users, **Suspend** it, with the reason "Account holder may be under 18". That ends every session and closes her sockets at once, and nothing new can be made from the account. (Whether what she already posted stays visible is not something this step does; ask the owner if it matters.) Do **not** use Ban: a ban records her address against re-registering, which is not for a child.
4. **Decide whether it is a child.** A report is a reason to suspend, not proof. If she replies from her own address and says she is under 18, or a document check shows it, that is enough. If she says she is an adult and the date on file agrees, ask the owner before reinstating (Users, Unsuspend).
5. **Delete her personal information promptly, as Privacy Policy 11 promises**, unless step 2 told you to hold it. Aim for **five working days, never more than the 30 days the Privacy Policy allows for other requests**.
   - Use the full erasure: `DELETE /api/admin/users/<id>?hard=true`, as an administrator. It runs the same erasure the data-rights page runs: every table that holds her, the identity checks held at Stripe, her date of birth, and it **ends any membership she was paying for at Stripe** before anything else. If Stripe cannot be asked it refuses and changes nothing, so try again.
   - It refuses, and says why, if the account is under a **legal hold**. Do not lift a hold to do this; ask the owner.
   - Records we are required to keep (payments and invoices, seven years) stay as a shell that names nobody. It carries no date of birth.
6. **If she paid**, her membership has been ended. A refund is the owner's decision; an administrator can make one from the admin console, Subscriptions (the first-payment refund Terms 6.3 promises).
7. **Write down what you did** in the reason on the suspension and in the owner's incident log, with the date: not her name or anything about her you do not need.

## What to avoid

- Do not unsuspend because she sends a new date of birth. The date on the account is not editable by her, and a new one the next day is the reason to look harder, not a way back.
- Do not keep a screenshot of her profile "for the record". The audit log already says who did what.
- Do not tell anyone who reported her what happened to the account beyond "we looked at it and took action".

## What the staff screen shows

Suspended accounts show the reason you wrote, in the Users list, and it is read on appeal. An under-18 account's suspension reason should say only what is needed to find it again.

## Decisions the owner needs to make

- [ ] **Legal position, before public launch.** Australia's social media minimum age rules (the Online Safety Amendment (Social Media Minimum Age) Act 2024, in force from 10 December 2025, administered by eSafety) can apply to a service with a public feed, stories and direct messages, and eSafety expects "reasonable steps", not a typed date. Ask counsel whether ATHENA is an age-restricted social media platform, what steps eSafety's guidance would expect of a service that says it is adults-only, and whether the OAIC's Children's Online Privacy Code (being developed under the Privacy and Other Legislation Amendment Act 2024) changes anything for a service that declares itself adults-only.
- [ ] **Whether a document check becomes mandatory** for accounts with no date of birth, or for anyone reported, using the Stripe Identity check that already exists. Today it is optional and is the only thing that stamps a date as confirmed.
- [ ] **Who is named for safeguarding reports**, and who counsel is, so step 2 has a person at the end of it.
- [ ] Approve the corrected Terms 12.4 wording (it now says ATHENA asks for a date of birth and does not call it verified).
