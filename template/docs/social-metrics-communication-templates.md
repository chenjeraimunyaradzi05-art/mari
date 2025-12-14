# Social Metrics Communication Templates

Use these snippets when creating Asana tasks or sending calendar invites. Replace bracketed placeholders.

## Asana Task Templates

### Task: Send Workshop Kit

**Title**: Prep & Distribute Social Metrics Workshop Kit (T-2)
**Description**:

```text
Share the latest discovery brief, interaction spec, wireframes, and co-design plan ahead of the Connections Hub workshop.

Checklist:
- Attach links:
  - docs/social-metrics-discovery-brief.md
  - docs/social-metrics-interaction-spec.md
  - docs/social-metrics-wireframes.md
  - docs/social-metrics-codesign-plan.md
- Post in Social Graph Slack + Asana thread requesting acknowledgements.
- Confirm receipt from PM, UX, Eng, Data partners.
```

### Task: Build Low-Fi Prototype

**Title**: Deliver Low-Fi Wireframes & Clickable Prototype
**Description**:

```text
Within one sprint day, translate co-design outputs into Figma frames + clickable flow.

Requirements:
- Persona panel, admin dashboard, ETL monitor screens.
- Annotate data bindings (SocialMetricsDaily fields, API params) and privacy cues.
- Enable commenting and mention PM/Eng for async review.
```

### Task: Pilot Validation

**Title**: Run Pilot Mentor/Member Validation
**Description**:

```text
Host two 30-min validation calls using Figma prototype.

Steps:
1. Recruit 2 mentors + 2 members (ensure NDAs as needed).
2. Capture screen/notes on invite funnel, civility trend, heatmap usability.
3. Summarize insights + decisions in product spec.
```

### Task: Service Refactor Test Coverage

**Title**: Add Verification & Messaging Regression Tests
**Description**:

```text
Before rollout, extend PHPUnit coverage for verification workflows and civility/messaging services.
- Cover referral code + privacy audit flows.
- Assert SocialMetricsAggregationService counts invites/messages/incidents correctly.
- Include command test for social:metrics-daily with persona + force flags.
```

## Calendar Invite Templates

### Invite: Co-Design Workshop (90 min)

_Subject_: Connections Hub Co-Design Workshop
_Body_:

```text
Goal: Align PM, UX, and Engineering on must-have Connections Hub components and admin dashboards before ETL/API build.

Agenda highlights:
1. Context + metrics recap
2. Fact-table walkthrough
3. Co-design breakout (Hub + filters)
4. Admin dashboard mapping
5. Privacy/accessibility cues
6. Action review

Pre-read links:
- discovery brief
- interaction spec
- wireframes
- co-design plan

Collaboration tools: [Zoom link], [FigJam link]
Please review docs before the session and come with open questions.
```

### Invite: Prototype Review (30 min)

_Subject_: Social Metrics Prototype Walkthrough
_Body_:

```text
Purpose: Review low-fidelity Connections Hub + admin dashboard prototype and capture blocking feedback.

Includes:
- Persona panel cards + heatmap
- Invite funnel + civility annotations
- ETL monitor stub

Please drop async comments in Figma beforehand; we’ll focus on unresolved items.
```

### Invite: Sign-Off Checkpoint (30 min)

_Subject_: Social Metrics Sign-Off & Engineering Kickoff Gate
_Body_:

```text
Agenda:
1. Recap pilot validation outcomes
2. Confirm UX accessibility checks
3. PM go/no-go for KPIs
4. Engineering readiness + next steps

Outcome: Formal approval to start implementation.
```

### Invite: Pilot Sessions (Mentor/Member)

_Subject_: Connections Hub Prototype Feedback Session
_Body_:

```text
Thanks for volunteering! We’ll walk through the new Connections Hub insights prototype and gather your feedback on invites, civility, and activity views. Session is recorded for internal review only.

Please join via [link]; no prep required beyond your experience using the current hub.
```
