# Host employer checks (apprenticeships)

_Version 1.0 — 2026-10-01. States what is true in the code today. Sections marked **[COUNSEL]** need a lawyer's confirmation before the policy is treated as settled; sections marked **[FOUNDER]** need a decision only the founder can make._

An apprentice is often a young person starting a first job, placed in a workplace
ATHENA has never seen. This document says what ATHENA checks about the
organisation that hosts an apprentice, what it deliberately does not check, and
why. It is the policy the product describes to members, so the product must not
say more than this does.

## The rule

An organisation may place apprentices through ATHENA only while **both** of these
are true:

1. It is **verified**: a member of staff approved its employer or educator badge
   (`Organization.isVerified`), after looking at its ABN and website.
2. It holds an **approved host safety attestation that has not run out**
   (`HostEmployerSafetyAttestation`, status `APPROVED`, `expiresAt` in the future).

"Place apprentices" means every step that puts an apprentice in a workplace:

| Step | What the server does without both |
|---|---|
| Create a listing | Always creates a **draft**. The status in the request is ignored. |
| Open a listing (publish, or set it to OPEN) | Refused with a 409 that tells staff what to do. |
| Apply | Refused with a 409 that tells the applicant why. Nothing is written. |
| Offer a placement, or confirm one | Refused with a 409. No seat is claimed. |

Moving an application along (screening, interview) and turning one down are not
refused: they promise nothing. An administrator is held to the same rule, because
the rule is about safety, not about who may edit.

**Which organisation is checked.** The host employer named on the listing. When a
listing names none, the training provider (RTO) is the organisation an apprentice
would be working under, so it is the one checked. A listing that names neither
cannot be opened.

The check is read at the moment of each step, from the attestation's end date. There
is nothing to sweep: when an approval runs out, the next step is refused, and the
listing shows as "not yet safety-checked" without anyone having to take it down.

## What an organisation attests

An owner or admin of the organisation (an accepted membership, not an unanswered
invitation) answers seven statements, each yes or no, and **every one has to be
yes** before ATHENA will look at the request. If something is not in place, the
organisation is told to put it in place first; it cannot send a "no" and ask to be
approved anyway.

1. A written work health and safety policy that covers apprentices.
2. Workers' compensation insurance that covers apprentices, as the law of its state requires.
3. Every apprentice works under a named, experienced person.
4. A safety induction and the protective equipment the work needs, before the first shift.
5. Incidents and injuries are recorded and reported as the law requires, and apprentices know who to tell.
6. An apprentice can raise a complaint about harassment, bullying or an unsafe workplace with someone other than the person supervising them, without penalty.
7. Where an apprentice is under 18, the organisation will meet its own state's obligations for people who work with children and young people (in Queensland, the Blue Card system), and those checks stay between the organisation and the people they concern.

It also gives a **named safety contact** (a person an apprentice can tell, with an
email address or a phone number) and its **ABN**.

The wording is versioned (`HOST_SAFETY_VERSION` in `host-safety.service.ts`) so an
old attestation can be read against the wording it was given for.

## What ATHENA does with it

- **ABN.** Checked for format (the ABN checksum). When `ABR_GUID` is set, it is
  looked up on the Australian Business Register at the time the attestation is
  sent, and an ABN the register does not know is refused (nearly always a typo).
  Only the **entity name and the ABN's status** are kept from the register's reply;
  the rest of the record is the register's to publish. When no lookup is
  configured, or it cannot be reached, the attestation records that as such. It is
  never recorded as a pass, and the reviewer is told to look the ABN up themselves.
- **Staff review.** A member of staff reads the attestation and writes down, in a
  sentence or two, what they did to be satisfied: called the safety contact, looked
  the ABN up, asked for the policy. That note is **required for either answer**, is
  kept in the audit log under the member of staff's name
  (`HOST_SAFETY_ATTESTATION_DECIDED`), and for a refusal is the reason the
  organisation reads.
- **Term.** An approval stands for a year unless staff set another term, up to two
  years. An organisation can renew in the last month.
- **Withdrawal.** Staff can refuse an approval that stands. That is how one is
  withdrawn, and the next step the organisation tries is refused. The staff queue
  lists every approval that stands, not only those ending soon, so one can be found
  at any point in its year; withdrawing one withdraws every approval the
  organisation holds, so a renewal approved beside it does not keep it placing
  apprentices.
- **Conflict.** A member of staff who belongs to the organisation does not decide
  its attestation. Two reviewers deciding at once cannot both win.
- **Who reviews.** Today only the `ADMIN` role reviews attestations, as it does
  badges. **[FOUNDER]** decide whether a narrower staff role should.

## What ATHENA shows applicants

Every apprenticeship listing, and its card, detail page and apply form, says
whether its host has been checked:

- **Safety-checked host**: verified, with an approved attestation. The text says
  what that is, and that it is the host's own statement.
- **Not yet safety-checked**: shown honestly, not hidden. The seeded catalogue
  names training providers nobody here has checked; an honest label serves a
  visitor better than an empty page. Applications through ATHENA are not open until
  the host has been checked.

The label never says "approved", "safe" or "guaranteed", and never says anyone's
police or background check was run.

## What ATHENA does not check, and why

ATHENA does **not** collect, hold, see or ask for an individual's police check,
criminal history, Blue Card or other working-with-children check, or any
background check, of any member of a host's staff.

Reasons:

- A criminal record is **sensitive information** under section 6 of the Privacy
  Act 1988 (Cth). Collecting it needs the individual's consent, the information
  has to be reasonably necessary for ATHENA's functions, and ATHENA would then hold
  it and have to protect it (Australian Privacy Principle 3 and the principles
  that follow). None of that is built, so none is claimed anywhere in the product.
- Police checks are normally obtained through an accredited police-check provider,
  by the person concerned, for the organisation that needs them. The organisation
  that employs the apprentice is the one with the relationship and the lawful
  basis. A platform in the middle adds risk and no safety.
- Working-with-children screening is run by the state or territory (in Queensland,
  Blue Card Services). Whether and when it applies to an apprentice's employer
  depends on the work and the apprentice's age. The attestation records that the
  organisation will meet its obligations; ATHENA does not verify individual cards.

The same applies to staff. They must not ask a host for the checks of its people,
and must not record them if offered. If a host sends one, say it is not needed and
do not keep it.

**[COUNSEL]** Confirm: (a) that organisation-level facts are all that is lawful
and proportionate for ATHENA to collect; (b) the wording of the seven statements,
including statement 7 against the relevant state working-with-children law and
the state laws on young workers; (c) whether the small business exemption or any
state apprenticeship law changes what ATHENA may say to members about a host.
Until then this policy describes the system as built, not a legal opinion.

## Housing providers

The same pattern applies to people who offer DV-safe, emergency and transitional
places (`housing-provider.service.ts`). A place can show as "Checked by ATHENA
staff" only while its lister holds an approved provider check, which expires after
a year, and staff record what they checked on every approval. No police or
background check is collected there either, for the same reasons. Whether ATHENA
should ever check landlords or housing providers more deeply, and by what lawful
means, is a question for counsel before it is a feature. **[COUNSEL]**

## Where it lives in the code

Cited by file name, so a rename breaks this sentence rather than a link:
`host-safety.service.ts` (statements, submission, decision),
`hiring-access.service.ts` (`hostMayPlaceApprentices`, `hostStandings`,
`withHostStanding`, `assertHostMayPlaceApprentices`), `apprenticeship.routes.ts`
(the five gates and the labels on every list and detail), `verification.routes.ts`
(`/host-safety/:orgId`, `/host-safety-queue`, `/host-safety-attestations/:id`),
and the screens: the host panel on an organisation's apprenticeships page, the
staff review under `/admin/host-safety`, and the label on the apprenticeship card,
detail page and apply form. The tables are in the migration
`20261001100000_housing_provider_and_host_employer_checks`.
