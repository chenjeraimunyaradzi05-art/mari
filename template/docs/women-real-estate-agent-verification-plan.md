# Women Real Estate Platform — Agent Verification Workflow Plan (Step 13)

## 1. Goals

- Build a rigorous yet empathetic verification experience for licensed female agents.
- Safeguard platform integrity through layered checks, audits, and compliance tooling.
- Automate repeatable flows while keeping human oversight for sensitive decisions.

## 2. User Journey Breakdown

1. **Application Intake**
   - Livewire wizard capturing personal details, license data, regulator selection, supporting documents, references.
   - Optional AI assistant guiding documentation requirements and answering onboarding questions.
   - Auto-save drafts, resume links, and reminders.

2. **Automated Screening**
   - Run `WomenVerificationService` to validate license number format, expiration, regulator alignment.
   - Integrate `FraudDetectionService` heuristic scoring (duplicate submissions, suspicious IP, mismatched names).
   - AI summarises submission for reviewer (documents, risk flags, recommended follow-ups).

3. **Manual Review**
   - Reviewer console (`admin/verification/index.blade.php`) displays queue with risk scoring, AI digest, timeline.
   - Actions: approve, reject, request more information, escalate to compliance.
   - Each decision creates `WomenAgentVerificationAudit` record with notes and AI summary snapshot.

4. **Decision & Activation**
   - On approval: mark `WomenVerifiedAgent` status, set `verified_at`, issue trust badge, send onboarding email with resources.
   - On rejection: capture reasons, send empathetic guidance, allow resubmission with supporting materials.
   - On request for info: open `pending_information` state, notify applicant, track SLA.

5. **Monitoring & Reverification**
   - Scheduled job checks `license_expires_at`, sends upcoming expiry reminders (90/30/7 days), auto-suspends on lapse.
   - Random spot checks to maintain compliance — triggers review audit record.
   - Agents can update credentials via dashboard; changes go through fast-track review.

## 3. Technical Components

- **Livewire Components**: `Livewire\Agents\VerificationWizard`, `Livewire\Agents\DocumentUploader`, `Livewire\Admin\VerificationQueue`.
- **Services**: `WomenVerificationService`, `LicenseRegulatorLookupService`, `AgentDocumentStorageService`, `AgentNotificationService`.
- **Jobs**: `ProcessAgentVerificationJob`, `SendVerificationReminderJob`, `ReverifyExpiredAgentJob`.
- **Policies/Middleware**: `EnsureVerifiedAgent` gate for sensitive routes; policy updates from Step 08.
- **Storage**: encrypted file storage for documents, hashed metadata, retention policy.

## 4. AI & Automation

- AI summarises document packets, highlights anomalies, and suggests next steps to reviewers.
- AI tone guidelines: professional, supportive, bias-aware, emphasising women-centric empowerment.
- Confidence thresholds to ensure low-confidence AI guidance prompts human double-check.
- Observability: log AI inference IDs in audit records for traceability.

## 5. Notifications & Communication

- Email + in-app messaging at each status change.
- SMS optional for reminders if agent opts in.
- Provide educational content (videos, articles) linking to regulatory resources and community best practices.

## 6. Compliance & Security

- Encrypt sensitive data; restrict access via role-based permissions.
- Maintain regulator audit trail (exportable reports of agent verification history).
- Document retention aligned with local laws; secure deletion path on request.
- WCAG-compliant forms with plain-language instructions.

## 7. Analytics & KPIs

- Measure verification SLA, approval rate, re-verification compliance, user satisfaction survey results.
- Track drop-off points in wizard to improve UX.
- Monitor fraud flags and escalations to calibrate heuristics.

## 8. Testing Strategy

- Feature tests covering complete flow (apply → review → approve/reject/request info).
- Livewire component tests for wizard validation, dynamic steps, file uploads.
- Policy tests to ensure only authorised reviewers can access console/actions.
- Queue/job tests verifying reminders and auto-suspension logic.
- Security tests simulating malicious uploads or tampered documents.

## 9. Rollout Plan

- Pilot with internal or partner agents; gather feedback on clarity and empathy of comms.
- Enable feature flag per region/regulator.
- Prepare support playbooks for customer service teams to handle escalation.

## 10. Open Questions

- Which regulator APIs will be available at launch vs. manual lookup?
- Do we need multilingual support for verification wizard now?
- Should we integrate video verification (live call) for high-risk cases?
- How to handle cross-border licenses (agent operating in multiple states/countries)?
